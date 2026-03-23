import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/auth"
// Rate limiting handled by middleware

const Schema = z.object({
  email: z.string().email().max(255),
  token: z.string().min(1),
  password: z.string().min(6).max(128),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      )
    }

    const { email, token, password } = parsed.data
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

    // Look up the token
    const stored = await prisma.verificationToken.findFirst({
      where: {
        identifier: `reset:${email}`,
        token: hashedToken,
      },
    })

    if (!stored) {
      return NextResponse.json({ error: "Invalid or expired reset link" }, { status: 400 })
    }

    if (stored.expires < new Date()) {
      // Clean up expired token
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: stored.identifier, token: stored.token } },
      })
      return NextResponse.json({ error: "Reset link has expired" }, { status: 400 })
    }

    // Update password
    const passwordHash = await hashPassword(password)
    await prisma.user.update({
      where: { email },
      data: { passwordHash },
    })

    // Delete used token
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: stored.identifier, token: stored.token } },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
