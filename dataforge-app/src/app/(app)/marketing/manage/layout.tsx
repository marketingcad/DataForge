import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

const NAV = [
  { href: "/marketing/manage/badges",      label: "Badges",      icon: "🏅" },
  { href: "/marketing/manage/tasks",       label: "Challenges",  icon: "🎯" },
  { href: "/marketing/manage/commissions", label: "Commissions", icon: "💰" },
];

export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "boss" && role !== "admin") redirect("/unauthorized");

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <div className="flex items-center gap-1 rounded-2xl bg-card shadow-sm p-1.5 w-fit">
        <Link href="/marketing" className="px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
          ← Dashboard
        </Link>
        <div className="w-px h-4 bg-border/60 mx-1" />
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <span>{n.icon}</span> {n.label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  );
}
