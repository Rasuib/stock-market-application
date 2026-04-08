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
    <div className="flex flex-col relative w-full gap-1 min-h-full">
      <div className="sticky top-[calc(var(--header-mobile)+var(--disclaimer-height,0px))] z-10 flex flex-wrap items-center gap-2.5 bg-background px-4 py-3 md:gap-4 md:px-6 md:pb-4 lg:top-[var(--disclaimer-height,0px)] lg:flex-nowrap lg:pt-7">
        <div className="flex size-7 items-center justify-center rounded bg-primary md:size-9">
          <header.icon className="size-5 opacity-80 md:opacity-100" />
        </div>
        <h1 className="mb-0.5 text-xl leading-[1] font-display lg:text-4xl">
          {header.title}
        </h1>
        {header.description && (
          <span className="ml-auto max-w-[48ch] text-right text-sm leading-snug text-muted-foreground md:text-sm">
            {header.description}
          </span>
        )}
      </div>
      <div className="min-h-full flex-1 flex flex-col gap-4 bg-background px-3 py-4 pb-20 sm:gap-6 md:py-8 lg:gap-8 lg:px-6 lg:pb-8">
        {children}
        {sidebar ? <div className="pt-2 lg:hidden">{sidebar}</div> : null}
      </div>
    </div>
  )
}
