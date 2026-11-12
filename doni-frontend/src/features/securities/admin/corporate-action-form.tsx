import { useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TFunction } from 'i18next'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  type CorporateAction,
  corporateActionsQuery,
  createCorporateAction,
  deleteCorporateAction,
  securitiesQuery,
} from '../api'
import { formatShortDate } from '../format'

const KINDS = ['split', 'reverse_split', 'free_shares', 'rights_issue'] as const
const DECIMAL = /^\d{1,15}(\.\d{1,6})?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const WHOLE = /^[1-9]\d{0,5}$/

const schema = (t: TFunction) => {
  const v = (key: string) => ({
    message: t(`admin.catalogue.validation.${key}`),
  })
  const optionalDecimal = z.union([
    z.literal(''),
    z.string().regex(DECIMAL, v('decimal')),
  ])
  return z.object({
    ticker: z.string().min(1, v('required')),
    kind: z.enum(KINDS, { errorMap: () => v('required') }),
    effectiveDate: z.string().regex(DATE, v('date')),
    ratioHeld: z.string().regex(WHOLE, v('whole')),
    ratioReceived: z.string().regex(WHOLE, v('whole')),
    cashInLieuPrice: optionalDecimal,
    subscriptionPrice: optionalDecimal,
    sourceNoticeUrl: z.string().trim().url(v('notice')),
  })
}

type Values = z.infer<ReturnType<typeof schema>>

/**
 * Admin: enter a corporate action from its BRVM notice, and see or remove
 * the actions already entered on a security.
 */
export function CorporateActionForm({ selectClass }: { selectClass: string }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const securities = useQuery(securitiesQuery())
  const resolver = useMemo(() => zodResolver(schema(t)), [t])
  const form = useForm<Values>({
    resolver,
    defaultValues: {
      ticker: '',
      kind: '' as Values['kind'],
      effectiveDate: '',
      ratioHeld: '',
      ratioReceived: '',
      cashInLieuPrice: '',
      subscriptionPrice: '',
      sourceNoticeUrl: '',
    },
  })
  const ticker = form.watch('ticker')

  const mutation = useMutation({
    mutationFn: ({
      ticker,
      ratioHeld,
      ratioReceived,
      cashInLieuPrice,
      subscriptionPrice,
      ...rest
    }: Values) =>
      createCorporateAction(ticker, {
        ...rest,
        ratioHeld: Number(ratioHeld),
        ratioReceived: Number(ratioReceived),
        ...(cashInLieuPrice ? { cashInLieuPrice } : {}),
        ...(subscriptionPrice ? { subscriptionPrice } : {}),
      }),
    onSuccess: async (_, values) => {
      toast.success(t('admin.catalogue.corporateAction.saved'))
      await queryClient.invalidateQueries({
        queryKey: ['securities', values.ticker],
      })
      form.reset({ ...form.formState.defaultValues, ticker: values.ticker })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        toast.error(t('admin.catalogue.corporateAction.exists'))
      } else if (error instanceof ApiError && error.status === 400) {
        toast.error(t('admin.catalogue.corporateAction.invalidTerms'))
      } else {
        toast.error(t('errors.toast.generic'))
      }
    },
  })

  return (
    <Card className='lg:col-span-2'>
      <CardHeader>
        <CardTitle>{t('admin.catalogue.corporateAction.title')}</CardTitle>
        <CardDescription>
          {t('admin.catalogue.corporateAction.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className='grid gap-6 lg:grid-cols-2'>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
            className='grid gap-4'
          >
            <div className='grid gap-4 sm:grid-cols-2'>
              <FormField
                control={form.control}
                name='ticker'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('admin.catalogue.corporateAction.fields.ticker')}
                    </FormLabel>
                    <FormControl>
                      <select className={selectClass} {...field}>
                        <option value=''>
                          {t('admin.catalogue.fields.choose')}
                        </option>
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
              <FormField
                control={form.control}
                name='kind'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t('admin.catalogue.corporateAction.fields.kind')}
                    </FormLabel>
                    <FormControl>
                      <select className={selectClass} {...field}>
                        <option value=''>
                          {t('admin.catalogue.fields.choose')}
                        </option>
                        {KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {t(`securities.corporateActions.kinds.${kind}`)}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <ActionField form={form} name='effectiveDate' type='date' help />
            <div className='grid gap-4 sm:grid-cols-2'>
              <ActionField form={form} name='ratioHeld' inputMode='numeric' />
              <ActionField
                form={form}
                name='ratioReceived'
                inputMode='numeric'
              />
            </div>
            <p className='text-muted-foreground text-sm'>
              {t('admin.catalogue.corporateAction.ratioHelp')}
            </p>
            <div className='grid gap-4 sm:grid-cols-2'>
              <ActionField
                form={form}
                name='cashInLieuPrice'
                inputMode='decimal'
                help
              />
              <ActionField
                form={form}
                name='subscriptionPrice'
                inputMode='decimal'
                help
              />
            </div>
            <ActionField form={form} name='sourceNoticeUrl' help />
            <Button disabled={mutation.isPending}>
              {t('admin.catalogue.corporateAction.submit')}
            </Button>
          </form>
        </Form>
        {ticker && <EnteredActions ticker={ticker} />}
      </CardContent>
    </Card>
  )
}

