import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// Edge-compatible config — NO Prisma, NO bcrypt (used only by middleware)
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/sign-in",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const publicPaths = ["/", "/sign-in", "/sign-up", "/api/auth", "/api/scraping/cron"];
      const isPublic = publicPaths.some(
        (p) => nextUrl.pathname === p || nextUrl.pathname.startsWith(p + "/")
      );
      if (isPublic) return true;
      return isLoggedIn;
    },
  },
  providers: [Credentials({})], // Credentials stub — full logic is in auth.ts
};
