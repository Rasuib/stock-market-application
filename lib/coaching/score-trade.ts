/**
 * Trade Scoring Engine — Weighted Rubric
 *
 * Scores each trade across 5 dimensions with confidence-aware logic:
 *   1. Signal Alignment (how well the trade direction matches market signals)
 *   2. Risk Management (position sizing and portfolio exposure)
 *   3. Discipline (trading pace, patience, plan adherence)
 *   4. Outcome Quality (P&L for sells, risk-adjusted)
 *   5. Learning Trajectory (improving or declining over time)
 *
 * Each dimension returns a ComponentScore with:
 *   - score: -1 to +1
 *   - confidence: 0-1 (how reliable this assessment is)
 *   - label: short readable label
 *   - detail: beginner-friendly explanation
 *   - evidence: traceable reasons
 *
 * The final weighted total is adjusted by market regime.
 */

import type { ComponentScore, ExtractedFeatures, EvaluateTradeInput } from "./types"
import { getRegimeWeightAdjustments } from "./market-regime"
import { getEffectiveWeights } from "./adaptive-weights"

// ── Base Weights (before regime adjustment) ──
// These are the defaults. getEffectiveWeights() returns adaptive weights
// after enough user feedback has been collected.

function getBaseWeights() {
  try {
    return getEffectiveWeights()
  } catch {
    // Fallback for SSR or test environments
    return { alignment: 0.28, risk: 0.22, discipline: 0.18, outcome: 0.22, learning: 0.10 }
  }
}

// ── Main Scoring Function ──

export interface ScoringResult {
  alignment: ComponentScore
  risk: ComponentScore
  discipline: ComponentScore
  outcome: ComponentScore
  learning: ComponentScore
  rawTotal: number
  score: number          // 0-100
  rewardTotal: number    // -100 to +100
  confidence: number     // 0-1
}

export function scoreTrade(input: EvaluateTradeInput, features: ExtractedFeatures): ScoringResult {
  const alignment = scoreAlignment(input, features)
  const risk = scoreRisk(input, features)
  const discipline = scoreDiscipline(input, features)
  const outcome = scoreOutcome(input, features)
  const learning = scoreLearning(features)

  // Get adaptive base weights (may be calibrated from user feedback)
  const base = getBaseWeights()

  // Get regime-adjusted weights
  const regime = features.regime.regime
  const adj = getRegimeWeightAdjustments(regime)

  const wAlignment = base.alignment * adj.alignmentMultiplier
  const wRisk = base.risk * adj.riskMultiplier
  const wDiscipline = base.discipline * adj.disciplineMultiplier
  const wOutcome = base.outcome * adj.outcomeMultiplier
  const wLearning = base.learning

  // Normalize weights to sum to 1
  const wTotal = wAlignment + wRisk + wDiscipline + wOutcome + wLearning
  const nAlignment = wAlignment / wTotal
  const nRisk = wRisk / wTotal
  const nDiscipline = wDiscipline / wTotal
  const nOutcome = wOutcome / wTotal
  const nLearning = wLearning / wTotal

  // Weighted total with confidence scaling
  // Higher confidence scores have more impact
  const rawTotal =
    nAlignment * alignment.score * (0.5 + 0.5 * alignment.confidence) +
    nRisk * risk.score * (0.5 + 0.5 * risk.confidence) +
    nDiscipline * discipline.score * (0.5 + 0.5 * discipline.confidence) +
    nOutcome * outcome.score * (0.5 + 0.5 * outcome.confidence) +
    nLearning * learning.score * (0.5 + 0.5 * learning.confidence)

  // Scale to 0-100 (from [-1,+1] raw)
  const score = Math.round(Math.max(0, Math.min(100, (rawTotal + 1) * 50)))

  // Reward in [-100, +100]
  const rewardTotal = Math.round(rawTotal * 100)

  // Overall confidence: weighted average of component confidences
  const confidence = Math.round((
    nAlignment * alignment.confidence +
    nRisk * risk.confidence +
    nDiscipline * discipline.confidence +
    nOutcome * outcome.confidence +
    nLearning * learning.confidence
  ) * 100) / 100

  return { alignment, risk, discipline, outcome, learning, rawTotal, score, rewardTotal, confidence }
}

