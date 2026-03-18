/**
 * Learning Summary Generator — Enhanced
 *
 * Analyzes a user's full trade history to produce a LearningSummary.
 * Uses recency-weighted averages, smarter trajectory detection,
 * and richer behavioral pattern analysis.
 *
 * Improvements over v1:
 * - Recency-weighted component averages (recent trades matter more)
 * - Smarter trajectory: linear regression slope, not just two-window comparison
 * - Win rate and total P&L tracking
 * - Behavioral pattern trend detection (increasing/stable/decreasing)
 * - More meaningful focus area generation
 */

import type {
  TradeWithCoaching,
  LearningSummary,
  BehavioralFlag,
  SkillTag,
} from "./types"

/**
 * Generate a learning summary from the user's trade history.
 */
export function generateLearningSummary(trades: TradeWithCoaching[]): LearningSummary {
  if (trades.length === 0) {
    return {
      grade: "-",
      score: 0,
      totalTrades: 0,
      trajectory: "stable",
      trajectoryDetail: "No trades yet. Start trading to begin your learning journey.",
      recurringMistakes: [],
      strengths: [],
      weaknesses: [],
      focusArea: "Place your first trade to start learning.",
      componentAverages: { alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 },
      recentComponentAverages: { alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 },
      winRate: 0,
      totalPnL: 0,
      bestTradeScore: 0,
      worstTradeScore: 0,
    }
  }

  const n = trades.length

  // ── Average reward ──
  const rewards = trades.map(t => t.coaching.reward.total)
  const avgReward = rewards.reduce((a, b) => a + b, 0) / n

  // ── Grade ──
  const grade = rewardToGrade(avgReward)

  // ── Trajectory: use linear regression slope on reward series ──
  const { trajectory, trajectoryDetail } = computeTrajectory(rewards)

  // ── Component averages (equal weight) ──
  const componentAverages = { alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 }
  for (const t of trades) {
    componentAverages.alignment += t.coaching.reward.alignment
    componentAverages.risk += t.coaching.reward.risk
    componentAverages.discipline += t.coaching.reward.discipline
    componentAverages.outcome += t.coaching.reward.outcome
    componentAverages.learning += t.coaching.reward.learning
  }
  componentAverages.alignment /= n
  componentAverages.risk /= n
  componentAverages.discipline /= n
  componentAverages.outcome /= n
  componentAverages.learning /= n

  // ── Recency-weighted component averages (exponential decay) ──
  const recentComponentAverages = computeRecencyWeighted(trades)

  // ── Recurring mistakes with trend detection ──
  const recurringMistakes = detectRecurringMistakes(trades)

  // ── Skill strengths and weaknesses ──
  const { strengths, weaknesses } = detectSkillAreas(trades)

  // ── Focus area ──
  const focusArea = generateFocusArea(recurringMistakes, recentComponentAverages, weaknesses, trajectory)

  // ── Win rate (sells only) ──
  const sells = trades.filter(t => t.type === "sell" && t.profit !== undefined)
  const wins = sells.filter(t => t.profit! > 0)
  const winRate = sells.length > 0 ? Math.round((wins.length / sells.length) * 100) : 0

  // ── Total P&L ──
  const totalPnL = sells.reduce((sum, t) => sum + (t.profit || 0), 0)

  // ── Best/worst trade scores ──
  const scores = trades.map(t => t.coaching.score)
  const bestTradeScore = Math.max(...scores)
  const worstTradeScore = Math.min(...scores)

  return {
    grade,
    score: Math.round(avgReward * 10) / 10,
    totalTrades: n,
    trajectory,
    trajectoryDetail,
    recurringMistakes,
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
    focusArea,
    componentAverages,
    recentComponentAverages,
    winRate,
    totalPnL: Math.round(totalPnL * 100) / 100,
    bestTradeScore,
    worstTradeScore,
  }
}

// ── Trajectory: Linear Regression Slope ──

function computeTrajectory(rewards: number[]): {
  trajectory: "improving" | "stable" | "declining"
  trajectoryDetail: string
} {
  if (rewards.length < 4) {
    return {
      trajectory: "stable",
      trajectoryDetail: "Not enough trades to determine trajectory. Keep trading to build data.",
    }
  }

  // Simple linear regression on the reward series
  const n = rewards.length
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0
  for (let i = 0; i < n; i++) {
    sumX += i
    sumY += rewards[i]
    sumXY += i * rewards[i]
    sumX2 += i * i
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)

  // Also compare last third vs first third for a simpler sanity check
  const third = Math.max(1, Math.floor(n / 3))
  const firstThird = rewards.slice(0, third)
  const lastThird = rewards.slice(-third)
  const firstAvg = firstThird.reduce((a, b) => a + b, 0) / firstThird.length
  const lastAvg = lastThird.reduce((a, b) => a + b, 0) / lastThird.length
  const windowDiff = lastAvg - firstAvg

  // Combine slope and window comparison for robustness
  if (slope > 0.5 && windowDiff > 3) {
    return {
      trajectory: "improving",
      trajectoryDetail: `Your recent trades show clear improvement. Recent scores average ${lastAvg.toFixed(0)} vs earlier ${firstAvg.toFixed(0)}. Keep building on what's working.`,
    }
  }
  if (slope > 0.2 || windowDiff > 5) {
    return {
      trajectory: "improving",
      trajectoryDetail: `Gradual improvement trend. Recent trades are scoring higher than earlier ones.`,
    }
  }
  if (slope < -0.5 && windowDiff < -3) {
    return {
      trajectory: "declining",
      trajectoryDetail: `Recent trades show declining quality. Recent scores average ${lastAvg.toFixed(0)} vs earlier ${firstAvg.toFixed(0)}. Review your recent decisions.`,
    }
  }
  if (slope < -0.2 || windowDiff < -5) {
    return {
      trajectory: "declining",
      trajectoryDetail: `Your scores are trending downward. Take a break and review your strategy.`,
    }
  }

  return {
    trajectory: "stable",
    trajectoryDetail: `Performance is consistent around ${(sumY / n).toFixed(0)} average reward. Look for specific areas to push yourself.`,
  }
}

