import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createPortfolio } from '../api'

/** First visit: name and create the portfolio. */
export function CreatePortfolio() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [name, setName] = useState(() => t('portfolio.create.defaultName'))

  const mutation = useMutation({
    mutationFn: () => createPortfolio(name.trim()),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['portfolios'] }),
    onError: () => toast.error(t('errors.toast.generic')),
  })

  return (
    <Card className='mx-auto max-w-md'>
      <CardHeader>
        <CardTitle>
          <h1 className='text-xl'>{t('portfolio.create.title')}</h1>
        </CardTitle>
        <CardDescription>{t('portfolio.create.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className='grid gap-4'
          onSubmit={(event) => {
            event.preventDefault()
            mutation.mutate()
          }}
        >
          <div className='grid gap-2'>
            <Label htmlFor='portfolio-name'>{t('portfolio.create.name')}</Label>
            <Input
              id='portfolio-name'
              value={name}
              maxLength={100}
              required
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Button disabled={mutation.isPending || !name.trim()}>
            {t('portfolio.create.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
