/**
 * The SGI directory (ADR 0002): a neutral listing, shown in alphabetical
 * order. It has no ranking, rating or "featured" field, and websites are the
 * SGIs' own pages, never affiliate links.
 *
 * Every fee carries the document it was read from and the date it applies to.
 *
 * PLACEHOLDER: the entries below are not real SGIs. Replace them with the
 * licensed SGIs (AMF-UMOA list) and their published fee schedules, and remove
 * `placeholder: true`. Never fill a fee without a source and a date.
 */

/** The kinds of fee the directory compares; labels are i18n keys `sgi.fee.<kind>`. */
export const FEE_KINDS = [
  'accountOpening',
  'brokerage',
  'custody',
  'other',
] as const
type FeeKind = (typeof FEE_KINDS)[number]

export interface SgiFee {
  kind: FeeKind
  /** As published, e.g. "1 % of the order amount" (free text, not computed). */
  value: string
  /** A URL or the name of the document the value was read from. */
  source: string
  /** The date the value applies to, YYYY-MM-DD. */
  asOf: string
}

export interface Sgi {
  name: string
  /** ISO 3166-1 alpha-2 code of the country of the head office. */
  country: string
  website?: string
  phone?: string
  email?: string
  fees: SgiFee[]
  /** True for a sample entry that is not real data. */
  placeholder?: boolean
}

const placeholderFees: SgiFee[] = FEE_KINDS.filter((k) => k !== 'other').map(
  (kind) => ({
    kind,
    value: 'PLACEHOLDER',
    source: 'PLACEHOLDER - fee schedule to supply',
    asOf: '2026-01-01',
  })
)

export const sgis: Sgi[] = [
  {
    name: 'PLACEHOLDER SGI B',
    country: 'SN',
    fees: placeholderFees,
    placeholder: true,
  },
  {
    name: 'PLACEHOLDER SGI A',
    country: 'CI',
    fees: placeholderFees,
    placeholder: true,
  },
]

/** The directory in alphabetical order of name, the only order it is shown in. */
export function alphabetical(list: Sgi[], language: string): Sgi[] {
  return [...list].sort((a, b) =>
    a.name.localeCompare(b.name, language, { sensitivity: 'base' })
  )
}
