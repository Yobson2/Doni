import {
  IconBuildingBank,
  IconDatabaseEdit,
  IconLayoutDashboard,
  IconPalette,
} from '@tabler/icons-react'
import { type NavGroup } from '../types'

// Titles are i18n keys, translated where they are rendered.
const navGroups: NavGroup[] = [
  {
    title: 'nav.groups.general',
    items: [
      {
        title: 'nav.dashboard',
        url: '/dashboard',
        icon: IconLayoutDashboard,
      },
      {
        title: 'nav.securities',
        url: '/securities',
        icon: IconBuildingBank,
      },
    ],
  },
  {
    title: 'nav.groups.admin',
    adminOnly: true,
    items: [
      {
        title: 'nav.adminCatalogue',
        url: '/admin/catalogue',
        icon: IconDatabaseEdit,
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

/** The groups a user sees: admin groups only for admins. */
export function navGroupsFor(isAdmin: boolean): NavGroup[] {
  return navGroups.filter((group) => !group.adminOnly || isAdmin)
}
