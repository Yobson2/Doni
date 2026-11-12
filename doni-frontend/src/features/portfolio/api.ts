import { queryOptions } from '@tanstack/react-query'
import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema'

export type Portfolio = components['schemas']['PortfolioDto']
export type PortfolioValuation = components['schemas']['PortfolioValuationDto']
type NewLedgerEntry = components['schemas']['CreateLedgerEntryDto']

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

/** Records a buy or a sell in the portfolio's ledger. */
export async function addLedgerEntry(id: string, body: NewLedgerEntry) {
  return unwrap(
    await api.POST('/api/portfolios/{id}/entries', {
      params: { path: { id } },
      body,
    })
  )
}
