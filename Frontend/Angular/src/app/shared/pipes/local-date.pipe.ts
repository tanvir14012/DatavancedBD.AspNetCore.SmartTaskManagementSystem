import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { formatDate } from '../utils/date.utils';

@Pipe({ name: 'localDate', standalone: true, pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly translate = inject(TranslateService);

  transform(value: string | null | undefined, pattern?: string): string {
    const lang = this.translate.currentLang ?? 'en';
    return formatDate(value, pattern, lang);
  }
}
