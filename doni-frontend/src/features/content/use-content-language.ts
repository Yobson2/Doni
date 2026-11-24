import { useTranslation } from 'react-i18next'

/** The active language, as content is keyed by it. */
export function useContentLanguage() {
  const { i18n } = useTranslation()
  return i18n.resolvedLanguage ?? i18n.language
}
