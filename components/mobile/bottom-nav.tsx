"use client"

import { useNavigation, type NavigationView } from "@/components/dashboard/navigation-context"
import { usePathname, useRouter } from "next/navigation"
import { BarChart3, TrendingUp, Wallet, Newspaper, Activity } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS: { view: NavigationView; label: string; icon: typeof BarChart3 }[] = [
  { view: "dashboard", label: "Home", icon: BarChart3 },
  { view: "analysis", label: "Analysis", icon: TrendingUp },
  { view: "simulator", label: "Trade", icon: Activity },
  { view: "portfolio", label: "Portfolio", icon: Wallet },
  { view: "news", label: "News", icon: Newspaper },
]

export default function BottomNav() {
  const { currentView, setCurrentView } = useNavigation()
  const pathname = usePathname()
  const router = useRouter()

  const handleNav = (view: NavigationView) => {
    if (pathname !== "/dashboard") {
      router.push("/dashboard")
    }
    setCurrentView(view)
  }

  return (
    <nav aria-label="Main navigation" className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-background/95 backdrop-blur-lg border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14 px-2" role="tablist">
        {NAV_ITEMS.map(({ view, label, icon: Icon }) => {
          const isActive = currentView === view && pathname === "/dashboard"
          return (
            <button
              key={view}
              role="tab"
              aria-selected={isActive}
              aria-label={`Navigate to ${label}`}
              onClick={() => handleNav(view)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                "active:scale-95 touch-manipulation",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-[11px] font-mono leading-none">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
