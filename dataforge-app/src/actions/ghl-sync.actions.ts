"use server";
import { requireRole } from "@/lib/rbac/guards";
import { autoSyncGhlCalls, autoSyncGhlOpportunities, autoSyncGhlAppointments, autoSyncGhlBookedContacts } from "@/lib/ghl/sync";
import { revalidatePath, revalidateTag } from "next/cache";

export async function syncGhlAction() {
  await requireRole("boss", "admin");
  await Promise.all([autoSyncGhlCalls(), autoSyncGhlOpportunities(), autoSyncGhlAppointments(), autoSyncGhlBookedContacts()]);
  revalidateTag("marketing");
  revalidatePath("/marketing");
  return { message: "GHL data synced successfully" };
}
