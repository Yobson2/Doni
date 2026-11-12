/**
 * Display helpers for portfolio figures. The API sends exact decimal strings
 * (ADR 0005); amounts are formatted by `@/lib/money` in the user's display
 * currency, and nothing here parses a decimal into a float.
 */

/** Whether a decimal string is negative, positive or zero, without parsing. */
export function signOf(value: string): -1 | 0 | 1 {
  if (value.startsWith('-')) return -1
  return /[1-9]/.test(value) ? 1 : 0
}

/**
 * A percentage the API already rounded to one decimal place, e.g. "44.7"
 * as "44,7 %". Intl formats the string as is.
 */
export function formatPercent(percent: string, language: string): string {
  return new Intl.NumberFormat(language, {
    style: 'unit',
    unit: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(percent as unknown as number)
}
