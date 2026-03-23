import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import crypto from "crypto"
import { prisma } from "@/lib/db"
import { hashPassword } from "@/lib/auth"
import { sendVerificationEmail } from "@/lib/email"
// Rate limiting handled by middleware

const SignupSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  bio: z.string().max(500).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = SignupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues.map((i) => i.message) },
        { status: 400 },
      )
    }

    const { name, email, password, bio } = parsed.data

    // Check if user exists
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 })
    }

    const passwordHash = await hashPassword(password)

    const emailServiceAvailable = !!process.env.RESEND_API_KEY

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        bio,
        // Auto-verify if no email service is configured
        emailVerified: emailServiceAvailable ? undefined : new Date(),
        tradingData: {
          create: {
            balance: 100000,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    })

    // Send verification email only if email service is available
    if (emailServiceAvailable) {
      const rawToken = crypto.randomUUID()
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex")
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

      await prisma.verificationToken.create({
        data: {
          identifier: `verify:${email}`,
          token: hashedToken,
          expires,
        },
      })

      await sendVerificationEmail(email, rawToken)

      return NextResponse.json({ user, requiresVerification: true }, { status: 201 })
    }

    return NextResponse.json({ user, requiresVerification: false }, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
  }
}
