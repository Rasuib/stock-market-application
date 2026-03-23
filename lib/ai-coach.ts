/**
 * AI Coach — Gemini API Integration
 *
 * Enhances the expert system's deterministic coaching with Gemini's
 * natural language intelligence. The expert system stays authoritative
 * for scoring; Gemini adds narrative depth, personalization, and
 * conversational coaching.
 *
 * Three capabilities:
 * 1. Post-trade analysis  — rich narrative after each trade
 * 2. Session insights     — deep pattern analysis across trade history
 * 3. Conversational chat  — ask questions about trades and strategy
 */

import type {
  CoachingReport,
  TradeWithCoaching,
  LearningSummary,
  EvaluateTradeInput,
} from "./coaching/types"

// ── Types ──

export interface AITradeAnalysis {
  narrative: string
  personalizedTip: string
  whatAProfessionalWouldDo: string
  encouragement: string
}

export interface AISessionInsight {
  performanceSummary: string
  patternAnalysis: string
  actionPlan: string[]
  mindsetTip: string
}

export interface AIChatMessage {
  role: "user" | "assistant"
  content: string
}

// ── System Prompts ──

const COACH_PERSONA = `You are an expert stock trading coach inside "Tradia", an educational trading simulator. You are warm, encouraging, and direct. You speak to beginner-to-intermediate traders learning with virtual money.

Key principles:
- Always educational — explain WHY, not just what
- Reference specific numbers and signals from the data
- Be honest about mistakes but frame them as learning opportunities
- Keep advice actionable and specific (not generic platitudes)
- Use the trader's actual data — never make up numbers
- Acknowledge good decisions, even in losing trades
- Currency: use $ for US stocks, ₹ for Indian stocks`

function buildTradeAnalysisPrompt(
  input: EvaluateTradeInput,
  coaching: CoachingReport,
): string {
  const currency = input.currency === "INR" ? "₹" : "$"
  const action = input.action.toUpperCase()

  return `Analyze this trade and provide coaching feedback.

TRADE:
- Action: ${action} ${input.quantity} shares of ${input.symbol}
- Price: ${currency}${input.price.toFixed(2)}
- Cost: ${currency}${(input.quantity * input.price).toFixed(2)}
- Market: ${input.market === "IN" ? "Indian (NSE/BSE)" : "US"}
${input.profit !== undefined ? `- Profit: ${currency}${input.profit.toFixed(2)} (${input.profitPercent?.toFixed(1)}%)` : ""}

MARKET CONDITIONS:
- Sentiment: ${input.sentiment.label} (${(input.sentiment.confidence * 100).toFixed(0)}% confidence, source: ${input.sentiment.source})
- Trend: ${input.trend.label} (${(input.trend.confidence * 100).toFixed(0)}% confidence)
- Momentum: ${input.trend.momentum.toFixed(2)}%
- Market regime: ${coaching.marketSnapshot.regime}

EXPERT SYSTEM ASSESSMENT:
- Verdict: ${coaching.verdict} (${coaching.score}/100)
- What went right: ${coaching.whatWentRight.join("; ")}
- What went wrong: ${coaching.whatWentWrong.join("; ")}
- Behavioral flags: ${coaching.behavioralFlags.map(f => `${f.flag} (${f.severity})`).join(", ") || "none"}
- Regime context: ${coaching.regimeContext}

PORTFOLIO CONTEXT:
- Balance: ${currency}${input.totalBalance.toLocaleString()}
- Portfolio exposure: ${(input.portfolioExposure * 100).toFixed(0)}%
- Existing position: ${input.existingPositionSize} shares
- Recent trades in last hour: ${input.recentTradeCount}

TRADER'S JOURNAL:
${input.thesis ? `- Pre-trade thesis: "${input.thesis}"` : "- No thesis provided (encourage writing one next time)"}
${input.reflection ? `- Post-trade reflection: "${input.reflection}"` : ""}

Respond with EXACTLY this JSON format (no markdown, no backticks):
{
  "narrative": "2-3 sentence analysis of this specific trade — what happened, why the score, and the key takeaway",
  "personalizedTip": "One specific, actionable tip based on THIS trade's weaknesses",
  "whatAProfessionalWouldDo": "One sentence about how a professional trader would approach this exact situation differently",
  "encouragement": "One short encouraging sentence acknowledging what was done well or the learning opportunity"
}`
}

