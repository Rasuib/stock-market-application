/**
 * AI Coach Status — GET /api/ai-coach/status
 *
 * Returns whether the Gemini API key is configured.
 * Rate limited to prevent abuse.
 */

import { NextRequest, NextResponse } from "next/server"
// Rate limiting handled by middleware

export async function GET(request: NextRequest) {
  const available = !!process.env.GEMINI_API_KEY
  return NextResponse.json({ available })
}
