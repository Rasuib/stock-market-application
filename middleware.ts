import { NextRequest, NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"
import { checkRateLimit, rateLimitResponse, getClientIP } from "@/lib/rate-limit"

/**
 * Middleware handles:
 * 1. Centralized rate limiting for API routes
 * 2. Auth protection for dashboard/profile/user API routes
 * 3. Optional email verification gate for dashboard/profile
 *
 * Important: Uses lightweight JWT token check in Edge runtime to keep
 * middleware bundle size below Vercel plan limits.
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
  return false
}

export default async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname
  const isApiRequest = pathname.startsWith("/api/")

  if (isApiRequest) {
    const ip = getClientIP(req)
    const { key, limit, windowMs } = getRateLimitConfig(pathname)
    const rl = checkRateLimit(key, ip, { limit, windowMs })
    if (!rl.allowed) return rateLimitResponse(rl.resetAt)
  }

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  if (!needsAuth) return NextResponse.next()

  // NextAuth v5 uses "authjs.session-token" cookie name.
  // On HTTPS (production), it's prefixed with "__Secure-".
  // getToken() in some v5 beta versions doesn't auto-detect this correctly
  // in Edge middleware, so we pass the cookie name explicitly.
  const secureCookie = req.nextUrl.protocol === "https:"
  const cookieName = secureCookie
    ? "__Secure-authjs.session-token"
    : "authjs.session-token"

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    cookieName,
    salt: cookieName,
  })

  if (!token) {
    if (isApiRequest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Only enforce email verification if the email service is configured (RESEND_API_KEY).
  // Without it, users can't receive verification emails, so blocking them is a dead end.
  const emailServiceConfigured = !!process.env.RESEND_API_KEY
  const needsVerification = VERIFIED_PREFIXES.some((p) => pathname.startsWith(p))
  if (emailServiceConfigured && needsVerification && !isApiRequest) {
    const emailVerified = isTruthyEmailVerified((token as Record<string, unknown>).emailVerified)
    if ((token as Record<string, unknown>).emailVerified !== undefined && !emailVerified) {
      return NextResponse.redirect(new URL("/verify-email", req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/profile/:path*",
    "/api/:path*",
  ],
}
