import { AxiosError } from 'axios'
import { toast } from 'sonner'
import i18n from '@/i18n'

export function handleServerError(error: unknown) {
  // eslint-disable-next-line no-console
  console.log(error)

  let errMsg = i18n.t('errors.toast.generic')

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = i18n.t('errors.toast.notFound')
  }

  if (error instanceof AxiosError) {
    errMsg = error.response?.data.title ?? errMsg
  }

  toast.error(errMsg)
}
