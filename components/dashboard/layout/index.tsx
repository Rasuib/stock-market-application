import type React from "react"

interface DashboardPageLayoutProps {
  children: React.ReactNode
  header: {
    title: string
    description?: string
    icon: React.ElementType
  }
  sidebar?: React.ReactNode
}

export default function DashboardPageLayout({ children, header, sidebar }: DashboardPageLayoutProps) {
  return (
    <div className="relative flex min-h-full w-full flex-col gap-2">
      <div className="sticky top-[calc(var(--header-mobile)+var(--disclaimer-height,0px))] z-20 border-b border-surface-border/70 bg-background/80 px-4 py-3 backdrop-blur md:px-6 md:py-4 lg:top-[var(--disclaimer-height,0px)]">
        <div className="flex flex-wrap items-center gap-3 lg:flex-nowrap lg:gap-4">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30 md:size-10">
            <header.icon className="size-5 md:size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="mb-0.5 text-xl leading-none font-display tracking-wide lg:text-4xl">
              {header.title}
            </h1>
            <span className="hidden text-[11px] uppercase tracking-[0.14em] text-muted-foreground md:inline-block">
              Trading Workspace
            </span>
          </div>
          {header.description && (
            <span className="ml-auto max-w-[54ch] text-right text-sm leading-snug text-muted-foreground">
              {header.description}
            </span>
          )}
        </div>
      </div>
      <div className="flex min-h-full flex-1 flex-col gap-6 px-3 py-4 pb-20 sm:gap-7 md:px-6 md:py-8 lg:gap-8 lg:pb-8">
        {children}
        {sidebar ? <div className="pt-2 lg:hidden">{sidebar}</div> : null}
      </div>
    </div>
  )
}
