"use client"

import { createContext, useContext, useState, type ReactNode } from "react"

export type NavigationView = "dashboard" | "analysis" | "portfolio" | "news" | "simulator" | "learn" | "challenges" | "leaderboard" | "progress" | "history" | "settings"

interface NavigationContextType {
  currentView: NavigationView
  setCurrentView: (view: NavigationView) => void
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [currentView, setCurrentView] = useState<NavigationView>("dashboard")

  return <NavigationContext.Provider value={{ currentView, setCurrentView }}>{children}</NavigationContext.Provider>
}

export function useNavigation() {
  const context = useContext(NavigationContext)
  if (context === undefined) {
    throw new Error("useNavigation must be used within NavigationProvider")
  }
  return context
}
