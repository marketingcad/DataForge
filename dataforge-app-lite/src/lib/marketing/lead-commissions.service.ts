import { prisma } from "@/lib/prisma";

/** Full ledger entry for boss/admin view */
export async function getLedger() {
  return prisma.leadCommission.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      lead:  { select: { id: true, businessName: true, city: true, category: true } },
      agent: { select: { id: true, name: true, email: true } },
      rule:  { select: { id: true, name: true } },
      paidBy: { select: { id: true, name: true, email: true } },
    },
  });
}

/** All commissions for a specific sales rep */
export async function getMyCommissions(agentId: string) {
  return prisma.leadCommission.findMany({
    where: { agentId },
    orderBy: { createdAt: "desc" },
    include: {
      lead: { select: { id: true, businessName: true, city: true, category: true } },
      rule: { select: { name: true } },
    },
  });
}

/** Commission for a specific lead (if any) */
export async function getLeadCommission(leadId: string) {
  return prisma.leadCommission.findUnique({
    where: { leadId },
    include: {
      agent: { select: { id: true, name: true, email: true } },
      rule:  { select: { id: true, name: true, amount: true } },
    },
  });
}

export async function upsertLeadCommission(data: {
  leadId:  string;
  agentId: string;
  ruleId?: string | null;
  amount:  number;
  note?:   string | null;
}) {
  return prisma.leadCommission.upsert({
    where: { leadId: data.leadId },
    create: {
      leadId:  data.leadId,
      agentId: data.agentId,
      ruleId:  data.ruleId ?? null,
      amount:  data.amount,
      note:    data.note ?? null,
      status:  "pending",
    },
    update: {
      agentId: data.agentId,
      ruleId:  data.ruleId ?? null,
      amount:  data.amount,
      note:    data.note ?? null,
      // reset status to pending if re-assigned
      status:  "pending",
      paidAt:  null,
      paidById: null,
      confirmedAt: null,
    },
  });
}

export async function markLeadCommissionPaid(id: string, paidById: string) {
  return prisma.leadCommission.update({
    where: { id },
    data: { status: "paid", paidAt: new Date(), paidById },
  });
}

export async function confirmLeadCommissionReceived(id: string, agentId: string) {
  // Only the assigned agent can confirm
  return prisma.leadCommission.updateMany({
    where: { id, agentId, status: "paid" },
    data: { status: "confirmed", confirmedAt: new Date() },
  });
}

export async function deleteLeadCommission(id: string) {
  return prisma.leadCommission.delete({ where: { id } });
}
