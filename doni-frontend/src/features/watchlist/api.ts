import { queryOptions } from '@tanstack/react-query'
import { api, unwrap } from '@/api/client'

export const watchlistQuery = () =>
  queryOptions({
    queryKey: ['watchlist'],
    queryFn: async () => unwrap(await api.GET('/api/watchlist')),
  })

/** Watches a security; watching one already watched changes nothing. */
export async function addToWatchlist(ticker: string) {
  return unwrap(
    await api.PUT('/api/watchlist/{ticker}', {
      params: { path: { ticker } },
    })
  )
}

/** Stops watching a security. */
export async function removeFromWatchlist(ticker: string) {
  unwrap(
    await api.DELETE('/api/watchlist/{ticker}', {
      params: { path: { ticker } },
    })
  )
}
