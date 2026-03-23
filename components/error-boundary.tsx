"use client"

import { Component, type ReactNode, type ErrorInfo } from "react"
import { Button } from "@/components/ui/button"
import { captureError } from "@/lib/error-reporting"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  /** Label shown in the error UI so users know which section crashed */
  section?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    captureError(error, {
      source: `ErrorBoundary${this.props.section ? `: ${this.props.section}` : ""}`,
      extra: { componentStack: info.componentStack },
    })
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
          <p className="text-red-400 font-mono text-sm mb-1">
            {this.props.section ? `${this.props.section} crashed` : "Something went wrong"}
          </p>
          <p className="text-gray-500 text-xs mb-4">
            {this.state.error?.message || "An unexpected error occurred"}
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-red-500/40 text-red-400 hover:bg-red-500/20"
            onClick={this.handleRetry}
          >
            Try Again
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
