import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import translationEN from './en.json'
import translationFR from './fr.json'

export const LANGUAGES = ['fr', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'doni-lang'

const resources = {
  en: { translation: translationEN },
  fr: { translation: translationFR },
}

/** Saved choice first, then the browser language; English otherwise. */
function detectLanguage(): Language {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved && (LANGUAGES as readonly string[]).includes(saved)) {
    return saved as Language
  }
  return navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  localStorage.setItem(STORAGE_KEY, lng)
})

i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n
