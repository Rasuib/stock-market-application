/**
 * RL-Inspired Reward Engine for Trading Behavior Evaluation
 *
 * Models user trading as a sequential decision process:
 *
 *   State  →  Action  →  Reward  →  Next State
 *
 * State:  (marketSentiment, marketTrend, portfolioExposure, recentBehavior, priorOutcomes)
 * Action: buy | sell | hold (inferred from user behavior)
 * Reward: scalar signal evaluating decision quality
 *
 * This is NOT a full deep RL system with policy networks.
 * It IS a principled reward-based evaluation framework that:
 *   1. Defines explicit reward components with clear semantics
 *   2. Tracks cumulative reward over a user's trading history
 *   3. Computes a learning grade from the reward trajectory
 *   4. Provides explainable reward breakdowns per trade
 *   5. Detects improvement/deterioration over time
 *
 * Reward Components:
 *   R_alignment  — Does the action align with market signals?
 *   R_risk       — Is the position sizing responsible?
 *   R_discipline — Is the trader patient and systematic?
 *   R_outcome    — Did the trade result in profit? (for sells)
 *   R_learning   — Is the user improving over time?
 *
 * Total: R = w1*R_alignment + w2*R_risk + w3*R_discipline + w4*R_outcome + w5*R_learning
 */

// ──── Types ────

export interface TradingState {
  /** FinBERT sentiment: -1 (bearish), 0 (neutral), +1 (bullish) */
  sentimentSignal: number
  sentimentConfidence: number
  /** Trend signal: -1 (downtrend), 0 (neutral), +1 (uptrend) */
  trendSignal: number
  trendConfidence: number
  /** Portfolio exposure: fraction of capital in positions (0 to 1) */
  portfolioExposure: number
  /** Number of trades in last hour */
  recentTradeCount: number
  /** Average reward of last 5 trades */
  recentAvgReward: number
  /** Win rate so far (0 to 1) */
  winRate: number
}

export type TradingAction = "buy" | "sell"

export interface RewardBreakdown {
  /** Signal alignment reward [-1, +1] */
  alignment: number
  alignmentExplanation: string
  /** Risk management reward [-1, +1] */
  risk: number
  riskExplanation: string
  /** Discipline reward [-1, +1] */
  discipline: number
  disciplineExplanation: string
  /** Outcome reward [-1, +1] (only meaningful for sells) */
  outcome: number
  outcomeExplanation: string
  /** Learning improvement reward [-1, +1] */
  learning: number
  learningExplanation: string
}

export interface RewardResult {
  /** Total reward for this trade, range approximately [-100, +100] */
  totalReward: number
  /** Breakdown of reward components */
  breakdown: RewardBreakdown
  /** Which components contributed most */
  dominantFactor: string
  /** Human-readable summary */
  explanation: string
  /** State at time of trade */
  state: TradingState
  /** Action taken */
  action: TradingAction
}

export interface RewardHistoryEntry {
  timestamp: string
  symbol: string
  action: TradingAction
  reward: number
  breakdown: RewardBreakdown
  cumulativeReward: number
  grade: string
}

export interface LearningGradeReport {
  /** Current grade: S, A, B, C, D, F */
  grade: string
  /** Numeric score (cumulative average reward) */
  score: number
  /** Trend: improving, stable, declining */
  trajectory: "improving" | "stable" | "declining"
  /** Percentile description */
  description: string
  /** Per-component averages */
  componentAverages: {
    alignment: number
    risk: number
    discipline: number
    outcome: number
    learning: number
  }
  /** Specific strengths */
  strengths: string[]
  /** Specific weaknesses */
  weaknesses: string[]
  /** Total trades evaluated */
  totalTrades: number
  /** Reward history for charting */
  rewardHistory: { timestamp: string; reward: number; cumulative: number }[]
}

// ──── Weights ────

const W_ALIGNMENT = 0.30
const W_RISK = 0.20
const W_DISCIPLINE = 0.20
const W_OUTCOME = 0.20
const W_LEARNING = 0.10

// ──── Core Reward Function ────

/**
 * Compute the reward for a single trade given the state and action.
 *
 * @param state  - Market conditions and portfolio state at time of trade
 * @param action - The user's action (buy or sell)
 * @param profit - Realized profit/loss (only for sell trades, undefined for buys)
 * @param rewardHistory - Previous rewards for computing learning component
 */
