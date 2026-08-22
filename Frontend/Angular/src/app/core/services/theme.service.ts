import { Injectable, Renderer2, RendererFactory2, inject, signal } from '@angular/core';

export type AppTheme = 'light' | 'dark';
export type ColorPalette = 'indigo' | 'blue' | 'teal' | 'purple' | 'rose';

const THEME_KEY = 'app_theme';
const PALETTE_KEY = 'app_palette';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly rendererFactory = inject(RendererFactory2);
  private readonly renderer: Renderer2;

  readonly theme = signal<AppTheme>((localStorage.getItem(THEME_KEY) as AppTheme) ?? 'light');
  readonly palette = signal<ColorPalette>(
    (localStorage.getItem(PALETTE_KEY) as ColorPalette) ?? 'indigo',
  );

  constructor() {
    this.renderer = this.rendererFactory.createRenderer(null, null);
    this._applyTheme(this.theme());
    this._applyPalette(this.palette());
  }

  toggleTheme(): void {
    this.setTheme(this.theme() === 'light' ? 'dark' : 'light');
  }

  setTheme(theme: AppTheme): void {
    this.theme.set(theme);
    localStorage.setItem(THEME_KEY, theme);
    this._applyTheme(theme);
  }

  setPalette(palette: ColorPalette): void {
    this.palette.set(palette);
    localStorage.setItem(PALETTE_KEY, palette);
    this._applyPalette(palette);
  }

  isDark(): boolean {
    return this.theme() === 'dark';
  }

  private _applyTheme(theme: AppTheme): void {
    const body = document.body;
    if (theme === 'dark') {
      this.renderer.addClass(body, 'dark');
      this.renderer.addClass(body, 'mat-app-background');
    } else {
      this.renderer.removeClass(body, 'dark');
    }
  }

  private _applyPalette(palette: ColorPalette): void {
    const body = document.body;
    // Remove previous palette classes
    const palettes: ColorPalette[] = ['indigo', 'blue', 'teal', 'purple', 'rose'];
    palettes.forEach((p) => this.renderer.removeClass(body, `palette-${p}`));
    this.renderer.addClass(body, `palette-${palette}`);
  }
}
