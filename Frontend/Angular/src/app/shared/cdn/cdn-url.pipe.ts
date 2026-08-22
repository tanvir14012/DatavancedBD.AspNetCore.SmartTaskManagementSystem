import { Pipe, PipeTransform, inject } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { CdnTransformOptions } from '../models/cdn.models';

/**
 * Transforms a CDN asset key into a full CDN URL with optional image
 * transformation parameters understood by the backend `AdaptiveImageProcessor`.
 *
 * Usage:
 * ```html
 * <img [src]="'images/hero.jpg' | cdnUrl" />
 * <img [src]="'images/hero.jpg' | cdnUrl:{ width: 800, format: 'webp', quality: 80 }" />
 * ```
 *
 * Transformation params map to backend query params:
 *   w  → width   h  → height   fmt → format   q  → quality   mode → resize mode
 */
@Pipe({ name: 'cdnUrl', standalone: true })
export class CdnUrlPipe implements PipeTransform {
  private readonly base = environment.cdnBaseUrl;

  transform(assetKey: string | null | undefined, options?: CdnTransformOptions): string {
    if (!assetKey) return '';

    // Normalise: remove leading slash to avoid double-slash
    const key = assetKey.startsWith('/') ? assetKey.slice(1) : assetKey;
    const url = new URL(`${this.base}/${key}`);

    if (options) {
      if (options.width != null) url.searchParams.set('w', String(options.width));
      if (options.height != null) url.searchParams.set('h', String(options.height));
      if (options.format) url.searchParams.set('fmt', options.format);
      if (options.quality != null) url.searchParams.set('q', String(options.quality));
      if (options.mode) url.searchParams.set('mode', options.mode);
    }

    return url.toString();
  }
}
