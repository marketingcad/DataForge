import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma, withDbRetry } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: process.env.AUTH_SECRET ?? "dev-placeholder-set-AUTH_SECRET-in-production",
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await withDbRetry(() =>
          prisma.user.findUnique({
            where: { email: credentials.email as string },
          })
        );

        if (!user?.password) return null;

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        return valid ? user : null;
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        // Carry role into the JWT so middleware can read it without a DB call
        token.role = (user as unknown as Record<string, unknown>).role as string ?? "lead_specialist";
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      // Always pull fresh role from DB so role changes take effect immediately.
      // If the DB is unavailable (Neon cold start), fall back to the JWT role
      // so auth never breaks due to a transient DB timeout.
      if (token.id) {
        try {
          const fresh = await withDbRetry(() =>
            prisma.user.findUnique({
              where: { id: token.id as string },
              select: { role: true },
            })
          );
          session.user.role = (fresh?.role as string) ?? (token.role as string) ?? "lead_specialist";
        } catch {
          session.user.role = (token.role as string) ?? "lead_specialist";
        }
      }
      return session;
    },
  },
});
