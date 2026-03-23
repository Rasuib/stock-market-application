import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Terms & Disclaimer",
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 text-gray-300 font-mono">
      <h1 className="text-3xl font-display text-white mb-8">Terms of Use & Disclaimer</h1>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl text-[#00ff88] font-semibold">Educational Purpose</h2>
        <p className="text-sm leading-relaxed">
          Tradia is an educational stock market simulator designed for learning purposes only.
          All trades executed on this platform use virtual currency and have no real financial impact.
          No real money is involved in any transaction.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl text-[#00ff88] font-semibold">Not Financial Advice</h2>
        <p className="text-sm leading-relaxed">
          The information, analysis, coaching feedback, and AI-generated insights provided by Tradia
          do not constitute financial advice, investment advice, trading advice, or any other sort of advice.
          You should not treat any of the platform&apos;s content as such.
        </p>
        <p className="text-sm leading-relaxed">
          The sentiment analysis, technical indicators, trend signals, and coaching reports are generated
          by automated systems (including FinBERT and Gemini AI) and may be inaccurate, incomplete, or
          outdated. They are provided for educational purposes to help you understand how such tools work.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl text-[#00ff88] font-semibold">Market Data</h2>
        <p className="text-sm leading-relaxed">
          Stock prices and market data displayed on Tradia are sourced from third-party providers
          and may be delayed, inaccurate, or incomplete. This data should not be relied upon for
          making real investment decisions.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl text-[#00ff88] font-semibold">No Warranty</h2>
        <p className="text-sm leading-relaxed">
          Tradia is provided &quot;as is&quot; without warranty of any kind, express or implied.
          We do not guarantee the accuracy, completeness, or reliability of any information
          presented on the platform.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl text-[#00ff88] font-semibold">Data & Privacy</h2>
        <p className="text-sm leading-relaxed">
          Your trading data, portfolio information, and learning progress are stored locally in your browser.
          Optional server synchronization stores data associated with your user identifier.
          We do not sell or share your data with third parties.
        </p>
      </section>

      <section className="space-y-4 mb-8">
        <h2 className="text-xl text-[#00ff88] font-semibold">Limitation of Liability</h2>
        <p className="text-sm leading-relaxed">
          In no event shall Tradia or its creators be liable for any direct, indirect, incidental,
          special, consequential, or punitive damages arising out of or relating to your use of
          the platform, including but not limited to any losses incurred from real trading decisions
          influenced by the platform&apos;s educational content.
        </p>
      </section>

      <div className="border-t border-gray-700 pt-6 mt-8">
        <p className="text-xs text-gray-500">
          By using Tradia, you acknowledge that you have read and understood these terms.
          If you do not agree with these terms, please discontinue use of the platform.
        </p>
      </div>
    </div>
  )
}
