import { prisma } from "@/lib/prisma";
import { normalizePhone, normalizeEmail, normalizeWebsite } from "@/lib/utils/normalize";
import { calculateDataQualityScore } from "@/lib/utils/scoring";
import { checkDuplicate } from "@/lib/utils/dedup";
import { LeadInput, InsertResult } from "@/types/lead";

/**
 * Insert a new lead, running normalization, dedup, and scoring first.
 *
 * - If a duplicate is found (phone/email/website match), the existing record
 *   is updated with any new industry and a recalculated score.
 * - If no duplicate, a new lead is created.
 */
export async function insertLead(raw: LeadInput & { folderId?: string }): Promise<InsertResult> {
  const phone = normalizePhone(raw.phone);
  const email = raw.email ? normalizeEmail(raw.email) : "";
  const website = raw.website ? normalizeWebsite(raw.website) : "";

  const dedupResult = await checkDuplicate(prisma, phone, email, website);

  if (dedupResult.isDuplicate) {
    const existing = await prisma.lead.findUnique({
      where: { id: dedupResult.existingId },
    });

    if (!existing) return { status: "duplicate", existingId: dedupResult.existingId };

    // Merge industries
    const newIndustries = raw.category
      ? Array.from(new Set([...existing.industriesFoundIn, raw.category]))
      : existing.industriesFoundIn;

    // Recalculate score and enforce monotonicity
    const newScore = calculateDataQualityScore(
      { ...raw, phone, email: email || undefined, website: website || undefined },
      newIndustries.length
    );

    await prisma.lead.update({
      where: { id: existing.id },
      data: {
        industriesFoundIn: newIndustries,
        dataQualityScore: Math.max(existing.dataQualityScore, newScore),
        // Move to the new folder if one was explicitly provided
        ...(raw.folderId ? { folderId: raw.folderId } : {}),
      },
    });

    return { status: "duplicate", existingId: existing.id };
  }

  // New lead
  const industries = raw.category ? [raw.category] : [];
  const score = calculateDataQualityScore(
    { ...raw, phone, email: email || undefined, website: website || undefined },
    industries.length
  );

  const lead = await prisma.lead.create({
    data: {
      businessName: raw.businessName,
      phone,
      email: email || null,
      website: website || null,
      contactPerson: raw.contactPerson || null,
      city: raw.city || null,
      state: raw.state || null,
      country: raw.country || null,
      category: raw.category || null,
      source: raw.source,
      industriesFoundIn: industries,
      dataQualityScore: score,
      folderId: raw.folderId || null,
    },
  });

  return { status: "created", id: lead.id };
}

/**
 * Update an existing lead's fields, recalculating score on save.
 * Score is monotonic — it only increases.
 */
export async function updateLead(id: string, raw: Partial<LeadInput>) {
  const existing = await prisma.lead.findUniqueOrThrow({ where: { id } });

  const phone = raw.phone ? normalizePhone(raw.phone) : existing.phone;
  const email = raw.email !== undefined
    ? normalizeEmail(raw.email)
    : existing.email ?? "";
  const website = raw.website !== undefined
    ? normalizeWebsite(raw.website)
    : existing.website ?? "";

  const merged = {
    businessName: raw.businessName ?? existing.businessName,
    phone,
    email: email || undefined,
    website: website || undefined,
    contactPerson: raw.contactPerson ?? existing.contactPerson ?? undefined,
    city: raw.city ?? existing.city ?? undefined,
    state: raw.state ?? existing.state ?? undefined,
    country: raw.country ?? existing.country ?? undefined,
    category: raw.category ?? existing.category ?? undefined,
    source: raw.source ?? existing.source,
  };

  const newScore = calculateDataQualityScore(merged, existing.industriesFoundIn.length);

  return prisma.lead.update({
    where: { id },
    data: {
      ...merged,
      email: merged.email || null,
      website: merged.website || null,
      contactPerson: merged.contactPerson || null,
      city: merged.city || null,
      state: merged.state || null,
      country: merged.country || null,
      category: merged.category || null,
      dataQualityScore: Math.max(existing.dataQualityScore, newScore),
    },
  });
}

/**
 * Get a paginated, filtered list of leads.
 */
export async function getLeads({
  search = "",
  industry = "",
  state = "",
  status = "",
  folderId = "",
  page = 1,
  pageSize = 20,
}: {
  search?: string;
  industry?: string;
  state?: string;
  status?: string;
  folderId?: string;
  page?: number;
  pageSize?: number;
}) {
  const where: Record<string, unknown> = {};

  if (search) {
    where.OR = [
      { businessName: { contains: search, mode: "insensitive" } },
      { phone: { contains: search } },
      { email: { contains: search, mode: "insensitive" } },
      { contactPerson: { contains: search, mode: "insensitive" } },
    ];
  }

  if (industry) where.industriesFoundIn = { has: industry };
  if (state) where.state = { equals: state, mode: "insensitive" };
  if (status) where.recordStatus = status;
  if (folderId === "unfiled") where.folderId = null;
  else if (folderId) where.folderId = folderId;

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: [{ dataQualityScore: "desc" }, { dateCollected: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
