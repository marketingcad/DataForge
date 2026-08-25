"use server";

import { revalidatePath, updateTag } from "next/cache";
import { requireDepartment } from "@/lib/rbac/guards";
import {
  countDuplicateGroups,
  findDuplicateGroups,
  mergeDuplicates,
  DUPLICATE_COUNT_TAG,
} from "@/lib/leads/duplicates";

export async function getDuplicateGroupsAction(limit = 50) {
  await requireDepartment("leads");
  return findDuplicateGroups(limit);
}

export async function countDuplicateGroupsAction() {
  await requireDepartment("leads");
  return countDuplicateGroups();
}

export type BulkMergeOutcome = {
  keepId: string;
  ok: boolean;
  /** Present when the group could not be merged. */
  reason?: string;
  removed?: number;
};

/**
 * Resolve several duplicate groups in one go.
 *
 * Runs sequentially rather than in parallel: each merge is its own transaction, and a
 * dozen concurrent ones would each want a pooler connection while holding row locks on
 * overlapping children. Groups that cannot be merged (for example both copies carrying a
 * commission) are reported individually instead of failing the whole batch.
 */
export async function bulkMergeDuplicatesAction(
  plans: { keepId: string; removeIds: string[] }[]
): Promise<BulkMergeOutcome[]> {
  await requireDepartment("leads");
  const outcomes: BulkMergeOutcome[] = [];
  for (const plan of plans) {
    try {
      const r = await mergeDuplicates(plan.keepId, plan.removeIds);
      outcomes.push(
        r.ok
          ? { keepId: plan.keepId, ok: true, removed: r.removed }
          : { keepId: plan.keepId, ok: false, reason: r.reason }
      );
    } catch (e) {
      outcomes.push({
        keepId: plan.keepId,
        ok: false,
        reason: e instanceof Error ? e.message : "Merge failed.",
      });
    }
  }
  if (outcomes.some((o) => o.ok)) {
    updateTag(DUPLICATE_COUNT_TAG);
    revalidatePath("/leads");
    revalidatePath("/reports");
  }
  return outcomes;
}

/**
 * Keep one copy of a duplicated lead and fold the rest into it.
 * Reassigns call history, GHL links and any commission before deleting — see
 * mergeDuplicates() for why a plain delete is not safe.
 */
export async function mergeDuplicatesAction(keepId: string, removeIds: string[]) {
  await requireDepartment("leads");
  const result = await mergeDuplicates(keepId, removeIds);
  if (result.ok) {
    // The banner count is cached for a few minutes; purge it now so the badge stops
    // advertising duplicates the user has just resolved. updateTag (not revalidateTag)
    // because this runs in a Server Action and we want read-your-own-writes.
    updateTag(DUPLICATE_COUNT_TAG);
    revalidatePath("/leads");
    revalidatePath("/reports");
  }
  return result;
}
