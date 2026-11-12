import { useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TFunction } from 'i18next'
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  createSecurity,
  putSecurityPrice,
  sectorsQuery,
  securitiesQuery,
} from '../api'
import { PageShell } from '../components/page-shell'

const DECIMAL = /^\d{1,15}(\.\d{1,6})?$/
const DATE = /^\d{4}-\d{2}-\d{2}$/

const selectClass = cn(
  'border-input dark:bg-input/30 flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm',
  'focus-visible:border-ring focus-visible:ring-ring/80 focus-visible:ring-[3px]'
)

/** Admin: add securities and hand-enter end-of-day prices from a BOC. */
export function CatalogueAdmin() {
  const { t } = useTranslation()
  return (
    <PageShell>
      <div className='mb-6 space-y-1'>
        <h1 className='text-2xl font-bold tracking-tight'>
          {t('admin.catalogue.title')}
        </h1>
        <p className='text-muted-foreground'>
          {t('admin.catalogue.description')}
        </p>
      </div>
      <div className='grid gap-6 lg:grid-cols-2'>
        <PriceEntryForm />
        <SecurityForm />
      </div>
    </PageShell>
  )
}

function errorMessage(error: unknown, t: TFunction) {
  if (error instanceof ApiError && error.status === 409) {
    return t('admin.catalogue.errors.exists')
  }
  if (error instanceof ApiError && error.status === 400) {
    return t('admin.catalogue.errors.invalid')
  }
  return t('errors.toast.generic')
}

// ─── Price entry ─────────────────────────────────────────────

const priceSchema = (t: TFunction) => {
  const decimal = z
    .string()
    .regex(DECIMAL, { message: t('admin.catalogue.validation.decimal') })
  const optionalDecimal = z.union([z.literal(''), decimal])
  const date = z
    .string()
    .regex(DATE, { message: t('admin.catalogue.validation.date') })
  return z.object({
    ticker: z
      .string()
      .min(1, { message: t('admin.catalogue.validation.required') }),
    date,
    close: decimal,
    open: optionalDecimal,
    volume: optionalDecimal,
    sourceDocument: z
      .string()
      .trim()
      .min(1, { message: t('admin.catalogue.validation.required') }),
    publishedOn: date,
  })
}

type PriceValues = z.infer<ReturnType<typeof priceSchema>>

