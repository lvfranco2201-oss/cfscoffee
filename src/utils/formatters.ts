/**
 * Shared formatting utilities — CFSCoffee BI
 */

/**
 * Removes "CFS Coffee" prefix noise and normalises store names.
 * "CFS Coffee - Colonia 3" → "Colonia 3"
 * "CFS Coffee - LC - Centro" → "Centro"
 */
export function cleanStoreName(val: string | null | undefined): string {
  if (!val) return '—';
  let clean = val.replace(/CFS Coffee/gi, '').trim();
  if (clean.startsWith('-')) clean = clean.substring(1).trim();
  const parts = clean.split('-').map((p) => p.trim()).filter(Boolean);
  clean = parts.length > 1 && parts[0].length <= 4 ? parts[1] : parts[0];
  return clean && clean.length > 20 ? clean.substring(0, 20) + '…' : clean || val;
}

/**
 * Formats a number as USD with optional decimals.
 * fmt(1234.5) → "$1,235"
 */
export function fmt(n: number, decimals = 0): string {
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Formats large numbers with K/M suffix.
 * fmtK(1500000) → "$1.5M"  |  fmtK(3200) → "$3.2K"
 */
export function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

/**
 * Formats a date string (YYYY-MM-DD) into a localised Spanish label.
 * "2026-04-11" → "viernes, 11 de abril de 2026"
 */
export function fmtDateLong(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
