"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

type Status = "verifying" | "success" | "error" | "waiting"

function VerifyEmailContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const email = searchParams.get("email")

  const [status, setStatus] = useState<Status>(token && email ? "verifying" : "waiting")
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (!token || !email) return

    const verify = async () => {
      try {
        const res = await fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`)
        if (res.ok) {
          setStatus("success")
        } else {
          const data = await res.json()
          setErrorMsg(data.error || "Verification failed")
          setStatus("error")
        }
      } catch {
        setErrorMsg("Network error. Please try again.")
        setStatus("error")
      }
    }

    verify()
  }, [token, email])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#2d1b4e] to-[#4a1a5c] p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-8 text-center space-y-6">
          {status === "waiting" && (
            <>
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-12 h-12 text-white">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-display text-white">Verification email sent</h2>
              <p className="text-gray-300 leading-relaxed">
                We&apos;ve sent a verification link to your email address. Please click the link to activate your account and start trading.
              </p>
              <Button
                onClick={() => router.push("/login")}
                className="w-full bg-[#1e2836] border border-gray-700 hover:bg-[#2d3748] text-white font-medium h-12"
              >
                BACK TO LOGIN
              </Button>
            </>
          )}

          {status === "verifying" && (
            <>
              <div className="w-16 h-16 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin mx-auto" />
              <h2 className="text-2xl font-display text-white">Verifying your email...</h2>
              <p className="text-gray-300">This will only take a moment.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-12 h-12 text-white">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-display text-white">Email Verified</h2>
              <p className="text-gray-300">Your account is now active. Sign in to start trading.</p>
              <Button
                onClick={() => router.push("/login")}
                className="w-full bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] hover:from-[#7c3aed] hover:to-[#c026d3] text-white font-medium h-12"
              >
                SIGN IN
              </Button>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex justify-center">
                <div className="w-24 h-24 bg-red-600/20 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-12 h-12 text-red-400">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-display text-white">Verification Failed</h2>
              <p className="text-gray-300">{errorMsg}</p>
              <Button
                onClick={() => router.push("/login")}
                className="w-full bg-[#1e2836] border border-gray-700 hover:bg-[#2d3748] text-white font-medium h-12"
              >
                BACK TO LOGIN
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#2d1b4e] to-[#4a1a5c]">
        <div className="w-16 h-16 border-4 border-[#8b5cf6] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  )
}
