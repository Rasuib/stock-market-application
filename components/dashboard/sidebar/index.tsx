"use client"

import { SidebarFooter as UI_SidebarFooter } from "@/components/ui/sidebar"
import { SidebarMenuButton as UI_SidebarMenuButton } from "@/components/ui/sidebar"
import { SidebarMenuItem as UI_SidebarMenuItem } from "@/components/ui/sidebar"
import { SidebarMenu as UI_SidebarMenu } from "@/components/ui/sidebar"
import { SidebarGroupContent as UI_SidebarGroupContent } from "@/components/ui/sidebar"
import { SidebarGroupLabel as UI_SidebarGroupLabel } from "@/components/ui/sidebar"
import { SidebarGroup as UI_SidebarGroup } from "@/components/ui/sidebar"
import { SidebarContent as UI_SidebarContent } from "@/components/ui/sidebar"
import { SidebarHeader as UI_SidebarHeader } from "@/components/ui/sidebar"
import { Sidebar } from "@/components/ui/sidebar"
import * as React from "react"
import { useNavigation, type NavigationView } from "@/components/dashboard/navigation-context"
import { cn } from "@/lib/utils"
import TrendingUpIcon from "@/components/icons/trending-up"
import BarChartIcon from "@/components/icons/bar-chart"
import DollarSignIcon from "@/components/icons/dollar-sign"
import ActivityIcon from "@/components/icons/activity"
import DotsVerticalIcon from "@/components/icons/dots-vertical"
import { Bullet } from "@/components/ui/bullet"
import Image from "next/image"
import { useAuth } from "@/contexts/auth-context"
import { useRouter, usePathname } from "next/navigation"
import SyncStatusBadge from "@/components/dashboard/sync-status-badge"

const navData = {
  navMain: [
    {
      title: "Trading",
      items: [
        {
          title: "Dashboard",
          view: "dashboard",
          icon: BarChartIcon,
        },
        {
          title: "Stock Analysis",
          view: "analysis",
          icon: TrendingUpIcon,
        },
        {
          title: "Simulator",
          view: "simulator",
          icon: ActivityIcon,
        },
        {
          title: "Portfolio",
          view: "portfolio",
          icon: DollarSignIcon,
        },
        {
          title: "Market News",
          view: "news",
          icon: ActivityIcon,
        },
        {
          title: "Trade History",
          view: "history",
          icon: ActivityIcon,
        },
      ],
    },
    {
      title: "Learn",
      items: [
        {
          title: "Learning Paths",
          view: "learn",
          icon: TrendingUpIcon,
        },
        {
          title: "Challenges",
          view: "challenges",
          icon: BarChartIcon,
        },
        {
          title: "Progress",
          view: "progress",
          icon: TrendingUpIcon,
        },
        {
          title: "Your Stats",
          view: "leaderboard",
          icon: DollarSignIcon,
        },
      ],
    },
  ],
  user: {
    name: "TRADER",
    email: "trader@tradia.com",
    avatar: "/trader-avatar.jpg",
  },
}

export function DashboardSidebar({ className, ...props }: React.ComponentProps<typeof Sidebar>) {
  const { currentView, setCurrentView } = useNavigation()
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const displayUser = {
    name: user?.name || navData.user.name,
    email: user?.email || navData.user.email,
    avatar: user?.avatar || navData.user.avatar,
  }

  const handleNavigation = (view: string) => {
    if (pathname !== "/dashboard") {
      router.push("/dashboard")
    }

    setCurrentView(view as NavigationView)
  }

  return (
    <Sidebar {...props} className={cn("py-sides", className)}>
      <UI_SidebarHeader className="rounded-t-lg flex gap-3 flex-row rounded-b-none">
        <div className="flex gap-3 flex-row cursor-pointer" role="button" tabIndex={0} onClick={() => router.push("/dashboard")} onKeyDown={(e) => { if (e.key === "Enter") router.push("/dashboard") }}>
          <div className="flex overflow-clip size-12 shrink-0 items-center justify-center rounded bg-sidebar-primary-foreground/10 transition-colors group-hover:bg-sidebar-primary text-sidebar-primary-foreground">
            <TrendingUpIcon className="size-8 group-hover:scale-110 transition-transform text-blue-500" />
          </div>
          <div className="grid min-w-0 flex-1 text-left leading-tight">
            <span className="text-xl font-display text-blue-400 xl:text-2xl">Tradia</span>
            <span className="text-[10px] uppercase text-muted-foreground/90 xl:text-xs">Stock Market Learning Platform</span>
          </div>
        </div>
      </UI_SidebarHeader>

      <UI_SidebarContent>
        {navData.navMain.map((group, i) => (
          <UI_SidebarGroup className={cn(i === 0 && "rounded-t-none")} key={group.title}>
            <UI_SidebarGroupLabel>
              <Bullet className="mr-2" />
              {group.title}
            </UI_SidebarGroupLabel>
            <UI_SidebarGroupContent>
              <UI_SidebarMenu>
                {group.items.map((item) => (
                  <UI_SidebarMenuItem key={item.title}>
                    <UI_SidebarMenuButton
                      isActive={currentView === item.view && pathname === "/dashboard"}
                      onClick={() => handleNavigation(item.view)}
                      aria-current={currentView === item.view && pathname === "/dashboard" ? "page" : undefined}
                    >
                      {React.createElement(item.icon, { className: "size-5" })}
                      <span>{item.title}</span>
                    </UI_SidebarMenuButton>
                  </UI_SidebarMenuItem>
                ))}
              </UI_SidebarMenu>
            </UI_SidebarGroupContent>
          </UI_SidebarGroup>
        ))}
      </UI_SidebarContent>

      <UI_SidebarFooter className="p-0">
        <div className="px-3 py-2">
          <SyncStatusBadge />
        </div>
        <UI_SidebarGroup>
          <UI_SidebarGroupLabel>
            <Bullet className="mr-2" />
            User
          </UI_SidebarGroupLabel>
          <UI_SidebarGroupContent>
            <UI_SidebarMenu>
              <UI_SidebarMenuItem>
                <div
                  className="flex gap-0.5 w-full group cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`${displayUser.name} profile`}
                  onClick={() => (isAuthenticated ? router.push("/profile") : router.push("/login"))}
                  onKeyDown={(e) => { if (e.key === "Enter") (isAuthenticated ? router.push("/profile") : router.push("/login")) }}
                >
                  <div className="shrink-0 flex size-14 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground overflow-clip">
                    <Image
                      src={displayUser.avatar || "/placeholder.svg"}
                      alt={displayUser.name}
                      width={120}
                      height={120}
                    />
                  </div>
                  <div className="group/item pl-3 pr-1.5 pt-2 pb-1.5 flex-1 flex bg-sidebar-accent hover:bg-sidebar-accent-active/75 items-center rounded group-data-[state=open]:bg-sidebar-accent-active group-data-[state=open]:hover:bg-sidebar-accent-active group-data-[state=open]:text-sidebar-accent-foreground">
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate text-xl font-display">{displayUser.name}</span>
                      <span className="truncate text-xs uppercase opacity-50 group-hover/item:opacity-100">
                        {displayUser.email}
                      </span>
                    </div>
                    <DotsVerticalIcon className="ml-auto size-4" />
                  </div>
                </div>
              </UI_SidebarMenuItem>
            </UI_SidebarMenu>
          </UI_SidebarGroupContent>
        </UI_SidebarGroup>
      </UI_SidebarFooter>
    </Sidebar>
  )
}
