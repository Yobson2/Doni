import {
  IconUsers,
  IconCurrencyDollar,
  IconTrendingUp,
  IconActivity,
} from '@tabler/icons-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { AnimatedContainer } from '@/components/motion/animated-container'
import {
  StaggerContainer,
  StaggerItem,
} from '@/components/motion/stagger-container'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const stats = [
  {
    title: 'Total Revenue',
    value: '$45,231.89',
    change: '+20.1% from last month',
    icon: IconCurrencyDollar,
  },
  {
    title: 'Users',
    value: '2,350',
    change: '+180 new this month',
    icon: IconUsers,
  },
  {
    title: 'Active Sessions',
    value: '1,247',
    change: '+12% from last hour',
    icon: IconActivity,
  },
  {
    title: 'Growth Rate',
    value: '+18.2%',
    change: '+4.1% from last month',
    icon: IconTrendingUp,
  },
]

const recentActivity = [
  { id: 1, user: 'John Doe', action: 'Created a new project', time: '2 min ago' },
  { id: 2, user: 'Jane Smith', action: 'Updated user settings', time: '5 min ago' },
  { id: 3, user: 'Bob Johnson', action: 'Completed task #1234', time: '12 min ago' },
  { id: 4, user: 'Alice Brown', action: 'Submitted a report', time: '30 min ago' },
  { id: 5, user: 'Charlie Wilson', action: 'Invited a new member', time: '1 hr ago' },
]

export default function Dashboard() {
  return (
    <>
      <Header fixed className=''>
        <Search />
        <div className='ml-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      <Main>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
        </div>

        {/* Stats Grid */}
        <StaggerContainer className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          {stats.map((stat) => (
            <StaggerItem key={stat.title}>
              <Card>
                <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                  <CardTitle className='text-sm font-medium'>
                    {stat.title}
                  </CardTitle>
                  <stat.icon className='text-muted-foreground h-4 w-4' />
                </CardHeader>
                <CardContent>
                  <div className='text-2xl font-bold'>{stat.value}</div>
                  <p className='text-muted-foreground text-xs'>{stat.change}</p>
                </CardContent>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {/* Recent Activity */}
        <AnimatedContainer variant='fadeSlideUp' delay={0.3}>
          <div className='mt-6 grid gap-4 lg:grid-cols-2'>
            <Card className='lg:col-span-2'>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className='space-y-4'>
                  {recentActivity.map((item) => (
                    <div
                      key={item.id}
                      className='flex items-center justify-between border-b pb-3 last:border-0 last:pb-0'
                    >
                      <div className='space-y-1'>
                        <p className='text-sm font-medium leading-none'>
                          {item.user}
                        </p>
                        <p className='text-muted-foreground text-sm'>
                          {item.action}
                        </p>
                      </div>
                      <span className='text-muted-foreground text-sm'>
                        {item.time}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </AnimatedContainer>
      </Main>
    </>
  )
}
