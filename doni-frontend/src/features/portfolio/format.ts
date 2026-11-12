/**
 * Display rounding for portfolio figures. The API sends exact decimal
 * strings (ADR 0005); they are rounded here, for display only, by Intl
 * straight from the string, so no float arithmetic touches them.
 *
 * Rules: amounts and gains to the whole franc (XOF has no minor unit in
 * practice); a PMP to 2 decimal places, since it is a per-share average.
 */

const format = (
  value: string,
  language: string,
  options: Intl.NumberFormatOptions
) =>
  new Intl.NumberFormat(language, {
    style: 'currency',
    currency: 'XOF',
    ...options,
  }).format(value as unknown as number)

/** A PMP, e.g. "4 120,50 F CFA". */
export function formatPmp(pmp: string, language: string): string {
  return format(pmp, language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/** A gain or loss with its sign, e.g. "+6 255 F CFA" / "-745 F CFA". */
export function formatGain(gain: string, language: string): string {
  return format(gain, language, { signDisplay: 'exceptZero' })
}

/** Whether a decimal string is negative, positive or zero, without parsing. */
export function signOf(value: string): -1 | 0 | 1 {
  if (value.startsWith('-')) return -1
  return /[1-9]/.test(value) ? 1 : 0
}
