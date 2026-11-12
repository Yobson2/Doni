import { IconLayoutDashboard, IconPalette } from '@tabler/icons-react'
import { type NavGroup } from '../types'

// Titles are i18n keys, translated where they are rendered.
export const navGroups: NavGroup[] = [
  {
    title: 'nav.groups.general',
    items: [
      {
        title: 'nav.dashboard',
        url: '/dashboard',
        icon: IconLayoutDashboard,
      },
    ],
  },
  {
    title: 'nav.groups.other',
    items: [
      {
        title: 'nav.settings',
        url: '/settings',
        icon: IconPalette,
      },
    ],
  },
]
