"use client"

/**
 * Skip to main content link — visible only when focused via keyboard.
 * Essential for screen reader and keyboard-only users.
 */
export default function SkipNav() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#00ff88] focus:text-black focus:rounded-lg focus:font-mono focus:text-sm focus:font-bold focus:outline-none"
    >
      Skip to main content
    </a>
  )
}
