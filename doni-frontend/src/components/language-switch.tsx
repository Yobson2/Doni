import { IconLanguage } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { setLanguage, type Language } from '@/i18n'
import { Button } from '@/components/ui/button'

/** Toggles between French and English. Shows the language it switches to. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const next: Language = i18n.resolvedLanguage === 'en' ? 'fr' : 'en'

  return (
    <Button
      variant='ghost'
      size='sm'
      className={cn('gap-1.5', className)}
      onClick={() => setLanguage(next)}
      aria-label={t(`language.switchTo.${next}`)}
      title={t(`language.switchTo.${next}`)}
    >
      <IconLanguage aria-hidden='true' className='size-4' />
      <span lang={next}>{next.toUpperCase()}</span>
    </Button>
  )
}
