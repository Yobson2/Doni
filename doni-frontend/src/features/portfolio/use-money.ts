import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/authStore'
import {
  type DisplayCurrency,
  formatAmount,
  formatGain,
  formatPmp,
} from '@/lib/money'

/** The currency the signed-in user sees amounts in; XOF until they choose. */
export function useDisplayCurrency(): DisplayCurrency {
  return useAuthStore((state) => state.auth.user?.displayCurrency ?? 'XOF')
}

/**
 * Formatters for XOF amounts in the user's display currency and the active
 * language: every amount on the portfolio page goes through these.
 */
export function useMoney() {
  const currency = useDisplayCurrency()
  const { i18n } = useTranslation()
  const lang = i18n.language
  return {
    amount: (xof: string) => formatAmount(xof, currency, lang),
    gain: (xof: string) => formatGain(xof, currency, lang),
    pmp: (xof: string) => formatPmp(xof, currency, lang),
  }
}
