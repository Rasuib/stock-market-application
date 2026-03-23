"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const email = searchParams.get("email")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!token || !email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#2d1b4e] to-[#4a1a5c] p-4">
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-8 text-center max-w-md">
          <h2 className="text-2xl font-display text-white mb-4">Invalid Reset Link</h2>
          <p className="text-gray-300 mb-6">This password reset link is invalid or has expired.</p>
          <Link href="/forgot-password" className="text-[#8b5cf6] hover:underline">
            Request a new reset link
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, password }),
      })

      if (res.ok) {
        setSuccess(true)
      } else {
        const data = await res.json()
        setError(data.error || "Something went wrong")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#2d1b4e] to-[#4a1a5c] p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-display text-white mb-2">
            {success ? "Password Reset" : "New Password"}
          </h1>
          <p className="text-gray-300">
            {success ? "Your password has been updated" : "Enter your new password"}
          </p>
        </div>

        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-8">
          {success ? (
            <div className="space-y-4 text-center">
              <div className="w-16 h-16 bg-green-600/20 rounded-full flex items-center justify-center mx-auto">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-8 h-8 text-green-400">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-gray-300 text-sm">You can now sign in with your new password.</p>
              <Link
                href="/login"
                className="inline-block bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] text-white font-medium px-6 py-3 rounded-lg hover:from-[#7c3aed] hover:to-[#c026d3]"
              >
                Sign In
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-[#1e2836] border-gray-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-white">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-[#1e2836] border-gray-700 text-white"
                />
              </div>

              {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] hover:from-[#7c3aed] hover:to-[#c026d3] text-white font-medium h-12"
              >
                {loading ? "RESETTING..." : "RESET PASSWORD"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#2d1b4e] to-[#4a1a5c]">
        <div className="w-16 h-16 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
