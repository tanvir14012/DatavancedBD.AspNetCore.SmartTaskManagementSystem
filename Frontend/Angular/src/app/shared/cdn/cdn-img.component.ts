import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnChanges,
  inject,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdnUrlPipe } from './cdn-url.pipe';
import { CdnTransformOptions } from '../models/cdn.models';

/**
 * A smart image component that renders a CDN-served asset with:
 * - On-the-fly transformation via query params (width, height, format, quality)
 * - Native lazy loading (`loading="lazy"`)
 * - Graceful error fallback to a configurable placeholder
 * - Emits `(loaded)` and `(error)` output events
 *
 * Usage:
 * ```html
 * <cdn-img
 *   assetKey="images/product.jpg"
 *   [width]="400"
 *   [format]="'webp'"
 *   [quality]="85"
 *   alt="Product photo"
 *   fallbackSrc="/assets/placeholder.png"
 *   (loaded)="onLoaded()"
 *   (error)="onError($event)"
 * />
 * ```
 */
@Component({
  selector: 'cdn-img',
  standalone: true,
  imports: [CommonModule, CdnUrlPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <img
      [src]="resolvedSrc()"
      [alt]="alt"
      [width]="width ?? null"
      [height]="height ?? null"
      [attr.loading]="lazy ? 'lazy' : null"
      [class]="cssClass"
      [style]="cssStyle"
      (load)="onLoad()"
      (error)="onImgError()"
    />
  `,
})
export class CdnImgComponent implements OnChanges {
  private readonly pipe = inject(CdnUrlPipe);

  /** CDN storage key, e.g. "images/photo.jpg" */
  @Input({ required: true }) assetKey!: string;

  // Transform params
  @Input() width?: number;
  @Input() height?: number;
  @Input() format?: CdnTransformOptions['format'];
  @Input() quality?: number;
  @Input() mode?: CdnTransformOptions['mode'];

  @Input() alt = '';
  @Input() lazy = true;
  /** URL shown if the CDN image fails to load. */
  @Input() fallbackSrc = '/assets/images/placeholder.png';
  @Input() cssClass = '';
  @Input() cssStyle = '';

  @Output() readonly loaded = new EventEmitter<void>();
  @Output() readonly error = new EventEmitter<Event>();

  private readonly _hasFailed = signal(false);

  readonly resolvedSrc = computed(() => {
    if (this._hasFailed()) return this.fallbackSrc;
    const options: CdnTransformOptions = {
      width: this.width,
      height: this.height,
      format: this.format,
      quality: this.quality,
      mode: this.mode,
    };
    return this.pipe.transform(this.assetKey, options);
  });

  ngOnChanges(): void {
    // Reset failure state when the asset key changes
    this._hasFailed.set(false);
  }

  onLoad(): void {
    this.loaded.emit();
  }

  onImgError(): void {
    this._hasFailed.set(true);
    this.error.emit(new Event('error'));
  }
}
