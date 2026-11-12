import { createFileRoute } from '@tanstack/react-router'
import { PortfolioPage } from '@/features/portfolio/portfolio-page'

// Code-split by the router plugin (autoCodeSplitting): the page loads only
// when the route is visited.
export const Route = createFileRoute('/_authenticated/portfolio/')({
  component: PortfolioPage,
})
