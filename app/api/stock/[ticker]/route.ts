import { type NextRequest, NextResponse } from "next/server"
import { normalizeYahooMarketState } from "@/lib/market-state"
// Rate limiting handled by middleware

export const dynamic = "force-dynamic"
export const revalidate = 0

interface StockResponse {
  symbol: string
  price: number
  change: number
  changePercent: number
  currency: string
  marketState: string
  marketStatusLabel: string
  exchangeName: string
  previousClose: number
  timestamp: number
}

const requestQueue = new Map<string, Promise<StockResponse>>()

export async function GET(request: NextRequest, { params }: { params: { ticker: string } }) {
  try {
    const ticker = params.ticker

    if (ticker === "search") {
      return NextResponse.json(
        { error: "Invalid ticker. Use /api/stocks/search for search functionality." },
        { status: 400 },
      )
    }

    if (!ticker) {
      return NextResponse.json({ error: "Ticker parameter is required" }, { status: 400 })
    }

    const cacheKey = ticker.toUpperCase()

    // Check if there's already a request in progress for this ticker
    if (requestQueue.has(cacheKey)) {
      const result = await requestQueue.get(cacheKey)
      return NextResponse.json(result)
    }

    // Create request promise and add to queue
    const requestPromise = fetchStockData(ticker)
    requestQueue.set(cacheKey, requestPromise)

    try {
      const result = await requestPromise
      return NextResponse.json(result, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      })
    } finally {
      // Remove from queue when done
      requestQueue.delete(cacheKey)
    }
  } catch (error) {
    console.error("Stock API Error:", error)
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid data format received from provider" }, { status: 502 })
    }
    return NextResponse.json({ error: "Failed to fetch stock data. Please try again." }, { status: 500 })
  }
}

async function fetchStockData(ticker: string): Promise<StockResponse> {
  await new Promise((resolve) => setTimeout(resolve, 300)) // Small delay to avoid rate limiting

  const baseQuery = ticker.toUpperCase().replace(/\.(NS|BO)$/, "")

  const tickersToTry: string[] = []

  if (ticker.includes(".")) {
    // Already has an exchange suffix — use it directly
    tickersToTry.push(ticker)
  } else {
    // No suffix: try bare ticker first (works for US), then Indian exchanges as fallback
    tickersToTry.push(ticker, `${baseQuery}.NS`, `${baseQuery}.BO`)
  }

  let lastError = null

  for (const tickerVariant of tickersToTry) {
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${tickerVariant}?interval=1m&range=1d&_=${Date.now()}`

      const response = await fetch(yahooUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        cache: "no-store",
      })

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error("Rate limit exceeded. Please try again later.")
        }
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`)
        continue
      }

      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        console.error("Non-JSON response:", text.substring(0, 100))
        lastError = new Error("Invalid response format from data provider")
        continue
      }

      const data = await response.json()

      if (!data.chart || !data.chart.result || !data.chart.result[0]) {
        lastError = new Error("Stock not found or invalid ticker symbol")
        continue
      }

      const result = data.chart.result[0]
      const meta = result.meta
      const quotes = result.indicators?.quote?.[0]

      if (!meta) {
        lastError = new Error("Invalid stock data received")
        continue
      }

      const normalizedState = normalizeYahooMarketState(meta.marketState)
      let currentPrice = meta.regularMarketPrice

      if (normalizedState === "after-hours" && typeof meta.postMarketPrice === "number") {
        currentPrice = meta.postMarketPrice
      } else if (normalizedState === "pre-market" && typeof meta.preMarketPrice === "number") {
        currentPrice = meta.preMarketPrice
      }

      if (quotes && quotes.close && quotes.close.length > 0) {
        // Get the last non-null close price
        for (let i = quotes.close.length - 1; i >= 0; i--) {
          if (quotes.close[i] !== null) {
            if (normalizedState === "open" || normalizedState === "unknown") {
              currentPrice = quotes.close[i]
            }
            break
          }
        }
      }

      const previousClose = meta.previousClose || meta.chartPreviousClose
      const change = currentPrice - previousClose
      const changePercent = (change / previousClose) * 100

      const stockData = {
        symbol: tickerVariant.toUpperCase(),
        price: Math.round(currentPrice * 100) / 100,
        change: Math.round(change * 100) / 100,
        changePercent: Math.round(changePercent * 100) / 100,
        currency: meta.currency || "USD",
        marketState: meta.marketState || "UNKNOWN",
        marketStatusLabel:
          normalizedState === "open"
            ? "Market Open"
            : normalizedState === "pre-market"
              ? "Pre-market price"
              : normalizedState === "after-hours"
                ? "After-hours price"
                : "Last official price",
        exchangeName: meta.exchangeName || "Unknown Exchange",
        previousClose: previousClose,
        timestamp: Date.now(),
      }

      return stockData
    } catch (error) {
      lastError = error
      continue
    }
  }

  // If all variants failed, throw the last error
  throw lastError || new Error("Failed to fetch stock data")
}
