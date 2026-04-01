import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Role } from "@/lib/rbac/roles";
import { getSettings } from "@/lib/settings/service";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const role = ((session.user as unknown as Record<string, unknown>)?.role as Role) ?? "lead_specialist";
  if (role !== "boss") redirect("/unauthorized");

  const settings = await getSettings();

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">App Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure global defaults for the DataForge application.
          </p>
        </div>

        <SettingsClient settings={settings} />
      </div>
    </div>
  );
}
