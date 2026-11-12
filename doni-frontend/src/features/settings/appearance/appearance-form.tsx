import { useId } from 'react'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { useTranslation } from 'react-i18next'
import { fonts } from '@/config/fonts'
import { cn } from '@/lib/utils'
import { SUPPORTED_LANGUAGES, setLanguage, type Language } from '@/i18n'
import { useFont } from '@/context/font-context'
import { useTheme } from '@/context/theme-context'
import { buttonVariants } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

type Font = (typeof fonts)[number]

// Preferences apply as soon as they are picked; each one is persisted locally.
export function AppearanceForm() {
  const { t, i18n } = useTranslation()
  const { font, setFont } = useFont()
  const { theme, setTheme } = useTheme()
  const fontId = useId()

  return (
    <div className='space-y-8'>
      <fieldset className='space-y-2'>
        <legend className='text-sm font-medium'>
          {t('settings.appearance.language')}
        </legend>
        <p className='text-muted-foreground text-sm'>
          {t('settings.appearance.languageDescription')}
        </p>
        <RadioGroup
          value={i18n.resolvedLanguage}
          onValueChange={(value) => setLanguage(value as Language)}
          className='flex gap-6 pt-1'
        >
          {SUPPORTED_LANGUAGES.map((language) => (
            <div key={language} className='flex items-center gap-2'>
              <RadioGroupItem value={language} id={`language-${language}`} />
              <Label htmlFor={`language-${language}`} lang={language}>
                {t(`language.name.${language}`)}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </fieldset>

      <div className='space-y-2'>
        <Label htmlFor={fontId}>{t('settings.appearance.font')}</Label>
        <div className='relative w-max'>
          <select
            id={fontId}
            value={font}
            onChange={(e) => setFont(e.target.value as Font)}
            className={cn(
              buttonVariants({ variant: 'outline' }),
              'w-[200px] appearance-none font-normal'
            )}
          >
            {fonts.map((f) => (
              <option key={f} value={f}>
                {t(`settings.appearance.fonts.${f}`)}
              </option>
            ))}
          </select>
          <ChevronDownIcon className='absolute top-2.5 right-3 h-4 w-4 opacity-50' />
        </div>
        <p className='text-muted-foreground text-sm'>
          {t('settings.appearance.fontDescription')}
        </p>
      </div>

      <fieldset className='space-y-1'>
        <legend className='text-sm font-medium'>{t('theme.label')}</legend>
        <p className='text-muted-foreground text-sm'>
          {t('settings.appearance.themeDescription')}
        </p>
        <RadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as 'light' | 'dark')}
          className='grid max-w-md grid-cols-2 gap-8 pt-2'
        >
          <Label className='[&:has([data-state=checked])>div]:border-primary flex-col items-stretch'>
            <RadioGroupItem value='light' className='sr-only' />
            <div className='border-muted hover:border-accent items-center rounded-md border-2 p-1'>
              <div className='space-y-2 rounded-sm bg-[#EFEDE7] p-2'>
                <div className='space-y-2 rounded-md bg-white p-2 shadow-xs'>
                  <div className='h-2 w-[80px] rounded-lg bg-[#E4E0D6]' />
                  <div className='h-2 w-[100px] rounded-lg bg-[#E4E0D6]' />
                </div>
                <div className='flex items-center space-x-2 rounded-md bg-white p-2 shadow-xs'>
                  <div className='h-4 w-4 rounded-full bg-[#E4E0D6]' />
                  <div className='h-2 w-[100px] rounded-lg bg-[#E4E0D6]' />
                </div>
              </div>
            </div>
            <span className='block w-full p-2 text-center font-normal'>
              {t('theme.light')}
            </span>
          </Label>
          <Label className='[&:has([data-state=checked])>div]:border-primary flex-col items-stretch'>
            <RadioGroupItem value='dark' className='sr-only' />
            <div className='border-muted bg-popover hover:bg-accent hover:text-accent-foreground items-center rounded-md border-2 p-1'>
              <div className='space-y-2 rounded-sm bg-[#10121D] p-2'>
                <div className='space-y-2 rounded-md bg-[#1F2336] p-2 shadow-xs'>
                  <div className='h-2 w-[80px] rounded-lg bg-[#686C87]' />
                  <div className='h-2 w-[100px] rounded-lg bg-[#686C87]' />
                </div>
                <div className='flex items-center space-x-2 rounded-md bg-[#1F2336] p-2 shadow-xs'>
                  <div className='h-4 w-4 rounded-full bg-[#686C87]' />
                  <div className='h-2 w-[100px] rounded-lg bg-[#686C87]' />
                </div>
              </div>
            </div>
            <span className='block w-full p-2 text-center font-normal'>
              {t('theme.dark')}
            </span>
          </Label>
        </RadioGroup>
      </fieldset>
    </div>
  )
}
