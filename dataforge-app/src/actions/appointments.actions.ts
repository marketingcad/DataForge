"use server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addManualAppointment(data: {
  agentId: string;
  clientName: string;
  clientPhone?: string;
  bookedAt: string;
  notes?: string;
}) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !["boss", "admin"].includes(user.role ?? "")) {
    throw new Error("Unauthorized");
  }

  const existing = await prisma.bookedAppointment.findFirst({
    where: {
      clientPhone: data.clientPhone?.trim() || "",
      bookedAt: new Date(data.bookedAt),
    },
    select: { id: true },
  });

  await prisma.bookedAppointment.upsert({
    where: {
      clientPhone_bookedAt: {
        clientPhone: data.clientPhone?.trim() || "",
        bookedAt:    new Date(data.bookedAt),
      },
    },
    create: {
      agentId:     data.agentId,
      clientName:  data.clientName.trim(),
      clientPhone: data.clientPhone?.trim() || null,
      bookedAt:    new Date(data.bookedAt),
      source:      "manual",
      createdById: user.id,
      notes:       data.notes?.trim() || null,
    },
    update: {
      agentId:    data.agentId,
      clientName: data.clientName.trim(),
      source:     "manual",
      createdById: user.id,
    },
  });

  // Award 1 balloon point to the agent on new appointment only
  if (!existing) {
    const agent = await prisma.user.findUnique({ where: { id: data.agentId }, select: { role: true } });
    if (agent && ["sales_rep", "team_lead"].includes(agent.role)) {
      await prisma.user.update({ where: { id: data.agentId }, data: { balloonPoints: { increment: 1 } } });
    }
  }

  revalidatePath("/marketing");
}

export async function deleteAppointmentAction(id: string) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id || !["boss", "admin"].includes(user.role ?? "")) {
    throw new Error("Unauthorized");
  }
  await prisma.bookedAppointment.delete({ where: { id } });
  revalidatePath("/marketing");
  revalidatePath("/marketing/appointments");
}

export async function getAppointmentsAction(agentId?: string) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string } | undefined;
  if (!user?.id) throw new Error("Unauthorized");

  const allowed = ["boss", "admin", "sales_rep", "team_lead"];
  if (!allowed.includes(user.role ?? "")) throw new Error("Unauthorized");

  return prisma.bookedAppointment.findMany({
    where: agentId ? { agentId } : undefined,
    include: {
      agent:     { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { bookedAt: "desc" },
  });
}

export async function getSalesReps() {
  return prisma.user.findMany({
    where: { role: { in: ["sales_rep", "team_lead"] } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
}
