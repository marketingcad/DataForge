import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { FeatureKey } from "@/lib/features";

/** Read the boss-disabled feature keys from settings.
 * Fails open (returns []) so a missing column / transient DB error can never
 * take down the whole app (this runs in the root app layout). */
export async function getDisabledFeatures(): Promise<string[]> {
  try {
    const s = await prisma.appSettings.findUnique({
      where: { id: "singleton" },
      select: { disabledFeatures: true },
    });
    return s?.disabledFeatures ?? [];
  } catch {
    return [];
  }
}

/** Redirect to the dashboard if the given feature has been disabled by the boss. */
export async function assertFeatureEnabled(key: FeatureKey): Promise<void> {
  const disabled = await getDisabledFeatures();
  if (disabled.includes(key)) redirect("/dashboard");
}