// ══════════════════════════════════════════════════════════════
// Component 1: Signal Alignment
// ══════════════════════════════════════════════════════════════

function scoreAlignment(input: EvaluateTradeInput, f: ExtractedFeatures): ComponentScore {
  const evidence: string[] = []

  // Confidence-weighted alignment for sentiment
  const sentimentAlignment = f.actionDirection * f.sentimentDirection * f.sentimentReliability
  // Confidence-weighted alignment for trend
  const trendAlignment = f.actionDirection * f.trendDirection * f.trendReliability

  // Regime bonus: in trending markets, alignment matters more
  let regimeBonus = 0
  if (f.regime.regime === "trending_up" || f.regime.regime === "trending_down") {
    regimeBonus = Math.abs(trendAlignment) > 0.3 ? 0.1 * Math.sign(trendAlignment) : 0
    if (regimeBonus !== 0) evidence.push(`Regime bonus: strong trend amplifies alignment.`)
  }

  // Combine: trend has slightly more weight (real price data > news sentiment)
  let score = sentimentAlignment * 0.40 + trendAlignment * 0.60 + regimeBonus

  // Signal agreement bonus: when both signals agree strongly, extra reward
  if (f.signalAgreement > 0.5 && f.sentimentReliability > 0.4 && f.trendReliability > 0.4) {
    const agreementBonus = 0.12
    score += agreementBonus * Math.sign(f.actionDirection * f.sentimentDirection)
    evidence.push("Both sentiment and trend agree strongly — higher confidence in the signal.")
  }

  // Signal disagreement: when signals conflict, penalize confidence
  if (f.signalAgreement < -0.3) {
    evidence.push("Sentiment and trend disagree — mixed signals reduce certainty.")
  }

  score = clamp(score, -1, 1)

  // Confidence in this score
  const confidence = Math.min(1, (f.sentimentReliability + f.trendReliability) / 2 + 0.1)

  // Build evidence
  const sentLabel = input.sentiment.label
  const trendLabel = input.trend.label
  const sentSrc = input.sentiment.source === "finbert" ? "FinBERT NLP" : input.sentiment.source === "heuristic-fallback" ? "keyword heuristic" : "unavailable"

  if (sentimentAlignment > 0.2) {
    evidence.push(`Sentiment (${sentLabel}, via ${sentSrc}) supports your ${input.action}.`)
  } else if (sentimentAlignment < -0.2) {
    evidence.push(`Sentiment (${sentLabel}, via ${sentSrc}) opposes your ${input.action}.`)
  } else {
    evidence.push(`Sentiment is neutral or low-confidence — not a strong signal either way.`)
  }

  if (trendAlignment > 0.2) {
    evidence.push(`Price trend (${trendLabel}, confidence ${(input.trend.confidence * 100).toFixed(0)}%) supports your ${input.action}.`)
  } else if (trendAlignment < -0.2) {
    evidence.push(`Price trend (${trendLabel}) opposes your ${input.action}.`)
  } else {
    evidence.push(`Trend is unclear or range-bound — no strong directional signal.`)
  }

  // Label
  let label: string
  let detail: string

  if (score > 0.35) {
    label = "Well-aligned"
    detail = `Your ${input.action} is well-supported by market signals. Both sentiment and trend confirm the direction.`
  } else if (score > 0.1) {
    label = "Partially aligned"
    detail = `Your ${input.action} has some signal support, but not full confirmation from both sentiment and trend.`
  } else if (score > -0.1) {
    label = "Neutral"
    detail = `Market signals are neutral or mixed for this ${input.action}. The case is neither clearly for nor against.`
  } else if (score > -0.35) {
    label = "Partially misaligned"
    detail = `Your ${input.action} has limited signal support. Some indicators point the other way.`
  } else {
    label = "Misaligned"
    detail = `Your ${input.action} conflicts with the dominant market signals. Both sentiment (${sentLabel}) and trend (${trendLabel}) suggest caution.`
  }

  return { score, confidence, label, detail, evidence }
}

