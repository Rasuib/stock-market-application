import type React from "react"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { SidebarProvider } from "@/components/ui/sidebar"
import { MobileHeader } from "@/components/dashboard/mobile-header"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { NavigationProvider } from "@/components/dashboard/navigation-context"
import BottomNav from "@/components/mobile/bottom-nav"
import DisclaimerBanner from "@/components/disclaimer-banner"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session) {
    redirect("/login?callbackUrl=/dashboard")
  }

  return (
    <NavigationProvider>
      <SidebarProvider>
        <DisclaimerBanner />
        <MobileHeader />

        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-gap lg:px-sides">
          <div className="hidden lg:block col-span-2 top-0 relative">
            <DashboardSidebar />
          </div>
          <main id="main-content" className="col-span-1 lg:col-span-10 pb-16 lg:pb-0">
            {children}
          </main>
        </div>

        <BottomNav />
      </SidebarProvider>
    </NavigationProvider>
  )
}
