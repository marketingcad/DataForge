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
      const role = (auth?.user as unknown as Record<string, unknown>)?.role as string | undefined;
      const pathname = nextUrl.pathname;

      const publicPaths = ["/", "/sign-in", "/sign-up", "/api/auth", "/api/scraping/cron"];
      const isPublic = publicPaths.some(
        (p) => pathname === p || pathname.startsWith(p + "/")
      );
      if (isPublic) return true;
      if (!isLoggedIn) return false;

      // Leads department: boss, admin, lead_specialist
      if (pathname.startsWith("/leads") || pathname.startsWith("/scraping")) {
        const allowed = ["boss", "admin", "lead_specialist"];
        if (!role || !allowed.includes(role))
          return Response.redirect(new URL("/unauthorized", nextUrl));
      }

      // Marketing department: boss, admin, sales_rep
      if (pathname.startsWith("/marketing")) {
        const allowed = ["boss", "admin", "sales_rep"];
        if (!role || !allowed.includes(role))
          return Response.redirect(new URL("/unauthorized", nextUrl));
      }

      // Admin panel: boss and admin only
      if (pathname.startsWith("/admin")) {
        const allowed = ["boss", "admin"];
        if (!role || !allowed.includes(role))
          return Response.redirect(new URL("/unauthorized", nextUrl));
      }

      return true;
    },
  },
  providers: [Credentials({})], // Credentials stub — full logic is in auth.ts
};
