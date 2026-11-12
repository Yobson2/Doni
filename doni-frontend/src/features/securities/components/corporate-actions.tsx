import { IconExternalLink } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CorporateAction } from '../api'
import { formatShortDate, formatXof } from '../format'

/**
 * The corporate actions on a security, newest first, each with its terms and
 * a link to the BRVM notice it was read from.
 */
export function CorporateActions({ actions }: { actions: CorporateAction[] }) {
  const { t } = useTranslation()
  if (actions.length === 0) return null

  return (
    <Card role='region' aria-labelledby='corporate-actions-title'>
      <CardHeader>
        <CardTitle id='corporate-actions-title'>
          {t('securities.corporateActions.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className='divide-border divide-y'>
          {actions
            .slice()
            .reverse()
            .map((action) => (
              <CorporateActionItem key={action.id} action={action} />
            ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function CorporateActionItem({ action }: { action: CorporateAction }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const ratio = { held: action.ratioHeld, received: action.ratioReceived }

  return (
    <li className='space-y-1 py-3 first:pt-0 last:pb-0'>
      <div className='flex flex-wrap items-baseline justify-between gap-2'>
        <p className='font-medium'>
          {t(`securities.corporateActions.kinds.${action.kind}`)}
        </p>
        <p className='text-muted-foreground text-sm'>
          {t('securities.corporateActions.effective', {
            date: formatShortDate(action.effectiveDate, lang),
          })}
        </p>
      </div>
      <p className='text-sm'>
        {action.kind === 'rights_issue' && action.subscriptionPrice
          ? t('securities.corporateActions.terms.rights_issue', {
              ...ratio,
              price: formatXof(action.subscriptionPrice, lang),
            })
          : t(`securities.corporateActions.terms.${action.kind}`, ratio)}
      </p>
      {action.cashInLieuPrice && (
        <p className='text-muted-foreground text-sm'>
          {t('securities.corporateActions.cashInLieu', {
            price: formatXof(action.cashInLieuPrice, lang),
          })}
        </p>
      )}
      {action.kind === 'rights_issue' && (
        <p className='text-muted-foreground text-sm'>
          {t('securities.corporateActions.rightsNote')}
        </p>
      )}
      <a
        href={action.sourceNoticeUrl}
        target='_blank'
        rel='noreferrer'
        className='text-primary inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline'
      >
        {t('securities.corporateActions.notice')}
        <IconExternalLink aria-hidden='true' className='size-3.5' />
      </a>
    </li>
  )
}
