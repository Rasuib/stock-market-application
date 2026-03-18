/**
 * Unified Trade Evaluation Pipeline — Expert System
 *
 * This is the ONE authoritative place where trades are evaluated.
 * Every trade flows through this pipeline:
 *
 *   1. Feature Extraction     → rich typed features from raw inputs
 *   2. Market Regime          → classify the current market environment
 *   3. Behavioral Analysis    → detect patterns using trade history
 *   4. Weighted Scoring       → confidence-aware, regime-adjusted rubric
 *   5. Feedback Synthesis     → context-specific coaching feedback
 *   6. Report Assembly        → complete CoachingReport
 *
 * Design: Explainable expert system. Every score comes from understandable
 * components. Every coaching sentence is traceable to evidence.
 */

import type {
  EvaluateTradeInput,
  CoachingReport,
  TradeVerdict,
  MarketSnapshot,
} from "./types"
import { extractFeatures } from "./feature-extractor"
import { detectBehavioralFlags } from "./behavior-memory"
import { scoreTrade } from "./score-trade"
import { synthesizeFeedback } from "./feedback-synthesizer"

// ── Main Entry Point ──

export function evaluateTradeForCoaching(input: EvaluateTradeInput): CoachingReport {
  // 1. Extract rich features from raw inputs
  const features = extractFeatures(input)

  // 2. Detect behavioral flags with memory/escalation
  const behavioralFlags = detectBehavioralFlags(input, features)

  // 3. Score across all dimensions (confidence-aware, regime-adjusted)
  const scoring = scoreTrade(input, features)

  // 4. Determine verdict
  const verdict = scoreToVerdict(scoring.score)

  // 5. Synthesize human-readable coaching feedback
  const feedback = synthesizeFeedback(input, features, scoring, behavioralFlags, verdict)

  // 6. Build market snapshot
  const marketSnapshot: MarketSnapshot = {
    sentiment: input.sentiment,
    trend: input.trend,
    price: input.price,
    currency: input.currency,
    market: input.market,
    regime: features.regime.regime,
  }

  // 7. Assemble final report
  return {
    verdict,
    score: scoring.score,
    confidence: scoring.confidence,
    summary: feedback.summary,
    whatWentRight: feedback.whatWentRight,
    whatWentWrong: feedback.whatWentWrong,
    improveNext: feedback.improveNext,
    supportingSignals: feedback.supportingSignals,
    contradictorySignals: feedback.contradictorySignals,
    riskNotes: feedback.riskNotes,
    skillTags: feedback.skillTags,
    marketSnapshot,
    behavioralFlags,
    regimeContext: feedback.regimeContext,
    reward: {
      total: scoring.rewardTotal,
      alignment: scoring.alignment.score,
      risk: scoring.risk.score,
      discipline: scoring.discipline.score,
      outcome: scoring.outcome.score,
      learning: scoring.learning.score,
    },
  }
}

// ── Verdict Classification ──

function scoreToVerdict(score: number): TradeVerdict {
  if (score >= 65) return "strong"
  if (score >= 40) return "mixed"
  return "weak"
}
