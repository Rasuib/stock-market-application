import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/email"
// Rate limiting handled by middleware

const Schema = z.object({
  email: z.string().email().max(255),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = Schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 })
    }

    const { email } = parsed.data

    // Always return 200 to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) {
      // User doesn't exist or is an OAuth-only user — don't reveal this
      return NextResponse.json({ success: true })
    }

    // Generate token
    const rawToken = crypto.randomUUID()
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex")
    const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    // Delete any existing reset tokens for this email
    await prisma.verificationToken.deleteMany({
      where: { identifier: `reset:${email}` },
    })

    // Store hashed token
    await prisma.verificationToken.create({
      data: {
        identifier: `reset:${email}`,
        token: hashedToken,
        expires,
      },
    })

    await sendPasswordResetEmail(email, rawToken)

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
