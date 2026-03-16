import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const publicPaths = ["/", "/sign-in", "/sign-up", "/api/auth", "/api/scraping/cron"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/")) ||
    pathname.startsWith("/_next") ||
    pathname.includes(".");

  if (!isPublic && !req.auth) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
