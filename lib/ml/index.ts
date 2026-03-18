/**
 * Tradia ML Pipeline
 *
 * Data → Preprocessing → Inference → Feature Fusion → Decision Engine → Reward → Output
 *
 * Modules:
 * 1. FinBERT Sentiment     — Real NLP sentiment analysis via Hugging Face Inference API (ProsusAI/finbert)
 * 2. Trend Detection        — SMA crossover + price momentum
 * 3. Decision Engine        — Feature fusion + explainable trade evaluation
 * 4. Behavior Analysis      — Trade pattern detection + learning feedback
 * 5. Reward Engine          — RL-inspired reward system for grading trading behavior
 *
 * The FinBERT module calls the real ProsusAI/finbert model via Hugging Face's Inference API.
 * If the model is unavailable, it falls back to keyword-based heuristics (clearly labeled in results).
 *
 * The Reward Engine models trading as a sequential decision process (state → action → reward)
 * and tracks cumulative reward to compute a learning grade.
 */

export { detectTrend, type TrendSignal, type PricePoint } from "./trend-detection"
export { evaluateTrade, type TradeEvaluation, type SentimentInput, type TrendInput, type TradeAction, type EvaluationFactor } from "./decision-engine"
export { analyzeBehavior, type BehaviorReport, type BehaviorAlert, type TradeRecord } from "./behavior-analysis"
export {
  classifySentiment,
  classifySentimentBatch,
  keywordFallback,
  finbertToSentimentLabel,
  finbertToScore,
  type FinBERTResult,
  type FinBERTBatchResult,
} from "./finbert"
export {
  computeReward,
  computeLearningGrade,
  loadRewardHistory,
  appendRewardHistory,
  clearRewardHistory,
  type TradingState,
  type TradingAction as RewardAction,
  type RewardResult,
  type RewardBreakdown,
  type RewardHistoryEntry,
  type LearningGradeReport,
} from "./reward-engine"
