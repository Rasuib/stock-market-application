/**
 * Tradia ML Pipeline
 *
 * Modules:
 * 1. FinBERT Sentiment  — Real NLP sentiment analysis via Hugging Face Inference API (ProsusAI/finbert)
 * 2. Trend Detection    — SMA crossover + price momentum
 */

export { detectTrend, type TrendSignal, type PricePoint } from "./trend-detection"
export {
  classifySentiment,
  classifySentimentBatch,
  keywordFallback,
  finbertToSentimentLabel,
  finbertToScore,
  type FinBERTResult,
  type FinBERTBatchResult,
} from "./finbert"
