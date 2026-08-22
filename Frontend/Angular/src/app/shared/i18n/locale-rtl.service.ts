import { DOCUMENT } from '@angular/common';
import {
  computed,
  effect,
  inject,
  Injectable,
  Renderer2,
  RendererFactory2,
  signal,
} from '@angular/core';

import { PlatformContextService } from '../ssr/platform-context.service';

export type Direction = 'ltr' | 'rtl';

@Injectable({
  providedIn: 'root',
})
export class LocaleRtlService {
  private static readonly rtlLanguages = new Set([
    'ar',
    'dv',
    'fa',
    'ha',
    'he',
    'ku',
    'ps',
    'ur',
    'yi',
  ]);

  private readonly documentRef = inject(DOCUMENT, { optional: true });
  private readonly rendererFactory = inject(RendererFactory2);
  private readonly platformContext = inject(PlatformContextService);
  private readonly renderer: Renderer2 = this.rendererFactory.createRenderer(null, null);
  private readonly localeSignal = signal('en');

  readonly currentLocale = computed(() => this.localeSignal());
  readonly currentDirection = computed<Direction>(() =>
    this.isRtlLocale(this.localeSignal()) ? 'rtl' : 'ltr',
  );

  constructor() {
    const doc = this.documentRef ?? this.platformContext.getDocument();
    const initialLang = doc?.documentElement.lang?.trim();
    if (initialLang) {
      this.localeSignal.set(this.normalizeLocale(initialLang));
    }

    effect(() => {
      const locale = this.currentLocale();
      const direction = this.currentDirection();
      this.applyRootAttributes(locale, direction);
    });
  }

  setLocale(locale: string): void {
    this.localeSignal.set(this.normalizeLocale(locale));
  }

  private applyRootAttributes(locale: string, direction: Direction): void {
    const doc = this.documentRef ?? this.platformContext.getDocument();
    const rootElement = doc?.documentElement;
    if (!rootElement) {
      return;
    }

    this.renderer.setAttribute(rootElement, 'lang', locale);
    this.renderer.setAttribute(rootElement, 'dir', direction);
  }

  private isRtlLocale(locale: string): boolean {
    const baseLanguage = locale.split('-')[0];
    return LocaleRtlService.rtlLanguages.has(baseLanguage);
  }

  private normalizeLocale(locale: string): string {
    return locale.trim().toLowerCase() || 'en';
  }
}
