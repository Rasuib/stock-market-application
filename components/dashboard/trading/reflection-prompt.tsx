"use client"

import { Button } from "@/components/ui/button"

interface ReflectionPromptProps {
  reflection: string
  onReflectionChange: (value: string) => void
  onSubmit: () => void
  onSkip: () => void
}

export default function ReflectionPrompt({
  reflection,
  onReflectionChange,
  onSubmit,
  onSkip,
}: ReflectionPromptProps) {
  return (
    <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg space-y-2">
      <p className="text-xs font-semibold text-primary">Post-Trade Reflection</p>
      <p className="text-xs text-muted-foreground">How did this trade go? What would you do differently?</p>
      <textarea
        id="trade-reflection"
        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
        rows={2}
        maxLength={280}
        placeholder="e.g. Held too long, should have set a stop-loss..."
        value={reflection}
        onChange={(e) => onReflectionChange(e.target.value)}
        aria-label="Post-trade reflection"
      />
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" onClick={onSkip}>
          Skip
        </Button>
        <Button
          size="sm"
          className="text-xs"
          disabled={reflection.trim().length < 10}
          onClick={onSubmit}
        >
          Save Reflection
        </Button>
      </div>
    </div>
  )
}
