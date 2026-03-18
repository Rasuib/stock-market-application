import { type NextRequest, NextResponse } from "next/server"

const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 5000 // 5 seconds for real-time feel

function generateRealtimeDataPoint(basePrice: number): { time: string; price: number; timestamp: number } {
  const now = Date.now()
  // Simulate small price fluctuations (±0.3%)
  const volatility = 0.003
  const randomChange = (Math.random() - 0.5) * 2 * volatility * basePrice
  const newPrice = Math.max(basePrice + randomChange, 0.01)

  return {
    time: new Date(now).toISOString(),
    price: Math.round(newPrice * 100) / 100,
    timestamp: now,
  }
}

export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const range = searchParams.get("range") || "1D"
    const ticker = params.ticker

    const cacheKey = `${ticker}-${range}`
    const cached = cache.get(cacheKey)

    if (range === "3S") {
      if (cached && cached.data.chartData && cached.data.chartData.length > 0) {
        const lastPrice = cached.data.chartData[cached.data.chartData.length - 1]?.price || 100
        const newDataPoint = generateRealtimeDataPoint(lastPrice)

        return NextResponse.json({
          success: true,
          chartData: [newDataPoint],
          symbol: ticker,
          range,
          dataPoints: 1,
          isRealtime: true,
        })
      }
      // If no cache, fetch initial data
    } else if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data)
    }

    // Map time ranges to periods and intervals
    const rangeMap: Record<string, { period: string; interval: string }> = {
      "3S": { period: "1d", interval: "1m" }, // Add 3S mapping for real-time
      "1D": { period: "1d", interval: "5m" },
      "5D": { period: "5d", interval: "15m" },
      "1M": { period: "1mo", interval: "1h" },
      "3M": { period: "3mo", interval: "1d" },
      "1Y": { period: "1y", interval: "1d" },
      ALL: { period: "max", interval: "1mo" },
    }

    const { period, interval } = rangeMap[range] || rangeMap["1D"]

    // Fetch historical data from Yahoo Finance
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?period1=0&period2=9999999999&interval=${interval}&range=${period}`

    const response = await fetch(yahooUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    })

    if (!response.ok) {
      if (response.status === 429) {
        if (cached && cached.data.chartData && cached.data.chartData.length > 0) {
          const lastPrice = cached.data.chartData[cached.data.chartData.length - 1]?.price || 100
          const newDataPoint = generateRealtimeDataPoint(lastPrice)
          return NextResponse.json({
            success: true,
            chartData: [newDataPoint],
            symbol: ticker,
            range,
            dataPoints: 1,
            isRealtime: true,
            isSimulated: true,
          })
        }
        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            details: "Too many requests to Yahoo Finance API. Please try again later.",
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

      if (textResponse.includes("Too Many Requests") || textResponse.includes("rate limit")) {
        if (cached && cached.data.chartData && cached.data.chartData.length > 0) {
          const lastPrice = cached.data.chartData[cached.data.chartData.length - 1]?.price || 100
          const newDataPoint = generateRealtimeDataPoint(lastPrice)
          return NextResponse.json({
            success: true,
            chartData: [newDataPoint],
            symbol: ticker,
            range,
            dataPoints: 1,
            isRealtime: true,
            isSimulated: true,
          })
        }
        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            details: "Yahoo Finance API rate limit reached. Please try again later.",
            retryAfter: 60,
          },
          { status: 429 },
        )
      }

      throw new Error("Invalid response format from Yahoo Finance API")
    }

    const data = await response.json()
    const result = data.chart?.result?.[0]

    if (!result) {
      throw new Error("No chart data available")
    }

    const timestamps = result.timestamp || []
    const prices = result.indicators?.quote?.[0]?.close || []

    // Format chart data
    const chartData = timestamps
      .map((timestamp: number, index: number) => ({
        time: new Date(timestamp * 1000).toISOString(),
        price: prices[index] || 0,
        timestamp: timestamp * 1000,
      }))
      .filter((point: any) => point.price > 0)

    const responseData = {
      success: true,
      chartData,
      symbol: ticker,
      range,
      dataPoints: chartData.length,
    }

    cache.set(cacheKey, { data: responseData, timestamp: Date.now() })

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
