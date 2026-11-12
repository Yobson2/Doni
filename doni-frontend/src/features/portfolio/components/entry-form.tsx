import { useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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
import { addLedgerEntry } from '../api'

const SHARES = /^[1-9]\d{0,14}$/
const DECIMAL = /^\d{1,15}(\.\d{1,6})?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

const selectClass = cn(
  'border-input dark:bg-input/30 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm',
  'focus-visible:border-ring focus-visible:ring-ring/80 focus-visible:ring-[3px]'
)

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

interface InsufficientBody {
  errors?: { context?: { held?: string; date?: string } }[]
}

/** Why the API refused the entry, in the user's language. */
function refusal(error: unknown, t: TFunction): string {
  if (error instanceof ApiError && error.status === 422) {
    const context = (error.body as InsufficientBody)?.errors?.[0]?.context
    return t('portfolio.form.errors.insufficient', {
      held: context?.held ?? '0',
    })
  }
  if (error instanceof ApiError && error.status === 400) {
    return t('portfolio.form.errors.invalid')
  }
  return t('errors.toast.generic')
}

/** Records a buy or a sell, with its fees and SGI. */
export function EntryForm({ portfolioId }: { portfolioId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const securities = useQuery(securitiesQuery())
  const schema = useMemo(() => entrySchema(t), [t])
  const form = useForm<EntryValues>({
    resolver: zodResolver(schema),
    defaultValues: {
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
    mutationFn: ({ fees, ...values }: EntryValues) =>
      addLedgerEntry(portfolioId, { ...values, fees: fees || '0' }),
    onSuccess: async (_, values) => {
      toast.success(t('portfolio.form.saved'))
      await queryClient.invalidateQueries({
        queryKey: ['portfolios', portfolioId],
      })
      // Keep the SGI: the next entry usually goes through the same one.
      form.reset({ ...form.formState.defaultValues, sgi: values.sgi })
    },
    onError: (error) => form.setError('root', { message: refusal(error, t) }),
  })

  const rootError = form.formState.errors.root?.message

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('portfolio.form.title')}</h2>
        </CardTitle>
        <CardDescription>{t('portfolio.form.description')}</CardDescription>
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
            <Button disabled={mutation.isPending}>
              {t('portfolio.form.submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
