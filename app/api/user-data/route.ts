/**
 * Server-Side User Data — Source of Truth
 *
 * GET  /api/user-data → canonical snapshot for authenticated user
 * POST /api/user-data → full state update (last-write-wins with version)
 *
 * Security:
 * - userId derived ONLY from session (never from body/query)
 * - Rate limited per IP
 * - Zod validation on all payloads
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

// ── Zod schemas ──

const PositionSchema = z.object({
  quantity: z.number(),
  avgPrice: z.number(),
})

const UserDataPayload = z.object({
  trades: z.array(z.object({
    id: z.string(),
    type: z.enum(["buy", "sell"]),
    symbol: z.string(),
    quantity: z.number().int().min(1),
    price: z.number().min(0),
    cost: z.number(),
    timestamp: z.string(),
    displayTime: z.string(),
    market: z.enum(["US", "IN"]),
    currency: z.enum(["USD", "INR"]),
    profit: z.number().optional(),
    profitPercent: z.number().optional(),
    execution: z.object({
      requestedPrice: z.number(),
      fillPrice: z.number(),
      spreadBps: z.number(),
      commissionPaid: z.number(),
      slippageBps: z.number(),
      executionDelayMs: z.number(),
      orderType: z.enum(["market", "limit"]),
    }).optional(),
    thesis: z.string().optional(),
    reflection: z.string().optional(),
    coaching: z.unknown(),
  })).max(500).default([]),
  positions: z.record(z.string(), PositionSchema).default({}),
  balance: z.number().min(0).max(1e9).default(100000),
  behavioralMemory: z.unknown().optional().default(null),
  curriculumProgress: z.unknown().optional().default(null),
  adaptiveWeights: z.unknown().optional().default(null),
  rewardHistory: z.array(z.number()).max(200).default([]),
  gamification: z.unknown().optional().default(null),
  onboardingStatus: z.enum([
    "not_started", "step1_search", "step2_trade", "step3_review", "completed", "skipped",
  ]).optional(),
  version: z.number().int().min(0).optional(),
})

// ── GET: Read canonical state ──

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limiting handled by middleware

  const userId = session.user.id

  try {
    const tradingData = await prisma.tradingData.findUnique({
      where: { userId },
    })

    const [trades, dbPositions] = await Promise.all([
      prisma.trade.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.position.findMany({ where: { userId } }),
    ])

    if (!tradingData) {
      return NextResponse.json({ data: null, exists: false, version: 0 })
    }

    // Prefer normalized Position table; fall back to JSON column for legacy data
    const positions: Record<string, { quantity: number; avgPrice: number }> = {}
    if (dbPositions.length > 0) {
      for (const p of dbPositions) {
        positions[p.symbol] = { quantity: p.quantity, avgPrice: p.avgPrice }
      }
    } else {
      try {
        const parsed = JSON.parse(tradingData.positions)
        Object.assign(positions, parsed)
      } catch { /* empty */ }
    }

    const data = {
      trades: trades.map((t) => ({
        id: t.id,
        type: t.type,
        symbol: t.symbol,
        quantity: t.quantity,
        price: t.price,
        cost: t.total,
        timestamp: t.createdAt.toISOString(),
        displayTime: t.createdAt.toLocaleTimeString(),
        market: t.market,
        currency: t.currency,
        profit: t.profit,
        coaching: t.coaching ? JSON.parse(t.coaching) : null,
        execution: t.execution ? JSON.parse(t.execution) : undefined,
        thesis: t.thesis,
        reflection: t.reflection,
      })),
      positions,
      balance: tradingData.balance,
      behavioralMemory: tradingData.behavioralMemory
        ? JSON.parse(tradingData.behavioralMemory)
        : null,
      curriculumProgress: tradingData.curriculumProgress
        ? JSON.parse(tradingData.curriculumProgress)
        : null,
      adaptiveWeights: tradingData.adaptiveWeights
        ? JSON.parse(tradingData.adaptiveWeights)
        : null,
      rewardHistory: JSON.parse(tradingData.rewardHistory),
      gamification: tradingData.gamification
        ? JSON.parse(tradingData.gamification)
        : null,
      onboardingStatus: tradingData.onboardingStatus,
      lastSynced: tradingData.lastSynced.toISOString(),
    }

    return NextResponse.json({
      data,
      exists: true,
      version: tradingData.version,
    })
  } catch {
    return NextResponse.json({ error: "Failed to read data" }, { status: 500 })
  }
}

