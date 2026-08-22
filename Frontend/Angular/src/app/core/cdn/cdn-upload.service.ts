import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable, Subject, concat, from, of, throwError } from 'rxjs';
import { catchError, concatMap, filter, map, switchMap, takeUntil, tap } from 'rxjs/operators';
import { environment } from '../../../../environments/environment';
import {
  InitiateUploadRequest,
  UploadChunkResult,
  UploadSession,
  CdnUploadProgress,
  UploadStatus,
} from '../../shared/models/cdn.models';

/** Default chunk size: 5 MB — minimum required by S3 multipart upload. */
const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024;

/**
 * Manages chunked multipart CDN uploads.
 *
 * Usage:
 * ```ts
 * cdnUpload.upload$(file).subscribe(progress => console.log(progress.percent));
 * ```
 */
@Injectable({ providedIn: 'root' })
export class CdnUploadService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiGatewayUrl}/cdn/v1/upload`;

  /**
   * High-level upload observable.  Orchestrates initiate → chunk → finalize → poll.
   *
   * Emits `CdnUploadProgress` events throughout; completes when the server
   * confirms `Completed` status (including after the async scan phase).
   *
   * @param file          The `File` object to upload.
   * @param options       Optional overrides (targetKey, chunkSize).
   * @param cancel$       Optional Subject; emitting any value aborts the upload.
   */
  upload$(
    file: File,
    options: { targetKey?: string; chunkSize?: number } = {},
    cancel$?: Subject<void>,
  ): Observable<CdnUploadProgress> {
    const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;

    return this.initiate({
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      totalSize: file.size,
      targetKey: options.targetKey,
    }).pipe(
      switchMap((session) =>
        this.uploadChunks$(file, session, chunkSize, cancel$).pipe(
          switchMap((progress) => {
            if (progress.status !== 'InProgress') return of(progress);

            // All chunks done — finalize
            return this.finalize(session.uploadId).pipe(
              switchMap((finalSession) => this.pollUntilDone$(finalSession.uploadId)),
              map((doneSession) => toProgress(doneSession, file.size)),
            );
          }),
        ),
      ),
    );
  }

  // ── Low-level methods (usable individually) ────────────────────────────────

  initiate(request: InitiateUploadRequest): Observable<UploadSession> {
    return this.http.post<UploadSession>(`${this.base}/initiate`, request);
  }

  uploadChunk(uploadId: string, chunkIndex: number, chunk: Blob): Observable<UploadChunkResult> {
    const formData = new FormData();
    formData.append('chunk', chunk, `chunk-${chunkIndex}`);
    return this.http.put<UploadChunkResult>(
      `${this.base}/${uploadId}/chunk/${chunkIndex}`,
      formData,
    );
  }

  finalize(uploadId: string): Observable<UploadSession> {
    return this.http.post<UploadSession>(`${this.base}/${uploadId}/finalize`, {});
  }

  abort(uploadId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${uploadId}`);
  }

  pollStatus(uploadId: string): Observable<UploadSession> {
    return this.http.get<UploadSession>(`${this.base}/${uploadId}/status`);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private uploadChunks$(
    file: File,
    session: UploadSession,
    chunkSize: number,
    cancel$?: Subject<void>,
  ): Observable<CdnUploadProgress> {
    const totalChunks = Math.ceil(file.size / chunkSize);
    let bytesUploaded = 0;

    const chunkObservables = Array.from({ length: totalChunks }, (_, i) => {
      const start = i * chunkSize;
      const chunk = file.slice(start, start + chunkSize);

      return this.chunkWithProgress$(session.uploadId, i, chunk, file.size).pipe(
        tap((progress) => {
          bytesUploaded = progress.bytesUploaded;
        }),
        map((progress) => ({ ...progress, uploadId: session.uploadId }) as CdnUploadProgress),
      );
    });

    let stream = concat(...chunkObservables);
    if (cancel$) {
      stream = stream.pipe(
        takeUntil(cancel$),
        // Abort on cancel
        catchError((err) => {
          this.abort(session.uploadId).subscribe();
          return throwError(() => err);
        }),
      );
    }

    return stream;
  }

  private chunkWithProgress$(
    uploadId: string,
    chunkIndex: number,
    chunk: Blob,
    totalBytes: number,
  ): Observable<CdnUploadProgress> {
    const formData = new FormData();
    formData.append('chunk', chunk, `chunk-${chunkIndex}`);

    const req = new HttpRequest('PUT', `${this.base}/${uploadId}/chunk/${chunkIndex}`, formData, {
      reportProgress: true,
    });

    let chunkBase = chunkIndex * chunk.size;

    return this.http.request<UploadChunkResult>(req).pipe(
      filter(
        (event) =>
          event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response,
      ),
      map((event) => {
        if (event.type === HttpEventType.UploadProgress) {
          const loaded = chunkBase + (event.loaded ?? 0);
          return buildProgress(uploadId, 'InProgress', loaded, totalBytes);
        }
        // Response — chunk complete
        return buildProgress(uploadId, 'InProgress', chunkBase + chunk.size, totalBytes);
      }),
    );
  }

  private pollUntilDone$(
    uploadId: string,
    intervalMs = 1500,
    maxPolls = 120,
  ): Observable<UploadSession> {
    let polls = 0;

    const poll$: Observable<UploadSession> = this.pollStatus(uploadId).pipe(
      switchMap((session) => {
        const terminal: UploadStatus[] = ['Completed', 'Failed', 'Aborted'];
        if (terminal.includes(session.status) || ++polls >= maxPolls) {
          return of(session);
        }
        return from(new Promise<void>((resolve) => setTimeout(resolve, intervalMs))).pipe(
          switchMap(() => poll$),
        );
      }),
    );

    return poll$;
  }
}

function buildProgress(
  uploadId: string,
  status: UploadStatus,
  bytesUploaded: number,
  totalBytes: number,
): CdnUploadProgress {
  return {
    uploadId,
    status,
    percent: totalBytes > 0 ? Math.round((bytesUploaded / totalBytes) * 100) : 0,
    bytesUploaded,
    totalBytes,
  };
}

function toProgress(session: UploadSession, totalBytes: number): CdnUploadProgress {
  return {
    uploadId: session.uploadId,
    status: session.status,
    percent: session.status === 'Completed' ? 100 : 0,
    bytesUploaded: session.status === 'Completed' ? totalBytes : 0,
    totalBytes,
    finalAssetKey: session.finalAssetKey,
    error: session.errorMessage,
  };
}
