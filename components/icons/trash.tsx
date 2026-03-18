import * as React from "react"

const TrashIcon = React.forwardRef<SVGSVGElement, React.ComponentProps<"svg">>(({ className, ...props }, ref) => (
  <svg
    ref={ref}
    className={className}
    fill="none"
    height="24"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
    width="24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path d="m3 6 3 0" />
    <path d="m5 6 0 14 c0 1-1 2-2 2 l8 0 c1 0 2-1 2-2 l0-14" />
    <path d="m8 6 0-2 c0-1 1-2 2-2 l4 0 c1 0 2 1 2 2 l0 2" />
    <line x1="10" x2="10" y1="11" y2="17" />
    <line x1="14" x2="14" y1="11" y2="17" />
  </svg>
))

TrashIcon.displayName = "TrashIcon"

export default TrashIcon
