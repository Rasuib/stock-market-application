/**
 * FinBERT Sentiment Analysis
 *
 * Uses the Hugging Face Inference API to run ProsusAI/finbert,
 * a BERT model fine-tuned on financial text for sentiment classification.
 *
 * Model: ProsusAI/finbert
 * Labels: positive, negative, neutral
 * Input:  financial text (headlines, summaries)
 * Output: probability distribution over {positive, negative, neutral}
 *
 * Falls back to keyword heuristics if the API is unavailable.
 */

const FINBERT_MODEL = "ProsusAI/finbert"
const HF_INFERENCE_URL = `https://api-inference.huggingface.co/models/${FINBERT_MODEL}`

// Timeout for HF API calls (model may need cold-start)
const INFERENCE_TIMEOUT_MS = 15_000

export interface FinBERTResult {
  label: "positive" | "negative" | "neutral"
  scores: {
    positive: number
    negative: number
    neutral: number
  }
  confidence: number
  source: "finbert" | "heuristic-fallback"
}

export interface FinBERTBatchResult {
  results: FinBERTResult[]
  /** Aggregate sentiment across all inputs */
  aggregate: FinBERTResult
  modelUsed: "finbert" | "heuristic-fallback"
}

/**
 * Classify a single text using FinBERT via Hugging Face Inference API.
 *
 * The HF Inference API accepts POST with { inputs: string } and returns
 * an array of [{label, score}] sorted by score descending.
 */
export async function classifySentiment(text: string): Promise<FinBERTResult> {
  try {
    const result = await callHuggingFaceAPI(text)
    return result
  } catch {
    // Fallback to keyword heuristic
    return keywordFallback(text)
  }
}

/**
 * Classify multiple texts in a single API call (batch inference).
 * HF Inference API supports batch inputs as string[].
 */
export async function classifySentimentBatch(texts: string[]): Promise<FinBERTBatchResult> {
  if (texts.length === 0) {
    return {
      results: [],
      aggregate: { label: "neutral", scores: { positive: 0.33, negative: 0.33, neutral: 0.34 }, confidence: 0, source: "heuristic-fallback" },
      modelUsed: "heuristic-fallback",
    }
  }

  // Truncate texts to 512 chars (BERT token limit ~512 tokens)
  const truncated = texts.map(t => t.slice(0, 512))

  let results: FinBERTResult[]
  let modelUsed: "finbert" | "heuristic-fallback" = "finbert"

  try {
    results = await callHuggingFaceAPIBatch(truncated)
  } catch {
    // Full fallback to keyword heuristics
    results = truncated.map(t => keywordFallback(t))
    modelUsed = "heuristic-fallback"
  }

  // Aggregate: average the score distributions
  const avgScores = { positive: 0, negative: 0, neutral: 0 }
  for (const r of results) {
    avgScores.positive += r.scores.positive
    avgScores.negative += r.scores.negative
    avgScores.neutral += r.scores.neutral
  }
  const n = results.length
  avgScores.positive /= n
  avgScores.negative /= n
  avgScores.neutral /= n

  const maxLabel = (avgScores.positive >= avgScores.negative && avgScores.positive >= avgScores.neutral)
    ? "positive"
    : (avgScores.negative >= avgScores.neutral)
      ? "negative"
      : "neutral"

  const confidence = Math.max(avgScores.positive, avgScores.negative, avgScores.neutral)

  return {
    results,
    aggregate: { label: maxLabel, scores: avgScores, confidence, source: modelUsed },
    modelUsed,
  }
}

// ──── Internal: Hugging Face API calls ────

