/**
 * Adaptive Weight Calibration
 *
 * Adjusts the scoring weights based on user feedback (thumbs up/down).
 * When users rate coaching as helpful, the current weight distribution
 * is reinforced. When unhelpful, weights shift toward equal distribution.
 *
 * Uses exponential moving average so recent feedback matters more.
 */

import type { AdaptiveWeights, CoachingReport } from "./types"

// ── Default Weights (same as score-trade.ts base weights) ──

const DEFAULT_WEIGHTS: AdaptiveWeights = {
  alignment: 0.28,
  risk: 0.22,
  discipline: 0.18,
  outcome: 0.22,
  learning: 0.10,
  sampleCount: 0,
  lastUpdated: new Date().toISOString(),
}

const EQUAL_WEIGHTS = {
  alignment: 0.20,
  risk: 0.20,
  discipline: 0.20,
  outcome: 0.20,
  learning: 0.20,
}

// ── Learning rate: how fast weights adapt ──
const LEARNING_RATE = 0.05 // 5% shift per feedback
const MIN_SAMPLES_TO_APPLY = 5 // need at least 5 ratings before using adaptive weights

// ── Storage ──

const STORAGE_KEY = "tradia_adaptive_weights"

export function loadAdaptiveWeights(): AdaptiveWeights {
  if (typeof window === "undefined") return { ...DEFAULT_WEIGHTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_WEIGHTS }
    return JSON.parse(raw) as AdaptiveWeights
  } catch {
    return { ...DEFAULT_WEIGHTS }
  }
}

export function saveAdaptiveWeights(weights: AdaptiveWeights): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(weights))
  } catch { /* */ }
}

// ── Update Weights from Feedback ──

export function updateWeightsFromFeedback(
  report: CoachingReport,
  helpful: boolean,
): AdaptiveWeights {
  const weights = loadAdaptiveWeights()

  if (helpful) {
    // Reinforce: shift toward the reward distribution of this trade
    // The idea: if the user found this report helpful, the weight balance
    // that produced it was good. Nudge weights toward the relative reward magnitudes.
    const rewardAbs = {
      alignment: Math.abs(report.reward.alignment),
      risk: Math.abs(report.reward.risk),
      discipline: Math.abs(report.reward.discipline),
      outcome: Math.abs(report.reward.outcome),
      learning: Math.abs(report.reward.learning),
    }
    const rewardSum = rewardAbs.alignment + rewardAbs.risk + rewardAbs.discipline +
      rewardAbs.outcome + rewardAbs.learning

    if (rewardSum > 0) {
      // Target: reward-proportional distribution
      const target = {
        alignment: rewardAbs.alignment / rewardSum,
        risk: rewardAbs.risk / rewardSum,
        discipline: rewardAbs.discipline / rewardSum,
        outcome: rewardAbs.outcome / rewardSum,
        learning: rewardAbs.learning / rewardSum,
      }

      weights.alignment += LEARNING_RATE * (target.alignment - weights.alignment)
      weights.risk += LEARNING_RATE * (target.risk - weights.risk)
      weights.discipline += LEARNING_RATE * (target.discipline - weights.discipline)
      weights.outcome += LEARNING_RATE * (target.outcome - weights.outcome)
      weights.learning += LEARNING_RATE * (target.learning - weights.learning)
    }
  } else {
    // Unhelpful: shift toward equal weights (the "I don't know" direction)
    weights.alignment += LEARNING_RATE * (EQUAL_WEIGHTS.alignment - weights.alignment)
    weights.risk += LEARNING_RATE * (EQUAL_WEIGHTS.risk - weights.risk)
    weights.discipline += LEARNING_RATE * (EQUAL_WEIGHTS.discipline - weights.discipline)
    weights.outcome += LEARNING_RATE * (EQUAL_WEIGHTS.outcome - weights.outcome)
    weights.learning += LEARNING_RATE * (EQUAL_WEIGHTS.learning - weights.learning)
  }

  // Normalize so weights sum to 1
  const sum = weights.alignment + weights.risk + weights.discipline +
    weights.outcome + weights.learning
  if (sum > 0) {
    weights.alignment /= sum
    weights.risk /= sum
    weights.discipline /= sum
    weights.outcome /= sum
    weights.learning /= sum
  }

  weights.sampleCount++
  weights.lastUpdated = new Date().toISOString()

  saveAdaptiveWeights(weights)
  return weights
}

// ── Get Effective Weights (for score-trade.ts to use) ──

export function getEffectiveWeights(): {
  alignment: number
  risk: number
  discipline: number
  outcome: number
  learning: number
} {
  const adaptive = loadAdaptiveWeights()

  // Only use adaptive weights if we have enough feedback samples
  if (adaptive.sampleCount < MIN_SAMPLES_TO_APPLY) {
    return {
      alignment: DEFAULT_WEIGHTS.alignment,
      risk: DEFAULT_WEIGHTS.risk,
      discipline: DEFAULT_WEIGHTS.discipline,
      outcome: DEFAULT_WEIGHTS.outcome,
      learning: DEFAULT_WEIGHTS.learning,
    }
  }

  // Blend: start from default, interpolate toward adaptive based on confidence
  // Confidence ramps up logarithmically: 5 samples = 0.3, 20 = 0.6, 50 = 0.8
  const confidence = Math.min(0.8, Math.log10(adaptive.sampleCount) / Math.log10(50) * 0.8)

  return {
    alignment: DEFAULT_WEIGHTS.alignment + confidence * (adaptive.alignment - DEFAULT_WEIGHTS.alignment),
    risk: DEFAULT_WEIGHTS.risk + confidence * (adaptive.risk - DEFAULT_WEIGHTS.risk),
    discipline: DEFAULT_WEIGHTS.discipline + confidence * (adaptive.discipline - DEFAULT_WEIGHTS.discipline),
    outcome: DEFAULT_WEIGHTS.outcome + confidence * (adaptive.outcome - DEFAULT_WEIGHTS.outcome),
    learning: DEFAULT_WEIGHTS.learning + confidence * (adaptive.learning - DEFAULT_WEIGHTS.learning),
  }
}

// ── Reset Weights ──

export function resetAdaptiveWeights(): AdaptiveWeights {
  const weights = { ...DEFAULT_WEIGHTS, lastUpdated: new Date().toISOString() }
  saveAdaptiveWeights(weights)
  return weights
}
