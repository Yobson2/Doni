import { queryOptions } from '@tanstack/react-query'
import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema'

export type Security = components['schemas']['SecurityDto']
export type EndOfDayPrice = components['schemas']['EndOfDayPriceDto']
/** A day of price history, restated in today's shares. */
export type HistoryPrice = components['schemas']['AdjustedEndOfDayPriceDto']
export type CorporateAction = components['schemas']['CorporateActionDto']
type CreateCorporateActionBody =
  components['schemas']['CreateCorporateActionDto']
type CreateSecurityBody = components['schemas']['CreateSecurityDto']
type PutPriceBody = components['schemas']['PutPriceDto']

export const securitiesQuery = () =>
  queryOptions({
    queryKey: ['securities'],
    queryFn: async () => unwrap(await api.GET('/api/securities')),
  })

export const securityQuery = (ticker: string) =>
  queryOptions({
    queryKey: ['securities', ticker],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/securities/{ticker}', {
          params: { path: { ticker } },
        })
      ),
  })

export const securityPricesQuery = (ticker: string) =>
  queryOptions({
    queryKey: ['securities', ticker, 'prices'],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/securities/{ticker}/prices', {
          params: { path: { ticker } },
        })
      ),
  })

export const corporateActionsQuery = (ticker: string) =>
  queryOptions({
    queryKey: ['securities', ticker, 'corporate-actions'],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/securities/{ticker}/corporate-actions', {
          params: { path: { ticker } },
        })
      ),
  })

export const sectorsQuery = () =>
  queryOptions({
    queryKey: ['sectors'],
    queryFn: async () => unwrap(await api.GET('/api/sectors')),
  })

/** Adds a security to the catalogue (admin). */
export async function createSecurity(body: CreateSecurityBody) {
  return unwrap(await api.POST('/api/securities', { body }))
}

/** Enters or corrects one day's end-of-day price from a BOC (admin). */
export async function putSecurityPrice(
  ticker: string,
  date: string,
  body: PutPriceBody
) {
  return unwrap(
    await api.PUT('/api/securities/{ticker}/prices/{date}', {
      params: { path: { ticker, date } },
      body,
    })
  )
}

/** Enters a corporate action from its BRVM notice (admin). */
export async function createCorporateAction(
  ticker: string,
  body: CreateCorporateActionBody
) {
  return unwrap(
    await api.POST('/api/securities/{ticker}/corporate-actions', {
      params: { path: { ticker } },
      body,
    })
  )
}

/** Removes a corporate action entered by mistake (admin). */
export async function deleteCorporateAction(ticker: string, id: string) {
  return unwrap(
    await api.DELETE('/api/securities/{ticker}/corporate-actions/{id}', {
      params: { path: { ticker, id } },
    })
  )
}
