/**
 * AI Coach Chat — Streaming Endpoint
 *
 * POST /api/ai-coach/chat
 * Body: { messages: AIChatMessage[], summary?, recentTrades? }
 *
 * Requires authentication.
 * Streams Gemini's response back as text/event-stream for real-time chat.
 */

import { z } from "zod"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { buildChatSystemPrompt } from "@/lib/ai-coach"
import { auth } from "@/lib/auth"
// Rate limiting handled by middleware

const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().min(1).max(5000),
  })).min(1).max(30),
  summary: z.unknown().optional(),
  recentTrades: z.array(z.unknown()).optional(),
})

export async function POST(request: Request) {
  // Auth check
  const session = await auth()
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "AI coaching unavailable", available: false }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )
  }

  try {
    const body = await request.json()
    const parsed = ChatRequestSchema.safeParse(body)

    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid request", details: parsed.error.issues.map(i => i.message) }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      )
    }

    const { messages, summary, recentTrades } = parsed.data
    const trimmedMessages = messages.slice(-20)

    const genAI = new GoogleGenerativeAI(apiKey)
    const systemPrompt = buildChatSystemPrompt(
      (summary as Parameters<typeof buildChatSystemPrompt>[0]) || null,
      (recentTrades as Parameters<typeof buildChatSystemPrompt>[1]) || [],
    )

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt,
    })

    const history = trimmedMessages.slice(0, -1).map(m => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    }))

    const lastMessage = trimmedMessages[trimmedMessages.length - 1]
    const chat = model.startChat({ history })
    const result = await chat.sendMessageStream(lastMessage.content)

    const encoder = new TextEncoder()
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) {
              const data = `data: ${JSON.stringify({ text })}\n\n`
              controller.enqueue(encoder.encode(data))
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch (err) {
          console.error("[AI Coach Chat] Stream error:", err)
          const errorMsg = `data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`
          controller.enqueue(encoder.encode(errorMsg))
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    })
  } catch (error) {
    console.error("[AI Coach Chat] Error:", error)
    return new Response(
      JSON.stringify({ error: "Chat failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
}
