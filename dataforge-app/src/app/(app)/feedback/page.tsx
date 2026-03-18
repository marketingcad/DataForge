import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getFeedback } from "@/lib/feedback/service";
import { Separator } from "@/components/ui/separator";
import { FeedbackAdminPanel } from "./_components/FeedbackAdminPanel";
import { FeedbackMyReports } from "./_components/FeedbackMyReports";
import type { Role } from "@/lib/rbac/roles";
import { Flag } from "lucide-react";

export default async function FeedbackPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = (session.user as unknown as Record<string, unknown>)?.role as Role;
  const isAdmin = role === "boss" || role === "admin";
  const userId = session.user.id!;

  const reports = await withDbRetry(() =>
    getFeedback(isAdmin ? undefined : { submittedBy: userId })
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">Bug & Feature Reports</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin
              ? `${reports.length} report${reports.length !== 1 ? "s" : ""} submitted by the team`
              : "Your submitted reports"}
          </p>
        </div>
      </div>

      <Separator />

      {isAdmin
        ? <FeedbackAdminPanel reports={reports as Parameters<typeof FeedbackAdminPanel>[0]["reports"]} />
        : <FeedbackMyReports reports={reports as Parameters<typeof FeedbackMyReports>[0]["reports"]} userId={userId} />
      }
    </div>
  );
}
