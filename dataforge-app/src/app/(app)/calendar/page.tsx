import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { withDbRetry } from "@/lib/prisma";
import { getCalendarEvents } from "@/lib/calendar/service";
import { CalendarView } from "@/components/calendar/CalendarView";
import { Separator } from "@/components/ui/separator";
import { CalendarDays } from "lucide-react";
import type { Role } from "@/lib/rbac/roles";

export default async function CalendarPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = (session.user as unknown as Record<string, unknown>)?.role as Role;
  const canEdit = role === "boss" || role === "admin";

  const events = await withDbRetry(() => getCalendarEvents());

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Calendar</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {canEdit ? "Team calendar — you can create and manage events." : "View team events and upcoming schedule."}
        </p>
      </div>

      <Separator />

      <CalendarView
        initialEvents={events as Parameters<typeof CalendarView>[0]["initialEvents"]}
        canEdit={canEdit}
      />
    </div>
  );
}
