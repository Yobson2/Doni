/**
 * Display formatting for prices and trading days, in the active language
 * (ADR 0012). Prices arrive as decimal strings (ADR 0005) and are formatted
 * from the string, so no float arithmetic touches them.
 */

/** A trading day (YYYY-MM-DD) as a calendar date, independent of time zone. */
const asUtcDate = (day: string) => new Date(`${day}T00:00:00Z`)

/** "11 novembre 2026" / "November 11, 2026". */
export function formatLongDate(day: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(asUtcDate(day))
}

/** "11/11/2026". */
export function formatShortDate(day: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(asUtcDate(day))
}

/** An amount in XOF, e.g. "4 190 F CFA". */
export function formatXof(amount: string, language: string): string {
  // Intl formats a numeric string exactly (no conversion to a float).
  return new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'XOF',
  }).format(amount as unknown as number)
}

/** A quantity such as a traded volume, e.g. "85 624". */
export function formatQuantity(quantity: string, language: string): string {
  return new Intl.NumberFormat(language).format(quantity as unknown as number)
}
