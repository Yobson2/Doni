import { describe, expect, it } from 'vitest'
import { FEE_KINDS, alphabetical, sgis } from './sgis'

const isCalendarDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)

describe('SGI directory data', () => {
  it.each(sgis.map((s) => [s.name, s] as const))(
    '%s: every fee has a value, a source and an as-of date',
    (_name, sgi) => {
      for (const fee of sgi.fees) {
        expect(FEE_KINDS).toContain(fee.kind)
        expect(fee.value.trim()).not.toBe('')
        expect(fee.source.trim()).not.toBe('')
        expect(isCalendarDate(fee.asOf)).toBe(true)
      }
    }
  )

  it('has each SGI once, with a country code and fee kinds not repeated', () => {
    expect(new Set(sgis.map((s) => s.name)).size).toBe(sgis.length)
    for (const sgi of sgis) {
      expect(sgi.country).toMatch(/^[A-Z]{2}$/)
      const kinds = sgi.fees.map((f) => f.kind)
      expect(new Set(kinds).size).toBe(kinds.length)
    }
  })

  it('carries no ranking and no tracking or affiliate link (ADR 0002)', () => {
    const allowed = [
      'name',
      'country',
      'website',
      'phone',
      'email',
      'fees',
      'placeholder',
    ]
    for (const sgi of sgis) {
      for (const key of Object.keys(sgi)) expect(allowed).toContain(key)
      if (sgi.website) expect(new URL(sgi.website).search).toBe('')
    }
  })

  it('marks sample entries as placeholders in their name', () => {
    for (const sgi of sgis.filter((s) => s.placeholder)) {
      expect(sgi.name).toContain('PLACEHOLDER')
    }
  })

  it('is shown in alphabetical order whatever the order in the file', () => {
    expect(
      alphabetical(
        [
          { name: 'Zeta', country: 'CI', fees: [] },
          { name: 'éta', country: 'SN', fees: [] },
          { name: 'Alpha', country: 'BJ', fees: [] },
        ],
        'fr'
      ).map((s) => s.name)
    ).toEqual(['Alpha', 'éta', 'Zeta'])
  })
})
