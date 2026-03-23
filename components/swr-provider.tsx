"use client"

import { SWRConfig } from "swr"
import type { ReactNode } from "react"

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`Request failed: ${r.status}`)
  return r.json()
})

export default function SWRProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher,
        revalidateOnFocus: false,
        dedupingInterval: 30_000,    // Dedupe identical requests within 30s
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  )
}
