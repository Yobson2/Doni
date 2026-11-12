import { api, unwrap } from '@/api/client'
import { useAuthStore } from '@/stores/authStore'

/**
 * Downloads everything Doni holds about the user as a JSON file. The export
 * needs the in-memory access token, so it is fetched and then saved from a
 * blob rather than opened as a plain link.
 */
export async function downloadMyData(): Promise<void> {
  const data = unwrap(await api.GET('/api/account/export'))
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `doni-export-${data.exportedAt.slice(0, 10)}.json`
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/**
 * Deletes the account after the server checks the password, then forgets the
 * session here (the server has already ended every session).
 */
export async function deleteMyAccount(password: string): Promise<void> {
  unwrap(await api.POST('/api/account/deletion', { body: { password } }))
  useAuthStore.getState().auth.reset()
}
