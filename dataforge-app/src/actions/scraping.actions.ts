"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ScrapingJobInputSchema } from "@/types/scraping";
import { createJob } from "@/lib/scraping/jobs/service";

export async function createJobAction(formData: FormData) {
  const raw = Object.fromEntries(formData.entries());
  const parsed = ScrapingJobInputSchema.safeParse(raw);

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const job = await createJob(parsed.data);
  revalidatePath("/scraping");
  redirect(`/scraping/${job.id}`);
}
