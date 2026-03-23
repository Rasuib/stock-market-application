/**
 * Email utility — sends transactional emails via Resend.
 *
 * If RESEND_API_KEY is not set, emails are skipped (logged to console in dev).
 * This allows the app to function without email in development.
 */

import { Resend } from "resend"

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

const FROM_EMAIL = process.env.EMAIL_FROM || "Tradia <noreply@tradia.app>"
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

interface SendResult {
  success: boolean
  message?: string
}

export async function sendVerificationEmail(email: string, token: string): Promise<SendResult> {
  const url = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`

  if (!resend) {
    console.log(`[email:dev] Verification link for ${email}: ${url}`)
    return { success: true, message: "Email skipped (no RESEND_API_KEY)" }
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Verify your Tradia account",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a2e;">Welcome to Tradia</h2>
          <p>Click the button below to verify your email and start trading:</p>
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #d946ef); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Verify Email
          </a>
          <p style="color: #666; font-size: 14px; margin-top: 24px;">
            This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>
        </div>
      `,
    })
    return { success: true }
  } catch (err) {
    console.error("[email] Failed to send verification email:", err)
    return { success: false, message: "Failed to send email" }
  }
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<SendResult> {
  const url = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`

  if (!resend) {
    console.log(`[email:dev] Password reset link for ${email}: ${url}`)
    return { success: true, message: "Email skipped (no RESEND_API_KEY)" }
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "Reset your Tradia password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a2e;">Password Reset</h2>
          <p>You requested a password reset for your Tradia account. Click below to set a new password:</p>
          <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #8b5cf6, #d946ef); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
            Reset Password
          </a>
          <p style="color: #666; font-size: 14px; margin-top: 24px;">
            This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
          </p>
        </div>
      `,
    })
    return { success: true }
  } catch (err) {
    console.error("[email] Failed to send password reset email:", err)
    return { success: false, message: "Failed to send email" }
  }
}
