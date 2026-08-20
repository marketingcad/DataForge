import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllBadges } from "@/lib/marketing/badges.service";
import { assertFeatureEnabled } from "@/lib/features-guard";
import { BadgesManager } from "./BadgesManager";

export default async function ManageBadgesPage() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "boss" && role !== "admin") redirect("/unauthorized");
  await assertFeatureEnabled("badges");

  const badges = await getAllBadges();
  return <BadgesManager badges={badges} />;
}
