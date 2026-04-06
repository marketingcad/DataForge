"use server";

import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/rbac/guards";
import {
  upsertLeadCommission,
  markLeadCommissionPaid,
  confirmLeadCommissionReceived,
  deleteLeadCommission,
} from "@/lib/marketing/lead-commissions.service";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/** Boss/admin: assign a lead to a rep and set commission amount */
export async function assignLeadCommissionAction(formData: FormData) {
  await requireRole("boss", "admin");

  const leadId  = formData.get("leadId")  as string;
  const agentId = formData.get("agentId") as string;
  const ruleId  = (formData.get("ruleId") as string) || null;
  const amount  = parseFloat(formData.get("amount") as string);
  const note    = (formData.get("note") as string)?.trim() || null;

  if (!leadId || !agentId || isNaN(amount)) throw new Error("Invalid data");

  // Update lead assignment
  await prisma.lead.update({
    where: { id: leadId },
    data: { assignedToId: agentId, assignedAt: new Date() },
  });

  await upsertLeadCommission({ leadId, agentId, ruleId, amount, note });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/marketing/manage/commissions");
  revalidatePath("/marketing/my-leads");
}

/** Boss/admin: mark a commission as paid */
export async function markLeadCommissionPaidAction(id: string) {
  await requireRole("boss", "admin");
  const session = await auth();
  const paidById = session!.user.id!;
  await markLeadCommissionPaid(id, paidById);
  revalidatePath("/marketing/manage/commissions");
  revalidatePath("/marketing/my-leads");
}

/** Sales rep: confirm they received payment */
export async function confirmLeadCommissionAction(id: string) {
  const session = await auth();
  const userId  = session?.user.id;
  if (!userId) throw new Error("Unauthenticated");
  await confirmLeadCommissionReceived(id, userId);
  revalidatePath("/marketing/my-leads");
}

/** Boss/admin: remove a commission assignment */
export async function removeLeadCommissionAction(id: string) {
  await requireRole("boss", "admin");
  await deleteLeadCommission(id);
  revalidatePath("/marketing/manage/commissions");
}
