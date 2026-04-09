import { type NextRequest, NextResponse } from "next/server"
import { computeAllIndicators, bollingerSeries, rsiSeries, macdSeries, smaSeries, emaSeries } from "@/lib/indicators"
import { isMarketActivelyTrading, marketStateLabel } from "@/lib/market-state"
// Rate limiting handled by middleware

export const dynamic = "force-dynamic"
export const revalidate = 0

interface ChartDataPoint {
  time: string
  price: number
  timestamp: number
}

interface ChartResponse {
  success: boolean
  chartData: ChartDataPoint[]
  symbol: string
  range: string
  dataPoints: number
  isRealtime?: boolean
  isSimulated?: boolean
  marketState?: string
  marketStatusLabel?: string
  isMarketOpen?: boolean
  isStale?: boolean
  indicators?: ReturnType<typeof computeAllIndicators> | null
  indicatorSeries?: {
    bollinger: { upper: Array<number | null>; middle: Array<number | null>; lower: Array<number | null> }
    rsi: Array<number | null>
    macd: { macd: Array<number | null>; signal: Array<number | null>; histogram: Array<number | null> }
    sma20: Array<number | null>
    ema12: Array<number | null>
  } | null
}

const cache = new Map<string, { data: ChartResponse; timestamp: number }>()
const CACHE_DURATION = 5000
const MAX_CACHE_SIZE = 50

function pruneChartCache() {
  if (cache.size <= MAX_CACHE_SIZE) return
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > 60000) cache.delete(key)
  }
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)
    for (let i = 0; i < entries.length - MAX_CACHE_SIZE; i++) {
      cache.delete(entries[i][0])
    }
  }
}

export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get("range") || "1D"
    const ticker = params.ticker

    const cacheKey = `${ticker}-${range}`
    const cached = cache.get(cacheKey)

    if (range !== "3S" && cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data)
    }

    const rangeMap: Record<string, { period: string; interval: string }> = {
      "3S": { period: "1d", interval: "1m" },
      "1D": { period: "1d", interval: "5m" },
      "5D": { period: "5d", interval: "15m" },
      "1M": { period: "1mo", interval: "1h" },
      "3M": { period: "3mo", interval: "1d" },
      "1Y": { period: "1y", interval: "1d" },
      ALL: { period: "max", interval: "1mo" },
    }

    const { period, interval } = rangeMap[range] || rangeMap["1D"]
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=0&period2=9999999999&interval=${interval}&range=${period}`

    const response = await fetch(yahooUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      cache: "no-store",
    })

    if (!response.ok) {
      if (cached?.data?.chartData?.length) {
        return NextResponse.json({
          ...cached.data,
          isRealtime: false,
          isSimulated: false,
          isStale: true,
          marketStatusLabel: `${cached.data.marketStatusLabel || "Latest chart"} - temporarily delayed`,
        })
      }

      if (response.status === 429) {
        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            details: "Yahoo Finance API rate limit reached. Please try again later.",
            retryAfter: 60,
          },
          { status: 429 },
        )
      }

      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      const textResponse = await response.text()
      console.error("Non-JSON response:", textResponse.substring(0, 100))

      if (cached?.data?.chartData?.length) {
        return NextResponse.json({
          ...cached.data,
          isRealtime: false,
          isSimulated: false,
          isStale: true,
          marketStatusLabel: `${cached.data.marketStatusLabel || "Latest chart"} - temporarily delayed`,
        })
      }

      throw new Error("Invalid response format from Yahoo Finance API")
    }

    const data = await response.json()
    const result = data.chart?.result?.[0]

    if (!result) {
      throw new Error("No chart data available")
    }

    const timestamps: number[] = result.timestamp || []
    const prices: Array<number | null> = result.indicators?.quote?.[0]?.close || []
    const marketState = result.meta?.marketState || "UNKNOWN"
    const isMarketOpen = isMarketActivelyTrading(marketState)

    const chartData: ChartDataPoint[] = timestamps
      .map((timestamp: number, index: number) => ({
        time: new Date(timestamp * 1000).toISOString(),
        price: prices[index] || 0,
        timestamp: timestamp * 1000,
      }))
      .filter((point: ChartDataPoint) => point.price > 0)

    const effectiveChartData = range === "3S" ? chartData.slice(-30) : chartData
    const closePrices = effectiveChartData.map((p) => p.price)
    let indicators = null
    let indicatorSeries = null

    // Need at least 35 points so MACD(12,26,9) and all derived series are stable.
    if (range !== "3S" && closePrices.length >= 35) {
      indicators = computeAllIndicators(closePrices)

      const bbSeries = bollingerSeries(closePrices)
      const rSeries = rsiSeries(closePrices)
      const mSeries = macdSeries(closePrices)
      const sma20Series = smaSeries(closePrices, 20)
      const ema12Series = emaSeries(closePrices, 12)

      indicatorSeries = {
        bollinger: { upper: bbSeries.upper, middle: bbSeries.middle, lower: bbSeries.lower },
        rsi: rSeries,
        macd: { macd: mSeries.macd, signal: mSeries.signal, histogram: mSeries.histogram },
        sma20: sma20Series,
        ema12: ema12Series,
      }
    }

    const statusLabel = marketStateLabel(marketState)
    const responseData: ChartResponse = {
      success: true,
      chartData: effectiveChartData,
      indicators,
      indicatorSeries,
      symbol: ticker,
      range,
      dataPoints: effectiveChartData.length,
      marketState,
      marketStatusLabel: range === "3S" && !isMarketOpen
        ? `${statusLabel} - showing latest official chart`
        : statusLabel,
      isMarketOpen,
      isRealtime: range === "3S" && isMarketOpen,
      isSimulated: false,
      isStale: range === "3S" && !isMarketOpen,
    }

    cache.set(cacheKey, { data: responseData, timestamp: Date.now() })
    pruneChartCache()

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Chart API Error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch chart data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
