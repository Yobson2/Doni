import { useEffect, useRef } from 'react'
import { LineSeries, createChart } from 'lightweight-charts'
import { useTheme } from '@/context/theme-context'
import type { EndOfDayPrice } from '../api'

// Brand chart colours (docs/brand, --chart-1 and neutrals in index.css), as
// hex because the chart library does not read CSS variables.
const COLOURS = {
  light: { line: '#2B3990', text: '#66697D', grid: '#E4E0D6' },
  dark: { line: '#8D9BF2', text: '#8E92A8', grid: '#272B3F' },
}

function isDark(theme: string) {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  return theme === 'dark'
}

interface PriceHistoryChartProps {
  /** Published end-of-day prices, oldest first. */
  prices: EndOfDayPrice[]
  /** Accessible name; the same data is also given as a table. */
  label: string
}

/** Closing prices over time, one point per trading day. */
export function PriceHistoryChart({ prices, label }: PriceHistoryChartProps) {
  const container = useRef<HTMLDivElement>(null)
  const { theme } = useTheme()

  useEffect(() => {
    if (!container.current) return
    const colours = COLOURS[isDark(theme) ? 'dark' : 'light']
    const chart = createChart(container.current, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: colours.text,
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: colours.grid },
        horzLines: { color: colours.grid },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      handleScroll: false,
      handleScale: false,
    })
    const series = chart.addSeries(LineSeries, {
      color: colours.line,
      lineWidth: 2,
      priceLineVisible: false,
    })
    // Display only: the chart library plots numbers.
    series.setData(
      prices.map((price) => ({ time: price.date, value: Number(price.close) }))
    )
    chart.timeScale().fitContent()
    return () => chart.remove()
  }, [prices, theme])

  return (
    <div
      ref={container}
      role='img'
      aria-label={label}
      className='h-64 w-full sm:h-80'
    />
  )
}
