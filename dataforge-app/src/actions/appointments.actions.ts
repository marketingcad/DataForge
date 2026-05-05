"use server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addManualAppointment(data: {
  agentId: string;
  clientName: string;
  bookedAt: string; // ISO string from client
  notes?: string;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !["boss", "admin"].includes(user.role ?? "")) {
    throw new Error("Unauthorized");
  }

  await prisma.bookedAppointment.create({
    data: {
      agentId:     data.agentId,
      clientName:  data.clientName.trim(),
      bookedAt:    new Date(data.bookedAt),
      source:      "manual",
      createdById: user.id,
      notes:       data.notes?.trim() || null,
    },
  });

  revalidatePath("/marketing");
}

export async function getSalesReps() {
  return prisma.user.findMany({
    where: { role: { in: ["sales_rep", "team_lead"] } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}
