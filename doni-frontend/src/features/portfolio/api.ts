import { queryOptions } from '@tanstack/react-query'
import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema'

export type Portfolio = components['schemas']['PortfolioDto']
export type PortfolioValuation = components['schemas']['PortfolioValuationDto']
export type LedgerEntry = components['schemas']['LedgerEntryDto']
type NewLedgerEntry = components['schemas']['CreateLedgerEntryDto']
type NewOpeningPosition = components['schemas']['CreateOpeningPositionDto']

export const portfoliosQuery = () =>
  queryOptions({
    queryKey: ['portfolios'],
    queryFn: async () => unwrap(await api.GET('/api/portfolios')),
  })

export const valuationQuery = (id: string) =>
  queryOptions({
    queryKey: ['portfolios', id, 'valuation'],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/portfolios/{id}/valuation', {
          params: { path: { id } },
        })
      ),
  })

export const entriesQuery = (id: string) =>
  queryOptions({
    queryKey: ['portfolios', id, 'entries'],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/portfolios/{id}/entries', {
          params: { path: { id } },
        })
      ),
  })

export async function createPortfolio(name: string) {
  return unwrap(await api.POST('/api/portfolios', { body: { name } }))
}

/** Records an opening position: the quantity held and its PMP as of a date. */
export async function addOpeningPosition(id: string, body: NewOpeningPosition) {
  return unwrap(
    await api.POST('/api/portfolios/{id}/opening-positions', {
      params: { path: { id } },
      body,
    })
  )
}

/**
 * Corrects a buy or a sell: a new entry replaces it and the portfolio is
 * recomputed. Refused (422) if a sale would then exceed the shares held.
 */
export async function editLedgerEntry(
  id: string,
  entryId: string,
  body: NewLedgerEntry
) {
  return unwrap(
    await api.PUT('/api/portfolios/{id}/entries/{entryId}', {
      params: { path: { id, entryId } },
      body,
    })
  )
}

/** Corrects an opening position, like `editLedgerEntry`. */
export async function editOpeningPosition(
  id: string,
  entryId: string,
  body: NewOpeningPosition
) {
  return unwrap(
    await api.PUT('/api/portfolios/{id}/opening-positions/{entryId}', {
      params: { path: { id, entryId } },
      body,
    })
  )
}

/** Deletes a ledger entry of any kind; refused (422) like an edit. */
export async function deleteLedgerEntry(id: string, entryId: string) {
  unwrap(
    await api.DELETE('/api/portfolios/{id}/entries/{entryId}', {
      params: { path: { id, entryId } },
    })
  )
}

/** Records a buy or a sell in the portfolio's ledger. */
export async function addLedgerEntry(id: string, body: NewLedgerEntry) {
  return unwrap(
    await api.POST('/api/portfolios/{id}/entries', {
      params: { path: { id } },
      body,
    })
  )
}
