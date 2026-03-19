"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ScrapingJobInputSchema } from "@/types/scraping";
import { createJob } from "@/lib/scraping/jobs/service";
import { requireDepartment } from "@/lib/rbac/guards";

export async function createJobAction(formData: FormData) {
  try {
    await requireDepartment("leads");
    const raw = Object.fromEntries(formData.entries());
    const parsed = ScrapingJobInputSchema.safeParse(raw);

    if (!parsed.success) {
      return { error: parsed.error.flatten().fieldErrors };
    }

    const job = await createJob(parsed.data);
    revalidatePath("/scraping");
    redirect(`/scraping/${job.id}`);
  } catch (err) {
    if (isRedirectError(err)) throw err;
    console.error("createJobAction error:", err);
    return { error: { _: ["Failed to create job. Please try again."] } };
  }
}
