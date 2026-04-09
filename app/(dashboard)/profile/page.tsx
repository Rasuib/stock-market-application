"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import DashboardPageLayout from "@/components/dashboard/layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import Image from "next/image"
import UserIcon from "@/components/icons/user"
import { generateLearningSummary } from "@/lib/coaching"
import type { LearningSummary, TradeWithCoaching, SkillTag, CurriculumTopic } from "@/lib/coaching/types"
import { loadTrades, loadGamification } from "@/lib/storage"
import TradeReviewCard from "@/components/dashboard/trade-review-card"
import {
  updateCurriculum,
  getCurriculumTopics,
  getCurrentFocusTopic,
  getStageInfo,
} from "@/lib/coaching/curriculum"
import { ACHIEVEMENTS } from "@/lib/gamification"
import { AchievementBadge, LockedAchievementBadge } from "@/components/gamification/achievement-badge"
import XPLevelBar from "@/components/gamification/xp-level-bar"
import StreakCounter from "@/components/gamification/streak-counter"

// ── Skill tag display names ──

const skillTagLabels: Record<SkillTag, string> = {
  signal_alignment: "Signal Alignment",
  risk_management: "Risk Management",
  position_sizing: "Position Sizing",
  patience: "Patience & Discipline",
  trend_reading: "Trend Reading",
  sentiment_reading: "Sentiment Reading",
  exit_timing: "Exit Timing",
  entry_timing: "Entry Timing",
  diversification: "Diversification",
}

