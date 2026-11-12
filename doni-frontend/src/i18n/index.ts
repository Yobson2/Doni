import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import translationEN from './en.json'
import translationFR from './fr.json'

// French is the default language; English is the alternative (ADR-0012).
export const LANGUAGES = ['fr', 'en'] as const
type Language = (typeof LANGUAGES)[number]
const DEFAULT_LANGUAGE: Language = 'fr'
const STORAGE_KEY = 'doni-lang'

const resources = {
  fr: { translation: translationFR },
  en: { translation: translationEN },
}

function isLanguage(value: unknown): value is Language {
  return LANGUAGES.includes(value as Language)
}

/** The saved choice if there is one, French otherwise. */
function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return isLanguage(saved) ? saved : DEFAULT_LANGUAGE
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
  lng: detectLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES,
  interpolation: {
    escapeValue: false,
  },
})

applyDocumentLanguage(i18n.language)

// Only an explicit change is persisted, so first-time visitors keep the default.
i18n.on('languageChanged', (language) => {
  applyDocumentLanguage(language)
  try {
    localStorage.setItem(STORAGE_KEY, language)
  } catch {
    // Storage can be unavailable (private mode); the switch still works for the session.
  }
})

export default i18n
