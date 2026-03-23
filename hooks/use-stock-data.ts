"use client"

import { useMemo, useCallback } from "react"
import useSWR from "swr"
import { detectTrend, type PricePoint } from "@/lib/ml/trend-detection"

export interface SentimentData {
  label: "bullish" | "bearish" | "neutral"
  score: number
  confidence: number
  source: "finbert" | "heuristic-fallback" | "unavailable"
}

export interface TrendData {
  label: "uptrend" | "downtrend" | "range" | "uncertain"
  signal: number
  confidence: number
  shortMA: number
  longMA: number
  momentum: number
}

interface UseStockDataReturn {
  sentiment: SentimentData | null
  trend: TrendData | null
  loading: boolean
  error: string | null
  refresh: () => void
}

const DEFAULT_SENTIMENT: SentimentData = { label: "neutral", score: 50, confidence: 0.3, source: "unavailable" }
const DEFAULT_TREND: TrendData = { label: "uncertain", signal: 0, confidence: 0.2, shortMA: 0, longMA: 0, momentum: 0 }

/**
 * Fetches sentiment and trend data for a given stock symbol.
 * Uses SWR for caching, deduplication, and stale-while-revalidate.
 */
export function useStockData(symbol: string | undefined): UseStockDataReturn {
  const cleanSymbol = symbol?.replace(/\.(NS|BO)$/, "")

  // SWR for news/sentiment
  const {
    data: newsData,
    error: newsError,
    isLoading: newsLoading,
    mutate: mutateNews,
  } = useSWR(
    symbol ? `/api/news?q=${encodeURIComponent(cleanSymbol!)}&ticker=${encodeURIComponent(symbol)}` : null,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  )

  // SWR for chart/trend
  const {
    data: chartData,
    error: chartError,
    isLoading: chartLoading,
    mutate: mutateChart,
  } = useSWR(
    symbol ? `/api/stock/${symbol}/chart?range=1D` : null,
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  )

  // Derive sentiment from news response
  const sentiment: SentimentData | null = useMemo(() => {
    if (!symbol) return null
    if (!newsData?.overallSentiment) return newsError ? DEFAULT_SENTIMENT : null

    const s = newsData.overallSentiment
    return {
      label: s.label === "bullish" ? "bullish" : s.label === "bearish" ? "bearish" : "neutral",
      score: s.score,
      confidence: s.confidence,
      source: newsData.sentimentModel || "unavailable",
    } as SentimentData
  }, [symbol, newsData, newsError])

  // Derive trend from chart response
  const trend: TrendData | null = useMemo(() => {
    if (!symbol) return null
    if (!chartData?.chartData?.length) return chartError ? DEFAULT_TREND : null

    const priceHistory: PricePoint[] = chartData.chartData.map((p: { price: number; timestamp: number }) => ({
      price: p.price,
      timestamp: p.timestamp,
    }))
    const trendSignal = detectTrend(priceHistory)
    const label = trendSignal.trend === "uptrend" ? "uptrend" as const
      : trendSignal.trend === "downtrend" ? "downtrend" as const
      : trendSignal.confidence < 0.2 ? "uncertain" as const
      : "range" as const

    return {
      label,
      signal: trendSignal.signal,
      confidence: trendSignal.confidence,
      shortMA: trendSignal.shortMA,
      longMA: trendSignal.longMA,
      momentum: trendSignal.priceChangePercent,
    }
  }, [symbol, chartData, chartError])

  const loading = (newsLoading || chartLoading) && !newsData && !chartData
  const error = newsError || chartError
    ? (newsError?.message || chartError?.message || "Failed to load market signals")
    : null

  const refresh = useCallback(() => {
    mutateNews()
    mutateChart()
  }, [mutateNews, mutateChart])

  return { sentiment, trend, loading, error, refresh }
}
