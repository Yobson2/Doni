import { createFileRoute, Outlet } from '@tanstack/react-router'
import { LandingNavbar } from '@/features/landing-page/components/landing-navbar'
import { LandingFooter } from '@/features/landing-page/components/landing-footer'

export const Route = createFileRoute('/_public')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className='flex min-h-svh flex-col'>
      <LandingNavbar />
      <main className='flex-1'>
        <Outlet />
      </main>
      <LandingFooter />
    </div>
  )
}
