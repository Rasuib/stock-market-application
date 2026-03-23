"use client"

import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Tradia",
  url: "https://tradia.vercel.app",
  description: "Learn stock market trading with AI-powered coaching, sentiment analysis, and paper trading. Practice with $100K virtual capital.",
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Paper trading with virtual capital",
    "AI trade coaching",
    "FinBERT sentiment analysis",
    "Technical indicators (SMA, EMA, RSI, MACD, Bollinger Bands)",
    "Behavioral pattern tracking",
    "Gamification with XP and achievements",
  ],
}

const features = [
  {
    title: "Paper Trading",
    description: "Practice with $100K virtual capital. Real market data, zero risk.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
  },
  {
    title: "AI Trade Coaching",
    description: "Every trade gets scored and reviewed. Personalized feedback on what to improve.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    title: "Sentiment Analysis",
    description: "FinBERT NLP processes financial news in real-time to gauge market mood.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    title: "Technical Indicators",
    description: "SMA, EMA, RSI, MACD, Bollinger Bands — all computed from real price data.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M3 3v18h18" />
        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
      </svg>
    ),
  },
  {
    title: "Behavioral Memory",
    description: "The system remembers your patterns — chasing losses, overtrading, ignoring signals.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zM12 8v4l3 3" />
      </svg>
    ),
  },
  {
    title: "Gamification",
    description: "XP, levels, achievements, and streaks. Learn trading while staying engaged.",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-6 h-6">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    ),
  },
]

const steps = [
  { step: "01", title: "Sign Up", description: "Create a free account in seconds. No credit card needed." },
  { step: "02", title: "Search & Analyze", description: "Look up any US or Indian stock. See sentiment, trends, and technical signals." },
  { step: "03", title: "Trade & Learn", description: "Execute paper trades and get AI coaching on every decision you make." },
]

export default function LandingPage() {
  const { status } = useSession()
  const router = useRouter()

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard")
    }
  }, [status, router])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#00ff88] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] text-white overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 lg:px-16 py-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-white">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <span className="text-2xl font-display text-blue-400">Tradia</span>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="px-5 py-2 text-sm font-mono text-gray-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="px-5 py-2.5 text-sm font-mono bg-[#00ff88] text-[#0d0d1a] rounded-lg font-semibold hover:bg-[#00dd77] transition-colors"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative px-6 lg:px-16 pt-16 lg:pt-24 pb-20">
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-20 right-1/4 w-80 h-80 bg-[#00ff88]/5 rounded-full blur-3xl" />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-[#00ff88]/20 bg-[#00ff88]/5">
            <div className="w-2 h-2 bg-[#00ff88] rounded-full animate-pulse" />
            <span className="text-xs font-mono text-[#00ff88]">EDUCATIONAL SIMULATOR — NOT FINANCIAL ADVICE</span>
          </div>

          <h1 className="text-5xl lg:text-7xl font-display leading-tight mb-6">
            Learn to Trade
            <br />
            <span className="text-[#00ff88]">Without the Risk</span>
          </h1>

          <p className="text-lg lg:text-xl text-gray-400 font-mono max-w-2xl mx-auto mb-10 leading-relaxed">
            Practice stock trading with virtual money. Get AI-powered coaching
            on every decision. Build real skills before risking real capital.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-8 py-4 text-base font-mono font-semibold bg-[#00ff88] text-[#0d0d1a] rounded-lg hover:bg-[#00dd77] transition-colors"
            >
              START TRADING FREE
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 text-base font-mono font-semibold border border-gray-600 text-gray-300 rounded-lg hover:border-gray-400 hover:text-white transition-colors"
            >
              SIGN IN
            </Link>
          </div>

          {/* Stats bar */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            <div>
              <div className="text-2xl lg:text-3xl font-display text-white">$100K</div>
              <div className="text-xs font-mono text-gray-500 mt-1">VIRTUAL CAPITAL</div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-display text-white">US + IN</div>
              <div className="text-xs font-mono text-gray-500 mt-1">MARKETS</div>
            </div>
            <div>
              <div className="text-2xl lg:text-3xl font-display text-white">FREE</div>
              <div className="text-xs font-mono text-gray-500 mt-1">FOREVER</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="px-6 lg:px-16 py-20 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-display mb-4">
              Everything You Need to <span className="text-[#00ff88]">Learn Trading</span>
            </h2>
            <p className="text-gray-400 font-mono max-w-xl mx-auto">
              Real market data. Intelligent coaching. No shortcuts.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-[#00ff88]/20 hover:bg-[#00ff88]/[0.02] transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-[#00ff88]/10 flex items-center justify-center text-[#00ff88] mb-4">
                  {feature.icon}
                </div>
                <h3 className="font-mono text-white font-semibold mb-2">{feature.title}</h3>
                <p className="font-mono text-sm text-gray-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 lg:px-16 py-20 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-display mb-4">
              Get Started in <span className="text-blue-400">3 Steps</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-5xl font-display text-[#00ff88]/20 mb-4">{item.step}</div>
                <h3 className="font-mono text-white font-semibold text-lg mb-2">{item.title}</h3>
                <p className="font-mono text-sm text-gray-400 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 lg:px-16 py-20 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-display mb-4">
            Ready to Start Learning?
          </h2>
          <p className="text-gray-400 font-mono mb-8">
            Create your free account and make your first paper trade in under a minute.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-4 text-base font-mono font-semibold bg-[#00ff88] text-[#0d0d1a] rounded-lg hover:bg-[#00dd77] transition-colors"
          >
            CREATE FREE ACCOUNT
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 lg:px-16 py-8 border-t border-white/5">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-display text-blue-400">Tradia</span>
            <span className="text-xs font-mono text-gray-600">Educational simulator only</span>
          </div>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
