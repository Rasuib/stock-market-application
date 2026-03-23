import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { prisma } from "@/lib/db"
// Rate limiting handled by middleware

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get("token")
  const email = searchParams.get("email")

  if (!token || !email) {
    return NextResponse.json({ error: "Missing token or email" }, { status: 400 })
  }

  try {
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex")

    const stored = await prisma.verificationToken.findFirst({
      where: {
        identifier: `verify:${email}`,
        token: hashedToken,
      },
    })

    if (!stored) {
      return NextResponse.json({ error: "Invalid or expired verification link" }, { status: 400 })
    }

    if (stored.expires < new Date()) {
      await prisma.verificationToken.delete({
        where: { identifier_token: { identifier: stored.identifier, token: stored.token } },
      })
      return NextResponse.json({ error: "Verification link has expired" }, { status: 400 })
    }

    // Mark user as verified
    await prisma.user.update({
      where: { email },
      data: { emailVerified: new Date() },
    })

    // Delete used token
    await prisma.verificationToken.delete({
      where: { identifier_token: { identifier: stored.identifier, token: stored.token } },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 })
  }
}
