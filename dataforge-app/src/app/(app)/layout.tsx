import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Database, LayoutDashboard, Users, Search, LogOut } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-14 items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-foreground">
              <Database className="h-5 w-5 text-blue-600" />
              <span>DataForge</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/dashboard" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
              <Link href="/leads" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Users className="h-4 w-4" />
                Leads
              </Link>
              <Link href="/scraping" className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                <Search className="h-4 w-4" />
                Scraping
              </Link>
            </nav>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:block">
                {session.user?.name ?? session.user?.email}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <Button variant="ghost" size="sm" type="submit" className="gap-1.5">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
