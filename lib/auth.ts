import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

const BCRYPT_ROUNDS = 12

function isSessionSafeImage(value: string | null | undefined): value is string {
  if (!value) return false
  // Base64 data URLs are too large for JWT-backed sessions/cookies.
  if (value.startsWith("data:image/")) return false
  return true
}

// Only include GitHub provider if credentials are configured
const providers = [
  ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
    ? [
        GitHub({
          clientId: process.env.AUTH_GITHUB_ID,
          clientSecret: process.env.AUTH_GITHUB_SECRET,
        }),
      ]
    : []),
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null

      const email = credentials.email as string
      const password = credentials.password as string

      const user = await prisma.user.findUnique({
        where: { email },
      })

      if (!user || !user.passwordHash) return null

      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) return null

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: isSessionSafeImage(user.image) ? user.image : undefined,
      }
    },
  }),
]

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.emailVerified = user.emailVerified ?? null
      }
      // Refresh profile fields from DB on explicit session update.
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { name: true, email: true, image: true, emailVerified: true },
        })
        if (dbUser) {
          token.name = dbUser.name ?? token.name
          token.email = dbUser.email ?? token.email
          token.picture = isSessionSafeImage(dbUser.image) ? dbUser.image : undefined
          token.emailVerified = dbUser.emailVerified
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
        session.user.name = (token.name as string | null | undefined) ?? session.user.name
        session.user.email = (token.email as string | null | undefined) ?? session.user.email
        session.user.image = (token.picture as string | null | undefined) ?? session.user.image
        session.user.emailVerified = token.emailVerified as Date | null
      }
      return session
    },
  },
  events: {
    // Auto-create TradingData for OAuth users (GitHub, etc.)
    async createUser({ user }) {
      if (user.id) {
        const existing = await prisma.tradingData.findUnique({ where: { userId: user.id } })
        if (!existing) {
          await prisma.tradingData.create({ data: { userId: user.id, balance: 100000 } })
        }
      }
    },
  },
})

/** Hash a password with bcrypt (exported for the signup API route). */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS)
}
