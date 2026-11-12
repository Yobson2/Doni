import type { TFunction } from 'i18next'
import { ApiError } from '@/api/client'
import { cn } from '@/lib/utils'

interface RefusalBody {
  errors?: { code?: string; context?: { held?: string } }[]
}

/**
 * Why the API refused a change to the ledger, in the user's language.
 * `insufficientKey` explains a sale that would exceed the shares held,
 * worded for the change being made.
 */
export function ledgerRefusal(
  error: unknown,
  t: TFunction,
  insufficientKey: string
): string {
  if (error instanceof ApiError && error.status === 422) {
    const first = (error.body as RefusalBody)?.errors?.[0]
    if (first?.code === 'LEDGER_ENTRY_005') {
      return t('portfolio.opening.duplicate')
    }
    return t(insufficientKey, { held: first?.context?.held ?? '0' })
  }
  if (error instanceof ApiError && error.status === 400) {
    return t('portfolio.form.errors.invalid')
  }
  if (error instanceof ApiError && error.status === 404) {
    return t('portfolio.form.errors.gone')
  }
  return t('errors.toast.generic')
}

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
