import { vi } from 'vitest'

/** A user as the API returns it. */
export const testUser = {
  id: '6f1c2b8e-1d2a-4c55-9a8e-2b9f0d6f7a10',
  email: 'awa@example.com',
  firstName: null,
  lastName: null,
  role: 'MEMBRE' as const,
  isActive: true,
  displayCurrency: 'XOF' as const,
  createdAt: '2026-01-05T10:00:00.000Z',
  updatedAt: '2026-01-05T10:00:00.000Z',
}

export const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

export const session = (accessToken: string) =>
  json(200, { accessToken, expiresIn: 900, user: testUser })

type Handler = (request: Request) => Response | Promise<Response>

/**
 * Replaces fetch with a fake API: `routes` maps "METHOD /path" to a handler.
 * Unknown routes answer 404. Returns the requests it received.
 */
export function fakeApi(routes: Record<string, Handler>) {
  const requests: Request[] = []
  const fetch = vi.fn(async (input: Request) => {
    requests.push(input)
    const { pathname } = new URL(input.url)
    const handler = routes[`${input.method} ${pathname}`]
    return handler ? handler(input) : json(404)
  })
  vi.stubGlobal('fetch', fetch)
  return { requests, fetch }
}
