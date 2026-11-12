import { cn } from '@/lib/utils'

/** What the ledger forms accept, mirroring the API's validation. */
export const SHARES = /^[1-9]\d{0,14}$/
export const DECIMAL = /^\d{1,15}(\.\d{1,6})?$/
export const DATE = /^\d{4}-\d{2}-\d{2}$/

export const selectClass = cn(
  'border-input dark:bg-input/30 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm',
  'focus-visible:border-ring focus-visible:ring-ring/80 focus-visible:ring-[3px]'
)

/** How the user records holdings: opening positions first (ADR 0001). */
export const ENTRY_MODES = ['opening', 'trade'] as const
export type EntryMode = (typeof ENTRY_MODES)[number]
