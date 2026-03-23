import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-8 p-4">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-600 mb-4">404</h1>
        <h2 className="text-xl font-bold uppercase text-gray-400 mb-2">
          Page Not Found
        </h2>
        <p className="text-sm max-w-sm text-center text-gray-500">
          The page you&apos;re looking for doesn&apos;t exist or is still under construction.
        </p>
      </div>
      <Link
        href="/"
        className="px-6 py-3 bg-gradient-to-r from-[#8b5cf6] to-[#d946ef] text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
      >
        Back to Home
      </Link>
    </div>
  )
}
