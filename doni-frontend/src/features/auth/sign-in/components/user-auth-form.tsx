import { HTMLAttributes, useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from '@tanstack/react-router'
import { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
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
      .min(7, { message: t('auth.validation.passwordMin', { min: 7 }) }),
  })

type FormValues = z.infer<ReturnType<typeof createFormSchema>>

export function UserAuthForm({ className, ...props }: UserAuthFormProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const formSchema = useMemo(() => createFormSchema(t), [t])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  })

  function onSubmit(_data: FormValues) {
    setIsLoading(true)

    // Placeholder until the real sign-in flow is wired to the API (#5).
    setTimeout(() => {
      setIsLoading(false)
      toast.success(t('auth.signIn.success'))
      navigate({ to: '/dashboard' })
    }, 1500)
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
