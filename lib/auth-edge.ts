/**
 * Edge-safe NextAuth instance used ONLY in middleware.
 *
 * The main auth config (lib/auth.ts) imports PrismaAdapter + bcrypt which
 * don't run on Vercel's Edge Runtime.  This lightweight twin shares the
 * same AUTH_SECRET, session strategy and cookie settings so it can decode
 * the JWT that the full config created — without any Node-only imports.
 */
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"

export const { auth } = NextAuth({
  // At least one provider is required so NextAuth initialises cookie options.
  // authorize() is never called in middleware — only the JWT decode path is used.
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: () => null,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token }) {
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) ?? token.sub ?? ""
        session.user.emailVerified = (token.emailVerified as Date | null) ?? null
      }
      return session
    },
  },
  trustHost: true,
})
