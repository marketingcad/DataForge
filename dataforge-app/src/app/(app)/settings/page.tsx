import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { type Role } from "@/lib/rbac/roles";
import { getSettings } from "@/lib/settings/service";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");

  const sessionUser = session.user as unknown as Record<string, unknown>;
  const role = (sessionUser?.role as Role) ?? "lead_specialist";
  const userId = sessionUser?.id as string;
  const isAdmin = role === "boss" || role === "admin";
  const isLeadSpecialist = role === "lead_specialist";

  const [settings, userProfile] = await Promise.all([
    isAdmin || isLeadSpecialist ? getSettings() : Promise.resolve(null),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, nickname: true, email: true, role: true },
    }),
  ]);

  return (
    <div className="flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin ? "Configure global defaults for the DataForge application." : "Manage your account settings."}
          </p>
        </div>

        <SettingsClient settings={settings} isAdmin={isAdmin} isLeadSpecialist={isLeadSpecialist} userProfile={userProfile} />
      </div>
    </div>
  );
}
