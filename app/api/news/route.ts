import { type NextRequest, NextResponse } from "next/server"
import { classifySentimentBatch, finbertToSentimentLabel, finbertToScore } from "@/lib/ml"

/**
 * GET /api/news
 *
 * Fetches financial news and analyzes sentiment using FinBERT (ProsusAI/finbert).
 *
 * Pipeline:
 *   1. Fetch headlines from Yahoo Finance or Google News RSS
 *   2. Batch-classify all headlines via FinBERT (Hugging Face Inference API)
 *   3. If FinBERT is unavailable, falls back to keyword heuristics (clearly labeled)
 *   4. Aggregate overall sentiment from individual article scores
 *
 * Query params:
 *   q      - search query (default: "stock market India")
 *   ticker - specific stock ticker for targeted news
 *   page   - page number for pagination (default: 1)
 *   limit  - articles per page (default: 10)
 */
export async function GET(request: NextRequest) {
  // Rate limiting handled by middleware

  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("q") || "stock market India"
    const ticker = searchParams.get("ticker") || ""
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1)
    const limit = Math.max(1, Math.min(50, parseInt(searchParams.get("limit") || "10", 10) || 10))

    // ── Stage 1: Fetch raw articles ──
    let rawArticles: RawArticle[] = []

    if (ticker) {
      rawArticles = await fetchYahooNews(ticker)
    }

    if (rawArticles.length === 0) {
      rawArticles = await fetchGoogleNews(query, ticker)
    }

    if (rawArticles.length === 0) {
      rawArticles = getFallbackArticles(ticker)
    }

    // ── Stage 2: FinBERT sentiment classification (batch) ──
    const texts = rawArticles.map(a => a.title + (a.description ? ". " + a.description : ""))
    const finbertResults = await classifySentimentBatch(texts)

    // ── Stage 3: Merge results ──
    const articles = rawArticles.map((article, i) => {
      const fb = finbertResults.results[i]
      return {
        id: i + 1,
        title: article.title,
        summary: article.description || generateSummary(article.title, article.source),
        source: article.source,
        url: article.url,
        imageUrl: article.imageUrl,
        publishedAt: article.publishedAt,
        timestamp: getTimeAgo(new Date(article.publishedAt)),
        category: categorizeNews(article.title),
        // FinBERT sentiment fields
        sentiment: finbertToSentimentLabel(fb.label),
        sentimentScore: finbertToScore(fb),
        sentimentConfidence: fb.confidence,
        sentimentSource: fb.source, // "finbert" or "heuristic-fallback"
        sentimentScores: fb.scores, // { positive, negative, neutral }
        impact: classifyImpact(article.title),
        ticker: ticker || null,
      }
    })

    const overallSentiment = calculateOverallSentiment(articles)

    const totalResults = articles.length
    const totalPages = Math.ceil(totalResults / limit)
    const startIndex = (page - 1) * limit
    const paginatedArticles = articles.slice(startIndex, startIndex + limit)

    return NextResponse.json({
      articles: paginatedArticles,
      totalResults,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
      query,
      ticker,
      overallSentiment,
      sentimentModel: finbertResults.modelUsed,
    })
  } catch (error) {
    console.error("News API Error:", error)
    const fallback = getFallbackArticles("")
    const fallbackArticles = fallback.map((a, i) => ({
      id: i + 1,
      title: a.title,
      summary: a.description,
      source: a.source,
      url: a.url,
      imageUrl: null,
      publishedAt: a.publishedAt,
      timestamp: getTimeAgo(new Date(a.publishedAt)),
      category: categorizeNews(a.title),
      sentiment: "neutral" as const,
      sentimentScore: 50,
      sentimentConfidence: 0.3,
      sentimentSource: "heuristic-fallback" as const,
      sentimentScores: { positive: 0.33, negative: 0.33, neutral: 0.34 },
      impact: "medium" as const,
      ticker: null,
    }))
    const fallbackTotal = fallbackArticles.length
    const fallbackTotalPages = Math.ceil(fallbackTotal / 10)
    return NextResponse.json({
      articles: fallbackArticles.slice(0, 10),
      totalResults: fallbackTotal,
      page: 1,
      limit: 10,
      totalPages: fallbackTotalPages,
      hasMore: 1 < fallbackTotalPages,
      query: "stock market",
      isFallback: true,
      sentimentModel: "heuristic-fallback",
      overallSentiment: { score: 50, label: "neutral", confidence: 0, bullishCount: 0, bearishCount: 0, neutralCount: 0 },
    })
  }
}

