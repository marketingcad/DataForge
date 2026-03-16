import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Database } from "lucide-react";
import Link from "next/link";
import { SidebarNav } from "@/components/SidebarNav";
import { UserNav } from "@/components/UserNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const user = session.user;

  return (
    <div className="flex h-screen overflow-hidden bg-background">

      {/* ── Sidebar ── */}
      <aside className="hidden md:flex w-56 flex-col border-r bg-background shrink-0">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2 px-5 border-b shrink-0">
          <Database className="h-5 w-5 text-blue-600 shrink-0" />
          <span className="font-semibold text-sm tracking-tight">DataForge</span>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto py-4">
          <p className="px-5 mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Menu
          </p>
          <SidebarNav />
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-6 bg-background shrink-0">
          {/* Mobile: brand */}
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-sm md:hidden">
            <Database className="h-5 w-5 text-blue-600" />
            DataForge
          </Link>
          <div className="hidden md:block" />

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Separator orientation="vertical" className="h-6" />
            <UserNav name={user?.name} email={user?.email} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </main>

      </div>
    </div>
  );
}
