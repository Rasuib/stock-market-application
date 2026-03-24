export const runtime = "edge"

import { NextRequest, NextResponse } from "next/server"

/**
 * Temporary debug endpoint to diagnose Edge middleware auth failures.
 * DELETE THIS after the issue is resolved.
 */
export function GET(req: NextRequest) {
  const secureName = "__Secure-authjs.session-token"
  const plainName = "authjs.session-token"

  const secureCookie = req.cookies.get(secureName)
  const plainCookie = req.cookies.get(plainName)
  const allNames = req.cookies.getAll().map((c) => c.name)

  return NextResponse.json({
    secureCookieExists: !!secureCookie,
    secureCookieLength: secureCookie?.value?.length ?? 0,
    plainCookieExists: !!plainCookie,
    plainCookieLength: plainCookie?.value?.length ?? 0,
    allCookieNames: allNames,
    authSecretSet: !!process.env.AUTH_SECRET,
    authSecretLength: process.env.AUTH_SECRET?.length ?? 0,
    protocol: req.nextUrl.protocol,
  })
}
