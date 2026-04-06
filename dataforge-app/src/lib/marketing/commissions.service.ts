import { prisma } from "@/lib/prisma";

export async function getAllCommissionRules() {
  return prisma.commissionRule.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { earnings: true } } },
  });
}

export async function createCommissionRule(data: {
  name: string;
  description?: string | null;
  type: string;
  amount: number;
  milestoneTarget?: number | null;
  period: string;
  active?: boolean;
}) {
  return prisma.commissionRule.create({ data });
}

export async function updateCommissionRule(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    type?: string;
    amount?: number;
    milestoneTarget?: number | null;
    period?: string;
    active?: boolean;
  }
) {
  return prisma.commissionRule.update({ where: { id }, data });
}

export async function deleteCommissionRule(id: string) {
  return prisma.commissionRule.delete({ where: { id } });
}
