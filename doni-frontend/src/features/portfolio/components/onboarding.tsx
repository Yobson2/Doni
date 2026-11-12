import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ENTRY_MODES, type EntryMode } from './form-fields'

const KEYS = { opening: 'opening', trade: 'trades' } as const

/**
 * An empty portfolio's first step. Existing holders come first (ADR 0001):
 * entering what they hold today, as opening positions, gets them a valued
 * portfolio in about two minutes; the full trade history comes second.
 */
export function Onboarding({
  onChoose,
}: {
  onChoose: (mode: EntryMode) => void
}) {
  const { t } = useTranslation()

  return (
    <Card className='lg:col-span-2'>
      <CardHeader>
        <CardTitle>
          <h2>{t('portfolio.onboarding.title')}</h2>
        </CardTitle>
        <CardDescription>
          {t('portfolio.onboarding.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className='grid gap-4 sm:grid-cols-2'>
          {ENTRY_MODES.map((mode, index) => (
            <li
              key={mode}
              className='flex flex-col gap-3 rounded-lg border p-4'
            >
              <p className='text-muted-foreground flex-1 text-sm'>
                {t(`portfolio.onboarding.${KEYS[mode]}.description`)}
              </p>
              <Button
                variant={index === 0 ? 'default' : 'outline'}
                onClick={() => onChoose(mode)}
              >
                {t(`portfolio.onboarding.${KEYS[mode]}.title`)}
              </Button>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
