import { prisma } from "@/lib/prisma";

/** All rep commission records — admin/boss view */
export async function getAllRepCommissions() {
  return prisma.repCommission.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      rep:     { select: { id: true, name: true, email: true } },
      rule:    { select: { id: true, name: true } },
      earnedBy: { select: { id: true, name: true, email: true } },
    },
  });
}

/** All commission records for a specific sales rep */
export async function getMyRepCommissions(repId: string) {
  return prisma.repCommission.findMany({
    where: { repId },
    orderBy: { createdAt: "desc" },
    include: {
      rule: { select: { name: true } },
    },
  });
}

export async function createRepCommission(data: {
  repId:  string;
  ruleId?: string | null;
  amount: number;
  note?:  string | null;
}) {
  return prisma.repCommission.create({
    data: {
      repId:  data.repId,
      ruleId: data.ruleId ?? null,
      amount: data.amount,
      note:   data.note ?? null,
      status: "pending",
    },
  });
}

export async function markRepCommissionEarned(id: string, earnedById: string) {
  return prisma.repCommission.update({
    where: { id },
    data: { status: "earned", earnedAt: new Date(), earnedById },
  });
}

export async function deleteRepCommission(id: string) {
  return prisma.repCommission.delete({ where: { id } });
}
