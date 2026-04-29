"use server";
import { requireRole } from "@/lib/rbac/guards";
import { autoSyncGhlCalls, autoSyncGhlOpportunities } from "@/lib/ghl/sync";
import { revalidatePath } from "next/cache";

export async function syncGhlAction() {
  await requireRole("boss", "admin");
  await Promise.all([autoSyncGhlCalls(), autoSyncGhlOpportunities()]);
  revalidatePath("/marketing");
  return { message: "GHL data synced successfully" };
}