// ── Recency-Weighted Component Averages ──

function computeRecencyWeighted(trades: TradeWithCoaching[]): LearningSummary["recentComponentAverages"] {
  const result = { alignment: 0, risk: 0, discipline: 0, outcome: 0, learning: 0 }
  if (trades.length === 0) return result

  // Exponential decay: recent trades get higher weight
  // Half-life of 10 trades (trades that are 10 positions older get half the weight)
  const halfLife = 10
  let weightSum = 0

  for (let i = 0; i < trades.length; i++) {
    const recency = i // 0 = oldest, n-1 = newest
    const weight = Math.pow(2, recency / halfLife)
    weightSum += weight

    const r = trades[i].coaching.reward
    result.alignment += r.alignment * weight
    result.risk += r.risk * weight
    result.discipline += r.discipline * weight
    result.outcome += r.outcome * weight
    result.learning += r.learning * weight
  }

  result.alignment /= weightSum
  result.risk /= weightSum
  result.discipline /= weightSum
  result.outcome /= weightSum
  result.learning /= weightSum

  return result
}

// ── Recurring Mistake Detection ──

function detectRecurringMistakes(trades: TradeWithCoaching[]): LearningSummary["recurringMistakes"] {
  const allCounts = new Map<BehavioralFlag, number>()
  const recent10 = trades.slice(-10)
  const older = trades.slice(0, -10)
  const recentCounts = new Map<BehavioralFlag, number>()

  for (const trade of trades) {
    for (const flag of trade.coaching.behavioralFlags) {
      allCounts.set(flag.flag, (allCounts.get(flag.flag) || 0) + 1)
    }
  }

  for (const trade of recent10) {
    for (const flag of trade.coaching.behavioralFlags) {
      recentCounts.set(flag.flag, (recentCounts.get(flag.flag) || 0) + 1)
    }
  }

  return [...allCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => {
      // Prioritize by recent frequency, then total count
      const aRecent = recentCounts.get(a[0]) || 0
      const bRecent = recentCounts.get(b[0]) || 0
      if (bRecent !== aRecent) return bRecent - aRecent
      return b[1] - a[1]
    })
    .slice(0, 3)
    .map(([flag, count]) => {
      const recentCount = recentCounts.get(flag) || 0
      let trend: "increasing" | "stable" | "decreasing" = "stable"

      if (older.length >= 5) {
        const olderCount = count - recentCount
        const recentRate = recentCount / Math.max(1, recent10.length)
        const olderRate = olderCount / Math.max(1, older.length)
        if (recentRate > olderRate * 1.5) trend = "increasing"
        else if (recentRate < olderRate * 0.5) trend = "decreasing"
      }

      return {
        flag,
        count,
        description: flagDescriptions[flag] || flag,
        tip: flagTips[flag] || "Review your recent trades for this pattern.",
        trend,
      }
    })
}

// ── Skill Strengths and Weaknesses ──

function detectSkillAreas(trades: TradeWithCoaching[]): {
  strengths: SkillTag[]
  weaknesses: SkillTag[]
} {
  // Use recency-weighted scoring for skill detection
  const skillScores = new Map<SkillTag, { weightedSum: number; weightSum: number }>()

  for (let i = 0; i < trades.length; i++) {
    const recency = i // 0 = oldest, n-1 = newest
    const weight = Math.pow(2, recency / 10) // half-life of 10 trades
    const trade = trades[i]

    for (const tag of trade.coaching.skillTags) {
      if (!skillScores.has(tag)) skillScores.set(tag, { weightedSum: 0, weightSum: 0 })
      const s = skillScores.get(tag)!
      s.weightedSum += trade.coaching.score * weight
      s.weightSum += weight
    }
  }

  const strengths: SkillTag[] = []
  const weaknesses: SkillTag[] = []

  for (const [tag, s] of skillScores.entries()) {
    if (s.weightSum < 1) continue // need meaningful data
    const avg = s.weightedSum / s.weightSum
    if (avg >= 60) strengths.push(tag)
    else if (avg < 40) weaknesses.push(tag)
  }

  return { strengths, weaknesses }
}

