/**
 * Progressive Curriculum System
 *
 * Introduces trading concepts progressively based on the user's
 * trade count and performance grade. Topics unlock as the user
 * demonstrates competency in prerequisite areas.
 *
 * Stages: beginner → developing → intermediate → proficient
 */

import type {
  CurriculumStage,
  CurriculumTopic,
  CurriculumProgress,
  LearningSummary,
} from "./types"

// ── Topic Definitions ──

const CURRICULUM_TOPICS: CurriculumTopic[] = [
  // ── Beginner (0+ trades) ──
  {
    id: "basics-buy-sell",
    title: "Buying & Selling Basics",
    description: "Understand what happens when you buy or sell a stock, and how profit/loss works.",
    stage: "beginner",
    minTrades: 0,
    minGrade: null,
    skillTags: ["entry_timing", "exit_timing"],
    tips: [
      "Buy = you think the price will go up. Sell = you think it's time to take profits or cut losses.",
      "Your profit on a sell = (sell price - buy price) × quantity.",
      "Every trade has a cost. Only trade when you have a reason.",
    ],
  },
  {
    id: "reading-sentiment",
    title: "Reading Market Sentiment",
    description: "Learn how news sentiment affects stock prices and how to read the sentiment indicator.",
    stage: "beginner",
    minTrades: 2,
    minGrade: null,
    skillTags: ["sentiment_reading"],
    tips: [
      "Bullish sentiment means positive news — prices tend to rise.",
      "Bearish sentiment means negative news — prices tend to fall.",
      "Check sentiment BEFORE trading. Don't buy into bad news.",
    ],
  },
  {
    id: "reading-trends",
    title: "Understanding Price Trends",
    description: "Learn how moving averages show the direction of a stock's price movement.",
    stage: "beginner",
    minTrades: 3,
    minGrade: null,
    skillTags: ["trend_reading"],
    tips: [
      "An uptrend means the short-term average is above the long-term average.",
      "A downtrend is the opposite — short below long. Prices are generally falling.",
      "Trading WITH the trend is safer than trading against it.",
    ],
  },

  // ── Developing (5+ trades, grade C or better) ──
  {
    id: "signal-alignment",
    title: "Aligning Signals Before Trading",
    description: "The best trades happen when sentiment AND trend agree. Learn to wait for confirmation.",
    stage: "developing",
    minTrades: 5,
    minGrade: "C",
    skillTags: ["signal_alignment"],
    tips: [
      "A buy is strongest when sentiment is bullish AND the trend is up.",
      "If signals disagree, consider waiting. Mixed signals = higher risk.",
      "Patience is a trading skill. Not every moment is a good time to trade.",
    ],
  },
  {
    id: "position-sizing",
    title: "Position Sizing & Risk",
    description: "Learn how much of your portfolio to risk on each trade.",
    stage: "developing",
    minTrades: 5,
    minGrade: "C",
    skillTags: ["position_sizing", "risk_management"],
    tips: [
      "Never put more than 10-15% of your portfolio in a single trade.",
      "Smaller positions let you survive mistakes and stay in the game.",
      "If you lose 50%, you need a 100% gain just to break even. Size matters.",
    ],
  },
  {
    id: "avoiding-overtrading",
    title: "Avoiding Overtrading",
    description: "Quality over quantity. Learn why fewer, better trades beats many impulsive ones.",
    stage: "developing",
    minTrades: 8,
    minGrade: null,
    skillTags: ["patience"],
    tips: [
      "Set a max of 3-5 trades per session. More trades ≠ more profit.",
      "Each trade should have a clear thesis. If you can't explain why, don't trade.",
      "Boredom and FOMO are not valid trading reasons.",
    ],
  },

  // ── Intermediate (15+ trades, grade B or better) ──
  {
    id: "market-regimes",
    title: "Understanding Market Regimes",
    description: "Markets behave differently in trends vs ranges vs uncertainty. Learn to adapt.",
    stage: "intermediate",
    minTrades: 15,
    minGrade: "B",
    skillTags: ["trend_reading", "signal_alignment"],
    tips: [
      "Trending markets: ride the wave. Align with the dominant direction.",
      "Range-bound markets: be cautious. Quick in and out, or sit it out.",
      "High uncertainty: reduce position sizes and trade less frequently.",
    ],
  },
  {
    id: "exit-strategy",
    title: "Exit Strategies",
    description: "Knowing when to sell is harder than knowing when to buy. Master your exits.",
    stage: "intermediate",
    minTrades: 15,
    minGrade: "B",
    skillTags: ["exit_timing"],
    tips: [
      "Set your exit plan BEFORE entering a trade. Both target and stop-loss.",
      "Don't sell winners too early just because you're up. Let trends work for you.",
      "Cut losses early. A small loss beats a catastrophic one.",
    ],
  },
  {
    id: "diversification",
    title: "Diversification & Portfolio Balance",
    description: "Don't put all your eggs in one basket. Learn to spread risk across positions.",
    stage: "intermediate",
    minTrades: 20,
    minGrade: "B",
    skillTags: ["diversification", "risk_management"],
    tips: [
      "Hold positions in at least 3 different stocks across sectors.",
      "If one stock tanks, diversification limits the damage.",
      "Keep 20-30% cash reserve for protection and opportunities.",
    ],
  },

  // ── Proficient (30+ trades, grade A or better) ──
  {
    id: "behavioral-mastery",
    title: "Behavioral Pattern Mastery",
    description: "Recognize and eliminate your own behavioral biases. The hardest trading skill.",
    stage: "proficient",
    minTrades: 30,
    minGrade: "A",
    skillTags: ["patience", "risk_management"],
    tips: [
      "Review your behavioral flags weekly. Patterns you don't see will keep costing you.",
      "Panic selling and late chasing are the two most expensive habits.",
      "Journal your emotions before and after trades. Awareness is the first step.",
    ],
  },
  {
    id: "advanced-regime-play",
    title: "Regime-Adapted Trading",
    description: "Adjust your entire strategy based on the current market regime.",
    stage: "proficient",
    minTrades: 40,
    minGrade: "A",
    skillTags: ["signal_alignment", "trend_reading", "sentiment_reading"],
    tips: [
      "In strong uptrends, increase position sizes and hold longer.",
      "In uncertainty, tighten stops and reduce exposure.",
      "Track how your performance varies by regime. Most traders have a 'best regime'.",
    ],
  },
]