// ──── Types ────

interface RawArticle {
  title: string
  description: string
  source: string
  url: string
  imageUrl: string | null
  publishedAt: string
}

interface YahooNewsItem {
  title?: string
  publisher?: string
  link?: string
  thumbnail?: { resolutions?: Array<{ url?: string }> }
  providerPublishTime?: number
}

// ──── Data Sources ────

async function fetchYahooNews(ticker: string): Promise<RawArticle[]> {
  const cleanTicker = ticker.replace(/\.(NS|BO)$/, "")
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(cleanTicker)}&newsCount=10`
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    })
    if (!response.ok) return []
    const data = await response.json()
    if (!data.news || data.news.length === 0) return []

    return (data.news as YahooNewsItem[]).map((item) => ({
      title: item.title || "Market Update",
      description: item.title || "",
      source: item.publisher || "Yahoo Finance",
      url: item.link || "",
      imageUrl: item.thumbnail?.resolutions?.[0]?.url || null,
      publishedAt: new Date((item.providerPublishTime || 0) * 1000).toISOString(),
    }))
  } catch {
    return []
  }
}

async function fetchGoogleNews(query: string, ticker: string): Promise<RawArticle[]> {
  let searchQuery = query
  if (ticker) {
    searchQuery = `${ticker.replace(/\.(NS|BO)$/, "")} stock share price news`
  }

  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=en-IN&gl=IN&ceid=IN:en`
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    })
    if (!response.ok) return []
    const xml = await response.text()
    return parseRSSFeed(xml)
  } catch {
    return []
  }
}

// ──── RSS Parsing ────

function parseRSSFeed(xml: string): RawArticle[] {
  const articles: RawArticle[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/
  const linkRegex = /<link>(.*?)<\/link>/
  const pubDateRegex = /<pubDate>(.*?)<\/pubDate>/
  const sourceRegex = /<source.*?>(.*?)<\/source>/
  const descriptionRegex = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/

  let match
  let index = 0

  while ((match = itemRegex.exec(xml)) !== null && index < 15) {
    const item = match[1]
    const titleMatch = item.match(titleRegex)
    const linkMatch = item.match(linkRegex)
    const pubDateMatch = item.match(pubDateRegex)
    const sourceMatch = item.match(sourceRegex)
    const descMatch = item.match(descriptionRegex)

    const title = titleMatch ? (titleMatch[1] || titleMatch[2] || "").trim() : ""
    if (!title || title.includes("[Removed]")) continue

    const cleanedTitle = cleanTitle(title)
    const rawDesc = descMatch ? descMatch[1] || descMatch[2] || "" : ""
    const description = cleanHtml(rawDesc)

    articles.push({
      title: cleanedTitle,
      description: description.length > 20 ? description : "",
      source: sourceMatch ? sourceMatch[1].trim() : "News",
      url: linkMatch ? linkMatch[1].trim() : "",
      imageUrl: null,
      publishedAt: pubDateMatch ? new Date(pubDateMatch[1].trim()).toISOString() : new Date().toISOString(),
    })
    index++
  }

  return articles
}

// ──── Helpers ────

function cleanTitle(title: string): string {
  const parts = title.split(" - ")
  if (parts.length > 1) { parts.pop(); return parts.join(" - ") }
  return title
}

function cleanHtml(html: string): string {
  if (!html) return ""
  return html
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*(Read more|Continue reading|Click here|Learn more)\.?\.?\.?\s*$/i, "")
}

