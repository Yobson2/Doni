import { type Sgi, type SgiFee, alphabetical, sgis } from '@/content/sgi/sgis'
import { useTranslation } from 'react-i18next'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DisclaimerLink } from '@/components/legal/disclaimer-link'
import { formatLongDate } from '@/features/securities/format'
import { ContentColumn } from './content-page'
import { useContentLanguage } from './use-content-language'

function FeeSource({ source }: { source: string }) {
  return /^https?:\/\//.test(source) ? (
    <a
      href={source}
      target='_blank'
      rel='noopener noreferrer'
      className='text-primary break-all underline underline-offset-4'
    >
      {source}
    </a>
  ) : (
    <>{source}</>
  )
}

function FeeTable({ sgi, fees }: { sgi: Sgi; fees: SgiFee[] }) {
  const { t } = useTranslation()
  const language = useContentLanguage()
  if (fees.length === 0) {
    return <p className='text-muted-foreground text-sm'>{t('sgi.noFees')}</p>
  }
  return (
    <Table>
      <caption className='sr-only'>
        {t('sgi.feesOf', { name: sgi.name })}
      </caption>
      <TableHeader>
        <TableRow>
          <TableHead>{t('sgi.columns.fee')}</TableHead>
          <TableHead>{t('sgi.columns.value')}</TableHead>
          <TableHead>{t('sgi.columns.source')}</TableHead>
          <TableHead>{t('sgi.columns.asOf')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fees.map((fee) => (
          <TableRow key={fee.kind} data-testid='sgi-fee'>
            <TableCell>{t(`sgi.fee.${fee.kind}`)}</TableCell>
            <TableCell className='whitespace-normal'>{fee.value}</TableCell>
            <TableCell className='whitespace-normal'>
              <FeeSource source={fee.source} />
            </TableCell>
            <TableCell>{formatLongDate(fee.asOf, language)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export default function SgiDirectory() {
  const { t } = useTranslation()
  const language = useContentLanguage()
  const list = alphabetical(sgis, language)
  const country = new Intl.DisplayNames([language], { type: 'region' })

  return (
    <ContentColumn>
      <h1 className='font-manrope text-3xl font-bold tracking-tight sm:text-4xl'>
        {t('sgi.title')}
      </h1>
      <p className='text-text-secondary mt-3'>{t('sgi.description')}</p>
      <p className='text-text-secondary mt-3 text-sm'>{t('sgi.neutrality')}</p>
      {list.some((s) => s.placeholder) && (
        <p
          role='note'
          className='bg-warning-subtle text-foreground border-warning mt-6 rounded-md border-l-4 px-4 py-3 text-sm'
        >
          {t('sgi.placeholder')}
        </p>
      )}
      <ul className='mt-10 flex flex-col gap-6'>
        {list.map((sgi) => (
          <li key={sgi.name} className='bg-card rounded-lg border p-5'>
            <h2 className='text-lg font-semibold'>{sgi.name}</h2>
            <p className='text-text-secondary text-sm'>
              {country.of(sgi.country)}
            </p>
            {(sgi.website || sgi.phone || sgi.email) && (
              <ul className='mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm'>
                {sgi.website && (
                  <li>
                    <a
                      href={sgi.website}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-primary underline-offset-4 hover:underline'
                    >
                      {t('sgi.website')}
                    </a>
                  </li>
                )}
                {sgi.phone && (
                  <li>
                    <a href={`tel:${sgi.phone}`}>{sgi.phone}</a>
                  </li>
                )}
                {sgi.email && (
                  <li>
                    <a href={`mailto:${sgi.email}`}>{sgi.email}</a>
                  </li>
                )}
              </ul>
            )}
            <div className='mt-4'>
              <FeeTable sgi={sgi} fees={sgi.fees} />
            </div>
          </li>
        ))}
      </ul>
      <DisclaimerLink className='mt-12' />
    </ContentColumn>
  )
}
