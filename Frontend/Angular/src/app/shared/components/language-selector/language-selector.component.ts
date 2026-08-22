import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { environment } from '../../../../environments/environment';
import { LanguageService } from '../../../core/services/language.service';

type LanguageSelectorVariant = 'dark' | 'light';

@Component({
  selector: 'app-language-selector',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <label
      class="lang-select-wrap"
      [class.dark]="variant() === 'dark'"
      [class.light]="variant() === 'light'"
    >
      <span class="lang-label">{{ 'common.language' | translate }}</span>
      <select
        class="lang-select"
        [ngModel]="langSvc.currentLang()"
        (ngModelChange)="langSvc.use($event)"
        [attr.aria-label]="'common.language' | translate"
      >
        @for (lang of languages; track lang.code) {
          <option [value]="lang.code">{{ lang.short }} - {{ lang.labelKey | translate }}</option>
        }
      </select>
    </label>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .lang-select-wrap {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }
      .lang-label {
        font-size: 0.76rem;
        font-weight: 600;
        letter-spacing: 0.04em;
        white-space: nowrap;
      }
      .lang-select {
        border: 1px solid rgba(255, 255, 255, 0.25);
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
        border-radius: 6px;
        padding: 0.35rem 0.5rem;
        min-width: 110px;
        font-size: 0.78rem;
        font-family: 'Outfit', sans-serif;
        outline: none;
      }
      .lang-select:focus {
        border-color: rgba(255, 255, 255, 0.55);
      }
      .dark .lang-label {
        color: rgba(255, 255, 255, 0.75);
      }
      .light .lang-label {
        color: #4b5563;
      }
      .light .lang-select {
        border-color: rgba(17, 24, 39, 0.2);
        background: rgba(255, 255, 255, 0.9);
        color: #111827;
      }
      .light .lang-select:focus {
        border-color: #2d7a56;
      }
    `,
  ],
})
export class LanguageSelectorComponent {
  readonly langSvc = inject(LanguageService);
  readonly variant = input<LanguageSelectorVariant>('dark');

  readonly languages = environment.supportedLanguages.map((code) => ({
    code,
    short: code.slice(0, 2).toUpperCase(),
    labelKey: `languages.${code}`,
  }));
}
