import { LinkProps } from '@tanstack/react-router'

// `title` fields hold i18n keys, not display text.
interface BaseNavItem {
  title: string
  badge?: string
  icon?: React.ElementType
}

type NavLink = BaseNavItem & {
  url: LinkProps['to']
  items?: never
}

type NavCollapsible = BaseNavItem & {
  items: (BaseNavItem & { url: LinkProps['to'] })[]
  url?: never
}

type NavItem = NavCollapsible | NavLink

interface NavGroup {
  title: string
  items: NavItem[]
  /** Shown only to admins. The API enforces the role; this only hides the link. */
  adminOnly?: boolean
}

export type { NavGroup, NavItem, NavCollapsible, NavLink }
