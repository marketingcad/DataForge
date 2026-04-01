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
      const pathname = nextUrl.pathname;

      const authPaths = ["/sign-in", "/sign-up"];
      const isAuthPage = authPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));

      // Redirect logged-in users away from the landing page and auth pages
      if (isLoggedIn && (pathname === "/" || isAuthPage)) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      const publicPaths = ["/", "/sign-in", "/sign-up", "/api/auth", "/api/scraping/cron"];
      const isPublic = publicPaths.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
      );
      if (isPublic) return true;

      // Middleware only enforces authentication.
      // Role-based access is enforced in server components via requireRole / requireDepartment.
      if (!isLoggedIn) return false;
      return true;
    },
  },
  providers: [Credentials({})], // Credentials stub — full logic is in auth.ts
};