export function computeReward(
  state: TradingState,
  action: TradingAction,
  profit: number | undefined,
  rewardHistory: number[],
): RewardResult {
  const breakdown: RewardBreakdown = {
    alignment: 0, alignmentExplanation: "",
    risk: 0, riskExplanation: "",
    discipline: 0, disciplineExplanation: "",
    outcome: 0, outcomeExplanation: "",
    learning: 0, learningExplanation: "",
  }

  // ── R_alignment: Does action match signals? ──
  const actionSign = action === "buy" ? 1 : -1
  const sentimentAlignment = actionSign * state.sentimentSignal
  const trendAlignment = actionSign * state.trendSignal

  // Weight by confidence
  const weightedSentiment = sentimentAlignment * state.sentimentConfidence
  const weightedTrend = trendAlignment * state.trendConfidence

  breakdown.alignment = (weightedSentiment * 0.45 + weightedTrend * 0.55)

  if (breakdown.alignment > 0.3) {
    breakdown.alignmentExplanation = `${action === "buy" ? "Buying" : "Selling"} aligns well with market signals (sentiment: ${state.sentimentSignal > 0 ? "bullish" : state.sentimentSignal < 0 ? "bearish" : "neutral"}, trend: ${state.trendSignal > 0 ? "up" : state.trendSignal < 0 ? "down" : "flat"}).`
  } else if (breakdown.alignment < -0.3) {
    breakdown.alignmentExplanation = `${action === "buy" ? "Buying" : "Selling"} conflicts with market signals. Consider checking sentiment and trend before trading.`
  } else {
    breakdown.alignmentExplanation = "Mixed or neutral market signals. Trade caution is appropriate."
  }

  // ── R_risk: Position sizing discipline ──
  if (action === "buy") {
    if (state.portfolioExposure > 0.8) {
      breakdown.risk = -0.8
      breakdown.riskExplanation = "Over-concentrated: >80% of capital is invested. Consider keeping a cash reserve."
    } else if (state.portfolioExposure > 0.6) {
      breakdown.risk = -0.3
      breakdown.riskExplanation = "High exposure (>60%). Monitor positions closely."
    } else if (state.portfolioExposure < 0.2) {
      breakdown.risk = 0.5
      breakdown.riskExplanation = "Conservative position sizing. Good risk management."
    } else {
      breakdown.risk = 0.3
      breakdown.riskExplanation = "Reasonable portfolio allocation."
    }
  } else {
    // Selling reduces risk — generally positive
    if (state.portfolioExposure > 0.6) {
      breakdown.risk = 0.6
      breakdown.riskExplanation = "Reducing exposure from a high-concentration portfolio. Good risk management."
    } else {
      breakdown.risk = 0.2
      breakdown.riskExplanation = "Portfolio exposure is manageable."
    }
  }

  // ── R_discipline: Trading frequency and patience ──
  if (state.recentTradeCount > 10) {
    breakdown.discipline = -0.8
    breakdown.disciplineExplanation = "Overtrading detected (>10 trades/hour). Slow down and trade with intention."
  } else if (state.recentTradeCount > 5) {
    breakdown.discipline = -0.3
    breakdown.disciplineExplanation = "Elevated trading frequency. Ensure each trade has a clear thesis."
  } else if (state.recentTradeCount <= 2) {
    breakdown.discipline = 0.6
    breakdown.disciplineExplanation = "Patient, deliberate trading pace. This is ideal for learning."
  } else {
    breakdown.discipline = 0.2
    breakdown.disciplineExplanation = "Moderate trading frequency."
  }

  // ── R_outcome: Realized P&L (sells only) ──
  if (action === "sell" && profit !== undefined) {
    if (profit > 0) {
      // Scale: diminishing returns beyond 10% profit
      const profitFraction = Math.min(profit / 1000, 1) // normalize to ~$1000
      breakdown.outcome = Math.min(1, 0.3 + profitFraction * 0.7)
      breakdown.outcomeExplanation = `Profitable trade (+$${profit.toFixed(2)}). Good exit timing.`
    } else if (profit === 0) {
      breakdown.outcome = 0
      breakdown.outcomeExplanation = "Break-even trade. No loss, but consider your opportunity cost."
    } else {
      const lossFraction = Math.min(Math.abs(profit) / 1000, 1)
      breakdown.outcome = -Math.min(1, 0.3 + lossFraction * 0.7)
      breakdown.outcomeExplanation = `Loss on trade (-$${Math.abs(profit).toFixed(2)}). Review your entry criteria.`
    }
  } else {
    // Buy trade or no profit data
    breakdown.outcome = 0
    breakdown.outcomeExplanation = action === "buy" ? "Position opened. Outcome will be evaluated on exit." : "No profit data available."
  }

  // ── R_learning: Is the user improving? ──
  if (rewardHistory.length >= 5) {
    const recent5 = rewardHistory.slice(-5)
    const older5 = rewardHistory.length >= 10
      ? rewardHistory.slice(-10, -5)
      : rewardHistory.slice(0, Math.min(5, rewardHistory.length - 5))

    if (older5.length > 0) {
      const recentAvg = recent5.reduce((a, b) => a + b, 0) / recent5.length
      const olderAvg = older5.reduce((a, b) => a + b, 0) / older5.length
      const improvement = recentAvg - olderAvg

      if (improvement > 5) {
        breakdown.learning = 0.8
        breakdown.learningExplanation = "Clear improvement in recent trades. Your decision-making is getting better."
      } else if (improvement > 0) {
        breakdown.learning = 0.3
        breakdown.learningExplanation = "Slight improvement trend. Keep building on good habits."
      } else if (improvement > -5) {
        breakdown.learning = 0
        breakdown.learningExplanation = "Performance is stable. Look for new strategies to improve."
      } else {
        breakdown.learning = -0.5
        breakdown.learningExplanation = "Recent trades show declining quality. Review your strategy."
      }
    } else {
      breakdown.learning = 0
      breakdown.learningExplanation = "Not enough history to assess learning trajectory."
    }
  } else {
    breakdown.learning = 0.1 // Small bonus for being new — encourage engagement
    breakdown.learningExplanation = "Early in your trading journey. Each trade is a learning opportunity."
  }

  // ── Aggregate ──
  const rawTotal = (
    W_ALIGNMENT * breakdown.alignment +
    W_RISK * breakdown.risk +
    W_DISCIPLINE * breakdown.discipline +
    W_OUTCOME * breakdown.outcome +
    W_LEARNING * breakdown.learning
  )

  // Scale to approximately [-100, +100]
  const totalReward = Math.round(rawTotal * 100)

  // Find dominant factor
  const factors = [
    { name: "Signal Alignment", value: Math.abs(breakdown.alignment) * W_ALIGNMENT },
    { name: "Risk Management", value: Math.abs(breakdown.risk) * W_RISK },
    { name: "Trading Discipline", value: Math.abs(breakdown.discipline) * W_DISCIPLINE },
    { name: "Trade Outcome", value: Math.abs(breakdown.outcome) * W_OUTCOME },
    { name: "Learning Progress", value: Math.abs(breakdown.learning) * W_LEARNING },
  ]
  factors.sort((a, b) => b.value - a.value)
  const dominantFactor = factors[0].name

  // Generate explanation
  const explanation = generateRewardExplanation(totalReward, breakdown, action)

  return {
    totalReward,
    breakdown,
    dominantFactor,
    explanation,
    state,
    action,
  }
}

