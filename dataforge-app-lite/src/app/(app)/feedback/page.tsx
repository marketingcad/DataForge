import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getFeedback } from "@/lib/feedback/service";
import { Separator } from "@/components/ui/separator";
import { FeedbackAdminPanel } from "./_components/FeedbackAdminPanel";
import { FeedbackPageSubmitButton } from "./_components/FeedbackPageSubmitButton";
import type { Role } from "@/lib/rbac/roles";
import { Bug } from "lucide-react";

export default async function FeedbackPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = (session.user as unknown as Record<string, unknown>)?.role as Role;
  const isAdmin = role === "boss" || role === "admin";

  // All users see all reports; only boss/admin can change status
  const reports = await withDbRetry(() => getFeedback());

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-primary" />
            <h1 className="text-lg font-semibold tracking-tight">Bug Reports &amp; Feature Requests</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track and manage feedback to improve the app
          </p>
        </div>
        <FeedbackPageSubmitButton />
      </div>

      <Separator />

      <FeedbackAdminPanel
        reports={reports as Parameters<typeof FeedbackAdminPanel>[0]["reports"]}
        isAdmin={isAdmin}
      />
    </div>
  );
}
