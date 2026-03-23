import type React from "react"
import "./globals.css"
import type { Metadata, Viewport } from "next"
import localFont from "next/font/local"
import { AuthProvider } from "@/contexts/auth-context"
import { NotificationProvider } from "@/contexts/notification-context"
import SkipNav from "@/components/skip-nav"
import SWRProvider from "@/components/swr-provider"

/**
 * Monospace font: uses system monospace stack with CSS fallback.
 * No build-time Google Fonts fetch — works in restricted/offline environments.
 * The CSS variable --font-roboto-mono is kept for backward compatibility.
 */
const monoFont = localFont({
  src: [
    {
      path: "../public/fonts/RobotoMono-Variable.woff2",
      style: "normal",
    },
  ],
  variable: "--font-roboto-mono",
  display: "swap",
  fallback: [
    "ui-monospace", "SFMono-Regular", "Menlo", "Monaco",
    "Cascadia Code", "Consolas", "Liberation Mono", "Courier New", "monospace",
  ],
})

const rebelGrotesk = localFont({
  src: "../public/fonts/Rebels-Fett.woff2",
  variable: "--font-rebels",
  display: "swap",
})

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tradia.vercel.app"),
  title: {
    template: "%s – Tradia",
    default: "Tradia - Learn Stock Market Trading",
  },
  description:
    "Learn stock market investing with sentiment analysis, simulated trading, and AI-powered educational feedback.",
  keywords: [
    "stock market simulator",
    "trading education",
    "paper trading",
    "sentiment analysis",
    "FinBERT",
    "technical indicators",
    "learn investing",
  ],
  openGraph: {
    type: "website",
    title: "Tradia - Learn Stock Market Trading",
    description: "Practice trading with virtual money. AI-powered coaching, real-time sentiment analysis, and technical indicators.",
    siteName: "Tradia",
    images: [
      {
        url: "/api/og?title=Tradia&description=Learn+stock+market+trading+with+AI-powered+coaching",
        width: 1200,
        height: 630,
        alt: "Tradia - Learn Stock Market Trading",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tradia - Learn Stock Market Trading",
    description: "Practice trading with virtual money. AI-powered coaching and real-time analysis.",
    images: ["/api/og?title=Tradia&description=Learn+stock+market+trading+with+AI-powered+coaching"],
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preload" href="/fonts/Rebels-Fett.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className={`${rebelGrotesk.variable} ${monoFont.variable} antialiased`}>
        <SkipNav />
        <SWRProvider>
          <AuthProvider>
            <NotificationProvider>
              {children}
            </NotificationProvider>
          </AuthProvider>
        </SWRProvider>
      </body>
    </html>
  )
}
