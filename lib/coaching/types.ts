/**
 * Canonical Coaching Types
 *
 * Every trade in Tradia produces a CoachingReport.
 * This is the single source of truth for post-trade feedback.
 */

// ── Market Snapshot ──

export interface MarketSnapshot {
  sentiment: {
    label: "bullish" | "bearish" | "neutral"
    score: number       // 0-100
    confidence: number  // 0-1
    source: "finbert" | "heuristic-fallback" | "unavailable"
  }
  trend: {
    label: "uptrend" | "downtrend" | "range" | "uncertain"
    signal: number      // -1 to 1
    confidence: number  // 0-1
    shortMA: number
    longMA: number
    momentum: number    // price change %
  }
  price: number
  currency: "USD" | "INR"
  market: "US" | "IN"
  regime: MarketRegime
}

// ── Market Regime ──

export type MarketRegime =
  | "trending_up"
  | "trending_down"
  | "range_bound"
  | "high_uncertainty"
  | "weak_signal"

export interface MarketRegimeDetail {
  regime: MarketRegime
  confidence: number        // 0-1
  maSpread: number          // (shortMA - longMA) / longMA as %
  signalAgreement: number   // -1 (disagree) to +1 (agree)
  description: string       // human-readable explanation
}

// ── Extracted Features ──

export interface ExtractedFeatures {
  // Signal features
  sentimentDirection: number    // -1 to +1 (bearish to bullish)
  sentimentStrength: number     // 0-1 (how strong the signal)
  sentimentReliability: number  // 0-1 (source quality * confidence)
  trendDirection: number        // -1 to +1
  trendStrength: number         // 0-1
  trendReliability: number      // 0-1
  signalAgreement: number       // -1 to +1 (do sentiment and trend agree?)
  maSpread: number              // % spread between short and long MA
  momentum: number              // recent price change %

  // Trade context features
  actionDirection: number       // +1 for buy, -1 for sell
  positionSizeRatio: number     // trade cost / total balance (0-1)
  portfolioExposure: number     // total invested / total capital (0-1)
  existingExposure: number      // existing position value / total balance
  isAddingToPosition: boolean   // buying more of something already held

  // Regime features
  regime: MarketRegimeDetail

  // Sell-specific features
  isSell: boolean
  profitAmount?: number
  profitPercent?: number
  holdingDuration?: number      // milliseconds since buy (estimated)
  isWinner?: boolean            // true if profit > 0

  // History features
  recentTradeCount: number
  recentAvgReward: number
  recentTradeImprovement: number  // change in avg reward (recent vs older)
  tradeHistoryLength: number
  recentMistakePatterns: BehaviorPattern[]
}

// ── Behavioral Flags ──

export type BehavioralFlag =
  | "overtrading"
  | "oversized_position"
  | "trend_fighting"
  | "sentiment_ignoring"
  | "panic_exit"
  | "late_chase"
  | "poor_risk_discipline"
  | "impulsive_reversal"
  | "concentration_risk"
  | "selling_winners_early"
  | "holding_losers"

export interface BehavioralFlagDetail {
  flag: BehavioralFlag
  severity: "info" | "warning" | "critical"
  description: string
  /** How many times this pattern has occurred in recent history */
  recurrence: number
  /** Whether severity was escalated due to repetition */
  escalated: boolean
}

export interface BehaviorPattern {
  flag: BehavioralFlag
  count: number
  recentCount: number   // count in last 10 trades
  trend: "increasing" | "stable" | "decreasing"
}

// ── Coaching Report ──

export type TradeVerdict = "strong" | "mixed" | "weak"

export interface CoachingReport {
  /** Overall verdict */
  verdict: TradeVerdict
  /** Score 0-100 (higher = better trade) */
  score: number
  /** Confidence in this assessment (0-1) */
  confidence: number
  /** One-sentence summary for beginners */
  summary: string
  /** What the user did right (beginner-friendly) */
  whatWentRight: string[]
  /** What the user did wrong (beginner-friendly) */
  whatWentWrong: string[]
  /** Concrete next-step improvements */
  improveNext: string[]
  /** Signals that supported this trade */
  supportingSignals: string[]
  /** Signals that contradicted this trade */
  contradictorySignals: string[]
  /** Risk-related observations */
  riskNotes: string[]
  /** Skill areas this trade tests */
  skillTags: SkillTag[]
  /** Market conditions at time of trade */
  marketSnapshot: MarketSnapshot
  /** Behavioral flags triggered */
  behavioralFlags: BehavioralFlagDetail[]
  /** Market regime at trade time */
  regimeContext: string
  /** Reward breakdown from the evaluation engine */
  reward: {
    total: number
    alignment: number
    risk: number
    discipline: number
    outcome: number
    learning: number
  }
  /** User feedback on coaching accuracy (optional, added after rating) */
  rating?: CoachingRating
}

