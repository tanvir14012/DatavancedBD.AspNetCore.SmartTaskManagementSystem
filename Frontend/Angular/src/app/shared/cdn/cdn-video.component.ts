import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  inject,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdnUrlPipe } from './cdn-url.pipe';

/**
 * A CDN-aware `<video>` wrapper that supports:
 * - Native byte-range streaming (MP4, WebM) — the browser handles range requests
 * - HLS playlist streaming (`.m3u8`) via the browser's native HLS support
 *   (Safari / iOS) or a dynamic hls.js import on browsers without native support
 * - Graceful fallback when the asset key is empty
 *
 * Usage:
 * ```html
 * <cdn-video
 *   assetKey="videos/demo.mp4"
 *   [controls]="true"
 *   [autoplay]="false"
 *   [muted]="true"
 *   poster="images/poster.jpg"
 *   (ready)="onVideoReady()"
 *   (playbackError)="onPlaybackError($event)"
 * />
 * ```
 */
@Component({
  selector: 'cdn-video',
  standalone: true,
  imports: [CommonModule, CdnUrlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <video
      #videoEl
      [src]="isHls ? undefined : resolvedSrc"
      [controls]="controls"
      [autoplay]="autoplay"
      [muted]="muted || autoplay"
      [loop]="loop"
      [poster]="resolvedPoster"
      [attr.preload]="preload"
      [width]="width ?? null"
      [height]="height ?? null"
      [class]="cssClass"
      [style]="cssStyle"
      playsinline
      (loadedmetadata)="onReady()"
      (error)="onVideoError($event)"
    >
      Your browser does not support the video tag.
    </video>
  `,
})
export class CdnVideoComponent implements AfterViewInit, OnDestroy {
  private readonly cdnPipe = inject(CdnUrlPipe);
  private hlsInstance: unknown = null;

  @ViewChild('videoEl') videoEl!: ElementRef<HTMLVideoElement>;

  /** CDN storage key, e.g. "videos/demo.mp4" or "videos/hls/stream.m3u8" */
  @Input({ required: true }) assetKey!: string;
  /** Optional CDN key for the poster image */
  @Input() posterKey?: string;

  @Input() controls = true;
  @Input() autoplay = false;
  @Input() muted = false;
  @Input() loop = false;
  @Input() preload: 'none' | 'metadata' | 'auto' = 'metadata';
  @Input() width?: number;
  @Input() height?: number;
  @Input() cssClass = '';
  @Input() cssStyle = '';

  @Output() readonly ready = new EventEmitter<void>();
  @Output() readonly playbackError = new EventEmitter<Event>();

  get resolvedSrc(): string {
    return this.cdnPipe.transform(this.assetKey);
  }

  get resolvedPoster(): string {
    return this.posterKey ? this.cdnPipe.transform(this.posterKey) : '';
  }

  get isHls(): boolean {
    return this.assetKey?.toLowerCase().endsWith('.m3u8') ?? false;
  }

  async ngAfterViewInit(): Promise<void> {
    if (this.isHls) {
      await this.initHls();
    }
  }

  ngOnDestroy(): void {
    this.destroyHls();
  }

  onReady(): void {
    this.ready.emit();
  }

  onVideoError(event: Event): void {
    this.playbackError.emit(event);
  }

  // ── HLS support ─────────────────────────────────────────────────────────────

  private async initHls(): Promise<void> {
    const video = this.videoEl?.nativeElement;
    if (!video) return;

    // Safari and iOS support HLS natively
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = this.resolvedSrc;
      return;
    }

    // Dynamically import hls.js only when needed (code-split / lazy)
    try {
      const Hls = await this.loadHlsJs();
      if (!Hls || !Hls.isSupported()) {
        console.warn('[CdnVideo] HLS not supported in this browser');
        return;
      }

      const hls = new Hls({ startLevel: -1 });
      hls.loadSource(this.resolvedSrc);
      hls.attachMedia(video);
      this.hlsInstance = hls;
    } catch (err) {
      console.error('[CdnVideo] Failed to load hls.js', err);
    }
  }

  /** Attempts to dynamically import hls.js. Returns null if not installed. */
  private async loadHlsJs(): Promise<{ new (): unknown; isSupported: () => boolean } | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await import('hls.js' as any);
      return mod?.default ?? mod;
    } catch {
      return null;
    }
  }

  private destroyHls(): void {
    if (
      this.hlsInstance &&
      typeof (this.hlsInstance as { destroy?: () => void }).destroy === 'function'
    ) {
      (this.hlsInstance as { destroy: () => void }).destroy();
      this.hlsInstance = null;
    }
  }
}
