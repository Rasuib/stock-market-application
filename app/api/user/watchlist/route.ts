/**
 * Watchlist API — CRUD for user's watchlist items.
 *
 * GET    /api/user/watchlist — list all watchlist items
 * POST   /api/user/watchlist — add a symbol
 * DELETE /api/user/watchlist — remove a symbol
 *
 * Auth: required (middleware-enforced)
 * Rate limit: handled by middleware
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const items = await prisma.watchlistItem.findMany({
      where: { userId: session.user.id },
      orderBy: { addedAt: "desc" },
    })

    return NextResponse.json({
      items: items.map((i) => ({
        symbol: i.symbol,
        name: i.name,
        market: i.market,
      })),
    })
  } catch {
    return NextResponse.json({ error: "Failed to load watchlist" }, { status: 500 })
  }
}

const AddSchema = z.object({
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(200),
  market: z.enum(["US", "IN"]).default("US"),
})

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = AddSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    const { symbol, name, market } = parsed.data

    await prisma.watchlistItem.upsert({
      where: {
        userId_symbol: { userId: session.user.id, symbol },
      },
      create: {
        userId: session.user.id,
        symbol,
        name,
        market,
      },
      update: { name, market },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to add to watchlist" }, { status: 500 })
  }
}

const RemoveSchema = z.object({
  symbol: z.string().min(1).max(20),
})

export async function DELETE(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = RemoveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }

    await prisma.watchlistItem.deleteMany({
      where: {
        userId: session.user.id,
        symbol: parsed.data.symbol,
      },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to remove from watchlist" }, { status: 500 })
  }
}