function buildSessionInsightPrompt(
  summary: LearningSummary,
  recentTrades: TradeWithCoaching[],
): string {
  const tradeList = recentTrades.slice(-10).map(t => {
    const currency = t.currency === "INR" ? "₹" : "$"
    let line = `- ${t.type.toUpperCase()} ${t.quantity} ${t.symbol} @ ${currency}${t.price.toFixed(2)} → ${t.coaching.verdict} (${t.coaching.score}/100)${t.profit !== undefined ? ` P&L: ${currency}${t.profit.toFixed(2)}` : ""}`
    if (t.thesis) line += ` | Thesis: "${t.thesis}"`
    if (t.reflection) line += ` | Reflection: "${t.reflection}"`
    return line
  }).join("\n")

  const mistakes = summary.recurringMistakes.map(m =>
    `- ${m.description} (${m.count}x, trend: ${m.trend})`
  ).join("\n")

  return `Analyze this trader's recent session and provide personalized coaching insights.

PERFORMANCE SUMMARY:
- Grade: ${summary.grade} (avg reward: ${summary.score.toFixed(1)})
- Trajectory: ${summary.trajectory}
- Total trades: ${summary.totalTrades}
- Win rate: ${summary.winRate}%
- Total P&L: $${summary.totalPnL.toFixed(2)}
- Best trade score: ${summary.bestTradeScore}/100
- Worst trade score: ${summary.worstTradeScore}/100

SKILL PROFILE:
- Strengths: ${summary.strengths.map(s => s.replace(/_/g, " ")).join(", ") || "none identified yet"}
- Weaknesses: ${summary.weaknesses.map(s => s.replace(/_/g, " ")).join(", ") || "none identified yet"}
- Focus area: ${summary.focusArea}

RECURRING PATTERNS:
${mistakes || "None detected yet"}

RECENT TRADES:
${tradeList || "No trades yet"}

COMPONENT SCORES (recent weighted):
- Signal Alignment: ${(summary.recentComponentAverages.alignment * 100).toFixed(0)}
- Risk Management: ${(summary.recentComponentAverages.risk * 100).toFixed(0)}
- Discipline: ${(summary.recentComponentAverages.discipline * 100).toFixed(0)}
- Outcomes: ${(summary.recentComponentAverages.outcome * 100).toFixed(0)}
- Learning: ${(summary.recentComponentAverages.learning * 100).toFixed(0)}

Respond with EXACTLY this JSON format (no markdown, no backticks):
{
  "performanceSummary": "2-3 sentence narrative of how this session went — reference specific trades and numbers",
  "patternAnalysis": "2-3 sentences identifying the most important pattern in their trading behavior and why it matters",
  "actionPlan": ["specific action 1 for next session", "specific action 2", "specific action 3"],
  "mindsetTip": "One sentence about trading psychology relevant to their current trajectory"
}`
}

function buildChatSystemPrompt(
  summary: LearningSummary | null,
  recentTrades: TradeWithCoaching[],
): string {
  let context = COACH_PERSONA + "\n\n"

  if (summary && summary.totalTrades > 0) {
    context += `TRADER PROFILE:
- Grade: ${summary.grade} (avg reward: ${summary.score.toFixed(1)})
- Trajectory: ${summary.trajectory}
- ${summary.totalTrades} total trades, ${summary.winRate}% win rate, $${summary.totalPnL.toFixed(2)} total P&L
- Strengths: ${summary.strengths.map(s => s.replace(/_/g, " ")).join(", ") || "none yet"}
- Weaknesses: ${summary.weaknesses.map(s => s.replace(/_/g, " ")).join(", ") || "none yet"}
- Focus: ${summary.focusArea}
- Recurring mistakes: ${summary.recurringMistakes.map(m => m.description).join("; ") || "none"}

`
  }

  if (recentTrades.length > 0) {
    const last5 = recentTrades.slice(-5).map(t => {
      const currency = t.currency === "INR" ? "₹" : "$"
      return `  ${t.type.toUpperCase()} ${t.quantity} ${t.symbol} @ ${currency}${t.price.toFixed(2)} → ${t.coaching.verdict} (${t.coaching.score}/100)${t.profit !== undefined ? `, P&L: ${currency}${t.profit.toFixed(2)}` : ""}`
    }).join("\n")

    context += `RECENT TRADES:\n${last5}\n\n`
  }

  context += `Answer the trader's questions about their trades, strategy, and learning. Be specific — reference their actual data. Keep responses concise (2-4 paragraphs max). Use plain language.`

  return context
}

// ── Exports for API routes ──

export {
  COACH_PERSONA,
  buildTradeAnalysisPrompt,
  buildSessionInsightPrompt,
  buildChatSystemPrompt,
}

// ── Client-side helpers ──

/**
 * Parse AI JSON response, handling potential markdown wrapping.
 */
export function parseAIResponse<T>(text: string): T {
  // Strip markdown code blocks if present
  let cleaned = text.trim()
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")
  }
  return JSON.parse(cleaned)
}