interface ActionFieldProps {
  form: ReturnType<typeof useForm<Values>>
  name: Exclude<keyof Values, 'ticker' | 'kind'>
  type?: string
  inputMode?: 'decimal' | 'numeric'
  help?: boolean
}

function ActionField({
  form,
  name,
  type = 'text',
  inputMode,
  help,
}: ActionFieldProps) {
  const { t } = useTranslation()
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {t(`admin.catalogue.corporateAction.fields.${name}`)}
          </FormLabel>
          <FormControl>
            <Input type={type} inputMode={inputMode} {...field} />
          </FormControl>
          {help && (
            <FormDescription>
              {t(`admin.catalogue.corporateAction.fields.${name}Help`)}
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

/** The corporate actions already entered on a security, with removal. */
function EnteredActions({ ticker }: { ticker: string }) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const actions = useQuery(corporateActionsQuery(ticker))
  const remove = useMutation({
    mutationFn: (action: CorporateAction) =>
      deleteCorporateAction(ticker, action.id),
    onSuccess: async () => {
      toast.success(t('admin.catalogue.corporateAction.removed'))
      await queryClient.invalidateQueries({ queryKey: ['securities', ticker] })
    },
    onError: () => toast.error(t('errors.toast.generic')),
  })

  return (
    <section aria-labelledby='entered-actions' className='space-y-3'>
      <h3 id='entered-actions' className='font-medium'>
        {t('admin.catalogue.corporateAction.entered', { ticker })}
      </h3>
      {actions.data?.length === 0 && (
        <p className='text-muted-foreground text-sm'>
          {t('admin.catalogue.corporateAction.none')}
        </p>
      )}
      <ul className='divide-border divide-y'>
        {actions.data?.map((action) => (
          <li
            key={action.id}
            className='flex flex-wrap items-center justify-between gap-2 py-2'
          >
            <div className='text-sm'>
              <p className='font-medium'>
                {t(`securities.corporateActions.kinds.${action.kind}`)} ·{' '}
                {formatShortDate(action.effectiveDate, i18n.language)}
              </p>
              <p className='text-muted-foreground'>
                {action.ratioReceived} / {action.ratioHeld} ·{' '}
                <a
                  href={action.sourceNoticeUrl}
                  target='_blank'
                  rel='noreferrer'
                  className='text-primary underline-offset-4 hover:underline'
                >
                  {t('securities.corporateActions.notice')}
                </a>
              </p>
            </div>
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={remove.isPending}
              onClick={() => remove.mutate(action)}
            >
              {t('admin.catalogue.corporateAction.remove')}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
