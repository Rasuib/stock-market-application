"use client"

import { useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Bullet } from "@/components/ui/bullet"
import NotificationItem from "./notification-item"
import type { Notification } from "@/types/dashboard"
import { AnimatePresence, motion } from "framer-motion"

interface NotificationsProps {
  initialNotifications: Notification[]
  notifications?: Notification[]
  onClearAll?: () => void
  onDelete?: (id: string) => void
  onMarkAsRead?: (id: string) => void
}

export default function Notifications({
  initialNotifications,
  notifications: propNotifications,
  onClearAll,
  onDelete,
  onMarkAsRead,
}: NotificationsProps) {
  const notifications = propNotifications || initialNotifications
  const [showAll, setShowAll] = useState(false)

  const unreadCount = notifications.filter((n) => !n.read).length
  const displayedNotifications = showAll ? notifications : notifications.slice(0, 3)

  const markAsRead = (id: string) => {
    if (onMarkAsRead) {
      onMarkAsRead(id)
    }
  }

  const deleteNotification = (id: string) => {
    if (onDelete) {
      onDelete(id)
    }
  }

  const clearAll = () => {
    if (onClearAll) {
      onClearAll()
    }
  }

  return (
    <Card className="h-full border-2 border-green-500/20 shadow-lg">
  <CardHeader className="flex items-center justify-between pl-3 pr-1 bg-green-500/5">
    <CardTitle className="flex items-center gap-2.5 text-sm font-medium uppercase text-green-600">
      {unreadCount > 0 ? (
        <Badge className="bg-green-600 text-white">{unreadCount}</Badge>
      ) : (
        <Bullet />
      )}
      Notifications ({notifications.length})
    </CardTitle>
    {notifications.length > 0 && (
      <Button
        className="opacity-50 hover:opacity-100 uppercase text-green-600 hover:text-green-700"
        size="sm"
        variant="ghost"
        onClick={clearAll}
      >
        Clear All
      </Button>
    )}
  </CardHeader>


      <CardContent className="bg-accent p-1.5 overflow-hidden">
        <div className="space-y-2">
          <AnimatePresence initial={false} mode="popLayout">
            {displayedNotifications.map((notification) => (
              <motion.div
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                key={notification.id}
              >
                <NotificationItem notification={notification} onMarkAsRead={markAsRead} onDelete={deleteNotification} />
              </motion.div>
            ))}

            {notifications.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No notifications yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Trade alerts will appear here</p>
              </div>
            )}

            {notifications.length > 3 && !showAll && (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-full"
              >
                <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} className="w-full">
                  Show All ({notifications.length})
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  )
}