// ── Grade Ordering ──

const GRADE_ORDER: Record<string, number> = { F: 0, D: 1, C: 2, B: 3, A: 4, S: 5 }

function meetsGrade(userGrade: string, requiredGrade: string | null): boolean {
  if (!requiredGrade) return true
  return (GRADE_ORDER[userGrade] ?? 0) >= (GRADE_ORDER[requiredGrade] ?? 0)
}

// ── Stage Thresholds ──

function computeStage(totalTrades: number, grade: string): CurriculumStage {
  if (totalTrades >= 30 && meetsGrade(grade, "A")) return "proficient"
  if (totalTrades >= 15 && meetsGrade(grade, "B")) return "intermediate"
  if (totalTrades >= 5 && meetsGrade(grade, "C")) return "developing"
  return "beginner"
}

// ── Default Progress ──

function defaultProgress(): CurriculumProgress {
  return {
    stage: "beginner",
    unlockedTopicIds: ["basics-buy-sell"],
    completedTopicIds: [],
    currentFocus: "basics-buy-sell",
    lastUpdated: new Date().toISOString(),
  }
}

// ── Load / Save Progress ──

const PROGRESS_KEY = "tradia_curriculum_progress"

export function loadCurriculumProgress(): CurriculumProgress {
  if (typeof window === "undefined") return defaultProgress()
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (!raw) return defaultProgress()
    return JSON.parse(raw) as CurriculumProgress
  } catch {
    return defaultProgress()
  }
}

export function saveCurriculumProgress(progress: CurriculumProgress): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  } catch { /* */ }
}

// ── Update Curriculum Based on Learning Summary ──

export function updateCurriculum(summary: LearningSummary): CurriculumProgress {
  const progress = loadCurriculumProgress()

  // Update stage
  progress.stage = computeStage(summary.totalTrades, summary.grade)

  // Check which topics should be unlocked
  for (const topic of CURRICULUM_TOPICS) {
    if (progress.unlockedTopicIds.includes(topic.id)) continue

    const stageOk = stageAtLeast(progress.stage, topic.stage)
    const tradesOk = summary.totalTrades >= topic.minTrades
    const gradeOk = meetsGrade(summary.grade, topic.minGrade)

    if (stageOk && tradesOk && gradeOk) {
      progress.unlockedTopicIds.push(topic.id)
    }
  }

  // Auto-complete topics where user demonstrates proficiency in all skill tags
  for (const topicId of progress.unlockedTopicIds) {
    if (progress.completedTopicIds.includes(topicId)) continue

    const topic = CURRICULUM_TOPICS.find(t => t.id === topicId)
    if (!topic) continue

    // A topic is "completed" when the user has traded enough and all its skill tags are strengths
    const allSkillsStrong = topic.skillTags.every(tag =>
      summary.strengths.includes(tag)
    )
    if (allSkillsStrong && summary.totalTrades >= topic.minTrades + 5) {
      progress.completedTopicIds.push(topicId)
    }
  }

  // Set current focus = first unlocked but not completed topic
  const focusTopic = progress.unlockedTopicIds.find(
    id => !progress.completedTopicIds.includes(id)
  )
  progress.currentFocus = focusTopic || null

  progress.lastUpdated = new Date().toISOString()
  saveCurriculumProgress(progress)
  return progress
}

// ── Get Topics with Unlock Status ──

export function getCurriculumTopics(progress: CurriculumProgress): CurriculumTopic[] {
  return CURRICULUM_TOPICS.map(topic => ({
    ...topic,
    unlocked: progress.unlockedTopicIds.includes(topic.id),
    completed: progress.completedTopicIds.includes(topic.id),
  }))
}

// ── Get Current Focus Topic ──

export function getCurrentFocusTopic(progress: CurriculumProgress): CurriculumTopic | null {
  if (!progress.currentFocus) return null
  const topic = CURRICULUM_TOPICS.find(t => t.id === progress.currentFocus)
  if (!topic) return null
  return { ...topic, unlocked: true, completed: false }
}

// ── Stage Comparison Helper ──

const STAGE_ORDER: Record<CurriculumStage, number> = {
  beginner: 0,
  developing: 1,
  intermediate: 2,
  proficient: 3,
}

function stageAtLeast(current: CurriculumStage, required: CurriculumStage): boolean {
  return STAGE_ORDER[current] >= STAGE_ORDER[required]
}

// ── Get Stage Display Info ──

export function getStageInfo(stage: CurriculumStage): { label: string; color: string; next: string | null } {
  switch (stage) {
    case "beginner":
      return { label: "Beginner", color: "text-blue-400", next: "Trade 5+ times with grade C to reach Developing" }
    case "developing":
      return { label: "Developing", color: "text-green-400", next: "Trade 15+ times with grade B to reach Intermediate" }
    case "intermediate":
      return { label: "Intermediate", color: "text-purple-400", next: "Trade 30+ times with grade A to reach Proficient" }
    case "proficient":
      return { label: "Proficient", color: "text-amber-400", next: null }
  }
}
