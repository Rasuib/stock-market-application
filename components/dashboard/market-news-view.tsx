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
        return <TrendingUp className="w-4 h-4 text-green-400" />
      case "bearish":
        return <TrendingDown className="w-4 h-4 text-red-400" />
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-400" />
    }
  }

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case "bullish":
        return "border-green-500 bg-green-500/10"
      case "bearish":
        return "border-red-500 bg-red-500/10"
      default:
        return "border-yellow-500 bg-yellow-500/10"
    }
  }

  const getImpactBadge = (impact: string) => {
    const colors = {
      high: "bg-red-500/20 text-red-400",
      medium: "bg-yellow-500/20 text-yellow-400",
      low: "bg-green-500/20 text-green-400",
    }
    return colors[impact as keyof typeof colors] || colors.medium
  }

  const getSentimentScoreColor = (score: number) => {
    if (score >= 65) return "text-green-400"
    if (score <= 35) return "text-red-400"
    return "text-yellow-400"
  }

  const getOverallSentimentColor = (score: number) => {
    if (score >= 65) return "bg-green-500"
    if (score <= 35) return "bg-red-500"
    return "bg-yellow-500"
  }

  const popularStocks = ["RELIANCE", "TCS", "INFY", "HDFC", "ICICI", "NIFTY", "SENSEX", "ADANI"]

  const totalNews = news.length

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Market News</h2>
          <p className="text-gray-400">Latest updates and market developments</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={sentimentModel === "finbert" ? "bg-purple-500/20 text-purple-400" : "bg-gray-500/20 text-gray-400"}>
            {sentimentModel === "finbert" ? "FinBERT Sentiment" : sentimentModel === "heuristic-fallback" ? "Heuristic Sentiment" : "Loading..."}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-gray-700 bg-gray-800/50"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Search Section */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="pt-4">
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search news by stock symbol or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-gray-800 border-gray-700 text-white"
              />
            </div>
            <Button type="submit" className="bg-purple-600 hover:bg-purple-700">
              Search
            </Button>
          </form>

          {/* Quick Stock Search Tags */}
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-400">Quick search:</span>
            {popularStocks.map((stock) => (
              <Badge
                key={stock}
                variant="outline"
                className={`cursor-pointer hover:bg-purple-600/20 hover:border-purple-500 transition-colors ${
                  activeTicker.includes(stock) ? "bg-purple-600/30 border-purple-500" : ""
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
        <Card className="bg-gray-900/50 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg flex items-center gap-2">
              Overall Sentiment
              {activeTicker && (
                <Badge variant="outline" className="ml-2">
                  {activeTicker.replace(".NS", "")}
                </Badge>
              )}
              <span className="text-xs font-normal text-gray-500 ml-auto">
                via {sentimentModel === "finbert" ? "FinBERT (ProsusAI)" : "keyword heuristic"}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              {/* Sentiment Score */}
              <div className="text-center">
                <div className={`text-4xl font-bold ${getSentimentScoreColor(overallSentiment.score)}`}>
                  {overallSentiment.score}
                </div>
                <div className="text-sm text-gray-400">Sentiment Score</div>
              </div>

              {/* Sentiment Bar */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-red-400">Bearish</span>
                  <span className={`text-sm font-medium capitalize ${getSentimentScoreColor(overallSentiment.score)}`}>
                    {overallSentiment.label}
                  </span>
                  <span className="text-sm text-green-400">Bullish</span>
                </div>
                <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getOverallSentimentColor(overallSentiment.score)} transition-all duration-500`}
                    style={{ width: `${overallSentiment.score}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>0</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>

              {/* Article Breakdown */}
              <div className="flex gap-4">
                <div className="text-center p-2 bg-green-500/10 rounded-lg">
                  <div className="text-lg font-bold text-green-400">{overallSentiment.bullishCount}</div>
                  <div className="text-xs text-gray-400">Bullish</div>
                </div>
                <div className="text-center p-2 bg-yellow-500/10 rounded-lg">
                  <div className="text-lg font-bold text-yellow-400">{overallSentiment.neutralCount}</div>
                  <div className="text-xs text-gray-400">Neutral</div>
                </div>
                <div className="text-center p-2 bg-red-500/10 rounded-lg">
                  <div className="text-lg font-bold text-red-400">{overallSentiment.bearishCount}</div>
                  <div className="text-xs text-gray-400">Bearish</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <span className="ml-2 text-gray-400">Loading latest news...</span>
        </div>
      ) : news.length === 0 ? (
        <Card className="bg-gray-900/50 border-gray-800">
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">No news found</h3>
            <p className="text-gray-400">Try searching for a different stock or keyword</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* News Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {news.map((article) => (
              <Card
                key={article.id}
                className={`bg-gray-900/50 border-gray-800 ${getSentimentColor(article.sentiment)} border-l-4 hover:bg-gray-800/50 transition-colors`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <CardTitle className="text-lg text-white leading-tight mb-2 line-clamp-2">
                        {article.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {getSentimentIcon(article.sentiment)}
                        <Badge className={`${getSentimentScoreColor(article.sentimentScore)} bg-gray-800`}>
                          Score: {article.sentimentScore}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {article.category}
                        </Badge>
                        <Badge className={getImpactBadge(article.impact)}>{article.impact.toUpperCase()}</Badge>
                        <Badge variant="outline" className="text-xs text-gray-400">
                          {article.source}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-gray-300 text-sm leading-relaxed mb-3 line-clamp-3">{article.summary}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="w-3 h-3" />
                      {article.timestamp}
                    </div>
                    {article.url && (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
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
          <Card className="bg-gray-900/50 border-gray-800">
            <CardHeader>
              <CardTitle className="text-white">Market Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <div className="text-2xl font-bold text-green-400">
                    {totalNews > 0 ? Math.round((overallSentiment.bullishCount / totalNews) * 100) : 0}%
                  </div>
                  <div className="text-sm text-gray-400">Bullish Sentiment</div>
                  <div className="text-xs text-gray-500 mt-1">{overallSentiment.bullishCount} articles</div>
                </div>
                <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="text-2xl font-bold text-blue-400">{totalNews}</div>
                  <div className="text-sm text-gray-400">News Articles</div>
                  <div className="text-xs text-gray-500 mt-1">Last updated just now</div>
                </div>
                <div className="text-center p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                  <div className="text-2xl font-bold text-red-400">{overallSentiment.bearishCount}</div>
                  <div className="text-sm text-gray-400">Bearish Articles</div>
                  <div className="text-xs text-gray-500 mt-1">
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
