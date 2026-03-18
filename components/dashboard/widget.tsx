"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import TVNoise from "@/components/ui/tv-noise"
import type { WidgetData } from "@/types/dashboard"
import Image from "next/image"

interface WidgetProps {
  widgetData: WidgetData
}

function getMarketStatus(): { label: string; isOpen: boolean } {
  const now = new Date()
  const istHours = Number(
    now.toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" })
  )
  const day = now.toLocaleString("en-US", { weekday: "short", timeZone: "Asia/Kolkata" })

  const isWeekday = !["Sat", "Sun"].includes(day)
  const isIndianMarketHours = isWeekday && istHours >= 9 && istHours < 16

  if (isIndianMarketHours) return { label: "NSE/BSE Open", isOpen: true }
  return { label: "Markets Closed", isOpen: false }
}

export default function Widget({ widgetData }: WidgetProps) {
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-IN", {
      hour12: true,
      hour: "numeric",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    })
  }

  const formatDate = (date: Date) => {
    const dayOfWeek = date.toLocaleDateString("en-IN", {
      weekday: "long",
      timeZone: "Asia/Kolkata",
    })
    const restOfDate = date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "Asia/Kolkata",
    })
    return { dayOfWeek, restOfDate }
  }

  const dateInfo = formatDate(currentTime)
  const marketStatus = getMarketStatus()

  return (
    <Card className="w-full aspect-[2] relative overflow-hidden">
      <TVNoise opacity={0.3} intensity={0.2} speed={40} />
      <CardContent className="bg-accent/30 flex-1 flex flex-col justify-between text-sm font-medium uppercase relative z-20">
        <div className="flex justify-between items-center">
          <span className="opacity-50">{dateInfo.dayOfWeek}</span>
          <span>{dateInfo.restOfDate}</span>
        </div>
        <div className="text-center">
          <div className="text-5xl font-display" suppressHydrationWarning>
            {formatTime(currentTime)}
          </div>
        </div>

        <div className="flex justify-between items-center">
          <Badge
            variant="secondary"
            className={marketStatus.isOpen ? "bg-green-500/20 text-green-400" : "bg-accent"}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${marketStatus.isOpen ? "bg-green-400 animate-pulse" : "bg-gray-500"}`} />
            {marketStatus.label}
          </Badge>
          <span>{widgetData.location || "Global Markets"}</span>
          <Badge variant="secondary" className="bg-accent">
            {widgetData.timezone}
          </Badge>
        </div>

        <div className="absolute inset-0 -z-[1]">
          <Image
            src="/assets/pc_blueprint.gif"
            alt="logo"
            width={250}
            height={250}
            className="size-full object-contain"
          />
        </div>
      </CardContent>
    </Card>
  )
}
