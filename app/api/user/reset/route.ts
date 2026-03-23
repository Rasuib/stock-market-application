/**
 * POST /api/user/reset — Reset all trading data for the authenticated user.
 *
 * Deletes all Trade records and resets TradingData to defaults.
 * Rate limited to prevent abuse (5 reqs / 60 s).
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { auth } from "@/lib/auth"
// Rate limiting handled by middleware

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id

  try {
    await prisma.$transaction(async (tx) => {
      // Delete all trades for this user
      await tx.trade.deleteMany({ where: { userId } })

      // Reset trading data to defaults
      await tx.tradingData.upsert({
        where: { userId },
        create: {
          userId,
          balance: 100_000,
          positions: "{}",
          gamification: null,
          onboardingStatus: "not_started",
          rewardHistory: "[]",
          behavioralMemory: null,
          curriculumProgress: null,
          adaptiveWeights: null,
          lastSynced: new Date(),
          version: 1,
        },
        update: {
          balance: 100_000,
          positions: "{}",
          gamification: null,
          onboardingStatus: "not_started",
          rewardHistory: "[]",
          behavioralMemory: null,
          curriculumProgress: null,
          adaptiveWeights: null,
          lastSynced: new Date(),
          version: { increment: 1 },
        },
      })
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to reset account" }, { status: 500 })
  }
}