// ══════════════════════════════════════════════════════════════
// Component 2: Risk Management
// ══════════════════════════════════════════════════════════════

function scoreRisk(input: EvaluateTradeInput, f: ExtractedFeatures): ComponentScore {
  const evidence: string[] = []
  let score: number
  let label: string
  let detail: string
  let confidence = 0.85 // risk assessment is usually reliable

  if (input.action === "buy") {
    // ── Buy Risk Assessment ──

    // Position sizing (most important risk factor)
    let sizingScore: number
    if (f.positionSizeRatio > 0.5) {
      sizingScore = -0.9
      evidence.push(`Position uses ${(f.positionSizeRatio * 100).toFixed(0)}% of capital — extremely oversized.`)
    } else if (f.positionSizeRatio > 0.25) {
      sizingScore = -0.5
      evidence.push(`Position uses ${(f.positionSizeRatio * 100).toFixed(0)}% of capital — large for a single trade.`)
    } else if (f.positionSizeRatio > 0.10) {
      sizingScore = 0.1
      evidence.push(`Position uses ${(f.positionSizeRatio * 100).toFixed(0)}% of capital — moderate size.`)
    } else {
      sizingScore = 0.5
      evidence.push(`Position uses ${(f.positionSizeRatio * 100).toFixed(0)}% of capital — conservative size.`)
    }

    // Portfolio exposure
    let exposureScore: number
    if (f.portfolioExposure > 0.85) {
      exposureScore = -0.8
      evidence.push(`${(f.portfolioExposure * 100).toFixed(0)}% of capital is invested — almost fully allocated.`)
    } else if (f.portfolioExposure > 0.7) {
      exposureScore = -0.4
      evidence.push(`${(f.portfolioExposure * 100).toFixed(0)}% portfolio exposure — nearing over-allocation.`)
    } else if (f.portfolioExposure > 0.5) {
      exposureScore = -0.1
      evidence.push(`${(f.portfolioExposure * 100).toFixed(0)}% portfolio exposure — moderate.`)
    } else {
      exposureScore = 0.3
      evidence.push(`${(f.portfolioExposure * 100).toFixed(0)}% portfolio exposure — healthy cash reserve.`)
    }

    // Regime-aware risk: in uncertain/weak markets, large positions are worse
    let regimePenalty = 0
    if (f.regime.regime === "high_uncertainty" || f.regime.regime === "weak_signal") {
      if (f.positionSizeRatio > 0.15) {
        regimePenalty = -0.15
        evidence.push(`Market is ${f.regime.regime.replace("_", " ")} — larger positions carry extra risk.`)
      }
    }

    // Adding to existing position risk
    let addingPenalty = 0
    if (f.isAddingToPosition && f.existingExposure > 0.2) {
      addingPenalty = -0.15
      evidence.push(`Already holding ${(f.existingExposure * 100).toFixed(0)}% in ${input.symbol} — adding increases concentration risk.`)
    }

    score = sizingScore * 0.5 + exposureScore * 0.3 + regimePenalty + addingPenalty

    if (score > 0.2) {
      label = "Good risk management"
      detail = "Reasonable position size and portfolio exposure. You're managing risk well."
    } else if (score > -0.2) {
      label = "Moderate risk"
      detail = "Position size and exposure are acceptable but could be improved."
    } else {
      label = "Elevated risk"
      detail = "Your position size or portfolio exposure is too high. Consider reducing to manage downside."
    }

  } else {
    // ── Sell Risk Assessment ──

    // Selling reduces risk, but context matters
    if (f.portfolioExposure > 0.7) {
      score = 0.5
      label = "Good de-risking"
      detail = "Selling from a concentrated portfolio. This reduces your overall risk."
      evidence.push("Portfolio was over-concentrated — selling helps re-balance.")
    } else if (f.isWinner === false && f.profitPercent !== undefined && f.profitPercent < -5) {
      // Cutting a loss
      score = 0.3
      label = "Loss cutting"
      detail = "Cutting a losing position shows discipline, even though it's painful."
      evidence.push(`Taking a ${f.profitPercent.toFixed(1)}% loss rather than hoping for recovery.`)
    } else if (f.isWinner === true) {
      // Profit-taking: evaluate if it was too early or well-timed
      if (f.trendDirection > 0.3 && f.trendReliability > 0.4 && f.profitPercent !== undefined && f.profitPercent < 5) {
        score = -0.1
        label = "Premature profit-taking"
        detail = "You're taking profits while the trend is still positive. Consider letting winners run."
        evidence.push(`Selling at +${f.profitPercent.toFixed(1)}% while trend is still positive.`)
      } else {
        score = 0.4
        label = "Profit secured"
        detail = "Locking in gains. Good discipline in managing your exit."
        evidence.push("Taking profit at a reasonable level.")
      }
    } else {
      score = 0.2
      label = "Manageable"
      detail = "This sell doesn't significantly change your risk profile."
      evidence.push("Portfolio exposure is at a manageable level.")
    }

    confidence = 0.8
  }

  score = clamp(score, -1, 1)

  return { score, confidence, label, detail, evidence }
}

