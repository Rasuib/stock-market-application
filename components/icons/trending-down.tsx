import * as React from "react"

const TrendingDownIcon = React.forwardRef<SVGSVGElement, React.ComponentProps<"svg">>(
  ({ className, ...props }, ref) => (
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
      <polyline points="23,18 13.5,8.5 8.5,13.5 1,6" />
      <polyline points="17,18 23,18 23,12" />
    </svg>
  ),
)

TrendingDownIcon.displayName = "TrendingDownIcon"

export default TrendingDownIcon
