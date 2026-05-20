"use server";
import { requireRole } from "@/lib/rbac/guards";
import { autoSyncGhlOpportunities, autoSyncGhlAppointments, autoSyncGhlBookedContacts } from "@/lib/ghl/sync";
import { revalidatePath } from "next/cache";

export async function syncGhlAction() {
  await requireRole("boss", "admin");

  // Calls are logged in real-time via the outbound/inbound webhook — no sync needed.
  await Promise.allSettled([
    autoSyncGhlOpportunities(),
    autoSyncGhlAppointments(),
    autoSyncGhlBookedContacts(),
  ]);

  revalidatePath("/marketing");

  return { message: "GHL synced — opportunities, appointments, and contacts updated." };
}
