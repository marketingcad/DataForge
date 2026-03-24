import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getKeywords } from "@/lib/keywords/service";
import { KeywordsManager } from "@/components/scraping/KeywordsManager";
import { Separator } from "@/components/ui/separator";
import { withDbRetry } from "@/lib/prisma";

const ALLOWED_ROLES = ["boss", "admin", "lead_data_analyst"];

export default async function KeywordsPage() {
  const session = await auth();
  if (!session) redirect("/sign-in");
  const role = (session.user as unknown as Record<string, unknown>)?.role as string;
  if (!ALLOWED_ROLES.includes(role)) redirect("/unauthorized");

  const keywords = await withDbRetry(() => getKeywords()).catch(() => []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Auto-Scrape Keywords</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Add keywords and locations to automatically discover leads on a schedule via Google Maps.
        </p>
      </div>

      <Separator />

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <KeywordsManager initial={keywords as any} />
    </div>
  );
}
