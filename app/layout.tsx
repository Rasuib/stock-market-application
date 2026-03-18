import type React from "react"
import { Roboto_Mono } from "next/font/google"
import "./globals.css"
import type { Metadata } from "next"
import localFont from "next/font/local"
import { SidebarProvider } from "@/components/ui/sidebar"
import { MobileHeader } from "@/components/dashboard/mobile-header"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import Widget from "@/components/dashboard/widget"
import DesktopNotifications from "@/components/dashboard/notifications-sidebar"
import { NavigationProvider } from "@/components/dashboard/navigation-context"
import { AuthProvider } from "@/contexts/auth-context"
import { NotificationProvider } from "@/contexts/notification-context"

const WIDGET_DATA = {
  location: "Global Markets",
  timezone: "IST",
  temperature: "",
  weather: "",
  date: "",
}

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
})

const rebelGrotesk = localFont({
  src: "../public/fonts/Rebels-Fett.woff2",
  variable: "--font-rebels",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    template: "%s – Tradia",
    default: "Tradia - Learn Stock Market Trading",
  },
  description:
    "Learn stock market investing with sentiment analysis, simulated trading, and educational feedback powered by FinBERT.",
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
      <body className={`${rebelGrotesk.variable} ${robotoMono.variable} antialiased`}>
        <AuthProvider>
          <NotificationProvider>
            <NavigationProvider>
              <SidebarProvider>
                {/* Mobile Header - only visible on mobile */}
                <MobileHeader />

                {/* Desktop Layout */}
                <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-gap lg:px-sides">
                  <div className="hidden lg:block col-span-2 top-0 relative">
                    <DashboardSidebar />
                  </div>
                  <div className="col-span-1 lg:col-span-7">{children}</div>
                  <div className="col-span-3 hidden lg:block">
                    <div className="space-y-gap py-sides min-h-screen max-h-screen sticky top-0 overflow-clip">
                      <Widget widgetData={WIDGET_DATA} />
                      <DesktopNotifications />
                    </div>
                  </div>
                </div>
              </SidebarProvider>
            </NavigationProvider>
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