// ──── Grade Computation ────

/**
 * Compute a learning grade from the full reward history.
 *
 * Grade scale:
 *   S  : avg reward >= 40  (exceptional — consistently aligned, profitable, disciplined)
 *   A  : avg reward >= 20  (strong)
 *   B  : avg reward >= 5   (good — room for improvement)
 *   C  : avg reward >= -10 (average — mixed decisions)
 *   D  : avg reward >= -30 (below average — significant issues)
 *   F  : avg reward < -30  (poor — needs fundamental rethinking)
 */
export function computeLearningGrade(history: RewardHistoryEntry[]): LearningGradeReport {
  if (history.length === 0) {
    return {
      grade: "—",
      score: 0,
      trajectory: "stable",
      description: "No trades evaluated yet. Start trading to build your grade.",
      componentAverages: { alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 },
      strengths: [],
      weaknesses: [],
      totalTrades: 0,
      rewardHistory: [],
    }
  }

  // Average reward
  const rewards = history.map(h => h.reward)
  const avgReward = rewards.reduce((a, b) => a + b, 0) / rewards.length

  // Grade
  let grade: string
  let description: string
  if (avgReward >= 40) { grade = "S"; description = "Exceptional trader. Consistently aligned, disciplined, and profitable." }
  else if (avgReward >= 20) { grade = "A"; description = "Strong performer. Good signal alignment and risk management." }
  else if (avgReward >= 5) { grade = "B"; description = "Solid foundation. Some room to improve signal alignment or discipline." }
  else if (avgReward >= -10) { grade = "C"; description = "Average performance. Work on aligning trades with market signals." }
  else if (avgReward >= -30) { grade = "D"; description = "Below average. Review the reward breakdowns to identify weak areas." }
  else { grade = "F"; description = "Needs improvement. Focus on one skill at a time — start with signal alignment." }

  // Trajectory: compare last 5 vs earlier
  let trajectory: "improving" | "stable" | "declining" = "stable"
  if (rewards.length >= 5) {
    const recent = rewards.slice(-5)
    const earlier = rewards.slice(0, -5)
    if (earlier.length > 0) {
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
      const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length
      if (recentAvg - earlierAvg > 5) trajectory = "improving"
      else if (recentAvg - earlierAvg < -5) trajectory = "declining"
    }
  }

  // Component averages
  const componentAverages = { alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 }
  for (const h of history) {
    componentAverages.alignment += h.breakdown.alignment
    componentAverages.risk += h.breakdown.risk
    componentAverages.discipline += h.breakdown.discipline
    componentAverages.outcome += h.breakdown.outcome
    componentAverages.learning += h.breakdown.learning
  }
  const n = history.length
  componentAverages.alignment /= n
  componentAverages.risk /= n
  componentAverages.discipline /= n
  componentAverages.outcome /= n
  componentAverages.learning /= n

  // Strengths and weaknesses
  const components = [
    { name: "Signal Alignment", value: componentAverages.alignment },
    { name: "Risk Management", value: componentAverages.risk },
    { name: "Trading Discipline", value: componentAverages.discipline },
    { name: "Trade Outcomes", value: componentAverages.outcome },
    { name: "Learning Progress", value: componentAverages.learning },
  ]
  components.sort((a, b) => b.value - a.value)

  const strengths = components.filter(c => c.value > 0.2).map(c => c.name)
  const weaknesses = components.filter(c => c.value < -0.2).map(c => c.name)

  // Reward history for chart
  const rewardHistory = history.map(h => ({
    timestamp: h.timestamp,
    reward: h.reward,
    cumulative: h.cumulativeReward,
  }))

  return {
    grade,
    score: Math.round(avgReward * 10) / 10,
    trajectory,
    description,
    componentAverages,
    strengths,
    weaknesses,
    totalTrades: history.length,
    rewardHistory,
  }
}

