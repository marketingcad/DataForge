"use server";

import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma, withDbRetry } from "@/lib/prisma";
import { getAgentReportMatrix } from "@/lib/reports/service";

async function requireBossAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role ?? "";
  if (!session?.user || !["boss", "admin"].includes(role)) {
    throw new Error("Forbidden");
  }
}

/** Create (or return the existing) public share token for the reports matrix. */
export async function generateReportsShareTokenAction(): Promise<{ token: string }> {
  await requireBossAdmin();
  const existing = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
    select: { reportsShareToken: true },
  });
  if (existing?.reportsShareToken) return { token: existing.reportsShareToken };

  const token = randomUUID();
  await prisma.appSettings.update({
    where: { id: "singleton" },
    data: { reportsShareToken: token },
  });
  return { token };
}

/** Disable the public share link. */
export async function revokeReportsShareTokenAction(): Promise<{ ok: true }> {
  await requireBossAdmin();
  await prisma.appSettings.update({
    where: { id: "singleton" },
    data: { reportsShareToken: null },
  });
  return { ok: true };
}

/** Public — validate a share token and return the report matrix, or null. */
export async function getSharedReportAction(token: string) {
  if (!token) return null;
  const settings = await prisma.appSettings.findFirst({
    where: { reportsShareToken: token },
    select: { id: true },
  });
  if (!settings) return null;
  const rows = await withDbRetry(() => getAgentReportMatrix());
  return { rows };
}