// ══════════════════════════════════════════════════════════════
// Component 3: Discipline
// ══════════════════════════════════════════════════════════════

function scoreDiscipline(input: EvaluateTradeInput, f: ExtractedFeatures): ComponentScore {
  const evidence: string[] = []

  // Trading frequency score
  let freqScore: number
  if (f.recentTradeCount > 10) {
    freqScore = -0.9
    evidence.push(`${f.recentTradeCount} trades in the last hour — excessive.`)
  } else if (f.recentTradeCount > 7) {
    freqScore = -0.6
    evidence.push(`${f.recentTradeCount} trades recently — very high frequency.`)
  } else if (f.recentTradeCount > 4) {
    freqScore = -0.2
    evidence.push(`${f.recentTradeCount} trades recently — moderate-high frequency.`)
  } else if (f.recentTradeCount <= 2) {
    freqScore = 0.6
    evidence.push("Patient, deliberate trading pace — ideal for learning.")
  } else {
    freqScore = 0.2
    evidence.push("Moderate trading frequency.")
  }

  // Regime-aware discipline: in uncertain markets, patience is more important
  let regimeAdjustment = 0
  if (f.regime.regime === "high_uncertainty" || f.regime.regime === "weak_signal") {
    if (f.recentTradeCount > 3) {
      regimeAdjustment = -0.15
      evidence.push(`Trading actively in a ${f.regime.regime.replace("_", " ")} market — patience is especially important here.`)
    } else if (f.recentTradeCount <= 2) {
      regimeAdjustment = 0.1
      evidence.push("Good patience in an uncertain market — waiting for clearer signals.")
    }
  }

  // Behavioral pattern penalty: if overtrading is a recurring pattern, penalize more
  const overtradingPattern = f.recentMistakePatterns.find(p => p.flag === "overtrading")
  let patternPenalty = 0
  if (overtradingPattern && overtradingPattern.recentCount >= 2) {
    patternPenalty = -0.15
    evidence.push("Overtrading is a recurring pattern — this needs urgent attention.")
  }

  const score = clamp(freqScore + regimeAdjustment + patternPenalty, -1, 1)
  const confidence = 0.9 // discipline is clearly measurable

  let label: string
  let detail: string

  if (score > 0.3) {
    label = "Disciplined"
    detail = "You're trading at a measured pace. This is the foundation of good trading."
  } else if (score > 0) {
    label = "Moderate discipline"
    detail = "Your trading pace is acceptable. Try to be more selective about which trades you take."
  } else if (score > -0.4) {
    label = "Low discipline"
    detail = "You're trading too frequently. Each trade should have a clear thesis — if you can't explain why in one sentence, don't trade."
  } else {
    label = "Undisciplined"
    detail = "Excessive trading is one of the fastest ways to lose money. Stop, review your strategy, then trade with intention."
  }

  return { score, confidence, label, detail, evidence }
}

