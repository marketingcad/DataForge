import { prisma } from "@/lib/prisma";

/**
 * GHL appointment reporting.
 *
 * "Appointments set from GHL" = BookedAppointment rows created by the GHL
 * webhook (source: "webhook"). The webhook fires when an appointment is booked,
 * so `createdAt` is treated as the date the appointment was *set*.
 *
 * Month boundaries are computed in Philippine time (UTC+8) to match the rest of
 * the marketing reporting (see src/lib/marketing/team.service.ts).
 */

const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;
const GHL_SOURCE = "webhook";

/** UTC instant for midnight (PHT) on the 1st of the given PHT year/month. */
function phtMonthStartUtc(year: number, monthIndex: number): Date {
  // Date.UTC normalizes out-of-range month indices (e.g. -1 → previous Dec, 12 → next Jan).
  return new Date(Date.UTC(year, monthIndex, 1) - PHT_OFFSET_MS);
}

function monthLabel(year: number, monthIndex: number): string {
  return new Date(Date.UTC(year, monthIndex, 1)).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function monthKey(year: number, monthIndex: number): string {
  // Normalize via Date.UTC so e.g. monthIndex 12 rolls into the next year.
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Resolve a "YYYY-MM" key to its [gte, lt) UTC range, defaulting to the current PHT month. */
function rangeForKey(key?: string): { key: string; label: string; gte: Date; lt: Date } {
  const nowPHT = new Date(Date.now() + PHT_OFFSET_MS);
  let year = nowPHT.getUTCFullYear();
  let month = nowPHT.getUTCMonth();

  if (key && /^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split("-").map(Number);
    year = y;
    month = m - 1;
  }

  return {
    key: monthKey(year, month),
    label: monthLabel(year, month),
    gte: phtMonthStartUtc(year, month),
    lt: phtMonthStartUtc(year, month + 1),
  };
}

export type GhlMonthlyPoint = { key: string; label: string; count: number };

/** Webhook-sourced appointment counts for the last `months` months (oldest → newest). */
export async function getGhlApptMonthly(months = 12): Promise<GhlMonthlyPoint[]> {
  const nowPHT = new Date(Date.now() + PHT_OFFSET_MS);
  const curY = nowPHT.getUTCFullYear();
  const curM = nowPHT.getUTCMonth();

  const buckets = Array.from({ length: months }, (_, i) => {
    const offset = months - 1 - i; // oldest first
    return rangeForKey(monthKey(curY, curM - offset));
  });

  const counts = await Promise.all(
    buckets.map((b) =>
      prisma.bookedAppointment.count({
        where: { source: GHL_SOURCE, createdAt: { gte: b.gte, lt: b.lt } },
      }),
    ),
  );

  return buckets.map((b, i) => ({ key: b.key, label: b.label, count: counts[i] }));
}

/** All-time count of GHL (webhook) appointments. */
export function getGhlApptTotal(): Promise<number> {
  return prisma.bookedAppointment.count({ where: { source: GHL_SOURCE } });
}

export type GhlMonthAppt = {
  id: string;
  clientName: string;
  clientPhone: string | null;
  bookedAt: Date;
  createdAt: Date;
  repName: string;
};

export type GhlMonthDetail = {
  key: string;
  label: string;
  total: number;
  reps: { name: string; count: number }[];
  appointments: GhlMonthAppt[];
};

/** Per-rep breakdown + full appointment list for a single month. */
export async function getGhlMonthDetail(key?: string): Promise<GhlMonthDetail> {
  const range = rangeForKey(key);

  const rows = await prisma.bookedAppointment.findMany({
    where: { source: GHL_SOURCE, createdAt: { gte: range.gte, lt: range.lt } },
    select: {
      id: true,
      clientName: true,
      clientPhone: true,
      bookedAt: true,
      createdAt: true,
      agent: { select: { name: true, nickname: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const appointments: GhlMonthAppt[] = rows.map((r) => ({
    id: r.id,
    clientName: r.clientName,
    clientPhone: r.clientPhone,
    bookedAt: r.bookedAt,
    createdAt: r.createdAt,
    repName: r.agent?.name ?? r.agent?.nickname ?? "Unassigned",
  }));

  const byRep = new Map<string, number>();
  for (const a of appointments) {
    byRep.set(a.repName, (byRep.get(a.repName) ?? 0) + 1);
  }
  const reps = [...byRep.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return {
    key: range.key,
    label: range.label,
    total: appointments.length,
    reps,
    appointments,
  };
}