function PriceEntryForm() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const securities = useQuery(securitiesQuery())
  const schema = useMemo(() => priceSchema(t), [t])
  const form = useForm<PriceValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ticker: '',
      date: '',
      close: '',
      open: '',
      volume: '',
      sourceDocument: '',
      publishedOn: '',
    },
  })

  const mutation = useMutation({
    mutationFn: ({ ticker, date, open, volume, ...rest }: PriceValues) =>
      putSecurityPrice(ticker, date, {
        ...rest,
        ...(open ? { open } : {}),
        ...(volume ? { volume } : {}),
      }),
    onSuccess: async (_, values) => {
      toast.success(t('admin.catalogue.price.saved'))
      await queryClient.invalidateQueries({ queryKey: ['securities'] })
      // Keep the security and BOC: the next price is often from the same one.
      form.reset({
        ...values,
        ticker: '',
        close: '',
        open: '',
        volume: '',
      })
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.catalogue.price.title')}</CardTitle>
        <CardDescription>
          {t('admin.catalogue.price.description')}
        </CardDescription>
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
                  <FormLabel>{t('admin.catalogue.fields.security')}</FormLabel>
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
            <div className='grid gap-4 sm:grid-cols-2'>
              <TextField form={form} name='date' type='date' />
              <TextField form={form} name='close' inputMode='decimal' />
              <TextField form={form} name='open' inputMode='decimal' />
              <TextField form={form} name='volume' inputMode='numeric' />
            </div>
            <TextField
              form={form}
              name='sourceDocument'
              placeholder={t(
                'admin.catalogue.fields.sourceDocumentPlaceholder'
              )}
              description
            />
            <TextField form={form} name='publishedOn' type='date' />
            <Button disabled={mutation.isPending}>
              {t('admin.catalogue.price.submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

interface TextFieldProps {
  form: ReturnType<typeof useForm<PriceValues>>
  name: Exclude<keyof PriceValues, 'ticker'>
  type?: string
  inputMode?: 'decimal' | 'numeric'
  placeholder?: string
  description?: boolean
}

function TextField({
  form,
  name,
  type = 'text',
  inputMode,
  placeholder,
  description,
}: TextFieldProps) {
  const { t } = useTranslation()
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(`admin.catalogue.fields.${name}`)}</FormLabel>
          <FormControl>
            <Input
              type={type}
              inputMode={inputMode}
              placeholder={placeholder}
              {...field}
            />
          </FormControl>
          {description && (
            <FormDescription>
              {t(`admin.catalogue.fields.${name}Help`)}
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// ─── New security ────────────────────────────────────────────

const securitySchema = (t: TFunction) =>
  z.object({
    ticker: z.string().regex(/^[A-Z0-9][A-Z0-9.-]{0,19}$/, {
      message: t('admin.catalogue.validation.ticker'),
    }),
    name: z
      .string()
      .trim()
      .min(1, { message: t('admin.catalogue.validation.required') }),
    sectorCode: z
      .string()
      .min(1, { message: t('admin.catalogue.validation.required') }),
    country: z
      .string()
      .regex(/^[A-Z]{2}$/, {
        message: t('admin.catalogue.validation.country'),
      }),
    profileFr: z.string(),
    profileEn: z.string(),
    profileOriginalLanguage: z.enum(['fr', 'en']),
  })

type SecurityValues = z.infer<ReturnType<typeof securitySchema>>

const PROFILE_FIELDS = ['profileFr', 'profileEn'] as const

function SecurityForm() {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const sectors = useQuery(sectorsQuery())
  const schema = useMemo(() => securitySchema(t), [t])
  const form = useForm<SecurityValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ticker: '',
      name: '',
      sectorCode: '',
      country: '',
      profileFr: '',
      profileEn: '',
      profileOriginalLanguage: 'fr',
    },
  })

  const mutation = useMutation({
    mutationFn: ({ profileFr, profileEn, ...rest }: SecurityValues) =>
      createSecurity({
        ...rest,
        profileFr: profileFr.trim() || null,
        profileEn: profileEn.trim() || null,
      }),
    onSuccess: async () => {
      toast.success(t('admin.catalogue.security.saved'))
      await queryClient.invalidateQueries({ queryKey: ['securities'] })
      form.reset()
    },
    onError: (error) => toast.error(errorMessage(error, t)),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('admin.catalogue.security.title')}</CardTitle>
        <CardDescription>
          {t('admin.catalogue.security.description')}
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
                name='ticker'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalogue.fields.ticker')}</FormLabel>
                    <FormControl>
                      <Input className='font-mono uppercase' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name='country'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('admin.catalogue.fields.country')}</FormLabel>
                    <FormControl>
                      <Input maxLength={2} className='uppercase' {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name='name'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalogue.fields.name')}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='sectorCode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('admin.catalogue.fields.sector')}</FormLabel>
                  <FormControl>
                    <select className={selectClass} {...field}>
                      <option value=''>
                        {t('admin.catalogue.fields.choose')}
                      </option>
                      {sectors.data?.map((s) => (
                        <option key={s.code} value={s.code}>
                          {i18n.language === 'en' ? s.nameEn : s.nameFr}
                        </option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {PROFILE_FIELDS.map((name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(`admin.catalogue.fields.${name}`)}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
            <FormField
              control={form.control}
              name='profileOriginalLanguage'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('admin.catalogue.fields.profileOriginalLanguage')}
                  </FormLabel>
                  <FormControl>
                    <select className={selectClass} {...field}>
                      <option value='fr'>{t('language.name.fr')}</option>
                      <option value='en'>{t('language.name.en')}</option>
                    </select>
                  </FormControl>
                  <FormDescription>
                    {t('admin.catalogue.fields.profileOriginalLanguageHelp')}
                  </FormDescription>
                </FormItem>
              )}
            />
            <Button disabled={mutation.isPending}>
              {t('admin.catalogue.security.submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
