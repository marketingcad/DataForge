import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getBalloonAdminDataAction } from "@/actions/balloons.actions";
import { AdminBalloonsClient } from "./AdminBalloonsClient";

export const dynamic = "force-dynamic";

export default async function AdminBalloonsPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = (session.user as unknown as { role?: string }).role ?? "";
  if (!["boss", "admin"].includes(role)) redirect("/dashboard");

  // Ensure all 16 balloon positions exist
  const { prisma } = await import("@/lib/prisma");
  const existingPositions = await prisma.balloon.findMany({ select: { position: true } });
  const existingSet = new Set(existingPositions.map((b) => b.position));
  const missing = Array.from({ length: 16 }, (_, i) => i + 1).filter((p) => !existingSet.has(p));
  if (missing.length > 0) {
    await prisma.balloon.createMany({ data: missing.map((position) => ({ position, prize: "" })) });
  }

  const { balloons, reps, rules, auditLogs } = await getBalloonAdminDataAction();

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-black tracking-tight">🎈 Balloon Pop — Admin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage prizes, reset balloons, configure rules, and control rep access.
        </p>
      </div>
      <AdminBalloonsClient
        initialBalloons={balloons as Parameters<typeof AdminBalloonsClient>[0]["initialBalloons"]}
        initialReps={reps as Parameters<typeof AdminBalloonsClient>[0]["initialReps"]}
        initialRules={rules}
        initialAuditLogs={auditLogs as Parameters<typeof AdminBalloonsClient>[0]["initialAuditLogs"]}
      />
    </div>
  );
}
