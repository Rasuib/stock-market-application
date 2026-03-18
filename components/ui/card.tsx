import type * as React from "react"
import { cn } from "@/lib/utils"

interface CardProps extends React.ComponentProps<"div"> {
  variant?: "default" | "notification" | "success" | "warning" | "error"
  size?: "sm" | "md" | "lg"
}

function Card({ className, variant = "default", size = "md", ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(
        "text-card-foreground flex flex-col rounded-lg border border-border/50 shadow-sm transition-all duration-200 hover:shadow-md hover:border-border gap-12",
        {
          "bg-pop": variant === "default",
          "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800": variant === "success",
          "bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800": variant === "warning",
          "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800": variant === "error",
          "bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800": variant === "notification",
        },
        {
          "p-1": size === "sm",
          "p-1.5": size === "md",
          "p-2": size === "lg",
        },
        className,
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header h-9 grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 pl-1 pr-1.5 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-title" className={cn("leading-none font-medium text-sm", className)} {...props} />
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-description" className={cn("text-muted-foreground text-sm", className)} {...props} />
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("col-start-2 row-span-2 row-start-1 self-start justify-self-end", className)}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-3 rounded bg-card py-2", className)} {...props} />
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-footer" className={cn("flex items-center px-6 [.border-t]:pt-6", className)} {...props} />
}

export { Card, CardHeader, CardFooter, CardTitle, CardAction, CardDescription, CardContent }
