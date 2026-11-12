import { HTMLAttributes, useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ApiError } from '@/api/client'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { signUp } from '@/features/auth/session'

type SignUpFormProps = HTMLAttributes<HTMLFormElement>

const createFormSchema = (t: TFunction) =>
  z
    .object({
      email: z
        .string()
        .min(1, { message: t('auth.validation.emailRequired') })
        .email({ message: t('auth.validation.emailInvalid') }),
      password: z
        .string()
        .min(1, { message: t('auth.validation.passwordRequired') })
        .min(8, { message: t('auth.validation.passwordMin', { min: 8 }) })
        .max(72, { message: t('auth.validation.passwordMax', { max: 72 }) }),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('auth.validation.passwordMismatch'),
      path: ['confirmPassword'],
    })

type FormValues = z.infer<ReturnType<typeof createFormSchema>>

export function SignUpForm({ className, ...props }: SignUpFormProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const formSchema = useMemo(() => createFormSchema(t), [t])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit({ email, password }: FormValues) {
    setIsLoading(true)
    try {
      await signUp({ email, password })
      toast.success(t('auth.signUp.success'))
      await navigate({ to: '/dashboard' })
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.status === 409
          ? t('auth.signUp.emailTaken')
          : t('errors.toast.generic')
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.email')}</FormLabel>
              <FormControl>
                <Input
                  type='email'
                  autoComplete='email'
                  placeholder={t('auth.emailPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.password')}</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete='new-password'
                  placeholder='********'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('auth.confirmPassword')}</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete='new-password'
                  placeholder='********'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2 h-11' disabled={isLoading}>
          {t('auth.signUp.submit')}
        </Button>
      </form>
    </Form>
  )
}
