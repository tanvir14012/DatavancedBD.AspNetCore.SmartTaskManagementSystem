import { format, formatDistanceToNow, isValid, parseISO, Locale } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';

const LOCALES: Record<string, Locale> = { en: enUS, ar };

export function formatDate(
  dateString: string | null | undefined,
  pattern = 'dd/MM/yyyy',
  lang = 'en',
): string {
  if (!dateString) return '';
  const date = parseISO(dateString);
  if (!isValid(date)) return dateString;
  return format(date, pattern, { locale: LOCALES[lang] ?? enUS });
}

export function formatDateTime(dateString: string | null | undefined, lang = 'en'): string {
  return formatDate(dateString, 'dd/MM/yyyy HH:mm', lang);
}

export function timeAgo(dateString: string | null | undefined, lang = 'en'): string {
  if (!dateString) return '';
  const date = parseISO(dateString);
  if (!isValid(date)) return dateString;
  return formatDistanceToNow(date, { addSuffix: true, locale: LOCALES[lang] ?? enUS });
}

export function toIsoString(date: Date): string {
  return date.toISOString();
}
