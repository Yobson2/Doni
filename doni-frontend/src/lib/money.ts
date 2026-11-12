import Big from 'big.js'
import type { components } from '@/api/schema'

/**
 * Money for display (ADR 0005, 0008). Every amount arrives from the API as
 * an exact decimal string in XOF, the stored currency. A user may choose to
 * see amounts in EUR: they are converted here, at display time only, at the
 * fixed peg rate, with a decimal library so no float arithmetic touches them.
 *
 * Display rounding rules: XOF amounts to the whole franc (XOF has no minor
 * unit in practice); EUR amounts to the cent, half up from the exact
 * conversion; a PMP to 2 decimal places in either currency.
 */

export type DisplayCurrency = components['schemas']['DisplayCurrency']

/** XOF per EUR, fixed by treaty: it never floats. */
export const PEG_RATE = '655.957'

/**
 * A private big.js: division rounds to 30 decimal places, half even, as in
 * the backend engine; nothing else here rounds until display.
 */
const Decimal = Big()
Decimal.DP = 30
Decimal.RM = Big.roundHalfEven
Decimal.strict = true

/** An XOF amount in EUR at the peg rate, as an exact decimal string. */
export function xofToEur(xof: string): string {
  return new Decimal(xof).div(new Decimal(PEG_RATE)).toFixed()
}

const CENTS = 2

/** The amount, rounded for display in that currency, as a decimal string. */
function inCurrency(xof: string, currency: DisplayCurrency): string {
  if (currency === 'XOF') return xof
  return new Decimal(xofToEur(xof)).round(CENTS, Big.roundHalfUp).toFixed(CENTS)
}

const format = (
  xof: string,
  currency: DisplayCurrency,
  language: string,
  options: Intl.NumberFormatOptions = {}
) =>
  // Intl formats a numeric string exactly (no conversion to a float).
  new Intl.NumberFormat(language, {
    style: 'currency',
    currency,
    ...options,
  }).format(inCurrency(xof, currency) as unknown as number)

/** An amount, e.g. "377 100 F CFA" / "574,89 €". */
export function formatAmount(
  xof: string,
  currency: DisplayCurrency,
  language: string
): string {
  return format(xof, currency, language)
}

/** A gain or loss with its sign, e.g. "+6 255 F CFA" / "-1,14 €". */
export function formatGain(
  xof: string,
  currency: DisplayCurrency,
  language: string
): string {
  return format(xof, currency, language, { signDisplay: 'exceptZero' })
}

/** A PMP, e.g. "4 120,50 F CFA" / "6,28 €". */
export function formatPmp(
  xof: string,
  currency: DisplayCurrency,
  language: string
): string {
  return format(xof, currency, language, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}