// ── POST: Write canonical state (last-write-wins with version) ──

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limiting handled by middleware

  const userId = session.user.id

  try {
    const body = await request.json()
    const parsed = UserDataPayload.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      )
    }

    const data = parsed.data
    const now = new Date()

    // Transactional upsert: trading data + trades
    const result = await prisma.$transaction(async (tx) => {
      // Upsert trading data
      const td = await tx.tradingData.upsert({
        where: { userId },
        create: {
          userId,
          balance: data.balance,
          positions: JSON.stringify(data.positions),
          rewardHistory: JSON.stringify(data.rewardHistory),
          behavioralMemory: data.behavioralMemory
            ? JSON.stringify(data.behavioralMemory) : null,
          curriculumProgress: data.curriculumProgress
            ? JSON.stringify(data.curriculumProgress) : null,
          adaptiveWeights: data.adaptiveWeights
            ? JSON.stringify(data.adaptiveWeights) : null,
          gamification: data.gamification
            ? JSON.stringify(data.gamification) : null,
          onboardingStatus: data.onboardingStatus ?? "not_started",
          lastSynced: now,
          version: 1,
        },
        update: {
          balance: data.balance,
          positions: JSON.stringify(data.positions),
          rewardHistory: JSON.stringify(data.rewardHistory),
          behavioralMemory: data.behavioralMemory
            ? JSON.stringify(data.behavioralMemory) : null,
          curriculumProgress: data.curriculumProgress
            ? JSON.stringify(data.curriculumProgress) : null,
          adaptiveWeights: data.adaptiveWeights
            ? JSON.stringify(data.adaptiveWeights) : null,
          gamification: data.gamification
            ? JSON.stringify(data.gamification) : null,
          onboardingStatus: data.onboardingStatus ?? undefined,
          lastSynced: now,
          version: { increment: 1 },
        },
      })

      // Sync positions to normalized Position table (dual-write)
      if (data.positions && Object.keys(data.positions).length > 0) {
        // Delete positions that no longer exist or have 0 quantity
        await tx.position.deleteMany({
          where: {
            userId,
            symbol: { notIn: Object.keys(data.positions).filter(s => data.positions[s].quantity > 0) },
          },
        })

        // Upsert each position
        for (const [symbol, pos] of Object.entries(data.positions)) {
          if (pos.quantity > 0) {
            await tx.position.upsert({
              where: { userId_symbol: { userId, symbol } },
              create: { userId, symbol, quantity: pos.quantity, avgPrice: pos.avgPrice },
              update: { quantity: pos.quantity, avgPrice: pos.avgPrice },
            })
          }
        }
      } else {
        // Clear all positions if empty
        await tx.position.deleteMany({ where: { userId } })
      }

      // Sync trades: upsert each trade by client-generated ID
      if (data.trades.length > 0) {
        // Get existing trade IDs for this user
        const existingTradeIds = new Set(
          (await tx.trade.findMany({
            where: { userId },
            select: { id: true },
          })).map(t => t.id)
        )

        // Only insert trades that don't exist yet
        const newTrades = data.trades.filter(t => !existingTradeIds.has(t.id))

        if (newTrades.length > 0) {
          await tx.trade.createMany({
            data: newTrades.map((t) => ({
              id: t.id,
              userId,
              symbol: t.symbol,
              type: t.type,
              quantity: t.quantity,
              price: t.price,
              currency: t.currency,
              total: t.cost,
              coaching: t.coaching ? JSON.stringify(t.coaching) : null,
              execution: t.execution ? JSON.stringify(t.execution) : null,
              thesis: t.thesis,
              reflection: t.reflection,
              profit: t.profit,
              market: t.market,
              createdAt: new Date(t.timestamp),
            })),
            skipDuplicates: true,
          })
        }
      }

      return td
    })

    return NextResponse.json({
      success: true,
      version: result.version,
      lastSynced: now.toISOString(),
    })
  } catch {
    return NextResponse.json({ error: "Failed to save data" }, { status: 500 })
  }
}

// ── PATCH: Update specific fields (onboarding status, single trade reflection, etc.) ──

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Rate limiting handled by middleware

  const userId = session.user.id

  const PatchSchema = z.object({
    onboardingStatus: z.enum([
      "not_started", "step1_search", "step2_trade", "step3_review", "completed", "skipped",
    ]).optional(),
    gamification: z.unknown().optional(),
    behavioralMemory: z.unknown().optional(),
    curriculumProgress: z.unknown().optional(),
  }).refine(obj => Object.keys(obj).length > 0, "At least one field required")

  try {
    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      )
    }

    const updates: Record<string, unknown> = { lastSynced: new Date() }
    if (parsed.data.onboardingStatus !== undefined) {
      updates.onboardingStatus = parsed.data.onboardingStatus
    }
    if (parsed.data.gamification !== undefined) {
      updates.gamification = JSON.stringify(parsed.data.gamification)
    }
    if (parsed.data.behavioralMemory !== undefined) {
      updates.behavioralMemory = JSON.stringify(parsed.data.behavioralMemory)
    }
    if (parsed.data.curriculumProgress !== undefined) {
      updates.curriculumProgress = JSON.stringify(parsed.data.curriculumProgress)
    }

    await prisma.tradingData.upsert({
      where: { userId },
      create: { userId, ...updates },
      update: updates,
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }
}