// ══════════════════════════════════════════════════════════════
// Component 4: Outcome Quality
// ══════════════════════════════════════════════════════════════

function scoreOutcome(input: EvaluateTradeInput, f: ExtractedFeatures): ComponentScore {
  const evidence: string[] = []

  if (input.action === "buy" || input.profit === undefined) {
    return {
      score: 0,
      confidence: 0.3, // low confidence — outcome unknown
      label: "Pending",
      detail: input.action === "buy" ? "Outcome will be evaluated when you close this position." : "No profit data available.",
      evidence: ["Outcome assessment requires a completed (sell) trade."],
    }
  }

  const profit = input.profit
  const profitPct = input.profitPercent

  // ── Sell Outcome Scoring ──

  // Risk-adjusted return: scale by position size (not absolute dollar amount)
  const positionValue = input.quantity * input.price
  const returnOnPosition = positionValue > 0 ? profit / positionValue : 0

  let score: number
  let label: string
  let detail: string

  if (profit > 0) {
    // Profitable sell — score based on return %
    if (returnOnPosition > 0.05) {
      score = 0.8
      label = "Strong profit"
      evidence.push(`${(returnOnPosition * 100).toFixed(1)}% return on position — excellent.`)
    } else if (returnOnPosition > 0.02) {
      score = 0.5
      label = "Good profit"
      evidence.push(`${(returnOnPosition * 100).toFixed(1)}% return — solid result.`)
    } else {
      score = 0.25
      label = "Small profit"
      evidence.push(`${(returnOnPosition * 100).toFixed(1)}% return — positive but modest.`)
    }

    // Was this aligned with signals? Aligned profitable exits are better
    if (f.sentimentDirection < 0 || f.trendDirection < -0.3) {
      score += 0.1 // bonus: took profit with deteriorating conditions
      evidence.push("Smart to take profit as conditions weakened.")
    }

    const pctStr = profitPct !== undefined ? ` (+${profitPct.toFixed(1)}%)` : ""
    detail = `Profitable exit — you made $${profit.toFixed(2)}${pctStr}. ${score > 0.5 ? "Well-timed." : "Consider holding longer for bigger moves."}`

  } else if (profit === 0) {
    score = 0
    label = "Break even"
    detail = "Break-even trade. No loss, but consider if a longer hold would have been better."
    evidence.push("Zero profit — neither good nor bad outcome.")

  } else {
    // Loss — differentiate between disciplined stop-loss and panic exit

    // Was this a panic exit?
    const isPanicExit = f.holdingDuration !== undefined && f.holdingDuration < 5 * 60 * 1000

    if (isPanicExit) {
      // Panic exits are worse
      score = -0.7
      label = "Panic exit"
      detail = `Sold at a loss of $${Math.abs(profit).toFixed(2)} within minutes of buying. This looks emotional, not strategic.`
      evidence.push("Very short holding time suggests reactive decision.")
    } else if (returnOnPosition > -0.05) {
      // Small controlled loss — disciplined
      score = -0.15
      label = "Small loss (disciplined)"
      detail = `Small loss of ${Math.abs(returnOnPosition * 100).toFixed(1)}%. Cutting losses early is a good habit.`
      evidence.push("Controlled loss — better than holding and hoping.")
    } else if (returnOnPosition > -0.15) {
      // Moderate loss
      score = -0.4
      label = "Moderate loss"
      detail = `Lost ${Math.abs(returnOnPosition * 100).toFixed(1)}% on this position. Review your entry — were the signals strong enough?`
      evidence.push("Moderate loss — check if entry was well-reasoned.")
    } else {
      // Large loss
      score = -0.8
      label = "Large loss"
      detail = `Significant loss of ${Math.abs(returnOnPosition * 100).toFixed(1)}%. A stop-loss at -5% to -8% would have limited this damage.`
      evidence.push("Large loss — stop-loss discipline needed.")
    }

    // Credit for cutting loss in bearish conditions (disciplined exit)
    if (!isPanicExit && f.trendDirection < -0.2 && f.sentimentDirection < 0) {
      score += 0.15
      evidence.push("Recognized deteriorating conditions and exited — shows awareness.")
    }
  }

  score = clamp(score, -1, 1)
  const confidence = 0.9 // outcome is factual

  return { score, confidence, label, detail, evidence }
}

