"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac/guards";
import { updateSettings } from "@/lib/settings/service";
import { prisma } from "@/lib/prisma";
import type { FeatureKey } from "@/lib/features";

type SettingKey =
  | "companyName" | "scrapingDefaultMaxLeads" | "scrapingDefaultInterval"
  | "scrapingGlobalPause" | "scrapingBoost" | "leadQualityGoodThreshold" | "leadQualityMediumThreshold"
  | "ghlWebhookUrl" | "ghlApiKey" | "ghlSubAccountApiKey" | "ghlLocationId"
  | "commissionCurrency" | "ghlInboundSecret";

/** Boss-only: enable/disable a feature (module) across the app. */
export async function setFeatureEnabledAction(key: FeatureKey, enabled: boolean) {
  try {
    await requireRole("boss");
    const s = await prisma.appSettings.findUnique({
      where: { id: "singleton" },
      select: { disabledFeatures: true },
    });
    const set = new Set(s?.disabledFeatures ?? []);
    if (enabled) set.delete(key); else set.add(key);
    await prisma.appSettings.upsert({
      where: { id: "singleton" },
      update: { disabledFeatures: [...set] },
      create: { id: "singleton", disabledFeatures: [...set] },
    });
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save" };
  }
}

export async function updateSettingFieldAction(key: SettingKey, value: string | number | boolean | null) {
  try {
    await requireRole("boss");

    let parsed: string | number | boolean | null = value;

    if (key === "scrapingDefaultMaxLeads" || key === "scrapingDefaultInterval" ||
        key === "leadQualityGoodThreshold" || key === "leadQualityMediumThreshold") {
      parsed = typeof value === "string" ? parseInt(value, 10) : Number(value);
      if (isNaN(parsed as number)) return { error: "Invalid number" };
    }

    if (key === "scrapingGlobalPause" || key === "scrapingBoost") {
      parsed = value === true || value === "true";
    }

    if (typeof parsed === "string") {
      parsed = parsed.trim() || null;
    }

    await updateSettings({ [key]: parsed });
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save" };
  }
}

// kept for any legacy callers
export async function updateSettingsAction(formData: FormData) {
  try {
    await requireRole("boss");
    await updateSettings({
      companyName: (formData.get("companyName") as string)?.trim(),
      scrapingDefaultMaxLeads: parseInt(formData.get("scrapingDefaultMaxLeads") as string, 10),
      scrapingDefaultInterval: parseInt(formData.get("scrapingDefaultInterval") as string, 10),
      scrapingGlobalPause: formData.get("scrapingGlobalPause") === "true",
      leadQualityGoodThreshold: parseInt(formData.get("leadQualityGoodThreshold") as string, 10),
      leadQualityMediumThreshold: parseInt(formData.get("leadQualityMediumThreshold") as string, 10),
      ghlWebhookUrl: (formData.get("ghlWebhookUrl") as string)?.trim() || null,
      ghlApiKey: (formData.get("ghlApiKey") as string)?.trim() || null,
      ghlSubAccountApiKey: (formData.get("ghlSubAccountApiKey") as string)?.trim() || null,
      ghlLocationId: (formData.get("ghlLocationId") as string)?.trim() || null,
      commissionCurrency: (formData.get("commissionCurrency") as string)?.trim() || "₱",
    });
    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to save settings" };
  }
}
