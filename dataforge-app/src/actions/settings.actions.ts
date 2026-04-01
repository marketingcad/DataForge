"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac/guards";
import { updateSettings } from "@/lib/settings/service";

export async function updateSettingsAction(formData: FormData) {
  try {
    await requireRole("boss");

    const companyName = (formData.get("companyName") as string)?.trim();
    const scrapingDefaultMaxLeads = parseInt(formData.get("scrapingDefaultMaxLeads") as string, 10);
    const scrapingDefaultInterval = parseInt(formData.get("scrapingDefaultInterval") as string, 10);
    const scrapingGlobalPause = formData.get("scrapingGlobalPause") === "true";
    const leadQualityGoodThreshold = parseInt(formData.get("leadQualityGoodThreshold") as string, 10);
    const leadQualityMediumThreshold = parseInt(formData.get("leadQualityMediumThreshold") as string, 10);

    await updateSettings({
      ...(companyName ? { companyName } : {}),
      ...(!isNaN(scrapingDefaultMaxLeads) ? { scrapingDefaultMaxLeads } : {}),
      ...(!isNaN(scrapingDefaultInterval) ? { scrapingDefaultInterval } : {}),
      scrapingGlobalPause,
      ...(!isNaN(leadQualityGoodThreshold) ? { leadQualityGoodThreshold } : {}),
      ...(!isNaN(leadQualityMediumThreshold) ? { leadQualityMediumThreshold } : {}),
    });

    revalidatePath("/settings");
    return { success: true };
  } catch (err) {
    console.error("updateSettingsAction error:", err);
    return { error: err instanceof Error ? err.message : "Failed to save settings" };
  }
}