function generateSummary(title: string, source: string): string {
  const lower = title.toLowerCase()
  if (lower.includes("nifty") || lower.includes("sensex")) return `Market update from ${source}. ${title}.`
  if (lower.includes("result") || lower.includes("quarter")) return `${title}. Financial results analysis from ${source}.`
  return `${title}. Full coverage from ${source}.`
}

function categorizeNews(title: string): string {
  const t = title.toLowerCase()
  if (t.includes("nifty") || t.includes("sensex") || t.includes("market")) return "Market Update"
  if (t.includes("rbi") || t.includes("fed") || t.includes("rate") || t.includes("policy")) return "Policy Update"
  if (t.includes("tech") || t.includes("software") || t.includes("tcs") || t.includes("infosys")) return "Tech Sector"
  if (t.includes("bank") || t.includes("hdfc") || t.includes("icici")) return "Banking"
  if (t.includes("oil") || t.includes("crude") || t.includes("energy")) return "Commodity"
  if (t.includes("quarter") || t.includes("result") || t.includes("earnings")) return "Earnings"
  return "General"
}

function classifyImpact(title: string): "high" | "medium" | "low" {
  const t = title.toLowerCase()
  const highWords = ["breaking", "urgent", "historic", "unprecedented", "crash", "surge", "record"]
  const medWords = ["major", "significant", "rally", "decline", "update"]
  if (highWords.some(w => t.includes(w))) return "high"
  if (medWords.some(w => t.includes(w))) return "medium"
  return "low"
}

function getTimeAgo(date: Date): string {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diffSec < 60) return "Just now"
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return date.toLocaleDateString()
}

function calculateOverallSentiment(articles: { sentiment: string; sentimentScore: number }[]) {
  if (articles.length === 0) return { score: 50, label: "neutral", confidence: 0, bullishCount: 0, bearishCount: 0, neutralCount: 0 }
  let totalScore = 0, bullishCount = 0, bearishCount = 0, neutralCount = 0
  for (const a of articles) {
    totalScore += a.sentimentScore
    if (a.sentiment === "bullish") bullishCount++
    else if (a.sentiment === "bearish") bearishCount++
    else neutralCount++
  }
  const avgScore = Math.round(totalScore / articles.length)
  const label = avgScore >= 60 ? "bullish" : avgScore <= 40 ? "bearish" : "neutral"
  return { score: avgScore, label, confidence: Math.abs(avgScore - 50) / 50, bullishCount, bearishCount, neutralCount }
}

// ──── Fallback Data ────

function getFallbackArticles(ticker: string): RawArticle[] {
  const now = new Date()
  const t = ticker ? ticker.replace(/\.(NS|BO)$/, "") : ""
  return [
    { title: t ? `${t} Stock Shows Strong Performance` : "Sensex, Nifty Trade Higher", description: t ? `${t} shares trading actively with positive volume.` : "Indian benchmark indices opened higher tracking global cues.", source: "Economic Times", url: "", imageUrl: null, publishedAt: now.toISOString() },
    { title: t ? `${t} Q3 Results Preview` : "RBI Maintains Status Quo on Rates", description: t ? `Analysts share expectations for ${t} quarterly results.` : "RBI kept policy rates unchanged citing inflation.", source: "Mint", url: "", imageUrl: null, publishedAt: new Date(now.getTime() - 3600000).toISOString() },
    { title: t ? `${t} Technical Levels to Watch` : "TCS Reports Strong Q3 Results", description: t ? `Key support and resistance levels for ${t}.` : "TCS beat estimates with digital services growth.", source: "Business Standard", url: "", imageUrl: null, publishedAt: new Date(now.getTime() - 7200000).toISOString() },
    { title: t ? `Institutional Interest in ${t}` : "FIIs Continue Buying Indian Equities", description: t ? `Institutional investors show interest in ${t}.` : "FIIs remain net buyers amid global uncertainty.", source: "Moneycontrol", url: "", imageUrl: null, publishedAt: new Date(now.getTime() - 10800000).toISOString() },
  ]
}
