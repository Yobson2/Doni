import { describe, expect, it } from 'vitest'
import {
  PEG_RATE,
  formatAmount,
  formatGain,
  formatPmp,
  xofToEur,
} from './money'

// Intl separates thousands with a narrow no-break space in French.
const text = (s: string) => s.replace(/\s/g, ' ')

describe('XOF to EUR at the peg rate (ADR 0008)', () => {
  it('is the fixed peg of 655.957 XOF per EUR', () => {
    expect(PEG_RATE).toBe('655.957')
  })

  it('converts exactly: 655.957 XOF is 1 EUR, 655 957 XOF is 1 000 EUR', () => {
    expect(xofToEur('655.957')).toBe('1')
    expect(xofToEur('655957')).toBe('1000')
    expect(xofToEur('-1311914')).toBe('-2000')
    expect(xofToEur('0')).toBe('0')
  })

  it('keeps 30 decimal places of an amount that does not divide evenly', () => {
    // 1 000 000 / 655.957 = 1524.49017237410379033991557373425392…
    expect(xofToEur('1000000')).toBe('1524.490172374103790339915573734254')
  })

  it('never goes through floating point', () => {
    // 0.1 + 0.2 in floats is 0.30000000000000004.
    expect(xofToEur('196.7871')).toBe('0.3')
  })
})

describe('displaying an amount in the chosen currency', () => {
  it('shows XOF to the whole franc, as stored', () => {
    expect(text(formatAmount('377100', 'XOF', 'fr'))).toBe('377 100 F CFA')
  })

  it('shows EUR to the cent, rounding half up from the exact conversion', () => {
    // 377 100 / 655.957 = 574.885…
    expect(text(formatAmount('377100', 'EUR', 'fr'))).toBe('574,89 €')
    expect(formatAmount('377100', 'EUR', 'en')).toBe('€574.89')
    // 1 000 000 F = 1 524.4902… €
    expect(text(formatAmount('1000000', 'EUR', 'fr'))).toBe('1 524,49 €')
    // Exactly half a cent (0.005 EUR = 3.279785 F) rounds up.
    expect(formatAmount('3.279785', 'EUR', 'en')).toBe('€0.01')
  })

  it('shows a gain with its sign in either currency', () => {
    expect(text(formatGain('6255', 'XOF', 'fr'))).toBe('+6 255 F CFA')
    // 6255 / 655.957 = 9.5357…
    expect(text(formatGain('6255', 'EUR', 'fr'))).toBe('+9,54 €')
    expect(text(formatGain('-745', 'EUR', 'fr'))).toBe('-1,14 €')
    expect(formatGain('0', 'EUR', 'en')).toBe('€0.00')
  })

  it('shows a PMP to two decimal places in either currency', () => {
    expect(text(formatPmp('4120.5', 'XOF', 'fr'))).toBe('4 120,50 F CFA')
    // 4120.5 / 655.957 = 6.2816…
    expect(text(formatPmp('4120.5', 'EUR', 'fr'))).toBe('6,28 €')
  })
})
