import { useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { securitiesQuery } from '@/features/securities/api'
import { type LedgerEntry, addLedgerEntry, editLedgerEntry } from '../api'
import {
  DATE,
  DECIMAL,
  SHARES,
  ledgerRefusal,
  selectClass,
} from './form-fields'
import { SubmitButtons } from './submit-buttons'

const entrySchema = (t: TFunction) => {
  const required = t('portfolio.form.validation.required')
  const decimal = z
    .string()
    .regex(DECIMAL, { message: t('portfolio.form.validation.decimal') })
  return z.object({
    kind: z.enum(['buy', 'sell']),
    ticker: z.string().min(1, { message: required }),
    date: z
      .string()
      .regex(DATE, { message: t('portfolio.form.validation.date') }),
    quantity: z
      .string()
      .regex(SHARES, { message: t('portfolio.form.validation.shares') }),
    price: decimal,
    fees: z.union([z.literal(''), decimal]),
    sgi: z.string().trim().min(1, { message: required }),
  })
}

type EntryValues = z.infer<ReturnType<typeof entrySchema>>

const TEXT_FIELDS = [
  { name: 'date', type: 'date' },
  { name: 'quantity', inputMode: 'numeric' },
  { name: 'price', inputMode: 'decimal' },
  { name: 'fees', inputMode: 'decimal' },
] as const

/** The form's values for an entry being corrected. */
const valuesOf = (entry: LedgerEntry): EntryValues => ({
  kind: entry.kind === 'sell' ? 'sell' : 'buy',
  ticker: entry.ticker,
  date: entry.date,
  quantity: entry.quantity,
  price: entry.price,
  fees: entry.fees,
  sgi: entry.sgi,
})

/**
 * Records a buy or a sell, with its fees and SGI. Given an `entry`, corrects
 * that entry instead, then calls `onDone` (also called on cancel).
 */
export function EntryForm({
  portfolioId,
  entry,
  onDone,
}: {
  portfolioId: string
  entry?: LedgerEntry
  onDone?: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const securities = useQuery(securitiesQuery())
  const schema = useMemo(() => entrySchema(t), [t])
  const form = useForm<EntryValues>({
    resolver: zodResolver(schema),
    defaultValues: entry
      ? valuesOf(entry)
      : {
          kind: 'buy',
          ticker: '',
          date: '',
          quantity: '',
          price: '',
          fees: '',
          sgi: '',
        },
  })

  const mutation = useMutation({
    mutationFn: ({ fees, ...values }: EntryValues) => {
      const body = { ...values, fees: fees || '0' }
      return entry
        ? editLedgerEntry(portfolioId, entry.id, body)
        : addLedgerEntry(portfolioId, body)
    },
    onSuccess: async (_, values) => {
      toast.success(
        t(entry ? 'portfolio.correction.saved' : 'portfolio.form.saved')
      )
      await queryClient.invalidateQueries({
        queryKey: ['portfolios', portfolioId],
      })
      if (entry) return onDone?.()
      // Keep the SGI: the next entry usually goes through the same one.
      form.reset({ ...form.formState.defaultValues, sgi: values.sgi })
    },
    onError: (error) =>
      form.setError('root', {
        message: ledgerRefusal(error, t, 'portfolio.form.errors.insufficient'),
      }),
  })

  const rootError = form.formState.errors.root?.message

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>
            {t(entry ? 'portfolio.correction.title' : 'portfolio.form.title')}
          </h2>
        </CardTitle>
        <CardDescription>
          {t(
            entry
              ? 'portfolio.correction.description'
              : 'portfolio.form.description'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className='grid gap-4'
          >
            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='kind'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('portfolio.form.kind')}</FormLabel>
                    <FormControl>
                      <select className={selectClass} {...field}>
                        <option value='buy'>{t('portfolio.kind.buy')}</option>
                        <option value='sell'>{t('portfolio.kind.sell')}</option>
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='ticker'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('portfolio.form.security')}</FormLabel>
                    <FormControl>
                      <select className={selectClass} {...field}>
                        <option value=''>{t('portfolio.form.choose')}</option>
                        {securities.data?.map((s) => (
                          <option key={s.ticker} value={s.ticker}>
                            {s.ticker} · {s.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {TEXT_FIELDS.map(({ name, ...props }) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t(`portfolio.form.${name}`)}</FormLabel>
                      <FormControl>
                        <Input {...props} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <FormField
              control={form.control}
              name='sgi'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('portfolio.form.sgi')}</FormLabel>
                  <FormControl>
                    <Input maxLength={100} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {rootError && (
              <p role='alert' className='text-destructive text-sm'>
                {rootError}
              </p>
            )}
            <SubmitButtons
              pending={mutation.isPending}
              label={t(
                entry ? 'portfolio.correction.submit' : 'portfolio.form.submit'
              )}
              onCancel={entry ? onDone : undefined}
            />
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
