import { NextResponse } from "next/server"
import { auth } from "@/lib/auth-edge"
import { checkRateLimit, rateLimitResponse, getClientIP } from "@/lib/rate-limit"

/**
 * Middleware handles:
 * 1. Centralized rate limiting for API routes
 * 2. Auth protection for dashboard/profile/user API routes
 * 3. Optional email verification gate for dashboard/profile
 *
 * Uses an Edge-safe NextAuth instance (lib/auth-edge.ts) that shares the
 * same AUTH_SECRET as the full config, so it can decode JWTs without
 * importing Prisma or bcrypt.
 */

const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
  "/api/auth/signup": { limit: 5, windowMs: 60_000 },
  "/api/auth/forgot-password": { limit: 3, windowMs: 60_000 },
  "/api/auth/reset-password": { limit: 5, windowMs: 60_000 },
  "/api/auth/verify-email": { limit: 10, windowMs: 60_000 },
  "/api/news": { limit: 30, windowMs: 60_000 },
  "/api/stocks/search": { limit: 20, windowMs: 60_000 },
  "/api/stock": { limit: 60, windowMs: 60_000 },
  "/api/user-data": { limit: 60, windowMs: 60_000 },
  "/api/user": { limit: 30, windowMs: 60_000 },
  "/api/ai-coach": { limit: 15, windowMs: 60_000 },
}

const DEFAULT_RATE_LIMIT = { limit: 60, windowMs: 60_000 }
const PROTECTED_PREFIXES = ["/dashboard", "/profile", "/api/user/", "/api/user-data"]
const VERIFIED_PREFIXES = ["/dashboard", "/profile"]

function getRateLimitConfig(pathname: string) {
  for (const [prefix, config] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) return { key: prefix, ...config }
  }
  return { key: "api-default", ...DEFAULT_RATE_LIMIT }
}

function isTruthyEmailVerified(value: unknown): boolean {
  if (value === true) return true
  if (typeof value === "string") {
    return value.toLowerCase() === "true" || value.toLowerCase() === "1"
  }
  if (value instanceof Date) return true
  return false
}

// Wrap the NextAuth auth() handler to add rate limiting and custom logic
export default auth((req) => {
  const pathname = req.nextUrl.pathname
  const isApiRequest = pathname.startsWith("/api/")

  // 1. Rate limiting for API routes
  if (isApiRequest) {
    const ip = getClientIP(req)
    const { key, limit, windowMs } = getRateLimitConfig(pathname)
    const rl = checkRateLimit(key, ip, { limit, windowMs })
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
  }

  // 2. Auth protection
  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  if (!needsAuth) return NextResponse.next()

  // req.auth is the decoded session (set by NextAuth's auth() wrapper)
  const session = req.auth

  if (!session) {
    if (isApiRequest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 3. Email verification gate (only when email service is configured)
  const emailServiceConfigured = !!process.env.RESEND_API_KEY
  const needsVerification = VERIFIED_PREFIXES.some((p) => pathname.startsWith(p))
  if (emailServiceConfigured && needsVerification && !isApiRequest) {
    const emailVerified = isTruthyEmailVerified(session.user?.emailVerified)
    if (session.user?.emailVerified !== undefined && !emailVerified) {
      return NextResponse.redirect(new URL("/verify-email", req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/api/:path*",
  ],
}
