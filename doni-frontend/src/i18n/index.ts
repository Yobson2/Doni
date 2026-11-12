import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import translationEN from './en.json'
import translationFR from './fr.json'

// French is the default language; English is the alternative (ADR-0012).
export const SUPPORTED_LANGUAGES = ['fr', 'en'] as const
export type Language = (typeof SUPPORTED_LANGUAGES)[number]
const DEFAULT_LANGUAGE: Language = 'fr'
const LANGUAGE_STORAGE_KEY = 'doni-language'

const resources = {
  fr: { translation: translationFR },
  en: { translation: translationEN },
}

function isLanguage(value: unknown): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language)
}

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

function applyDocumentLanguage(language: string) {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language
  }
}

i18n.use(initReactI18next).init({
  resources,
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    escapeValue: false,
  },
})

applyDocumentLanguage(i18n.language)

// Only an explicit change is persisted, so first-time visitors keep the default.
i18n.on('languageChanged', (language) => {
  applyDocumentLanguage(language)
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    // Storage can be unavailable (private mode); the switch still works for the session.
  }
})

export function setLanguage(language: Language) {
  return i18n.changeLanguage(language)
}

export default i18n
