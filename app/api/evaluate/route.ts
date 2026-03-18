import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import {
  classifySentimentBatch,
  finbertToSentimentLabel,
  finbertToScore,
  detectTrend,
  type PricePoint,
} from "@/lib/ml"
import { evaluateTradeForCoaching, type EvaluateTradeInput } from "@/lib/coaching"

/**
 * POST /api/evaluate
 *
 * Server-side trade evaluation using the unified coaching pipeline.
 *
 * Pipeline:
 *   1. Fetch news headlines for the ticker (Yahoo Finance)
 *   2. Run FinBERT sentiment classification (Hugging Face Inference API)
 *   3. Fetch intraday chart data and run SMA trend detection
 *   4. Run the full coaching expert system pipeline
 *
 * Returns a CoachingReport with verdict, score, feedback, and behavioral flags.
 */

const EvaluateRequestSchema = z.object({
  action: z.enum(["buy", "sell"]),
  ticker: z.string().min(1).max(20).regex(/^[A-Za-z0-9.]+$/, "Invalid ticker format"),
  quantity: z.number().positive().optional().default(1),
  price: z.number().positive().optional().default(100),
  portfolioExposure: z.number().min(0).max(1).optional().default(0.3),
  totalBalance: z.number().positive().optional().default(100000),
  recentTradeCount: z.number().int().min(0).optional().default(0),
  existingPositionSize: z.number().int().min(0).optional().default(0),
})

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()
const RATE_LIMIT = 20 // max requests per window
const RATE_WINDOW_MS = 60_000 // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || "unknown"
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }

  try {
    const body = await request.json()
    const parsed = EvaluateRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues.map(i => i.message) },
        { status: 400 },
      )
    }

    const { action, ticker, quantity, price, portfolioExposure, totalBalance, recentTradeCount, existingPositionSize } = parsed.data
    const cleanTicker = ticker.replace(/\.(NS|BO)$/, "")

    // Fetch sentiment + chart in parallel
    const [sentimentResult, chartResult] = await Promise.allSettled([
      fetchFinBERTSentiment(cleanTicker),
      fetchChartData(ticker),
    ])

    // Process sentiment
    let sentimentLabel: "bullish" | "bearish" | "neutral" = "neutral"
    let sentimentScore = 50
    let sentimentConfidence = 0.3
    let sentimentSource: "finbert" | "heuristic-fallback" | "unavailable" = "unavailable"

    if (sentimentResult.status === "fulfilled" && sentimentResult.value) {
      const fb = sentimentResult.value
      sentimentLabel = finbertToSentimentLabel(fb.aggregate.label) as "bullish" | "bearish" | "neutral"
      sentimentScore = finbertToScore(fb.aggregate)
      sentimentConfidence = fb.aggregate.confidence
      sentimentSource = fb.modelUsed as "finbert" | "heuristic-fallback"
    }

    // Process trend
    let trendLabel: "uptrend" | "downtrend" | "range" | "uncertain" = "uncertain"
    let trendSignal = 0
    let trendConfidence = 0.3
    let shortMA = 0
    let longMA = 0
    let momentum = 0

    if (chartResult.status === "fulfilled" && chartResult.value) {
      const t = detectTrend(chartResult.value)
      trendLabel = t.trend === "neutral" ? "range" : t.trend as "uptrend" | "downtrend"
      trendSignal = t.signal
      trendConfidence = t.confidence
      shortMA = t.shortMA ?? 0
      longMA = t.longMA ?? 0
      momentum = t.priceChangePercent ?? 0
    }

    // Run unified coaching pipeline
    const input: EvaluateTradeInput = {
      action,
      symbol: ticker.toUpperCase(),
      quantity,
      price,
      market: ticker.includes(".NS") || ticker.includes(".BO") ? "IN" : "US",
      currency: ticker.includes(".NS") || ticker.includes(".BO") ? "INR" : "USD",
      sentiment: { label: sentimentLabel, score: sentimentScore, confidence: sentimentConfidence, source: sentimentSource },
      trend: { label: trendLabel, signal: trendSignal, confidence: trendConfidence, shortMA, longMA, momentum },
      portfolioExposure,
      recentTradeCount,
      existingPositionSize,
      totalBalance,
      recentRewards: [],
      tradeHistory: [],
    }

    const coaching = evaluateTradeForCoaching(input)

    return NextResponse.json({
      coaching,
      sentiment: input.sentiment,
      trend: { label: trendLabel, signal: trendSignal, confidence: trendConfidence },
      ticker: ticker.toUpperCase(),
      action,
      timestamp: Date.now(),
    })
  } catch {
    return NextResponse.json({ error: "Failed to evaluate trade" }, { status: 500 })
  }
}

// ── Safe fetch with timeout ──

const FETCH_TIMEOUT_MS = 8_000

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function fetchFinBERTSentiment(cleanTicker: string) {
  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(cleanTicker)}&newsCount=10`
    const response = await fetchWithTimeout(yahooUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    })
    if (!response.ok) return null
    const data = await response.json()
    if (!data.news || data.news.length === 0) return null

    const headlines = data.news
      .map((item: Record<string, string>) => item.title || "")
      .filter((t: string) => t.length > 0)
      .slice(0, 15)
    if (headlines.length === 0) return null

    return await classifySentimentBatch(headlines)
  } catch {
    return null
  }
}

async function fetchChartData(ticker: string): Promise<PricePoint[] | null> {
  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=5m&range=1d`
    const response = await fetchWithTimeout(yahooUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    })
    if (!response.ok) return null
    const data = await response.json()
    const result = data.chart?.result?.[0]
    if (!result) return null

    const timestamps: number[] = result.timestamp || []
    const prices: (number | null)[] = result.indicators?.quote?.[0]?.close || []

    const priceHistory: PricePoint[] = []
    for (let i = 0; i < timestamps.length; i++) {
      if (prices[i] != null && (prices[i] as number) > 0) {
        priceHistory.push({ price: prices[i] as number, timestamp: timestamps[i] * 1000 })
      }
    }

    return priceHistory.length >= 2 ? priceHistory : null
  } catch {
    return null
  }
}
