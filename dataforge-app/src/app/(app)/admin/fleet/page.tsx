import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Role } from "@/lib/rbac/roles";
import { FleetDashboard } from "./FleetDashboard";

export default async function FleetPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = ((session.user as unknown as Record<string, unknown>)?.role as Role) ?? "lead_specialist";
  if (role !== "boss") redirect("/unauthorized");

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-4xl space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Fleet</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Every device signed into DataForge right now — who&apos;s online, on what kind of
            device, and what they can scrape.
          </p>
        </div>
        <FleetDashboard />
      </div>
    </div>
  );
}
