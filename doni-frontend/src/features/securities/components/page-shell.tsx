import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitch } from '@/components/language-switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

/**
 * Header and main area of a market-data page, with the information-only
 * notice every data page carries (ADR 0002).
 */
export function PageShell({ children }: { children: ReactNode }) {
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
        {children}
        <p className='text-muted-foreground mt-8 text-xs'>
          {t('securities.disclaimer')}
        </p>
      </Main>
    </>
  )
}