export default function ProfilePage() {
  const router = useRouter()
  const { user, isAuthenticated, updateUser, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<"learning" | "settings">("learning")
  const [formData, setFormData] = useState({
    name: user?.name || "",
    email: user?.email || "",
    bio: user?.bio || "",
    avatar: user?.avatar || "",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [trades] = useState<TradeWithCoaching[]>(() => (typeof window === "undefined" ? [] : loadTrades()))

  // Generate learning summary from coaching data
  const summary: LearningSummary = useMemo(() => generateLearningSummary(trades), [trades])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/login")
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) {
    return null
  }

  const handleSave = async () => {
    setIsSaving(true)
    await updateUser({ name: formData.name, bio: formData.bio, avatar: formData.avatar })
    setIsSaving(false)
  }

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 1_500_000) {
        window.alert("Image is too large. Please choose a file smaller than 1.5MB.")
        e.target.value = ""
        return
      }
      const reader = new FileReader()
      reader.onloadend = () => {
        setFormData({ ...formData, avatar: reader.result as string })
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <DashboardPageLayout
      header={{
        title: "Learning Hub",
        description: "Track your trading skills and progress",
        icon: UserIcon,
      }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            onClick={() => setActiveTab("learning")}
            className={`flex-1 font-mono text-sm ${
              activeTab === "learning"
                ? "bg-gradient-to-r from-[#00ff88]/20 to-[#00cc66]/20 text-[#00ff88] border border-[#00ff88]/40"
                : "bg-[#1a1a2e] text-gray-400 hover:bg-[#2d2d44] border border-[#2d2d44]"
            }`}
          >
            LEARNING PROGRESS
          </Button>
          <Button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 font-mono text-sm ${
              activeTab === "settings"
                ? "bg-gradient-to-r from-[#00ff88]/20 to-[#00cc66]/20 text-[#00ff88] border border-[#00ff88]/40"
                : "bg-[#1a1a2e] text-gray-400 hover:bg-[#2d2d44] border border-[#2d2d44]"
            }`}
          >
            PROFILE SETTINGS
          </Button>
        </div>

        {activeTab === "learning" ? (
          <LearningTab summary={summary} trades={trades} />
        ) : (
          <SettingsTab
            formData={formData}
            setFormData={setFormData}
            handleSave={handleSave}
            handleAvatarUpload={handleAvatarUpload}
            isSaving={isSaving}
            logout={logout}
          />
        )}
      </div>
    </DashboardPageLayout>
  )
}

// ══════════════════════════════════════════════════════════════
// Learning Tab
// ══════════════════════════════════════════════════════════════

function LearningTab({ summary, trades }: { summary: LearningSummary; trades: TradeWithCoaching[] }) {
  const router = useRouter()

  // All hooks must be called unconditionally (before any early return)
  const curriculumProgress = useMemo(() => updateCurriculum(summary), [summary])
  const topics = useMemo(() => getCurriculumTopics(curriculumProgress), [curriculumProgress])
  const focusTopic = useMemo(() => getCurrentFocusTopic(curriculumProgress), [curriculumProgress])

  if (summary.totalTrades === 0) {
    return (
      <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-12 text-center">
        <div className="font-mono text-6xl text-gray-600 mb-4">?</div>
        <h4 className="font-mono text-gray-300 text-lg mb-2">No trading data yet</h4>
        <p className="font-mono text-gray-500 text-sm mb-6">
          Start trading in the simulator to track your learning progress.
        </p>
        <Button
          onClick={() => router.push("/dashboard")}
          className="bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40 hover:bg-[#00ff88]/30 font-mono"
        >
          GO TO SIMULATOR
        </Button>
      </div>
    )
  }

  const rewards = trades.map(t => t.coaching.reward.total)
  const stageInfo = getStageInfo(curriculumProgress.stage)

  return (
    <div className="space-y-6">
      {/* Grade + Trajectory + Stats Header */}
      <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-mono text-sm text-gray-400 mb-2">OVERALL GRADE</h3>
            <div className="flex items-baseline gap-4">
              <span className={`font-mono text-6xl font-bold ${gradeColor(summary.grade)}`}>
                {summary.grade}
              </span>
              <div>
                <div className="font-mono text-white text-lg">
                  {summary.score >= 0 ? "+" : ""}{summary.score.toFixed(1)} avg reward
                </div>
                <div className={`font-mono text-sm ${trajectoryColor(summary.trajectory)}`}>
                  {summary.trajectory === "improving" && "Improving"}
                  {summary.trajectory === "declining" && "Declining"}
                  {summary.trajectory === "stable" && "Stable"}
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-right">
            <div>
              <div className="font-mono text-2xl text-white">{summary.totalTrades}</div>
              <div className="font-mono text-xs text-gray-400">TRADES</div>
            </div>
            <div>
              <div className={`font-mono text-2xl ${summary.winRate >= 50 ? "text-green-400" : summary.winRate > 0 ? "text-amber-400" : "text-gray-400"}`}>
                {summary.winRate}%
              </div>
              <div className="font-mono text-xs text-gray-400">WIN RATE</div>
            </div>
          </div>
        </div>
        {/* Trajectory detail */}
        {summary.trajectoryDetail && summary.totalTrades >= 4 && (
          <p className="font-mono text-xs text-gray-400 border-t border-[#2d2d44] pt-3">{summary.trajectoryDetail}</p>
        )}
      </div>

      {/* XP & Achievements */}
      <div className="bg-[#1a1a2e]/80 border border-amber-500/20 rounded-lg p-6">
        <h3 className="font-mono text-sm text-amber-400 mb-4">LEVEL & ACHIEVEMENTS</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <XPLevelBar />
          <StreakCounter />
        </div>
        <div className="space-y-2">
          {ACHIEVEMENTS.map((def) => {
            const gamification = loadGamification()
            const unlocked = gamification.achievements.find((a) => a.id === def.id)
            return unlocked ? (
              <AchievementBadge key={def.id} achievement={unlocked} />
            ) : (
              <LockedAchievementBadge key={def.id} id={def.id} />
            )
          })}
        </div>
      </div>

      {/* Focus Area */}
      <div className="bg-[#0d0d1a] border border-[#00ff88]/30 rounded-lg p-5">
        <h3 className="font-mono text-xs text-[#00ff88] mb-2">YOUR FOCUS AREA</h3>
        <p className="font-mono text-sm text-gray-200">{summary.focusArea}</p>
      </div>

      {/* Curriculum Progress */}
      <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-mono text-sm text-[#00ff88]">LEARNING CURRICULUM</h3>
          <div className="flex items-center gap-2">
            <span className={`font-mono text-sm font-bold ${stageInfo.color}`}>{stageInfo.label}</span>
            <span className="font-mono text-xs text-gray-500">
              {curriculumProgress.completedTopicIds.length}/{curriculumProgress.unlockedTopicIds.length} completed
            </span>
          </div>
        </div>

        {/* Stage progress bar */}
        <div className="flex gap-1 mb-3">
          {(["beginner", "developing", "intermediate", "proficient"] as const).map((stage) => (
            <div key={stage} className="flex-1 h-2 rounded-full overflow-hidden bg-[#0d0d1a]">
              <div className={`h-full rounded-full transition-all ${
                stageAtLeast(curriculumProgress.stage, stage) ? "bg-[#00ff88]" : ""
              }`} style={{ width: stageAtLeast(curriculumProgress.stage, stage) ? "100%" : "0%" }} />
            </div>
          ))}
        </div>
        {stageInfo.next && (
          <p className="font-mono text-[10px] text-gray-500 mb-4">{stageInfo.next}</p>
        )}

        {/* Current focus topic */}
        {focusTopic && (
          <div className="bg-[#00ff88]/5 border border-[#00ff88]/20 rounded-lg p-4 mb-4">
            <div className="font-mono text-xs text-[#00ff88] mb-1">CURRENTLY LEARNING</div>
            <div className="font-mono text-sm text-white mb-1">{focusTopic.title}</div>
            <p className="font-mono text-xs text-gray-400 mb-3">{focusTopic.description}</p>
            <div className="space-y-1.5">
              {focusTopic.tips.map((tip, i) => (
                <p key={i} className="font-mono text-xs text-gray-300 pl-3 border-l-2 border-[#00ff88]/30">{tip}</p>
              ))}
            </div>
          </div>
        )}

        {/* All topics */}
        <div className="space-y-2">
          {topics.map((topic) => (
            <CurriculumTopicRow key={topic.id} topic={topic} isFocus={topic.id === curriculumProgress.currentFocus} />
          ))}
        </div>
      </div>

      {/* Skill Component Bars (recency-weighted) */}
      <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-6">
        <h3 className="font-mono text-sm text-[#00ff88] mb-1">SKILL BREAKDOWN</h3>
        <p className="font-mono text-xs text-gray-500 mb-4">Recent trades weighted more heavily</p>
        <div className="space-y-4">
          {([
            { label: "Signal Alignment", value: summary.recentComponentAverages.alignment },
            { label: "Risk Management", value: summary.recentComponentAverages.risk },
            { label: "Discipline", value: summary.recentComponentAverages.discipline },
            { label: "Trade Outcomes", value: summary.recentComponentAverages.outcome },
            { label: "Learning Trajectory", value: summary.recentComponentAverages.learning },
          ] as const).map(({ label, value }) => (
            <div key={label}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs text-gray-400">{label}</span>
                <span className={`font-mono text-xs ${value >= 0 ? "text-[#00ff88]" : "text-red-400"}`}>
                  {value >= 0 ? "+" : ""}{(value * 100).toFixed(0)}
                </span>
              </div>
              <div className="h-2 bg-[#0d0d1a] rounded-full overflow-hidden">
                {value >= 0 ? (
                  <div
                    className="h-full bg-[#00ff88] rounded-full transition-all"
                    style={{ width: `${Math.min(100, value * 100)}%` }}
                  />
                ) : (
                  <div className="h-full flex justify-end">
                    <div
                      className="h-full bg-red-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.abs(value) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strengths & Weaknesses */}
      {(summary.strengths.length > 0 || summary.weaknesses.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summary.strengths.length > 0 && (
            <div className="bg-[#1a1a2e]/80 border border-[#00ff88]/20 rounded-lg p-4">
              <h3 className="font-mono text-xs text-[#00ff88] mb-3">STRENGTHS</h3>
              <div className="space-y-2">
                {summary.strengths.map(tag => (
                  <div key={tag} className="font-mono text-sm text-gray-200 flex items-center gap-2">
                    <span className="text-[#00ff88]">+</span> {skillTagLabels[tag]}
                  </div>
                ))}
              </div>
            </div>
          )}
          {summary.weaknesses.length > 0 && (
            <div className="bg-[#1a1a2e]/80 border border-red-500/20 rounded-lg p-4">
              <h3 className="font-mono text-xs text-red-400 mb-3">NEEDS WORK</h3>
              <div className="space-y-2">
                {summary.weaknesses.map(tag => (
                  <div key={tag} className="font-mono text-sm text-gray-200 flex items-center gap-2">
                    <span className="text-red-400">-</span> {skillTagLabels[tag]}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recurring Mistakes */}
      {summary.recurringMistakes.length > 0 && (
        <div className="bg-[#1a1a2e]/80 border border-amber-500/30 rounded-lg p-6">
          <h3 className="font-mono text-sm text-amber-400 mb-4">RECURRING PATTERNS</h3>
          <div className="space-y-4">
            {summary.recurringMistakes.map(({ flag, count, description, tip, trend }) => (
              <div key={flag} className="bg-[#0d0d1a] rounded-lg p-4 border border-[#2d2d44]">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm text-white">{description}</span>
                  <div className="flex items-center gap-2">
                    {trend !== "stable" && (
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded ${
                        trend === "increasing" ? "text-red-400 bg-red-500/10" : "text-green-400 bg-green-500/10"
                      }`}>
                        {trend === "increasing" ? "GETTING WORSE" : "IMPROVING"}
                      </span>
                    )}
                    <span className="font-mono text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
                      {count}x
                    </span>
                  </div>
                </div>
                <p className="font-mono text-xs text-gray-400">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reward Trajectory Sparkline */}
      {rewards.length >= 3 && (
        <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-6">
          <h3 className="font-mono text-sm text-[#00ff88] mb-4">REWARD TRAJECTORY</h3>
          <div className="flex items-end gap-0.5 h-16">
            {rewards.slice(-40).map((reward, i) => {
              const maxAbs = Math.max(1, ...rewards.slice(-40).map(r => Math.abs(r)))
              const height = Math.max(2, (Math.abs(reward) / maxAbs) * 64)
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm ${reward >= 0 ? "bg-[#00ff88]/60" : "bg-red-500/60"}`}
                  style={{ height: `${height}px` }}
                  title={`Trade ${i + 1}: ${reward > 0 ? "+" : ""}${reward}`}
                />
              )
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="font-mono text-xs text-gray-500">Older</span>
            <span className="font-mono text-xs text-gray-500">Recent</span>
          </div>
        </div>
      )}

      {/* Recent Trade Reviews */}
      <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-6">
        <h3 className="font-mono text-sm text-[#00ff88] mb-4">RECENT TRADE REVIEWS</h3>
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {trades
            .slice()
            .reverse()
            .slice(0, 10)
            .map((trade) => (
              <TradeReviewCard
                key={trade.id}
                coaching={trade.coaching}
                action={trade.type}
                symbol={trade.symbol}
                quantity={trade.quantity}
                currency={trade.currency}
                expanded={false}
              />
            ))}
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Settings Tab (unchanged from original, just cleaned up)
// ══════════════════════════════════════════════════════════════

function SettingsTab({
  formData,
  setFormData,
  handleSave,
  handleAvatarUpload,
  isSaving,
  logout,
}: {
  formData: { name: string; email: string; bio: string; avatar: string }
  setFormData: (data: { name: string; email: string; bio: string; avatar: string }) => void
  handleSave: () => void
  handleAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  isSaving: boolean
  logout: () => void
}) {
  return (
    <div className="bg-[#1a1a2e]/80 border border-[#2d2d44] rounded-lg p-8 space-y-8">
      <div>
        <h3 className="text-xl font-mono text-white mb-2">Profile Information</h3>
        <p className="text-gray-400 font-mono text-sm">Update your personal information</p>
      </div>

      {/* Avatar Section */}
      <div className="flex flex-col items-center py-6 border-y border-[#2d2d44]">
        <div className="relative w-32 h-32 mb-4">
          {formData.avatar ? (
            <Image
              src={formData.avatar || "/placeholder.svg"}
              alt={formData.name}
              fill
              className="rounded-full object-cover border-4 border-[#00ff88]/40"
            />
          ) : (
            <div className="w-32 h-32 rounded-full bg-[#0d0d1a] border-4 border-[#2d2d44] flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-16 h-16 text-gray-500">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          )}
        </div>
        <label
          htmlFor="avatar-change"
          className="cursor-pointer px-4 py-2 bg-[#0d0d1a] border border-[#2d2d44] rounded-md text-sm text-gray-300 hover:bg-[#2d2d44] transition-colors font-mono"
        >
          CHANGE AVATAR
        </label>
        <input id="avatar-change" type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
      </div>

      {/* Form Fields */}
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-white font-mono text-sm">Full Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-[#0d0d1a] border-[#2d2d44] text-white font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white font-mono text-sm">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="bg-[#0d0d1a] border-[#2d2d44] text-white font-mono placeholder:text-gray-500"
              disabled
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio" className="text-white font-mono text-sm">Bio</Label>
          <Textarea
            id="bio"
            placeholder="Tell us about yourself..."
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            className="bg-[#0d0d1a] border-[#2d2d44] text-white font-mono placeholder:text-gray-500 resize-none"
            rows={4}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 bg-[#00ff88]/20 text-[#00ff88] border border-[#00ff88]/40 hover:bg-[#00ff88]/30 font-mono h-12 disabled:opacity-50"
        >
          {isSaving ? "SAVING..." : "SAVE CHANGES"}
        </Button>
        <Button
          onClick={logout}
          variant="outline"
          className="bg-transparent border-red-500/40 text-red-400 hover:bg-red-500/10 font-mono"
        >
          LOGOUT
        </Button>
      </div>
    </div>
  )
}

// ── Style Helpers ──

function gradeColor(grade: string): string {
  switch (grade) {
    case "S": return "text-yellow-300"
    case "A": return "text-[#00ff88]"
    case "B": return "text-blue-400"
    case "C": return "text-gray-300"
    case "D": return "text-orange-400"
    case "F": return "text-red-400"
    default: return "text-gray-500"
  }
}

function trajectoryColor(trajectory: string): string {
  switch (trajectory) {
    case "improving": return "text-[#00ff88]"
    case "declining": return "text-red-400"
    default: return "text-gray-400"
  }
}

// ── Curriculum Topic Row ──

function CurriculumTopicRow({ topic, isFocus }: { topic: CurriculumTopic; isFocus: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={`rounded-lg border transition-colors ${
        topic.completed
          ? "bg-[#00ff88]/5 border-[#00ff88]/20"
          : topic.unlocked
          ? "bg-[#0d0d1a] border-[#2d2d44] hover:border-[#00ff88]/30 cursor-pointer"
          : "bg-[#0d0d1a]/50 border-[#1a1a2e] opacity-50"
      }`}
      onClick={() => topic.unlocked && setOpen(!open)}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="font-mono text-sm shrink-0">
          {topic.completed ? (
            <span className="text-[#00ff88]">&#10003;</span>
          ) : topic.unlocked ? (
            <span className="text-gray-400">&#9675;</span>
          ) : (
            <span className="text-gray-600">&#9632;</span>
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-xs text-white truncate">{topic.title}</div>
          <div className="font-mono text-[10px] text-gray-500 capitalize">{topic.stage}</div>
        </div>
        {isFocus && (
          <span className="font-mono text-[10px] text-[#00ff88] bg-[#00ff88]/10 px-2 py-0.5 rounded shrink-0">
            FOCUS
          </span>
        )}
      </div>
      {open && topic.unlocked && (
        <div className="px-4 pb-3 space-y-2">
          <p className="font-mono text-xs text-gray-400">{topic.description}</p>
          {topic.tips.map((tip, i) => (
            <p key={i} className="font-mono text-xs text-gray-300 pl-3 border-l-2 border-[#2d2d44]">{tip}</p>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Stage comparison helper ──

const STAGE_ORDER_MAP: Record<string, number> = { beginner: 0, developing: 1, intermediate: 2, proficient: 3 }

function stageAtLeast(current: string, required: string): boolean {
  return (STAGE_ORDER_MAP[current] ?? 0) >= (STAGE_ORDER_MAP[required] ?? 0)
}
