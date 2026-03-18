/**
 * Feedback Synthesizer
 *
 * Converts scoring results and features into human-readable coaching feedback.
 * Every coaching sentence is traceable to evidence from the scoring components.
 *
 * Design principles:
 * - Concise, specific, beginner-friendly
 * - Evidence-based (never generic filler)
 * - Context-aware (references actual trade parameters)
 * - Personalized (accounts for behavioral patterns)
 * - Actionable (every "improve" item is something the user can do next trade)
 */

import type {
  EvaluateTradeInput,
  ExtractedFeatures,
  BehavioralFlagDetail,
  SkillTag,
  TradeVerdict,
} from "./types"
import type { ScoringResult } from "./score-trade"

export interface SynthesizedFeedback {
  summary: string
  whatWentRight: string[]
  whatWentWrong: string[]
  improveNext: string[]
  supportingSignals: string[]
  contradictorySignals: string[]
  riskNotes: string[]
  skillTags: SkillTag[]
  regimeContext: string
}

export function synthesizeFeedback(
  input: EvaluateTradeInput,
  features: ExtractedFeatures,
  scoring: ScoringResult,
  flags: BehavioralFlagDetail[],
  verdict: TradeVerdict,
): SynthesizedFeedback {
  const whatWentRight: string[] = []
  const whatWentWrong: string[] = []
  const improveNext: string[] = []
  const supportingSignals: string[] = []
  const contradictorySignals: string[] = []
  const riskNotes: string[] = []
  const skillTags: SkillTag[] = []

  const action = input.action
  const actionWord = action === "buy" ? "buying" : "selling"

  // ═══════════════════════════════════════════════════════════
  // 1. Alignment feedback
  // ═══════════════════════════════════════════════════════════

  if (scoring.alignment.score > 0.2) {
    whatWentRight.push(scoring.alignment.detail)
    skillTags.push("signal_alignment")
  } else if (scoring.alignment.score < -0.2) {
    whatWentWrong.push(scoring.alignment.detail)
    skillTags.push("signal_alignment")

    // Specific improvement based on what was misaligned
    if (features.actionDirection * features.trendDirection < -0.2) {
      improveNext.push("Check the price trend (moving averages) before entering. Trading with the trend significantly improves outcomes.")
      skillTags.push("trend_reading")
    }
    if (features.actionDirection * features.sentimentDirection < -0.2) {
      improveNext.push("Review news sentiment before trading. Strong opposing sentiment is a warning sign.")
      skillTags.push("sentiment_reading")
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 2. Signal context (supporting vs contradictory)
  // ═══════════════════════════════════════════════════════════

  const sentSrc = input.sentiment.source === "finbert" ? "FinBERT NLP" : input.sentiment.source === "heuristic-fallback" ? "keyword analysis" : "unavailable"
  const sentConf = (input.sentiment.confidence * 100).toFixed(0)
  const trendConf = (input.trend.confidence * 100).toFixed(0)

  if (input.sentiment.source !== "unavailable") {
    const sentAlign = features.actionDirection * features.sentimentDirection
    if (sentAlign > 0) {
      supportingSignals.push(`Sentiment is ${input.sentiment.label} (via ${sentSrc}, ${sentConf}% confidence) — supports ${actionWord}.`)
    } else if (sentAlign < 0) {
      contradictorySignals.push(`Sentiment is ${input.sentiment.label} (via ${sentSrc}, ${sentConf}% confidence) — conflicts with ${actionWord}.`)
    } else {
      supportingSignals.push(`Sentiment is neutral (via ${sentSrc}) — no clear signal.`)
    }
  }

  const trendAlign = features.actionDirection * features.trendDirection
  if (trendAlign > 0.2) {
    supportingSignals.push(`Trend is ${input.trend.label} (${trendConf}% confidence) — supports ${actionWord}.`)
  } else if (trendAlign < -0.2) {
    contradictorySignals.push(`Trend is ${input.trend.label} (${trendConf}% confidence) — conflicts with ${actionWord}.`)
  } else {
    supportingSignals.push(`Trend is ${input.trend.label} — no strong directional signal.`)
  }

  // Momentum context
  if (Math.abs(features.momentum) > 2) {
    const momDir = features.momentum > 0 ? "upward" : "downward"
    const momStr = `${Math.abs(features.momentum).toFixed(1)}% ${momDir} momentum`
    if (features.actionDirection * features.momentum > 0) {
      supportingSignals.push(`${momStr} supports your ${action}.`)
    } else {
      contradictorySignals.push(`${momStr} works against your ${action}.`)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 3. Risk feedback
  // ═══════════════════════════════════════════════════════════

  riskNotes.push(scoring.risk.detail)

  if (scoring.risk.score > 0.2) {
    whatWentRight.push(scoring.risk.detail)
    skillTags.push("risk_management", "position_sizing")
  } else if (scoring.risk.score < -0.2) {
    whatWentWrong.push(scoring.risk.detail)
    skillTags.push("risk_management", "position_sizing")

    if (action === "buy") {
      if (features.positionSizeRatio > 0.2) {
        improveNext.push(`Size your positions at 5-10% of portfolio. This trade used ${(features.positionSizeRatio * 100).toFixed(0)}%.`)
      }
      if (features.portfolioExposure > 0.7) {
        improveNext.push("Keep at least 25% of your capital in cash. Over-allocation leaves no room for opportunities or protection.")
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 4. Discipline feedback
  // ═══════════════════════════════════════════════════════════

  if (scoring.discipline.score > 0.3) {
    whatWentRight.push(scoring.discipline.detail)
    skillTags.push("patience")
  } else if (scoring.discipline.score < -0.2) {
    whatWentWrong.push(scoring.discipline.detail)
    skillTags.push("patience")
    improveNext.push("Set a maximum of 3-5 trades per session. Before each trade, write a one-sentence reason for entering.")
  }

  // ═══════════════════════════════════════════════════════════
  // 5. Outcome feedback (sells only)
  // ═══════════════════════════════════════════════════════════

  if (scoring.outcome.score > 0.2) {
    whatWentRight.push(scoring.outcome.detail)
    skillTags.push("exit_timing")
  } else if (scoring.outcome.score < -0.2) {
    whatWentWrong.push(scoring.outcome.detail)
    skillTags.push("exit_timing")

    // Sell-specific improvement advice
    if (features.isWinner === false) {
      if (features.holdingDuration !== undefined && features.holdingDuration < 5 * 60 * 1000) {
        improveNext.push("Set your stop-loss BEFORE entering a trade. If the price hits it, exit without emotion.")
      } else {
        improveNext.push("Review your entry decision. Were the signals strong enough to justify this trade?")
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 6. Learning trajectory feedback
  // ═══════════════════════════════════════════════════════════

  if (scoring.learning.score > 0.3) {
    whatWentRight.push(scoring.learning.detail)
  } else if (scoring.learning.score < -0.2) {
    whatWentWrong.push(scoring.learning.detail)
    improveNext.push("Review your last 5 trades and identify the most common mistake. Focus on fixing that one thing.")
  }

  // ═══════════════════════════════════════════════════════════
  // 7. Behavioral flag feedback
  // ═══════════════════════════════════════════════════════════

  for (const flag of flags) {
    if (flag.severity === "warning" || flag.severity === "critical") {
      whatWentWrong.push(flag.description)
    }

    // Add specific, actionable improvement for each flag type
    switch (flag.flag) {
      case "overtrading":
        addUnique(improveNext, "Limit yourself to 3-5 trades per session. Quality beats quantity.")
        skillTags.push("patience")
        break
      case "oversized_position":
        addUnique(improveNext, "Start with 5-10% of capital per trade. Scale up only as confidence grows.")
        skillTags.push("position_sizing")
        break
      case "trend_fighting":
        addUnique(improveNext, "Before each trade, check the moving average direction. Trade with it, not against it.")
        skillTags.push("trend_reading")
        break
      case "sentiment_ignoring":
        addUnique(improveNext, "Check the news sentiment panel before entering. Strong opposing sentiment is a red flag.")
        skillTags.push("sentiment_reading")
        break
      case "panic_exit":
        addUnique(improveNext, "Decide your exit price BEFORE entering. Write it down. Don't let fear change your plan.")
        break
      case "late_chase":
        addUnique(improveNext, "If a stock already moved 3%+, the easy gain is gone. Wait for a pullback or find a different opportunity.")
        skillTags.push("entry_timing")
        break
      case "impulsive_reversal":
        addUnique(improveNext, "Commit to a direction. Reversing within minutes means your original plan wasn't solid.")
        break
      case "selling_winners_early":
        addUnique(improveNext, "Let winners run. Instead of fixed exits, try a trailing stop at -3% from the peak.")
        skillTags.push("exit_timing")
        break
      case "holding_losers":
        addUnique(improveNext, "Cut losses at -5% to -8%. Holding losers longer almost never works out.")
        skillTags.push("exit_timing")
        break
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 8. Regime context
  // ═══════════════════════════════════════════════════════════

  let regimeContext = features.regime.description
  const regime = features.regime.regime

  // Add regime-specific coaching color
  if (regime === "high_uncertainty" && action === "buy") {
    regimeContext += " In uncertain markets, smaller positions and patience tend to pay off."
  } else if (regime === "weak_signal") {
    regimeContext += " With weak signals, consider waiting for clearer conditions."
  } else if (regime === "trending_up" && action === "sell" && features.isWinner === true) {
    regimeContext += " Selling in an uptrend can mean leaving gains on the table."
  } else if (regime === "trending_down" && action === "buy") {
    regimeContext += " Buying in a downtrend is risky — wait for signs of reversal."
  }

  // ═══════════════════════════════════════════════════════════
  // 9. Ensure minimum quality
  // ═══════════════════════════════════════════════════════════

  // Always provide at least one positive point
  if (whatWentRight.length === 0) {
    whatWentRight.push("You placed a trade and are building your track record. Each trade is a learning opportunity.")
  }

  // Always provide at least one improvement point
  if (improveNext.length === 0) {
    if (action === "buy") {
      improveNext.push("Before your next trade, set a target exit price and a stop-loss level.")
    } else {
      improveNext.push("For your next trade, articulate your thesis in one sentence before clicking.")
    }
  }

  // Cap arrays to prevent information overload
  const finalImproveNext = [...new Set(improveNext)].slice(0, 3)
  const finalSkillTags = [...new Set(skillTags)]

  // ═══════════════════════════════════════════════════════════
  // 10. Summary sentence
  // ═══════════════════════════════════════════════════════════

  const summary = generateSummary(input, verdict, scoring.score, whatWentRight, whatWentWrong, features)

  return {
    summary,
    whatWentRight,
    whatWentWrong,
    improveNext: finalImproveNext,
    supportingSignals,
    contradictorySignals,
    riskNotes,
    skillTags: finalSkillTags,
    regimeContext,
  }
}

// ── Summary Generation ──

function generateSummary(
  input: EvaluateTradeInput,
  verdict: TradeVerdict,
  score: number,
  right: string[],
  wrong: string[],
  features: ExtractedFeatures,
): string {
  const action = input.action === "buy" ? "Buy" : "Sell"
  const regime = features.regime.regime.replace(/_/g, " ")

  if (verdict === "strong") {
    const mainRight = right[0] || "Good alignment with market signals."
    return `${action} looks solid (${score}/100). ${mainRight}`
  }

  if (verdict === "mixed") {
    if (right.length > 0 && wrong.length > 0) {
      // Use the shortest wrong item for the summary
      const shortWrong = wrong.reduce((a, b) => a.length < b.length ? a : b)
      return `Mixed ${action.toLowerCase()} (${score}/100, ${regime} market). ${right[0]} However, ${shortWrong.charAt(0).toLowerCase()}${shortWrong.slice(1)}`
    }
    return `Mixed signals for this ${action.toLowerCase()} (${score}/100). Some factors support it, others suggest caution.`
  }

  // weak
  const mainIssue = wrong[0] || "This trade conflicts with current market signals."
  return `Weak ${action.toLowerCase()} decision (${score}/100). ${mainIssue}`
}

// ── Utility ──

function addUnique(arr: string[], item: string): void {
  if (!arr.includes(item)) arr.push(item)
}
