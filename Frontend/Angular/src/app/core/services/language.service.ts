import { Injectable, Renderer2, RendererFactory2, inject, signal, effect } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { environment } from '../../../environments/environment';

export type AppLanguage = 'en' | 'ar' | string;
export type TextDirection = 'ltr' | 'rtl';

const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);
const LANG_KEY = 'app_language';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly rendererFactory = inject(RendererFactory2);
  private readonly renderer: Renderer2;

  readonly currentLang = signal<AppLanguage>(this._getStoredLang());
  readonly direction = signal<TextDirection>(
    RTL_LANGUAGES.has(this._getStoredLang()) ? 'rtl' : 'ltr',
  );

  constructor() {
    this.renderer = this.rendererFactory.createRenderer(null, null);
    this.translate.addLangs(environment.supportedLanguages);
    this.translate.setDefaultLang(environment.defaultLanguage);

    effect(() => {
      const lang = this.currentLang();
      const dir: TextDirection = RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';
      this.direction.set(dir);
      this._applyToDocument(lang, dir);
    });

    this.use(this.currentLang());
  }

  use(lang: AppLanguage): void {
    this.translate.use(lang);
    localStorage.setItem(LANG_KEY, lang);
    this.currentLang.set(lang);
  }

  isRtl(): boolean {
    return this.direction() === 'rtl';
  }

  private _getStoredLang(): AppLanguage {
    return localStorage.getItem(LANG_KEY) ?? environment.defaultLanguage;
  }

  private _applyToDocument(lang: string, dir: TextDirection): void {
    const html = document.documentElement;
    this.renderer.setAttribute(html, 'lang', lang);
    this.renderer.setAttribute(html, 'dir', dir);
    this.renderer.setStyle(document.body, 'direction', dir);

    if (dir === 'rtl') {
      this.renderer.addClass(document.body, 'rtl');
      this.renderer.removeClass(document.body, 'ltr');
    } else {
      this.renderer.addClass(document.body, 'ltr');
      this.renderer.removeClass(document.body, 'rtl');
    }
  }
}
