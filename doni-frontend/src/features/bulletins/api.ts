import { queryOptions } from '@tanstack/react-query'
import { api, unwrap } from '@/api/client'
import type { components } from '@/api/schema'

export type Bulletin = components['schemas']['BulletinDto']
type CorrectBulletinBody = components['schemas']['CorrectBulletinDto']

/** Ingested BOCs held for review (admin). */
export const heldBulletinsQuery = () =>
  queryOptions({
    queryKey: ['bulletins', 'pending_review'],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/bulletins', {
          params: { query: { status: 'pending_review' } },
        })
      ),
  })

/** One day's BOC with the rows read from it (admin). */
export const bulletinQuery = (date: string) =>
  queryOptions({
    queryKey: ['bulletins', 'day', date],
    queryFn: async () =>
      unwrap(
        await api.GET('/api/bulletins/{date}', {
          params: { path: { date } },
        })
      ),
  })

/** Corrects misread values of a held day (admin). */
export async function correctBulletin(date: string, body: CorrectBulletinBody) {
  return unwrap(
    await api.PATCH('/api/bulletins/{date}', {
      params: { path: { date } },
      body,
    })
  )
}

/** Publishes a held day: its prices are shown from then on (admin). */
export async function publishBulletin(date: string) {
  return unwrap(
    await api.POST('/api/bulletins/{date}/publish', {
      params: { path: { date } },
    })
  )
}
