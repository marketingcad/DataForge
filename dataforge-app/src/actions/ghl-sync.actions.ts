"use server";
import { requireRole } from "@/lib/rbac/guards";
import { autoSyncGhlCalls, autoSyncGhlOpportunities, autoSyncGhlAppointments, autoSyncGhlBookedContacts } from "@/lib/ghl/sync";
import { revalidatePath } from "next/cache";

export async function syncGhlAction() {
  await requireRole("boss", "admin");

  const [callResult] = await Promise.allSettled([
    autoSyncGhlCalls(true), // full=true: no page cap, no since-filter
    autoSyncGhlOpportunities(),
    autoSyncGhlAppointments(),
    autoSyncGhlBookedContacts(),
  ]);

  revalidatePath("/marketing");

  if (callResult.status === "rejected") {
    throw new Error(`Call sync failed: ${(callResult.reason as Error)?.message ?? "unknown error"}`);
  }

  const calls = callResult.value;

  if (calls.noAgents) {
    return { message: "No agents linked to GHL. Go to Settings → Users and set each agent's GHL User ID." };
  }

  return {
    message: `Synced ${calls.synced} new call${calls.synced !== 1 ? "s" : ""} (${calls.skipped} already up to date, ${calls.unmatched} unmatched)`,
  };
}
