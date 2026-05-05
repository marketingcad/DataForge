import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

const ALLOWED_ROLES = ["boss", "admin", "sales_rep", "team_lead"];

export default async function AppointmentsPage() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !ALLOWED_ROLES.includes(user.role ?? "")) redirect("/dashboard");

  const isSalesRep = user.role === "sales_rep";

  const appointments = await prisma.bookedAppointment.findMany({
    where: isSalesRep ? { agentId: user.id } : undefined,
    include: {
      agent:     { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { bookedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black tracking-tight">Appointments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {isSalesRep ? "Your booked appointments" : "All booked appointments across the team"}
        </p>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card shadow-sm overflow-hidden">
        {appointments.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-3xl mb-3">📅</p>
            <p className="text-sm text-muted-foreground">No appointments recorded yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date Booked</th>
                  {!isSalesRep && (
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales Rep</th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Added By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {appointments.map((a) => (
                  <tr key={a.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium">{a.clientName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{a.clientPhone ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(a.bookedAt).toLocaleString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                        hour: "numeric", minute: "2-digit",
                      })}
                    </td>
                    {!isSalesRep && (
                      <td className="px-4 py-3 font-medium">{a.agent.name ?? "—"}</td>
                    )}
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                        a.source === "webhook"
                          ? "bg-sky-500/10 text-sky-600"
                          : "bg-violet-500/10 text-violet-600"
                      }`}>
                        {a.source === "webhook" ? "🔗 GHL" : "✏️ Manual"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {a.source === "webhook" ? "GHL Automation" : (a.createdBy?.name ?? "—")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
