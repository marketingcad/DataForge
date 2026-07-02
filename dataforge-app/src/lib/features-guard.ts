import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { FeatureKey } from "@/lib/features";

/** Read the boss-disabled feature keys from settings. */
export async function getDisabledFeatures(): Promise<string[]> {
  const s = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
    select: { disabledFeatures: true },
  });
  return s?.disabledFeatures ?? [];
}

/** Redirect to the dashboard if the given feature has been disabled by the boss. */
export async function assertFeatureEnabled(key: FeatureKey): Promise<void> {
  const disabled = await getDisabledFeatures();
  if (disabled.includes(key)) redirect("/dashboard");
}
