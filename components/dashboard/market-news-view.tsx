"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Clock, TrendingUp, TrendingDown, AlertCircle, Search, RefreshCw, ExternalLink, Loader2 } from "lucide-react"

interface NewsArticle {
  id: number
  title: string
  summary: string
  source: string
  url: string
  imageUrl?: string
  publishedAt: string
  timestamp: string
  category: string
  sentiment: "bullish" | "bearish" | "neutral"
  sentimentScore: number
  sentimentConfidence: number
  impact: "high" | "medium" | "low"
}

interface OverallSentiment {
  score: number
  label: string
  confidence: number
  bullishCount: number
  bearishCount: number
  neutralCount: number
}

export default function MarketNewsView() {
  const [news, setNews] = useState<NewsArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeSearch, setActiveSearch] = useState("stock market India")
  const [activeTicker, setActiveTicker] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [overallSentiment, setOverallSentiment] = useState<OverallSentiment>({
    score: 50,
    label: "neutral",
    confidence: 0,
    bullishCount: 0,
    bearishCount: 0,
    neutralCount: 0,
  })
  const [sentimentModel, setSentimentModel] = useState<string>("unknown")

  const fetchNews = useCallback(async (query: string, ticker?: string) => {
    try {
      setLoading(true)
      const tickerParam = ticker ? `&ticker=${encodeURIComponent(ticker)}` : ""
      const response = await fetch(`/api/news?q=${encodeURIComponent(query)}${tickerParam}&_t=${Date.now()}`)
      if (!response.ok) throw new Error("Failed to fetch news")

      const data = await response.json()
      setNews(data.articles || [])

      if (data.overallSentiment) {
        setOverallSentiment(data.overallSentiment)
      }
      if (data.sentimentModel) {
        setSentimentModel(data.sentimentModel)
      }
    } catch (error) {
      console.error("Failed to fetch news:", error)
      setNews([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchNews(activeSearch, activeTicker)

    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchNews(activeSearch, activeTicker)
    }, 60000)

    return () => clearInterval(interval)
  }, [activeSearch, activeTicker, fetchNews])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setActiveSearch(searchQuery.trim() + " stock news")
      setActiveTicker("")
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchNews(activeSearch, activeTicker)
  }

  const handleStockSearch = (stock: string) => {
    setSearchQuery(stock)
    // Map common names to tickers
    const tickerMap: { [key: string]: string } = {
      RELIANCE: "RELIANCE.NS",
      TCS: "TCS.NS",
      INFY: "INFY.NS",
      HDFC: "HDFCBANK.NS",
      ICICI: "ICICIBANK.NS",
      NIFTY: "^NSEI",
      SENSEX: "^BSESN",
      ADANI: "ADANIENT.NS",
    }
    const ticker = tickerMap[stock] || `${stock}.NS`
    setActiveTicker(ticker)
    setActiveSearch(stock + " stock share price news")
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case "bullish":
        return <TrendingUp className="w-4 h-4 text-success" />
      case "bearish":
        return <TrendingDown className="w-4 h-4 text-destructive" />
      default:
        return <AlertCircle className="w-4 h-4 text-warning" />
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "bullish":
        return "border-success bg-success/10"
      case "bearish":
        return "border-destructive bg-destructive/10"
      default:
        return "border-warning bg-warning/10"
    }
  }

  const getImpactBadge = (impact: string) => {
    const colors = {
      high: "bg-destructive/20 text-destructive",
      medium: "bg-warning/20 text-warning",
      low: "bg-success/20 text-success",
    }
    return colors[impact as keyof typeof colors] || colors.medium
  }

  const getSentimentScoreColor = (score: number) => {
    if (score >= 65) return "text-success"
    if (score <= 35) return "text-destructive"
    return "text-warning"
  }

  const getOverallSentimentColor = (score: number) => {
    if (score >= 65) return "bg-success"
    if (score <= 35) return "bg-destructive"
    return "bg-warning"
  }

  const popularStocks = ["RELIANCE", "TCS", "INFY", "HDFC", "ICICI", "NIFTY", "SENSEX", "ADANI"]

  const totalNews = news.length

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Market News</h2>
          <p className="text-muted-foreground">Latest updates and market developments</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={sentimentModel === "finbert" ? "bg-chart-4/20 text-chart-4" : "bg-muted/20 text-muted-foreground"}>
            {sentimentModel === "finbert" ? "FinBERT Sentiment" : sentimentModel === "heuristic-fallback" ? "Heuristic Sentiment" : "Loading..."}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-border bg-surface"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search Section */}
      <Card>
        <CardContent className="pt-4">
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search news by stock symbol or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-surface border-border text-foreground"
              />
            </div>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
              Search
            </Button>
          </form>

          {/* Quick Stock Search Tags */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Quick search:</span>
            {popularStocks.map((stock) => (
              <Badge
                key={stock}
                variant="outline"
                className={`cursor-pointer hover:bg-chart-4/20 hover:border-chart-4 transition-colors ${
                  activeTicker.includes(stock) ? "bg-chart-4/30 border-chart-4" : ""
                }`}
                onClick={() => handleStockSearch(stock)}
              >
                {stock}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {!loading && news.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-lg flex items-center gap-2">
              Overall Sentiment
              {activeTicker && (
                <Badge variant="outline" className="ml-2">
                  {activeTicker.replace(".NS", "")}
                </Badge>
              )}
              <span className="text-xs font-normal text-muted-foreground ml-auto">
                via {sentimentModel === "finbert" ? "FinBERT (ProsusAI)" : "keyword heuristic"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              {/* Sentiment Score */}
              <div className="text-center shrink-0">
                <div className={`text-4xl font-bold ${getSentimentScoreColor(overallSentiment.score)}`}>
                  {overallSentiment.score}
                </div>
                <div className="text-sm text-muted-foreground">Sentiment Score</div>
              </div>

              {/* Sentiment Bar */}
              <div className="flex-1 w-full">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-destructive">Bearish</span>
                  <span className={`text-sm font-medium capitalize ${getSentimentScoreColor(overallSentiment.score)}`}>
                    {overallSentiment.label}
                  </span>
                  <span className="text-sm text-success">Bullish</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getOverallSentimentColor(overallSentiment.score)} transition-all duration-500`}
                    style={{ width: `${overallSentiment.score}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>

              {/* Article Breakdown */}
              <div className="flex gap-3 sm:gap-4 w-full sm:w-auto shrink-0">
                <div className="text-center p-2 bg-success/10 rounded-lg flex-1 sm:flex-initial">
                  <div className="text-lg font-bold text-success">{overallSentiment.bullishCount}</div>
                  <div className="text-xs text-muted-foreground">Bullish</div>
                </div>
                <div className="text-center p-2 bg-warning/10 rounded-lg flex-1 sm:flex-initial">
                  <div className="text-lg font-bold text-warning">{overallSentiment.neutralCount}</div>
                  <div className="text-xs text-muted-foreground">Neutral</div>
                </div>
                <div className="text-center p-2 bg-destructive/10 rounded-lg flex-1 sm:flex-initial">
                  <div className="text-lg font-bold text-destructive">{overallSentiment.bearishCount}</div>
                  <div className="text-xs text-muted-foreground">Bearish</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-chart-4" />
          <span className="ml-2 text-muted-foreground">Loading latest news...</span>
        </div>
      ) : news.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No news found</h3>
            <p className="text-muted-foreground">Try searching for a different stock or keyword</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* News Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {news.map((article) => (
              <Card
                key={article.id}
                className={`${getSentimentColor(article.sentiment)} border-l-4 hover:bg-surface transition-colors`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <CardTitle className="text-base sm:text-lg text-foreground leading-tight mb-2 line-clamp-3 sm:line-clamp-2">
                        {article.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {getSentimentIcon(article.sentiment)}
                        <Badge className={`${getSentimentScoreColor(article.sentimentScore)} bg-surface`}>
                          Score: {article.sentimentScore}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {article.category}
                        </Badge>
                        <Badge className={getImpactBadge(article.impact)}>{article.impact.toUpperCase()}</Badge>
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          {article.source}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-foreground/80 text-sm leading-relaxed mb-3 line-clamp-4 sm:line-clamp-3">{article.summary}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {article.timestamp}
                    </div>
                    {article.url && (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-chart-4 hover:text-chart-4/80"
                      >
                        Read more <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Market Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Market Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-success/10 rounded-lg border border-success/20">
                  <div className="text-2xl font-bold text-success">
                    {totalNews > 0 ? Math.round((overallSentiment.bullishCount / totalNews) * 100) : 0}%
                  </div>
                  <div className="text-sm text-muted-foreground">Bullish Sentiment</div>
                  <div className="text-xs text-muted-foreground mt-1">{overallSentiment.bullishCount} articles</div>
                </div>
                <div className="text-center p-4 bg-primary/10 rounded-lg border border-primary/20">
                  <div className="text-2xl font-bold text-primary">{totalNews}</div>
                  <div className="text-sm text-muted-foreground">News Articles</div>
                  <div className="text-xs text-muted-foreground mt-1">Last updated just now</div>
                </div>
                <div className="text-center p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <div className="text-2xl font-bold text-destructive">{overallSentiment.bearishCount}</div>
                  <div className="text-sm text-muted-foreground">Bearish Articles</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {totalNews > 0 ? Math.round((overallSentiment.bearishCount / totalNews) * 100) : 0}% of total
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
