import { prisma } from "@/lib/prisma";
import { normalizePhone, normalizeEmail, normalizeWebsite } from "@/lib/utils/normalize";
import { calculateDataQualityScore } from "@/lib/utils/scoring";
import { checkDuplicate } from "@/lib/utils/dedup";
import { geocodeAddress } from "@/lib/leads/geocode";
import { LeadInput, InsertResult } from "@/types/lead";

/**
 * Insert a new lead, running normalization, dedup, and scoring first.
 *
 * - If a duplicate is found (phone/email/website match), the existing record
 *   is updated with any new industry and a recalculated score.
 * - If no duplicate, a new lead is created.
 */
export async function insertLead(raw: LeadInput & { folderId?: string; savedById?: string; keywordId?: string }): Promise<InsertResult> {
  const phone = normalizePhone(raw.phone);
  const email = raw.email ? normalizeEmail(raw.email) : "";
  const website = raw.website ? normalizeWebsite(raw.website) : "";

  const dedupResult = await checkDuplicate(prisma, phone, raw.businessName, email || undefined);

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
        duplicateFlag: true,
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

  const coords = await geocodeAddress({
    address: raw.address,
    city: raw.city,
    state: raw.state,
    country: raw.country,
  });

  const lead = await prisma.lead.create({
    data: {
      businessName: raw.businessName,
      phone,
      email: email || null,
      website: website || null,
      contactPerson: raw.contactPerson || null,
      address: raw.address || null,
      city: raw.city || null,
      state: raw.state || null,
      country: raw.country || null,
      category: raw.category || null,
      source: raw.source,
      industriesFoundIn: industries,
      dataQualityScore: score,
      folderId: raw.folderId || null,
      savedById: raw.savedById || null,
      keywordId: raw.keywordId || null,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
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

  const locationChanged =
    raw.address !== undefined || raw.city !== undefined ||
    raw.state !== undefined || raw.country !== undefined;

  const coords = locationChanged
    ? await geocodeAddress({
        address: raw.address ?? existing.address,
        city: merged.city,
        state: merged.state,
        country: merged.country,
      })
    : null;

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
      ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
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
  location = "",
  status = "",
  folderId = "",
  sort = "newest",
  page = 1,
  pageSize = 20,
  minScore,
  maxScore,
  hasEmail,
  hasWebsite,
  hasContact,
  hasPhone,
  hasBusiness,
  noEmail,
  noWebsite,
  noContact,
  noPhone,
  noBusiness,
  hasScore,
  noScore,
  searchField = "business",
  savedById,
  exportStatus,
  exportedFrom,
  exportedTo,
}: {
  search?: string;
  industry?: string;
  state?: string;
  location?: string;
  status?: string;
  folderId?: string;
  sort?: "name_asc" | "name_desc" | "newest" | "oldest";
  page?: number;
  pageSize?: number;
  minScore?: number;
  maxScore?: number;
  hasEmail?: boolean;
  hasWebsite?: boolean;
  hasContact?: boolean;
  hasPhone?: boolean;
  hasBusiness?: boolean;
  noEmail?: boolean;
  noWebsite?: boolean;
  noContact?: boolean;
  noPhone?: boolean;
  noBusiness?: boolean;
  hasScore?: boolean;
  noScore?: boolean;
  searchField?: "business" | "contact" | "location" | "phone" | "email" | "website" | "score";
  savedById?: string;
  exportStatus?: "exported" | "not_exported";
  /** yyyy-mm-dd — filters by export date (inclusive) */
  exportedFrom?: string;
  exportedTo?: string;
}) {
  const where: Record<string, unknown> = {};

  if (search) {
    if (searchField === "contact") {
      where.contactPerson = { contains: search, mode: "insensitive" };
    } else if (searchField === "location") {
      where.OR = [
        { address: { contains: search, mode: "insensitive" } },
        { city: { contains: search, mode: "insensitive" } },
        { state: { contains: search, mode: "insensitive" } },
      ];
    } else if (searchField === "phone") {
      where.phone = { startsWith: search };
    } else if (searchField === "email") {
      where.email = { contains: search, mode: "insensitive" };
    } else if (searchField === "website") {
      where.website = { contains: search, mode: "insensitive" };
    } else if (searchField === "score") {
      const n = parseInt(search);
      if (!isNaN(n)) where.dataQualityScore = { gte: n };
    } else {
      where.businessName = { contains: search, mode: "insensitive" };
    }
  }

  if (industry) where.industriesFoundIn = { has: industry };
  if (state) where.state = { contains: state, mode: "insensitive" };
  if (location) {
    where.OR = [
      { address: { contains: location, mode: "insensitive" } },
      { city: { contains: location, mode: "insensitive" } },
      { state: { contains: location, mode: "insensitive" } },
    ];
  }
  if (status) where.recordStatus = status;
  if (folderId === "unfiled") where.folderId = null;
  else if (folderId) where.folderId = folderId;
  if (minScore !== undefined || maxScore !== undefined) {
    where.dataQualityScore = {
      ...(minScore !== undefined ? { gte: minScore } : {}),
      ...(maxScore !== undefined ? { lte: maxScore } : {}),
    };
  }
  if (hasEmail)    where.email         = { not: null, notIn: [""] };
  if (hasWebsite)  where.website       = { not: null, notIn: [""] };
  if (hasContact)  where.contactPerson = { not: null, notIn: [""] };
  if (hasPhone)    where.phone         = { not: null, notIn: ["", "N/A"] };
  if (hasBusiness) where.businessName  = { not: null, notIn: [""] };
  if (hasScore)    where.dataQualityScore = { gt: 0 };
  if (noScore)     where.dataQualityScore = { equals: 0 };

  type AndClause = Record<string, unknown>;
  const and: AndClause[] = (where.AND as AndClause[] | undefined) ?? [];
  if (noEmail)    and.push({ OR: [{ email: null }, { email: "" }] });
  if (noWebsite)  and.push({ OR: [{ website: null }, { website: "" }] });
  if (noContact)  and.push({ OR: [{ contactPerson: null }, { contactPerson: "" }] });
  if (noPhone)    and.push({ OR: [{ phone: null }, { phone: "" }, { phone: "N/A" }] });
  if (noBusiness) and.push({ OR: [{ businessName: null }, { businessName: "" }] });
  if (and.length) where.AND = and;

  if (savedById) where.savedById = savedById;

  // Export status + export-date range (filters on exportedAt).
  if (exportStatus === "not_exported") {
    where.exportedAt = null;
  } else if (exportStatus === "exported" || exportedFrom || exportedTo) {
    const range: Record<string, Date> = {};
    if (exportedFrom) range.gte = new Date(`${exportedFrom}T00:00:00.000Z`);
    if (exportedTo)   range.lte = new Date(`${exportedTo}T23:59:59.999Z`);
    // "exported" with no date bounds → any non-null export date.
    where.exportedAt = Object.keys(range).length ? range : { not: null };
  }

  // GHL webhook leads are a separate, special type — never mixed into the
  // scraped Leads views (this query backs the Leads page + CSV export).
  where.source = { not: "GHL" };

  const orderBy =
    sort === "name_asc"  ? [{ businessName: "asc"  as const }] :
    sort === "name_desc" ? [{ businessName: "desc" as const }] :
    sort === "oldest"    ? [{ dateCollected: "asc"  as const }] :
                           [{ dateCollected: "desc" as const }];

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.lead.count({ where }),
  ]);

  return { leads, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}
