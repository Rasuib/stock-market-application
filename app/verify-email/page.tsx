"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function VerifyEmailPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#2d1b4e] to-[#4a1a5c] p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#0a0a0a] border border-gray-800 rounded-lg p-8 text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="w-12 h-12 text-white"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5 text-white"
              >
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
              <h2 className="text-2xl font-display text-white">Verification email sent</h2>
            </div>
          </div>

          <p className="text-gray-300 leading-relaxed">
            We&apos;ve sent a verification link to your email address. Please click the link to activate your account and
            start trading.
          </p>

          <Button
            onClick={() => router.push("/login")}
            className="w-full bg-[#1e2836] border border-gray-700 hover:bg-[#2d3748] text-white font-medium h-12"
          >
            BACK TO LOGIN
          </Button>
        </div>
      </div>
    </div>
  )
}
