import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LookupItem } from '../models/lookup.model';

/**
 * Translates a lookup item's name based on the current language.
 *
 * Usage: {{ department | translateLookup }}
 *        {{ departmentId | translateLookup: departments }}
 */
@Pipe({ name: 'translateLookup', standalone: true, pure: false })
export class TranslateLookupPipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(value: LookupItem | string | null, items?: LookupItem[]): string {
    if (!value) return '';

    // If a lookup list is provided, resolve by ID
    if (typeof value === 'string' && items) {
      const found = items.find((i) => String(i.id) === value);
      return found ? this._name(found) : value;
    }

    if (typeof value === 'object') {
      return this._name(value);
    }

    return String(value);
  }

  private _name(item: LookupItem): string {
    const lang = this.translate.currentLang ?? 'en';
    return lang === 'ar' ? item.nameAr : item.nameEn;
  }
}