async function callHuggingFaceAPI(text: string): Promise<FinBERTResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS)

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    const apiKey = process.env.HF_API_TOKEN
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`
    }

    const response = await fetch(HF_INFERENCE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: text }),
      signal: controller.signal,
    })

    if (response.status === 503) {
      // Model is loading — HF returns estimated_time
      const body = await response.json()
      const waitTime = Math.min((body.estimated_time || 20) * 1000, 30_000)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      // Retry once
      return callHuggingFaceAPI(text)
    }

    if (!response.ok) {
      throw new Error(`HF API returned ${response.status}`)
    }

    const data = await response.json()
    return parseHFResponse(data)
  } finally {
    clearTimeout(timeout)
  }
}

async function callHuggingFaceAPIBatch(texts: string[]): Promise<FinBERTResult[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS)

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    const apiKey = process.env.HF_API_TOKEN
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`
    }

    const response = await fetch(HF_INFERENCE_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ inputs: texts }),
      signal: controller.signal,
    })

    if (response.status === 503) {
      const body = await response.json()
      const waitTime = Math.min((body.estimated_time || 20) * 1000, 30_000)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      return callHuggingFaceAPIBatch(texts)
    }

    if (!response.ok) {
      throw new Error(`HF API returned ${response.status}`)
    }

    const data = await response.json()

    // Batch response: array of arrays
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data.map((item: unknown) => parseHFResponse(item))
    }

    // Single result wrapped — shouldn't happen in batch but handle gracefully
    if (Array.isArray(data) && !Array.isArray(data[0])) {
      return [parseHFResponse(data)]
    }

    throw new Error("Unexpected HF response shape")
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Parse the HF Inference API response into our FinBERTResult format.
 *
 * HF returns: [[{label: "positive", score: 0.95}, {label: "negative", score: 0.03}, {label: "neutral", score: 0.02}]]
 */
function parseHFResponse(data: unknown): FinBERTResult {
  const items = (Array.isArray(data) && Array.isArray(data[0])) ? data[0] : data
  if (!Array.isArray(items)) {
    throw new Error("Cannot parse HF response")
  }

  const scores = { positive: 0, negative: 0, neutral: 0 }

  for (const item of items as { label: string; score: number }[]) {
    const label = item.label.toLowerCase()
    if (label === "positive") scores.positive = item.score
    else if (label === "negative") scores.negative = item.score
    else if (label === "neutral") scores.neutral = item.score
  }

  const maxScore = Math.max(scores.positive, scores.negative, scores.neutral)
  const label = scores.positive === maxScore ? "positive"
    : scores.negative === maxScore ? "negative"
    : "neutral"

  return { label, scores, confidence: maxScore, source: "finbert" }
}

// ──── Fallback: keyword heuristic ────

const POS_WORDS = ["surge", "soar", "rally", "gain", "rise", "jump", "climb", "bullish", "growth", "profit", "strong", "higher", "increase", "boost", "upgrade", "beat", "record", "outperform"]
const NEG_WORDS = ["crash", "plunge", "collapse", "fall", "drop", "decline", "bearish", "loss", "weak", "lower", "decrease", "fear", "risk", "downgrade", "miss", "cut", "layoff", "recession"]

/**
 * Keyword-weighted sentiment fallback.
 * Used when FinBERT API is unavailable.
 * Clearly labeled as heuristic fallback in the result.
 */
export function keywordFallback(text: string): FinBERTResult {
  const lower = text.toLowerCase()
  let pos = 0
  let neg = 0

  for (const w of POS_WORDS) { if (lower.includes(w)) pos++ }
  for (const w of NEG_WORDS) { if (lower.includes(w)) neg++ }

  const total = pos + neg
  if (total === 0) {
    return { label: "neutral", scores: { positive: 0.2, negative: 0.2, neutral: 0.6 }, confidence: 0.6, source: "heuristic-fallback" }
  }

  const posScore = pos / total
  const negScore = neg / total
  const neutralScore = Math.max(0, 1 - posScore - negScore) * 0.3

  // Normalize
  const sum = posScore + negScore + neutralScore
  const normalized = {
    positive: posScore / sum,
    negative: negScore / sum,
    neutral: neutralScore / sum,
  }

  const maxScore = Math.max(normalized.positive, normalized.negative, normalized.neutral)
  const label = normalized.positive === maxScore ? "positive"
    : normalized.negative === maxScore ? "negative"
    : "neutral"

  return { label, scores: normalized, confidence: maxScore, source: "heuristic-fallback" }
}

// ──── Helpers ────

/** Convert FinBERT label to the app's sentiment vocabulary */
export function finbertToSentimentLabel(label: FinBERTResult["label"]): "bullish" | "bearish" | "neutral" {
  if (label === "positive") return "bullish"
  if (label === "negative") return "bearish"
  return "neutral"
}

/** Convert FinBERT result to a 0-100 sentiment score (for backwards compat) */
export function finbertToScore(result: FinBERTResult): number {
  // Map from [-1, +1] probability space to [0, 100]
  const net = result.scores.positive - result.scores.negative
  return Math.round(50 + net * 50)
}
