import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import GitHub from "next-auth/providers/github"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db"

const BCRYPT_ROUNDS = 12

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
        image: user.image,
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
      // Refresh emailVerified on session update (e.g. after email verification)
      if (trigger === "update" && token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { emailVerified: true },
        })
        if (dbUser) token.emailVerified = dbUser.emailVerified
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string
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
