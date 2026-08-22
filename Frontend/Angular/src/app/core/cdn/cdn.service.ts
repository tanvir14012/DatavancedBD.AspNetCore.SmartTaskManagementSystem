import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../http/api.service';
import {
  AssetMetadata,
  SecureLinkToken,
  SignedUrlRequest,
  UploadSession,
  InvalidateCacheRequest,
  InvalidateCacheResult,
} from '../../shared/models/cdn.models';

/**
 * Provides access to all CDN management endpoints exposed by the backend
 * `Usm.Shared.Infrastructure.CDN` library.
 *
 * Base path: `cdn/v1/`  (routed through the API gateway → Kestrel)
 * Nginx serves actual asset bytes; this service handles the metadata /
 * control plane (signed URLs, cache invalidation, upload status).
 */
@Injectable({ providedIn: 'root' })
export class CdnService {
  private readonly api = inject(ApiService);
  private readonly base = 'cdn/v1';

  // ── Asset Metadata ──────────────────────────────────────────────────────────

  /**
   * Retrieves cached metadata for an asset (key, size, ETag, content-type …).
   * Results are backed by the Redis `cdn:meta:{key}` cache on the server side.
   */
  getMetadata(assetKey: string): Observable<AssetMetadata> {
    return this.api.get<AssetMetadata>(
      `${this.base}/assets/${encodeURIComponent(assetKey)}/metadata`,
    );
  }

  /**
   * Lists all assets inside a given bucket prefix.
   * Returns paged result of asset keys and metadata summaries.
   */
  listAssets(
    bucketOrPrefix: string,
    page = 1,
    pageSize = 50,
  ): Observable<{ items: AssetMetadata[]; totalCount: number }> {
    return this.api.get(`${this.base}/assets`, {
      prefix: bucketOrPrefix,
      page: String(page),
      pageSize: String(pageSize),
    });
  }

  // ── Secure Link Generation ──────────────────────────────────────────────────

  /**
   * Requests a signed CDN URL for an asset.  The server generates the
   * Nginx-compatible MD5 token and returns the full signed URL.
   */
  getSignedUrl(request: SignedUrlRequest): Observable<SecureLinkToken> {
    return this.api.post<SecureLinkToken>(`${this.base}/assets/signed-url`, request);
  }

  // ── Cache Invalidation ──────────────────────────────────────────────────────

  /**
   * Invalidates the server-side Redis cache for an asset.
   * Triggers a pub/sub broadcast so all edge nodes drop their copies.
   */
  invalidateAsset(request: InvalidateCacheRequest): Observable<InvalidateCacheResult> {
    return this.api.post<InvalidateCacheResult>(`${this.base}/cache/invalidate`, request);
  }

  /**
   * Invalidates all cached assets matching a key prefix.
   */
  invalidateByPrefix(prefix: string): Observable<InvalidateCacheResult> {
    return this.api.post<InvalidateCacheResult>(`${this.base}/cache/invalidate-prefix`, { prefix });
  }

  // ── Upload Management ───────────────────────────────────────────────────────

  /**
   * Retrieves the current status of an in-progress or completed upload session.
   */
  getUploadStatus(uploadId: string): Observable<UploadSession> {
    return this.api.get<UploadSession>(`${this.base}/upload/${uploadId}/status`);
  }

  /**
   * Aborts an in-progress upload and releases all partial chunks.
   */
  abortUpload(uploadId: string): Observable<void> {
    return this.api.delete<void>(`${this.base}/upload/${uploadId}`);
  }
}
