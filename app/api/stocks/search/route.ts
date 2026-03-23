import { type NextRequest, NextResponse } from "next/server"
// Rate limiting handled by middleware

interface SearchResult {
  symbol: string
  price: number
  change: number
  changePercent: number
  currency: string
  marketState: string
  exchangeName: string
  exchange: string
  exchangeFullName: string
  originalQuery: string
}

interface SearchResponse {
  query: string
  results: SearchResult[]
  timestamp: number
}

interface StockData {
  symbol: string
  price: number
  change: number
  changePercent: number
  currency: string
  marketState: string
  exchangeName: string
}

const cache = new Map<string, { data: SearchResponse; timestamp: number }>()
const CACHE_DURATION = 300000 // 5 minutes cache
const MAX_CACHE_SIZE = 100

function pruneCache() {
  if (cache.size <= MAX_CACHE_SIZE) return
  const now = Date.now()
  for (const [key, entry] of cache) {
    if (now - entry.timestamp > CACHE_DURATION) cache.delete(key)
  }
  // If still too large, remove oldest
  if (cache.size > MAX_CACHE_SIZE) {
    const entries = [...cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)
    for (let i = 0; i < entries.length - MAX_CACHE_SIZE; i++) {
      cache.delete(entries[i][0])
    }
  }
}

// Well-known US tickers — never route these to Indian exchanges
const KNOWN_US_TICKERS = new Set([
  "AAPL", "GOOGL", "GOOG", "MSFT", "AMZN", "TSLA", "META", "NVDA", "NFLX",
  "AMD", "INTC", "ORCL", "CRM", "ADBE", "PYPL", "SQ", "SHOP", "UBER", "LYFT",
  "COIN", "SNOW", "PLTR", "RIVN", "LCID", "NIO", "BA", "DIS", "JPM", "GS",
  "V", "MA", "WMT", "KO", "PEP", "JNJ", "PFE", "MRNA", "XOM", "CVX",
  "SPY", "QQQ", "IWM", "DIA", "VTI",
])

// Well-known Indian tickers
const KNOWN_INDIAN_TICKERS = new Set([
  "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "ITC", "LT",
  "HINDUNILVR", "BAJFINANCE", "BHARTIARTL", "HCLTECH", "WIPRO", "KOTAKBANK",
  "AXISBANK", "MARUTI", "TATAMOTORS", "TATASTEEL", "ADANIENT", "ADANIGREEN",
  "ADANIPORTS", "SUNPHARMA", "DRREDDY", "CIPLA", "DIVISLAB", "NESTLEIND",
  "TITAN", "ULTRACEMCO", "POWERGRID", "NTPC", "ONGC", "COALINDIA",
  "BAJAJFINSV", "ASIANPAINT", "TECHM", "JSWSTEEL", "HINDALCO",
])

function classifyTicker(symbol: string): "US" | "IN" | "unknown" {
  const upper = symbol.toUpperCase().replace(/\.(NS|BO)$/, "")
  if (KNOWN_US_TICKERS.has(upper)) return "US"
  if (KNOWN_INDIAN_TICKERS.has(upper)) return "IN"
  if (/\.(NS|BO)$/i.test(symbol)) return "IN"
  return "unknown"
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q")

    if (!query) {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 })
    }

    const cacheKey = `search_${query.toUpperCase()}`
    const now = Date.now()

    const cached = cache.get(cacheKey)
    if (cached && now - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data)
    }

    const results: SearchResult[] = []
    const baseQuery = query.toUpperCase().replace(/\.(NS|BO)$/, "")
    const classification = classifyTicker(query)

    if (classification === "US") {
      // Known US ticker — only try US
      const stockData = await tryFetch(baseQuery)
      if (stockData) {
        results.push({
          ...stockData,
          exchange: "US",
          exchangeFullName: stockData.exchangeName || "US Market",
          originalQuery: baseQuery,
        })
      }
    } else if (classification === "IN") {
      // Known Indian ticker — try NSE and BSE
      await tryIndianExchanges(baseQuery, results)
    } else {
      // Unknown — try all: US first (1 call), then Indian exchanges (2 calls)
      const usData = await tryFetch(baseQuery)
      if (usData) {
        results.push({
          ...usData,
          exchange: "US",
          exchangeFullName: usData.exchangeName || "US Market",
          originalQuery: baseQuery,
        })
      }
      // Also try Indian exchanges
      await tryIndianExchanges(baseQuery, results)
    }

    const searchResults = {
      query: baseQuery,
      results,
      timestamp: now,
    }

    cache.set(cacheKey, { data: searchResults, timestamp: now })
    pruneCache()
    return NextResponse.json(searchResults)
  } catch (error) {
    console.error("Stock Search API Error:", error)
    return NextResponse.json({ error: "Failed to search stocks" }, { status: 500 })
  }
}

async function tryIndianExchanges(baseQuery: string, results: SearchResult[]) {
  const exchanges = [
    { suffix: ".NS", name: "NSE", fullName: "National Stock Exchange" },
    { suffix: ".BO", name: "BSE", fullName: "Bombay Stock Exchange" },
  ]

  for (const exchange of exchanges) {
    const ticker = `${baseQuery}${exchange.suffix}`
    const stockData = await tryFetch(ticker)
    if (stockData) {
      results.push({
        ...stockData,
        exchange: exchange.name,
        exchangeFullName: exchange.fullName,
        originalQuery: baseQuery,
      })
    }
  }
}

async function tryFetch(ticker: string): Promise<StockData | null> {
  try {
    return await fetchStockData(ticker)
  } catch {
    return null
  }
}

async function fetchStockData(ticker: string) {
  const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`

  const response = await fetch(yahooUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const data = await response.json()

  if (!data.chart || !data.chart.result || !data.chart.result[0]) {
    throw new Error("Stock not found")
  }

  const result = data.chart.result[0]
  const meta = result.meta

  if (!meta) {
    throw new Error("Invalid stock data")
  }

  const currentPrice = meta.regularMarketPrice || meta.previousClose
  const previousClose = meta.previousClose
  const change = currentPrice - previousClose
  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0

  return {
    symbol: ticker.toUpperCase(),
    price: currentPrice,
    change,
    changePercent,
    currency: meta.currency || "USD",
    marketState: meta.marketState || "UNKNOWN",
    exchangeName: meta.exchangeName || "Unknown Exchange",
  }
}
