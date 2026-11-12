import { createFileRoute } from '@tanstack/react-router'
import { WatchlistPage } from '@/features/watchlist/watchlist-page'

export const Route = createFileRoute('/_authenticated/watchlist/')({
  component: WatchlistPage,
})