// ──── Persistence Helpers ────

const REWARD_HISTORY_KEY = "tradia_reward_history"

/** Load reward history from localStorage */
export function loadRewardHistory(): RewardHistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(REWARD_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

/** Save a new reward entry to history */
export function appendRewardHistory(entry: RewardHistoryEntry): void {
  if (typeof window === "undefined") return
  try {
    const history = loadRewardHistory()
    history.push(entry)
    // Keep last 200 entries to avoid localStorage bloat
    const trimmed = history.slice(-200)
    localStorage.setItem(REWARD_HISTORY_KEY, JSON.stringify(trimmed))
  } catch {
    // localStorage full or unavailable
  }
}

/** Clear reward history */
export function clearRewardHistory(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(REWARD_HISTORY_KEY)
  } catch {
    // ignore
  }
}

// ──── Internal Helpers ────

function generateRewardExplanation(
  totalReward: number,
  breakdown: RewardBreakdown,
  action: TradingAction,
): string {
  if (totalReward >= 30) {
    return `Excellent ${action} decision. ${breakdown.alignmentExplanation}`
  }
  if (totalReward >= 10) {
    return `Good ${action}. ${breakdown.alignmentExplanation}`
  }
  if (totalReward >= -10) {
    return `Neutral ${action}. ${breakdown.alignmentExplanation} ${breakdown.disciplineExplanation}`
  }
  if (totalReward >= -30) {
    return `Below average ${action}. ${breakdown.alignmentExplanation} ${breakdown.riskExplanation}`
  }
  return `Poor ${action} decision. ${breakdown.alignmentExplanation} ${breakdown.riskExplanation} ${breakdown.disciplineExplanation}`
}
