import { useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
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
import { addOpeningPosition } from '../api'
import { DATE, DECIMAL, SHARES, selectClass } from './form-fields'

const openingSchema = (t: TFunction) =>
  z.object({
    ticker: z
      .string()
      .min(1, { message: t('portfolio.form.validation.required') }),
    date: z
      .string()
      .regex(DATE, { message: t('portfolio.form.validation.date') }),
    quantity: z
      .string()
      .regex(SHARES, { message: t('portfolio.form.validation.shares') }),
    pmp: z
      .string()
      .regex(DECIMAL, { message: t('portfolio.form.validation.decimal') }),
    sgi: z
      .string()
      .trim()
      .min(1, { message: t('portfolio.form.validation.required') }),
  })

type OpeningValues = z.infer<ReturnType<typeof openingSchema>>

const TEXT_FIELDS = [
  { name: 'date', type: 'date' },
  { name: 'quantity', inputMode: 'numeric' },
  { name: 'pmp', inputMode: 'decimal' },
] as const

interface InsufficientBody {
  errors?: { context?: { held?: string } }[]
}

/** Why the API refused the opening position, in the user's language. */
function refusal(error: unknown, t: TFunction): string {
  if (error instanceof ApiError && error.status === 422) {
    const context = (error.body as InsufficientBody)?.errors?.[0]?.context
    return t('portfolio.opening.insufficient', { held: context?.held ?? '0' })
  }
  if (error instanceof ApiError && error.status === 400) {
    return t('portfolio.form.errors.invalid')
  }
  return t('errors.toast.generic')
}

/**
 * Records an opening position: the quantity of a security held and its PMP
 * as of a date, copied from an SGI statement, instead of every past trade.
 */
export function OpeningPositionForm({ portfolioId }: { portfolioId: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const securities = useQuery(securitiesQuery())
  const schema = useMemo(() => openingSchema(t), [t])
  const form = useForm<OpeningValues>({
    resolver: zodResolver(schema),
    defaultValues: { ticker: '', date: '', quantity: '', pmp: '', sgi: '' },
  })

  const mutation = useMutation({
    mutationFn: (values: OpeningValues) =>
      addOpeningPosition(portfolioId, values),
    onSuccess: async (_, values) => {
      toast.success(t('portfolio.opening.saved'))
      await queryClient.invalidateQueries({
        queryKey: ['portfolios', portfolioId],
      })
      // Keep the date and SGI: the next security is usually on the same
      // statement.
      form.reset({
        ...form.formState.defaultValues,
        date: values.date,
        sgi: values.sgi,
      })
    },
    onError: (error) => form.setError('root', { message: refusal(error, t) }),
  })

  const rootError = form.formState.errors.root?.message

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t('portfolio.opening.title')}</h2>
        </CardTitle>
        <CardDescription>{t('portfolio.opening.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className='grid gap-4'
          >
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
            <div className='grid gap-4 sm:grid-cols-3'>
              {TEXT_FIELDS.map(({ name, ...props }) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t(`portfolio.opening.${name}`)}</FormLabel>
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
              {t('portfolio.opening.submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
