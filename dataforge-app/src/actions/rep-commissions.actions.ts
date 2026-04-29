"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/rbac/guards";
import {
  createRepCommission,
  markRepCommissionEarned,
  deleteRepCommission,
} from "@/lib/marketing/rep-commissions.service";
import { createNotification } from "@/lib/notifications/service";

/** Boss/admin: create a commission record for a sales rep */
export async function createRepCommissionAction(formData: FormData) {
  await requireRole("boss", "admin");

  const repId  = formData.get("repId")  as string;
  const ruleId = (formData.get("ruleId") as string) || null;
  const amount = parseFloat(formData.get("amount") as string);
  const note   = (formData.get("note") as string)?.trim() || null;

  if (!repId || isNaN(amount) || amount < 0) throw new Error("Invalid data");

  await createRepCommission({ repId, ruleId, amount, note });

  await createNotification({
    userId: repId,
    type: "info",
    title: "💰 New commission assigned",
    message: `You have a new commission of ${amount} assigned to you.${note ? ` Note: ${note}` : ""}`,
    link: "/my-commissions",
  });

  revalidatePath("/marketing/manage/commissions");
}

/** Boss/admin: mark a rep commission record as earned (paid out) */
export async function markRepCommissionEarnedAction(id: string) {
  await requireRole("boss", "admin");
  const session = await auth();
  const earnedById = session!.user.id!;
  const record = await markRepCommissionEarned(id, earnedById);

  await createNotification({
    userId: record.repId,
    type: "info",
    title: "✅ Commission marked as earned",
    message: `Your commission of ${record.amount} has been marked as earned by your manager.`,
    link: "/my-commissions",
  });

  revalidatePath("/marketing/manage/commissions");
  revalidatePath("/my-commissions");
}

/** Boss/admin: delete a rep commission record */
export async function deleteRepCommissionAction(id: string) {
  await requireRole("boss", "admin");
  await deleteRepCommission(id);
  revalidatePath("/marketing/manage/commissions");
  revalidatePath("/my-commissions");
}
