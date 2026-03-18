/**
 * Tradia Coaching Pipeline — Expert System
 *
 * Single authoritative source for trade evaluation and beginner coaching.
 *
 * Pipeline:
 *   Features → Regime → Behavior → Score → Feedback → Report
 *
 * Supporting systems:
 *   - Adaptive weight calibration (feedback-driven)
 *   - Persistent behavioral memory (cross-session)
 *   - Progressive curriculum (stage-based learning)
 */

export { evaluateTradeForCoaching } from "./evaluate-trade"
export { generateLearningSummary } from "./learning-summary"
export { classifyMarketRegime } from "./market-regime"
export { extractFeatures } from "./feature-extractor"
export { detectBehavioralFlags } from "./behavior-memory"
export { scoreTrade } from "./score-trade"
export { synthesizeFeedback } from "./feedback-synthesizer"

// Supporting systems
export { updateBehavioralMemory, rebuildBehavioralMemory, loadBehavioralMemory } from "./behavioral-memory-store"
export { updateCurriculum, getCurriculumTopics, getCurrentFocusTopic, getStageInfo, loadCurriculumProgress } from "./curriculum"
export { updateWeightsFromFeedback, getEffectiveWeights, loadAdaptiveWeights } from "./adaptive-weights"

export type {
  CoachingReport,
  TradeWithCoaching,
  LearningSummary,
  MarketSnapshot,
  MarketRegime,
  MarketRegimeDetail,
  ExtractedFeatures,
  BehavioralFlagDetail,
  BehavioralFlag,
  BehaviorPattern,
  TradeVerdict,
  SkillTag,
  ComponentScore,
  EvaluateTradeInput,
  CoachingRating,
  AdaptiveWeights,
  BehavioralMemoryStore,
  CurriculumStage,
  CurriculumTopic,
  CurriculumProgress,
} from "./types"
