'use client';

import { useTranslation } from '@/lib/i18n/LanguageContext';

/**
 * Returns the BCP-47 locale string for date formatting based on the active UI language.
 * - 'en' → 'en-US'
 * - 'es' (or anything else) → 'es-ES'
 *
 * Usage:
 *   const dateLocale = useDateLocale();
 *   const label = new Date(str + 'T12:00:00').toLocaleDateString(dateLocale, { ... });
 */
export function useDateLocale(): string {
  const { locale } = useTranslation();
  return locale === 'en' ? 'en-US' : 'es-ES';
}

/**
 * Utility: format an ISO date string (YYYY-MM-DD) into a long human-readable label.
 * Automatically switches between English and Spanish based on the locale argument.
 */
export function formatDateLong(dateStr: string, dateLocale: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(dateLocale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Utility: format an ISO date string (YYYY-MM-DD) into a short "Apr 12" label.
 */
export function formatDateShort(dateStr: string, dateLocale: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(dateLocale, {
    day: 'numeric',
    month: 'short',
  });
}
