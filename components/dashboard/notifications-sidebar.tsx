"use client"

import Notifications from "@/components/dashboard/notifications"
import { useNotifications } from "@/contexts/notification-context"

export default function DesktopNotifications() {
  const { notifications, clearAll, deleteNotification, markAsRead } = useNotifications()

  return (
    <div className="relative">
      <Notifications
        initialNotifications={notifications}
        notifications={notifications}
        onClearAll={clearAll}
        onDelete={deleteNotification}
        onMarkAsRead={markAsRead}
      />
    </div>
  )
}