// ══════════════════════════════════════════════════════════════
// Component 5: Learning Trajectory
// ══════════════════════════════════════════════════════════════

function scoreLearning(f: ExtractedFeatures): ComponentScore {
  const evidence: string[] = []

  if (f.tradeHistoryLength < 3) {
    return {
      score: 0.1,
      confidence: 0.2,
      label: "Getting started",
      detail: "Too early to assess your learning trajectory. Keep trading to build your track record.",
      evidence: ["Fewer than 3 historical trades — insufficient data for trajectory analysis."],
    }
  }

  let score: number
  let label: string
  let detail: string

  const improvement = f.recentTradeImprovement

  // Check for declining mistake patterns (improvement)
  const improvingPatterns = f.recentMistakePatterns.filter(p => p.trend === "decreasing")
  const worseningPatterns = f.recentMistakePatterns.filter(p => p.trend === "increasing")

  let patternBonus = 0
  if (improvingPatterns.length > 0) {
    patternBonus = 0.15
    evidence.push(`Improving on: ${improvingPatterns.map(p => p.flag.replace(/_/g, " ")).join(", ")}.`)
  }
  if (worseningPatterns.length > 0) {
    patternBonus -= 0.15
    evidence.push(`Getting worse at: ${worseningPatterns.map(p => p.flag.replace(/_/g, " ")).join(", ")}.`)
  }

  if (f.tradeHistoryLength < 6) {
    // Early phase: give benefit of the doubt
    score = 0.15 + patternBonus
    label = "Building track record"
    detail = "Still early in your journey. Focus on consistency and learning from each trade."
    evidence.push(`${f.tradeHistoryLength} trades completed — still in learning phase.`)
  } else if (improvement > 8) {
    score = 0.8 + patternBonus
    label = "Strong improvement"
    detail = "Clear improvement in recent trades. Your decisions are getting noticeably better."
    evidence.push(`Recent trades average ${improvement.toFixed(0)} points above earlier trades.`)
  } else if (improvement > 3) {
    score = 0.4 + patternBonus
    label = "Improving"
    detail = "Gradual improvement trend. Keep building on good habits."
    evidence.push(`Recent trades trending ${improvement.toFixed(0)} points higher.`)
  } else if (improvement > -3) {
    score = 0.05 + patternBonus
    label = "Stable"
    detail = "Performance is consistent. Look for specific areas to push yourself."
    evidence.push("Performance stable — neither improving nor declining significantly.")
  } else if (improvement > -8) {
    score = -0.3 + patternBonus
    label = "Slight decline"
    detail = "Recent trades show a dip. Review your recent decisions and identify what changed."
    evidence.push(`Recent trades trending ${Math.abs(improvement).toFixed(0)} points lower.`)
  } else {
    score = -0.6 + patternBonus
    label = "Declining"
    detail = "Recent trades show declining quality. Take a break, review your strategy, then return fresh."
    evidence.push(`Significant decline: recent trades ${Math.abs(improvement).toFixed(0)} points below average.`)
  }

  score = clamp(score, -1, 1)

  // Confidence increases with more data
  const confidence = Math.min(0.9, 0.3 + f.tradeHistoryLength * 0.05)

  return { score, confidence, label, detail, evidence }
}

// ── Utility ──

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
