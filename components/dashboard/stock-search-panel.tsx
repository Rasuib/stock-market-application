"use client"

import { useState, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, TrendingUp, TrendingDown, Loader2, AlertCircle, ArrowRight } from "lucide-react"
import RealTimeStockChart from "./real-time-stock-chart"
import { fetchJSON } from "@/lib/fetch-client"
import { useTradingStore } from "@/stores/trading-store"
import { SearchResultsSkeleton, StockDetailSkeleton } from "./loading-skeletons"

interface StockData {
  symbol: string
  price: number
  change: number
  changePercent: number
  currency: string
  marketState: string
  exchangeName: string
}

interface NewsData {
  headlines: string[]
  sentiment: "positive" | "negative" | "neutral"
  sentimentScore: number
  totalArticles: number
}

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
  error?: string
}

interface NewsArticle {
  title?: string
}

interface NewsApiResponse {
  articles?: NewsArticle[]
  overallSentiment?: { label?: "bullish" | "bearish" | "neutral"; score?: number }
  totalResults?: number
  error?: boolean
}

export default function StockSearchPanel() {
  const storeSelectStock = useTradingStore((s) => s.selectStock)
  const storeAddToWatchlist = useTradingStore((s) => s.addToWatchlist)
  const [ticker, setTicker] = useState("")
  const [stockData, setStockData] = useState<StockData | null>(null)
  const [newsData, setNewsData] = useState<NewsData | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getMarketFromResult = (result: { symbol: string; currency: string }) => {
    if (result.currency === "INR" || result.symbol.endsWith(".NS") || result.symbol.endsWith(".BO")) {
      return "IN"
    }

    return "US"
  }

  const mapNewsResponse = (data: NewsApiResponse): NewsData | null => {
    if (!data || !Array.isArray(data.articles)) {
      return null
    }

    const sentimentLabel = data.overallSentiment?.label
    const sentiment =
      sentimentLabel === "bullish" ? "positive" : sentimentLabel === "bearish" ? "negative" : "neutral"

    return {
      headlines: data.articles.map((article) => article.title || "").filter(Boolean).slice(0, 5),
      sentiment,
      sentimentScore: (data.overallSentiment?.score ?? 50) / 100,
      totalArticles: data.totalResults ?? data.articles.length,
    }
  }

  const handleMultiSearch = async () => {
    if (!ticker.trim()) return

    setLoading(true)
    setError(null)
    setShowSearchResults(true)
    setStockData(null)

    try {
      const searchData = await fetchJSON<SearchResponse>(
        `/api/stocks/search?q=${encodeURIComponent(ticker)}`,
      )

      if (searchData.error) {
        throw new Error(searchData.error)
      }

      setSearchResults(searchData.results || [])

      if (searchData.results.length === 0) {
        setError(`No results for "${ticker}". Try a company name or ticker like AAPL or RELIANCE.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed. Please try again.")
      setSearchResults([])
    } finally {
      setLoading(false)
    }
  }

  const selectStock = async (result: SearchResult) => {
    setDetailLoading(true)
    setShowSearchResults(false)
    setError(null)

    try {
      const [stockResult, newsResult] = await Promise.all([
        fetchJSON<StockData>(`/api/stock/${encodeURIComponent(result.symbol)}`),
        fetchJSON<NewsApiResponse>(`/api/news?ticker=${encodeURIComponent(result.symbol)}`).catch(() => ({ error: true })),
      ])
      const market = getMarketFromResult(result)

      setStockData(stockResult)
      setNewsData(newsResult.error ? null : mapNewsResponse(newsResult))

      storeSelectStock({
        symbol: stockResult.symbol,
        price: stockResult.price,
        name: result.originalQuery || stockResult.symbol,
        market,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load stock details. Please try again.")
    } finally {
      setDetailLoading(false)
    }
  }

  const handlePriceUpdate = useCallback(
    (price: number, change: number, changePercent: number) => {
      if (!stockData) return

      const updatedStockData = {
        ...stockData,
        price,
        change,
        changePercent,
      }

      setStockData(updatedStockData)
      storeSelectStock({
        symbol: stockData.symbol,
        price,
        name: stockData.symbol,
        market: stockData.currency === "INR" ? "IN" : "US",
      })
    },
    [storeSelectStock, stockData],
  )

  const handleAddToWatchlist = (result: SearchResult) => {
    storeAddToWatchlist({
      symbol: result.symbol,
      name: result.originalQuery || result.symbol,
      price: `${result.currency === "INR" ? "\u20B9" : "$"}${result.price.toFixed(2)}`,
      change: `${result.changePercent >= 0 ? "+" : ""}${result.changePercent.toFixed(2)}%`,
      isPositive: result.changePercent >= 0,
      sector: "Unknown",
      market: getMarketFromResult(result),
    })
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "positive":
        return "bg-profit/20 text-profit border-profit/30"
      case "negative":
        return "bg-loss/20 text-loss border-loss/30"
      default:
        return "bg-muted text-muted-foreground border-border"
    }
  }

  const getSentimentIcon = (sentiment: string) => {
    if (sentiment === "positive") {
      return <TrendingUp className="w-4 h-4" />
    }

    if (sentiment === "negative") {
      return <TrendingDown className="w-4 h-4" />
    }

    return null
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Find a Stock
          </CardTitle>
          {!stockData && !loading && (
            <p className="text-sm text-muted-foreground">Search by company name or ticker symbol to get started.</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Apple, TSLA, Reliance"
              value={ticker}
              onChange={(e) => setTicker(e.target.value)}
              aria-label="Stock ticker search"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleMultiSearch()
                }
              }}
            />
            <Button onClick={handleMultiSearch} disabled={loading || !ticker.trim()} className="touch-manipulation max-sm:px-3">
              {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Searching</> : "Search"}
            </Button>
          </div>

          {/* Error with retry */}
          {error && (
            <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg" role="alert">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-destructive text-sm">{error}</p>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive shrink-0" onClick={handleMultiSearch}>
                Retry
              </Button>
            </div>
          )}

          {loading && showSearchResults && <SearchResultsSkeleton />}

          {showSearchResults && !loading && searchResults.length > 0 && (
            <div className="space-y-2" role="region" aria-label="Search results">
              <p className="text-sm text-muted-foreground" aria-live="polite">{searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found</p>
              {searchResults.map((result, index) => (
                <div
                  key={`${result.symbol}-${index}`}
                  className="flex items-center justify-between gap-4 p-4 bg-surface rounded-lg border border-surface-border hover:border-primary/30 transition-colors cursor-pointer max-md:flex-col"
                  onClick={() => selectStock(result)}
                  onKeyDown={(e) => { if (e.key === "Enter") selectStock(result) }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select ${result.symbol} at ${result.currency === "INR" ? "₹" : "$"}${result.price.toFixed(2)}`}
                >
                  <div>
                    <h5 className="text-lg font-bold">{result.symbol}</h5>
                    <p className="text-xl font-mono">
                      {result.currency === "INR" ? "₹" : "$"}
                      {result.price.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {result.exchangeFullName} | {result.marketState}
                    </p>
                  </div>
                  <div className="text-right max-md:w-full">
                    <p className={`text-lg font-semibold font-mono ${result.change >= 0 ? "text-profit" : "text-loss"}`}>
                      {result.change >= 0 ? "+" : ""}
                      {result.change.toFixed(2)} ({result.changePercent >= 0 ? "+" : ""}{result.changePercent.toFixed(2)}%)
                    </p>
                    <div className="flex gap-2 mt-2 max-md:justify-end max-md:w-full">
                      <Button size="sm" className="touch-manipulation max-md:flex-1 max-md:h-10" onClick={(e) => { e.stopPropagation(); selectStock(result) }}>
                        <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                        Analyze
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="touch-manipulation max-md:flex-1 max-md:h-10"
                        onClick={(e) => { e.stopPropagation(); handleAddToWatchlist(result) }}
                      >
                        + Watchlist
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {detailLoading && !showSearchResults && <StockDetailSkeleton />}

          {stockData && !detailLoading && !showSearchResults && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-surface-border">
                <div>
                  <h3 className="text-xl font-bold">{stockData.symbol}</h3>
                  <p className="text-2xl font-mono">
                    {stockData.currency === "INR" ? "₹" : "$"}
                    {stockData.price.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{stockData.exchangeName}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-semibold font-mono ${stockData.change >= 0 ? "text-profit" : "text-loss"}`}>
                    {stockData.change >= 0 ? "+" : ""}
                    {stockData.change.toFixed(2)}
                  </p>
                  <p className={`text-sm font-mono ${stockData.changePercent >= 0 ? "text-profit" : "text-loss"}`}>
                    ({stockData.changePercent >= 0 ? "+" : ""}
                    {stockData.changePercent.toFixed(2)}%)
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 justify-end">
                    <ArrowRight className="w-3 h-3" />
                    Use the trade panel to buy or sell
                  </p>
                </div>
              </div>

              {newsData && (
                <div className="p-4 bg-surface rounded-lg border border-surface-border">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold">News Sentiment</h4>
                    <Badge className={getSentimentColor(newsData.sentiment)}>
                      {getSentimentIcon(newsData.sentiment)}
                      {newsData.sentiment.toUpperCase()} ({newsData.sentimentScore.toFixed(2)})
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">Based on {newsData.totalArticles} recent articles:</p>
                    {newsData.headlines.map((headline, index) => (
                      <p key={`${headline}-${index}`} className="text-sm p-2 bg-surface-elevated rounded">
                        {headline}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Search prompt — only show when no stock detail is loaded */}
          {!stockData && !showSearchResults && !loading && (
            <div className="py-4 text-center">
              <p className="text-sm text-muted-foreground">
                Search for any stock by name or ticker symbol to view signals and start trading.
              </p>
            </div>
          )}

          {/* "Search again" when viewing a stock */}
          {stockData && !showSearchResults && !loading && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStockData(null)
                setNewsData(null)
                setTicker("")
              }}
              className="w-full"
            >
              <Search className="w-3.5 h-3.5 mr-1.5" />
              Search for a different stock
            </Button>
          )}
        </CardContent>
      </Card>

      {stockData && (
        <RealTimeStockChart
          symbol={stockData.symbol}
          currentPrice={stockData.price}
          change={stockData.change}
          changePercent={stockData.changePercent}
          currency={stockData.currency}
          onPriceUpdate={handlePriceUpdate}
        />
      )}
    </div>
  )
}
