import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/db"
// Rate limiting handled by middleware

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  avatar: z
    .string()
    .max(1_500_000, "Avatar is too large")
    .refine((value) => value.startsWith("data:image/") || value.startsWith("http://") || value.startsWith("https://"), {
      message: "Avatar must be an image data URL or HTTP(S) URL",
    })
    .optional(),
})

const RETRYABLE_DB_ERROR_PATTERN =
  /(Error in PostgreSQL connection: Error \{ kind: Closed|P1001|P1017|Connection terminated|server has closed the connection)/i

function isRetryableDbError(error: unknown): boolean {
  return error instanceof Error && RETRYABLE_DB_ERROR_PATTERN.test(error.message)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, bio: true, image: true },
  })
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const user = await loadProfile(session.user.id)
    return NextResponse.json({ user })
  } catch (error) {
    console.error("Profile load error:", error)
    return NextResponse.json({ error: "Failed to load profile" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const parsed = UpdateProfileSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      )
    }

    const updates: Record<string, string> = {}
    if (parsed.data.name !== undefined) updates.name = parsed.data.name
    if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio
    if (parsed.data.avatar !== undefined) updates.image = parsed.data.avatar

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    }

    // Retry once for transient Neon/Prisma closed connection errors.
    let user: { id: string; name: string | null; email: string; bio: string | null; image: string | null } | null = null
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await prisma.$connect()
        user = await prisma.user.update({
          where: { id: session.user.id },
          data: updates,
          select: { id: true, name: true, email: true, bio: true, image: true },
        })
        break
      } catch (error) {
        if (!isRetryableDbError(error) || attempt === 1) {
          throw error
        }
        await sleep(250)
      }
    }

    if (!user) {
      throw new Error("Profile update failed after retry")
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("Profile update error:", error)
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}
