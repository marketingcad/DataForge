import { UserButton } from "@clerk/nextjs";
import { Database, LayoutDashboard, Users, Search } from "lucide-react";
import Link from "next/link";

export default function AppLayout({ children }: { children: React.ReactNode }) {
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
            <UserButton />
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
