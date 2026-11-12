import { IconChartLine } from '@tabler/icons-react'
import { useTranslation } from 'react-i18next'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { AnimatedContainer } from '@/components/motion/animated-container'
import { LanguageSwitch } from '@/components/language-switch'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent } from '@/components/ui/card'

export default function Dashboard() {
  const { t } = useTranslation()

  return (
    <>
      <Header fixed>
        <Search />
        <div className='ml-auto flex items-center space-x-2'>
          <LanguageSwitch />
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <h1 className='mb-6 text-2xl font-bold tracking-tight'>
          {t('dashboard.title')}
        </h1>

        <AnimatedContainer variant='fadeSlideUp'>
          <Card>
            <CardContent className='flex flex-col items-center gap-3 py-12 text-center'>
              <IconChartLine
                aria-hidden='true'
                className='text-muted-foreground size-10'
              />
              <h2 className='text-lg font-semibold'>
                {t('dashboard.empty.title')}
              </h2>
              <p className='text-muted-foreground max-w-md text-sm'>
                {t('dashboard.empty.description')}
              </p>
            </CardContent>
          </Card>
        </AnimatedContainer>
      </Main>
    </>
  )
}
