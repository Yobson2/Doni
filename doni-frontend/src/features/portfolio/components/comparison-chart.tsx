import { useEffect, useRef } from 'react'
import { LineSeries, LineStyle, createChart } from 'lightweight-charts'
import { useTheme } from '@/context/theme-context'
import type { PortfolioReturns } from '../api'

type Point = PortfolioReturns['comparison']['points'][number]

// Brand chart colours (--chart-1 and neutrals in index.css), as hex because
// the chart library does not read CSS variables. The portfolio is the brand
// line; the benchmark a dashed neutral one.
const COMPARISON_COLOURS = {
  light: { portfolio: '#2B3990', benchmark: '#66697D', grid: '#E4E0D6' },
  dark: { portfolio: '#8D9BF2', benchmark: '#8E92A8', grid: '#272B3F' },
}

function isDark(theme: string) {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return theme === 'dark'
}

/**
 * One series' points for the chart library. A day with no value (a data
 * gap) is a whitespace point: the line breaks there instead of joining the
 * days around it, so nothing is drawn that the data does not support.
 */
function toLine(points: Point[], key: 'portfolio' | 'benchmark') {
  return points.map((point) => {
    const value = point[key]
    // Display only: the chart library plots numbers.
    return value === null
      ? { time: point.date }
      : { time: point.date, value: Number(value) }
  })
}

interface ComparisonChartProps {
  points: Point[]
  /** Accessible name; the figures are also given as text next to it. */
  label: string
}

/** Cumulative portfolio TWR and benchmark change, in %, one point a day. */
export function ComparisonChart({ points, label }: ComparisonChartProps) {
  const container = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    if (!container.current) return
    const colours = COMPARISON_COLOURS[isDark(theme) ? 'dark' : 'light']
    const chart = createChart(container.current, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: colours.benchmark,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: colours.grid },
        horzLines: { color: colours.grid },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      localization: {
        priceFormatter: (value: number) => `${value.toFixed(2)} %`,
      },
      handleScroll: false,
      handleScale: false,
    })
    const benchmark = chart.addSeries(LineSeries, {
      color: colours.benchmark,
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
    })
    benchmark.setData(toLine(points, 'benchmark'))
    const portfolio = chart.addSeries(LineSeries, {
      color: colours.portfolio,
      lineWidth: 2,
      priceLineVisible: false,
    })
    portfolio.setData(toLine(points, 'portfolio'))
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [points, theme])

  return (
    <div
      ref={container}
      role='img'
      aria-label={label}
      className='h-64 w-full sm:h-80'
    />
  )
}