// ── Component Scoring ──

export interface ComponentScore {
  score: number     // -1 to +1
  confidence: number // 0-1 (how reliable this score is)
  label: string
  detail: string
  evidence: string[] // traceable reasons for this score
}

// ── Skill Tags ──

export type SkillTag =
  | "signal_alignment"
  | "risk_management"
  | "position_sizing"
  | "patience"
  | "trend_reading"
  | "sentiment_reading"
  | "exit_timing"
  | "entry_timing"
  | "diversification"

// ── Trade with Coaching ──

export interface TradeWithCoaching {
  // Trade execution data
  id: string
  type: "buy" | "sell"
  symbol: string
  quantity: number
  price: number
  cost: number
  timestamp: string       // ISO-8601
  displayTime: string
  market: "US" | "IN"
  currency: "USD" | "INR"
  profit?: number         // only for sells
  profitPercent?: number  // only for sells

  // Execution realism metadata (present on new trades)
  execution?: {
    requestedPrice: number
    fillPrice: number
    spreadBps: number
    commissionPaid: number
    slippageBps: number
    executionDelayMs: number
    orderType: "market" | "limit"
  }

  // Trade journal
  thesis?: string         // pre-trade reasoning
  reflection?: string     // post-trade reflection

  // Coaching data (always present)
  coaching: CoachingReport
}

// ── Learning Summary (for dashboard/profile) ──

export interface LearningSummary {
  grade: string           // S, A, B, C, D, F
  score: number           // average reward
  totalTrades: number
  trajectory: "improving" | "stable" | "declining"
  trajectoryDetail: string // human-readable trajectory explanation
  /** Top 3 recurring mistakes */
  recurringMistakes: {
    flag: BehavioralFlag
    count: number
    description: string
    tip: string
    trend: "increasing" | "stable" | "decreasing"
  }[]
  /** Strongest skill areas */
  strengths: SkillTag[]
  /** Weakest skill areas - what to focus on next */
  weaknesses: SkillTag[]
  /** The single most important thing to improve */
  focusArea: string
  /** Component averages */
  componentAverages: {
    alignment: number
    risk: number
    discipline: number
    outcome: number
    learning: number
  }
  /** Recency-weighted component averages (last 10 trades weighted more) */
  recentComponentAverages: {
    alignment: number
    risk: number
    discipline: number
    outcome: number
    learning: number
  }
  /** Win rate for sells */
  winRate: number
  /** Total P&L */
  totalPnL: number
  /** Best and worst trade scores */
  bestTradeScore: number
  worstTradeScore: number
}

// ── Evaluate Trade Input ──

export interface EvaluateTradeInput {
  action: "buy" | "sell"
  symbol: string
  quantity: number
  price: number
  market: "US" | "IN"
  currency: "USD" | "INR"
  // Market signals
  sentiment: {
    label: "bullish" | "bearish" | "neutral"
    score: number
    confidence: number
    source: "finbert" | "heuristic-fallback" | "unavailable"
  }
  trend: {
    label: "uptrend" | "downtrend" | "range" | "uncertain"
    signal: number
    confidence: number
    shortMA: number
    longMA: number
    momentum: number
  }
  // Portfolio context
  portfolioExposure: number   // 0-1
  recentTradeCount: number    // trades in last hour
  existingPositionSize: number // shares already held
  totalBalance: number
  // History context
  recentRewards: number[]     // last N reward scores
  tradeHistory: TradeWithCoaching[]  // recent trades for pattern detection
  // Outcome (sells only)
  profit?: number
  profitPercent?: number
  // Journal (optional)
  thesis?: string
  reflection?: string
}

// ── Coaching Feedback Rating ──

export interface CoachingRating {
  helpful: boolean
  timestamp: string
}

// ── Adaptive Weights ──

export interface AdaptiveWeights {
  alignment: number
  risk: number
  discipline: number
  outcome: number
  learning: number
  sampleCount: number
  lastUpdated: string
}

// ── Behavioral Memory Store ──

export interface BehavioralMemoryStore {
  flagCounts: Record<string, number>
  recentFlagCounts: Record<string, number>
  flagTrends: Record<string, "increasing" | "stable" | "decreasing">
  activeImprovementAreas: string[]
  totalTradesAnalyzed: number
  lastUpdated: string
}

// ── Curriculum ──

export type CurriculumStage = "beginner" | "developing" | "intermediate" | "proficient"

export interface CurriculumTopic {
  id: string
  title: string
  description: string
  stage: CurriculumStage
  minTrades: number
  minGrade: string | null
  skillTags: SkillTag[]
  tips: string[]
  unlocked?: boolean
  completed?: boolean
}

export interface CurriculumProgress {
  stage: CurriculumStage
  unlockedTopicIds: string[]
  completedTopicIds: string[]
  currentFocus: string | null
  lastUpdated: string
}
