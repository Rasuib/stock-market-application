/**
 * Flag → Lesson Mapping
 *
 * Maps behavioral flags to relevant learning paths lessons.
 * Used to show contextual "You should review this lesson" banners
 * after a trade triggers a mapped flag.
 */

import type { BehavioralFlag } from "./types"

export interface FlagLessonLink {
  flag: BehavioralFlag
  lessonId: string
  lessonTitle: string
  nudgeMessage: string
  /** Stronger message when user repeats the flag AFTER completing the lesson */
  reminderMessage: string
}

export const FLAG_LESSON_MAP: FlagLessonLink[] = [
  {
    flag: "overtrading",
    lessonId: "overtrading",
    lessonTitle: "Overtrading",
    nudgeMessage: "You're trading very frequently. Review the Overtrading lesson to understand why patience pays off.",
    reminderMessage: "You've already learned about overtrading — what triggered this burst of trades?",
  },
  {
    flag: "oversized_position",
    lessonId: "risk-management-101",
    lessonTitle: "Risk Management 101",
    nudgeMessage: "This trade uses a large portion of your capital. Review Risk Management 101.",
    reminderMessage: "You know about position sizing from Risk Management 101 — why the oversized bet this time?",
  },
  {
    flag: "trend_fighting",
    lessonId: "trends",
    lessonTitle: "Trend Detection",
    nudgeMessage: "You're trading against the trend. Review how trend detection works.",
    reminderMessage: "You've studied trends — reconsider whether this is a calculated contrarian move or impulse.",
  },
  {
    flag: "sentiment_ignoring",
    lessonId: "sentiment",
    lessonTitle: "What is Market Sentiment?",
    nudgeMessage: "Market sentiment was strongly against this trade. Read up on how sentiment works.",
    reminderMessage: "You've learned about sentiment — did you consciously decide to ignore it, or overlook it?",
  },
  {
    flag: "panic_exit",
    lessonId: "emotions",
    lessonTitle: "Fear and Greed",
    nudgeMessage: "That looked like a panic sell. The Fear and Greed lesson explains this pattern.",
    reminderMessage: "You've studied fear and greed — try to pause and breathe before selling in a rush.",
  },
  {
    flag: "late_chase",
    lessonId: "combining-signals",
    lessonTitle: "Combining Multiple Signals",
    nudgeMessage: "You may be chasing momentum. Review how to combine signals before entering.",
    reminderMessage: "You learned about signal confirmation — waiting for a pullback is usually smarter than chasing.",
  },
  {
    flag: "poor_risk_discipline",
    lessonId: "risk-management-101",
    lessonTitle: "Risk Management 101",
    nudgeMessage: "Your risk management needs attention. Review the basics.",
    reminderMessage: "Risk discipline starts before the trade. Set your exit plan first, then execute.",
  },
  {
    flag: "concentration_risk",
    lessonId: "risk-management-101",
    lessonTitle: "Risk Management 101",
    nudgeMessage: "Too much of your portfolio is in one stock. Review diversification principles.",
    reminderMessage: "You know about diversification — consider spreading across different stocks.",
  },
  {
    flag: "selling_winners_early",
    lessonId: "loss-aversion",
    lessonTitle: "Loss Aversion",
    nudgeMessage: "You might be selling winners too early. The Loss Aversion lesson explains this bias.",
    reminderMessage: "Remember: let winners run. You've learned about this — trust your original thesis.",
  },
  {
    flag: "holding_losers",
    lessonId: "loss-aversion",
    lessonTitle: "Loss Aversion",
    nudgeMessage: "Holding losers too long is a common bias. Review the Loss Aversion lesson.",
    reminderMessage: "You've studied loss aversion — cutting losses early is a skill, not a failure.",
  },
  {
    flag: "impulsive_reversal",
    lessonId: "emotions",
    lessonTitle: "Fear and Greed",
    nudgeMessage: "Frequent reversals suggest emotional trading. Review Fear and Greed.",
    reminderMessage: "You've learned about emotional trading — try waiting at least an hour before reversing.",
  },
]

/**
 * Get lesson links for a set of triggered behavioral flags.
 */
export function getLessonLinksForFlags(
  flags: BehavioralFlag[],
): FlagLessonLink[] {
  const seen = new Set<string>()
  const links: FlagLessonLink[] = []

  for (const flag of flags) {
    const link = FLAG_LESSON_MAP.find(m => m.flag === flag)
    if (link && !seen.has(link.lessonId)) {
      seen.add(link.lessonId)
      links.push(link)
    }
  }

  return links
}
