import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllCommissionRules } from "@/lib/marketing/commissions.service";
import { CommissionsManager } from "./CommissionsManager";

export default async function ManageCommissionsPage() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;
  if (role !== "boss" && role !== "admin") redirect("/unauthorized");

  const rules = await getAllCommissionRules();
  return <CommissionsManager rules={rules} />;
}
