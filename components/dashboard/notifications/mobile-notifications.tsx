"use client"

import type React from "react"
import { useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Bullet } from "@/components/ui/bullet"
import { AnimatePresence, motion, type PanInfo } from "motion/react"
import NotificationItem from "./notification-item"
import type { Notification } from "@/types/dashboard"
import { SheetClose, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface MobileNotificationsProps {
  notifications: Notification[]
  onMarkAsRead?: (id: string) => void
  onDelete?: (id: string) => void
}

interface SwipeableWrapperProps {
  children: React.ReactNode
  onDelete: () => void
}

function SwipeableWrapper({ children, onDelete }: SwipeableWrapperProps) {
  const handleDragEnd = (event: Event, info: PanInfo) => {
    // Delete if swiped left more than 120px OR with sufficient velocity
    const shouldDelete = info.offset.x < -120 || (info.offset.x < -50 && info.velocity.x < -500)

    if (shouldDelete) {
      // Immediate deletion - let parent handle exit animation
      onDelete()
    }
  }

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: -200, right: 0 }}
      dragSnapToOrigin
      dragElastic={0.2}
      onDragEnd={handleDragEnd}
      whileDrag={{
        scale: 0.98,
        boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
      }}
      className="relative cursor-grab active:cursor-grabbing"
      style={{ touchAction: "pan-y" }} // Allow vertical scrolling, horizontal dragging
    >
      {children}
    </motion.div>
  )
}

export default function MobileNotifications({ notifications, onMarkAsRead, onDelete }: MobileNotificationsProps) {
  const prevNotificationsRef = useRef<Notification[]>(notifications)
  const audioTimeoutsRef = useRef<Set<NodeJS.Timeout>>(new Set())

  // Detect new notifications for audio alert
  useEffect(() => {
    const prevNotifications = prevNotificationsRef.current
    const newNotifications = notifications.filter(
      (notification) => !prevNotifications.some((prev) => prev.id === notification.id),
    )

    if (newNotifications.length > 0) {
      const timeoutId = setTimeout(() => {
        playSubtleNotificationSound()
        audioTimeoutsRef.current.delete(timeoutId)
      }, 10000)
      audioTimeoutsRef.current.add(timeoutId)
    }

    prevNotificationsRef.current = notifications

    return () => {
      audioTimeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId)
      })
      audioTimeoutsRef.current.clear()
    }
  }, [notifications])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAsRead = (id: string) => {
    onMarkAsRead?.(id)
  }

  const deleteNotification = (id: string) => {
    onDelete?.(id)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Accessibility Title */}
      <SheetHeader className="sr-only">
        <SheetTitle>Notifications</SheetTitle>
      </SheetHeader>

      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          {unreadCount > 0 ? <Badge>{unreadCount}</Badge> : <Bullet />}
          <h2 className="text-sm font-medium uppercase">Notifications</h2>
        </div>
        <SheetClose>
          <Badge variant="secondary" className="uppercase text-muted-foreground">
            Close
          </Badge>
        </SheetClose>
      </div>

      {/* Notifications List */}
      <div className="flex-1 overflow-y-auto overflow-x-clip p-2 space-y-2 bg-muted">
        {notifications.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-muted-foreground">No notifications</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {notifications.map((notification) => (
              <motion.div
                key={notification.id}
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8, x: -300 }}
                transition={{
                  layout: { duration: 0.3, ease: "easeOut" },
                  opacity: { duration: 0.2 },
                  scale: { duration: 0.2 },
                  x: { duration: 0.2 },
                }}
              >
                <SwipeableWrapper onDelete={() => deleteNotification(notification.id)}>
                  <NotificationItem
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onDelete={deleteNotification}
                  />
                </SwipeableWrapper>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Swipe Hint */}
      {notifications.length > 0 && (
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">Swipe left to delete notifications</p>
        </div>
      )}
    </div>
  )
}

function playSubtleNotificationSound() {
  try {
    // Check if we're on a mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    if (!isMobile) return

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

    // Create a very subtle, soft chime sound
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    // Soft, gentle tone (higher frequency for subtlety)
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(600, audioContext.currentTime + 0.3)

    // Very low volume for subtlety
    gainNode.gain.setValueAtTime(0, audioContext.currentTime)
    gainNode.gain.linearRampToValueAtTime(0.05, audioContext.currentTime + 0.05)
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3)

    oscillator.type = "sine" // Soft sine wave
    oscillator.start(audioContext.currentTime)
    oscillator.stop(audioContext.currentTime + 0.3)

    // Clean up
    setTimeout(() => {
      try {
        audioContext.close()
      } catch (e) {
        // Audio context cleanup completed
      }
    }, 500)
  } catch (error) {
    // Fallback: gentle vibration on mobile
    if ("vibrate" in navigator) {
      navigator.vibrate([50, 100, 50]) // Subtle vibration pattern
    }
  }
}
