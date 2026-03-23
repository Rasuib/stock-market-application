/**
 * AI Coach API — Trade Analysis & Session Insights
 *
 * POST /api/ai-coach
 * Body: { type: "trade-analysis" | "session-insight", ...data }
 *
 * Requires authentication.
 * Calls Google Gemini API to generate enhanced coaching feedback.
 * Falls back gracefully when API key is missing.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { GoogleGenerativeAI } from "@google/generative-ai"
import {
  buildTradeAnalysisPrompt,
  buildSessionInsightPrompt,
  parseAIResponse,
  COACH_PERSONA,
} from "@/lib/ai-coach"
import type { AITradeAnalysis, AISessionInsight } from "@/lib/ai-coach"
import { auth } from "@/lib/auth"
// Rate limiting handled by middleware

// ── Zod Schemas ──

const TradeAnalysisSchema = z.object({
  type: z.literal("trade-analysis"),
  input: z.object({
    action: z.enum(["buy", "sell"]),
    symbol: z.string().min(1),
    quantity: z.number().positive(),
    price: z.number().positive(),
    market: z.enum(["US", "IN"]),
    currency: z.enum(["USD", "INR"]),
    sentiment: z.object({
      label: z.enum(["bullish", "bearish", "neutral"]),
      score: z.number(),
      confidence: z.number(),
      source: z.enum(["finbert", "heuristic-fallback", "unavailable"]),
    }),
    trend: z.object({
      label: z.enum(["uptrend", "downtrend", "range", "uncertain"]),
      signal: z.number(),
      confidence: z.number(),
      shortMA: z.number(),
      longMA: z.number(),
      momentum: z.number(),
    }),
    portfolioExposure: z.number(),
    recentTradeCount: z.number(),
    existingPositionSize: z.number(),
    totalBalance: z.number(),
    recentRewards: z.array(z.number()),
    tradeHistory: z.array(z.unknown()),
    profit: z.number().optional(),
    profitPercent: z.number().optional(),
    thesis: z.string().optional(),
    reflection: z.string().optional(),
  }),
  coaching: z.object({
    verdict: z.enum(["strong", "mixed", "weak"]),
    score: z.number().min(0).max(100),
    summary: z.string(),
  }).passthrough(),
})

const SessionInsightSchema = z.object({
  type: z.literal("session-insight"),
  summary: z.object({
    grade: z.string(),
    score: z.number(),
    totalTrades: z.number(),
    trajectory: z.enum(["improving", "stable", "declining"]),
  }).passthrough(),
  recentTrades: z.array(z.unknown()).optional().default([]),
})

export async function POST(request: Request) {
  // Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI coaching unavailable", available: false },
      { status: 503 },
    )
  }

  try {
    const body = await request.json()

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: COACH_PERSONA,
    })

    // Trade analysis
    const tradeResult = TradeAnalysisSchema.safeParse(body)
    if (tradeResult.success) {
      const { input, coaching } = tradeResult.data
      const prompt = buildTradeAnalysisPrompt(input as unknown as Parameters<typeof buildTradeAnalysisPrompt>[0], coaching as unknown as Parameters<typeof buildTradeAnalysisPrompt>[1])
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      const analysis = parseAIResponse<AITradeAnalysis>(text)
      return NextResponse.json({ analysis, available: true })
    }

    // Session insight
    const sessionResult = SessionInsightSchema.safeParse(body)
    if (sessionResult.success) {
      const { summary, recentTrades } = sessionResult.data
      const prompt = buildSessionInsightPrompt(summary as unknown as Parameters<typeof buildSessionInsightPrompt>[0], recentTrades as unknown as Parameters<typeof buildSessionInsightPrompt>[1])
      const result = await model.generateContent(prompt)
      const text = result.response.text()
      const insight = parseAIResponse<AISessionInsight>(text)
      return NextResponse.json({ insight, available: true })
    }

    return NextResponse.json(
      { error: "Invalid request. Provide type: 'trade-analysis' or 'session-insight' with valid data." },
      { status: 400 },
    )
  } catch (error) {
    console.error("[AI Coach] Error:", error)
    const message = error instanceof SyntaxError
      ? "AI response was not valid JSON. Try again."
      : "AI coaching temporarily unavailable."
    return NextResponse.json({ error: message, available: true }, { status: 500 })
  }
}