// ── Focus Area Generation ──

function generateFocusArea(
  mistakes: LearningSummary["recurringMistakes"],
  recentAvg: LearningSummary["recentComponentAverages"],
  weaknesses: SkillTag[],
  trajectory: LearningSummary["trajectory"],
): string {
  // Priority 1: Increasing recurring mistakes
  const increasing = mistakes.find(m => m.trend === "increasing")
  if (increasing) {
    return `Priority: ${increasing.description} (getting more frequent). ${increasing.tip}`
  }

  // Priority 2: Most frequent recurring mistake
  if (mistakes.length > 0) {
    return `Focus on: ${mistakes[0].description}. ${mistakes[0].tip}`
  }

  // Priority 3: Weakest component (recency-weighted)
  const components = [
    { name: "signal alignment", tag: "signal_alignment" as SkillTag, value: recentAvg.alignment },
    { name: "risk management", tag: "risk_management" as SkillTag, value: recentAvg.risk },
    { name: "trading discipline", tag: "patience" as SkillTag, value: recentAvg.discipline },
    { name: "trade outcomes", tag: "exit_timing" as SkillTag, value: recentAvg.outcome },
  ]
  components.sort((a, b) => a.value - b.value)

  if (components[0].value < -0.1) {
    return focusAreaAdvice[components[0].tag] || `Work on improving your ${components[0].name}.`
  }

  // Priority 4: General trajectory-based advice
  if (trajectory === "declining") {
    return "Your recent trades are declining. Review your last 5 trades and identify what changed."
  }

  if (weaknesses.length > 0) {
    const weakName = skillTagNames[weaknesses[0]] || weaknesses[0]
    return focusAreaAdvice[weaknesses[0]] || `Work on improving your ${weakName}.`
  }

  return "You're doing well! Continue trading deliberately and review your results regularly."
}

// ── Grade Calculation ──

function rewardToGrade(avgReward: number): string {
  if (avgReward >= 40) return "S"
  if (avgReward >= 20) return "A"
  if (avgReward >= 5) return "B"
  if (avgReward >= -10) return "C"
  if (avgReward >= -30) return "D"
  return "F"
}

// ── Lookup Tables ──

const skillTagNames: Record<SkillTag, string> = {
  signal_alignment: "signal alignment",
  risk_management: "risk management",
  position_sizing: "position sizing",
  patience: "patience and discipline",
  trend_reading: "trend reading",
  sentiment_reading: "sentiment reading",
  exit_timing: "exit timing",
  entry_timing: "entry timing",
  diversification: "diversification",
}

const flagDescriptions: Record<BehavioralFlag, string> = {
  overtrading: "Trading too frequently",
  oversized_position: "Position sizes too large",
  trend_fighting: "Trading against the trend",
  sentiment_ignoring: "Ignoring market sentiment",
  panic_exit: "Panic selling at a loss",
  late_chase: "Chasing after price has moved",
  poor_risk_discipline: "Buying when over-exposed",
  impulsive_reversal: "Quick buy/sell reversals",
  concentration_risk: "All trades in one stock",
  selling_winners_early: "Selling profitable positions too soon",
  holding_losers: "Holding losing positions too long",
}

const flagTips: Record<BehavioralFlag, string> = {
  overtrading: "Set a max of 3-5 trades per session. Quality over quantity.",
  oversized_position: "Start with 5-10% of capital per trade. You can always add more.",
  trend_fighting: "Check the moving averages before trading. Trade with the trend.",
  sentiment_ignoring: "Read the news sentiment before entering. It drives short-term moves.",
  panic_exit: "Set your stop-loss BEFORE entering. Don't let fear drive exits.",
  late_chase: "If a stock has already moved 5%+, the easy money is gone. Wait for a pullback.",
  poor_risk_discipline: "Keep at least 20-30% of capital in cash for protection and opportunities.",
  impulsive_reversal: "Write down your trade thesis before clicking. Reversals should be rare.",
  concentration_risk: "Explore 3-5 different stocks across sectors to spread risk.",
  selling_winners_early: "Let winners run. Consider trailing stop-losses instead of fixed exits.",
  holding_losers: "Cut losses early. If your thesis is wrong, exit and move on.",
}

const focusAreaAdvice: Record<SkillTag, string> = {
  signal_alignment: "Practice waiting for both sentiment and trend to confirm before entering a trade.",
  risk_management: "Focus on never risking more than 10% of your portfolio on a single position.",
  position_sizing: "Start with small positions. You can always scale up as confidence grows.",
  patience: "Set a rule: wait at least 5 minutes between trades. Think before you click.",
  trend_reading: "Study how moving averages work. Trade in the direction of the dominant trend.",
  sentiment_reading: "Check news sentiment before every trade. It tells you what the market is feeling.",
  exit_timing: "Set target prices and stop-losses BEFORE entering. Don't decide exits in the moment.",
  entry_timing: "Wait for confirmation. A strong entry has both trend and sentiment support.",
  diversification: "Spread your trades across at least 3 different stocks to reduce risk.",
}
