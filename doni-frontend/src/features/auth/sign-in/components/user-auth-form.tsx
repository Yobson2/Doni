import { HTMLAttributes, useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useSearch } from '@tanstack/react-router'
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
import { afterSignInPath, signIn } from '@/features/auth/session'

type UserAuthFormProps = HTMLAttributes<HTMLFormElement>

const createFormSchema = (t: TFunction) =>
  z.object({
    email: z
      .string()
      .min(1, { message: t('auth.validation.emailRequired') })
      .email({ message: t('auth.validation.emailInvalid') }),
    password: z
      .string()
      .min(1, { message: t('auth.validation.passwordRequired') })
      .min(8, { message: t('auth.validation.passwordMin', { min: 8 }) }),
  })

type FormValues = z.infer<ReturnType<typeof createFormSchema>>

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })
  const formSchema = useMemo(() => createFormSchema(t), [t])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  async function onSubmit(data: FormValues) {
    setIsLoading(true)
    try {
      await signIn(data)
      toast.success(t('auth.signIn.success'))
      await navigate({ to: afterSignInPath(redirect) })
    } catch (error) {
      toast.error(
        error instanceof ApiError && error.status === 401
          ? t('auth.signIn.invalidCredentials')
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
            <FormItem className='relative'>
              <FormLabel>{t('auth.password')}</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete='current-password'
                  placeholder='********'
                  {...field}
                />
              </FormControl>
              <FormMessage />
              <Link
                to='/forgot-password'
                className='text-muted-foreground absolute -top-0.5 right-0 text-sm font-medium hover:opacity-75'
              >
                {t('auth.signIn.forgot')}
              </Link>
            </FormItem>
          )}
        />
        <Button className='mt-2 h-11' disabled={isLoading}>
          {t('auth.signIn.submit')}
        </Button>
      </form>
    </Form>
  )
}
