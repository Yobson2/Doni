import { LANGUAGES } from '@/i18n'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/** Two-option FR / EN toggle. Each option is a real button with aria-pressed. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const current = i18n.resolvedLanguage

  return (
    <div
      role='group'
      aria-label={t('landing.nav.language')}
      className={cn(
        'border-border inline-flex items-center rounded-md border p-0.5',
        className
      )}
    >
      {LANGUAGES.map((lng) => (
        <button
          key={lng}
          type='button'
          lang={lng}
          aria-pressed={current === lng}
          onClick={() => i18n.changeLanguage(lng)}
          className={cn(
            'h-7 min-w-9 rounded-[5px] px-2 text-xs font-semibold tracking-wide uppercase transition-colors',
            current === lng
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {lng}
        </button>
      ))}
    </div>
  )
}
