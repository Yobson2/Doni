import { useTranslation } from 'react-i18next'

/** Fixed CFA franc / euro parity (1 EUR = 655.957 XOF). */
export const XOF_PER_EUR = 655.957

export type Currency = 'XOF' | 'EUR'

export interface Buy {
  quantity: number
  price: number
}

export interface PositionInput {
  buys: Buy[]
  /** Net dividend per share, paid on every share held. */
  dividendPerShare: number
  lastClose: number
}

/**
 * The arithmetic Doni runs for a position, simplified for the landing page
 * (no fees, no sells): weighted average cost (PMP), unrealised gain, and
 * return including dividends.
 */
export function computePosition({
  buys,
  dividendPerShare,
  lastClose,
}: PositionInput) {
  const shares = buys.reduce((sum, b) => sum + b.quantity, 0)
  const invested = buys.reduce((sum, b) => sum + b.quantity * b.price, 0)
  const avgCost = shares > 0 ? invested / shares : 0
  const value = shares * lastClose
  const unrealised = value - invested
  const dividends = shares * dividendPerShare
  const ratio = (n: number) => (invested > 0 ? n / invested : 0)

  return {
    shares,
    invested,
    avgCost,
    value,
    unrealised,
    dividends,
    unrealisedPct: ratio(unrealised),
    dividendsPct: ratio(dividends),
    totalReturnPct: ratio(unrealised + dividends),
  }
}

/** The worked example shown in the hero and as the calculator's start state. */
export const EXAMPLE_POSITION: PositionInput = {
  buys: [
    { quantity: 20, price: 15_000 },
    { quantity: 10, price: 18_000 },
  ],
  dividendPerShare: 900,
  lastClose: 17_500,
}

/** Locale-aware money / percent formatters that follow the active language. */
export function useFormatters() {
  const { i18n } = useTranslation()
  const locale = i18n.resolvedLanguage === 'fr' ? 'fr-FR' : 'en-GB'

  const number = (n: number, digits = 0) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(n)

  const money = (xof: number, currency: Currency = 'XOF', signed = false) => {
    const sign = signed
      ? xof > 0
        ? '+'
        : xof < 0
          ? '−'
          : ''
      : xof < 0
        ? '−'
        : ''
    const abs = Math.abs(xof)
    if (currency === 'EUR') {
      const eur = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 2,
      }).format(abs / XOF_PER_EUR)
      return sign + eur
    }
    return `${sign}${number(abs)}\u00a0FCFA`
  }

  const percent = (ratio: number, signed = true) => {
    const sign = signed ? (ratio > 0 ? '+' : ratio < 0 ? '−' : '') : ''
    return (
      sign +
      new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(Math.abs(ratio))
    )
  }

  return { number, money, percent }
}
