const GHL_BASE = "https://services.leadconnectorhq.com";
const GHL_VERSION = "2021-07-28";
const REQUEST_TIMEOUT_MS = 15_000; // 15 s per request — abort if GHL hangs

function buildHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: GHL_VERSION,
    "Content-Type": "application/json",
  };
}

function ghlFetch(url: string, init: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

export interface GhlContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  locationId: string;
  assignedTo?: string;
  dateAdded?: string;
  dateUpdated?: string;
  createdAt?: string;
}

export interface GhlConversation {
  id: string;
  contactId: string;
  type: string;
  lastMessageType?: string;
  contactName?: string;
  phone?: string;
  assignedTo?: string;
  dateAdded?: number | string;
  dateUpdated?: number | string;
  lastMessageDate?: number | string;
  sort?: number[];
  [key: string]: unknown;
}

export interface GhlMessage {
  id: string;
  type: number | string;
  messageType?: string;
  contentType?: string;
  direction: "inbound" | "outbound";
  status: string;
  dateAdded: string;
  meta?: {
    duration?: number;
    durationSecs?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

/** Search GHL contacts by phone number. Returns the first match or null. */
export async function searchContactByPhone(
  apiKey: string,
  locationId: string,
  phone: string
): Promise<GhlContact | null> {
  const url = `${GHL_BASE}/contacts/search?locationId=${encodeURIComponent(locationId)}&query=${encodeURIComponent(phone)}`;
  const res = await ghlFetch(url, { headers: buildHeaders(apiKey) });
  if (!res.ok) return null;
  const data = await res.json();
  const contacts: GhlContact[] = data.contacts ?? [];
  return contacts[0] ?? null;
}

/** Get a single GHL contact by ID. */
export async function getContactById(
  apiKey: string,
  contactId: string
): Promise<GhlContact | null> {
  const res = await ghlFetch(`${GHL_BASE}/contacts/${contactId}`, {
    headers: buildHeaders(apiKey),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.contact as GhlContact) ?? null;
}

/** Get all conversations for a contact. */
export async function getContactConversations(
  apiKey: string,
  locationId: string,
  contactId: string
): Promise<GhlConversation[]> {
  const url = `${GHL_BASE}/conversations/search?locationId=${encodeURIComponent(locationId)}&contactId=${encodeURIComponent(contactId)}`;
  const res = await ghlFetch(url, { headers: buildHeaders(apiKey) });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.conversations as GhlConversation[]) ?? [];
}

/** Get all conversations assigned to a specific GHL user/agent. */
export async function getAgentConversations(
  apiKey: string,
  locationId: string,
  ghlUserId: string,
  limit = 100
): Promise<{ conversations: GhlConversation[]; debug: Record<string, unknown> }> {
  const headers = buildHeaders(apiKey);
  const debug: Record<string, unknown> = {};

  // Try assignedTo param (GHL v2 standard)
  const r1 = await ghlFetch(
    `${GHL_BASE}/conversations/search?locationId=${encodeURIComponent(locationId)}&assignedTo=${encodeURIComponent(ghlUserId)}&limit=${limit}`,
    { headers }
  );
  debug.assignedTo = { status: r1.status };
  if (r1.ok) {
    const d = await r1.json();
    debug.assignedToRaw = d;
    const list: GhlConversation[] = d.conversations ?? d.data ?? [];
    if (list.length > 0) return { conversations: list, debug };
  }

  // Fallback: userId param
  const r2 = await ghlFetch(
    `${GHL_BASE}/conversations/search?locationId=${encodeURIComponent(locationId)}&userId=${encodeURIComponent(ghlUserId)}&limit=${limit}`,
    { headers }
  );
  debug.userId = { status: r2.status };
  if (r2.ok) {
    const d = await r2.json();
    debug.userIdRaw = d;
    const list: GhlConversation[] = d.conversations ?? d.data ?? [];
    if (list.length > 0) return { conversations: list, debug };
  }

  // Fallback: no user filter — get all location conversations
  const r3 = await ghlFetch(
    `${GHL_BASE}/conversations/search?locationId=${encodeURIComponent(locationId)}&limit=${limit}`,
    { headers }
  );
  debug.noFilter = { status: r3.status };
  if (r3.ok) {
    const d = await r3.json();
    debug.noFilterRaw = d;
  }

  return { conversations: [], debug };
}

const CALL_CONV_TYPES = new Set(["TYPE_CALL", "CALL", "type_call", "call"]);

function isCallConversation(conv: GhlConversation): boolean {
  return (
    CALL_CONV_TYPES.has(String(conv.type ?? "")) ||
    CALL_CONV_TYPES.has(String(conv.lastMessageType ?? ""))
  );
}

/**
 * Fetch all CALL-type conversations for a location, paginated.
 * GHL has no "get calls by user" endpoint — we fetch all and filter by assignedTo.
 * Returns conversations attributed per agent userId.
 */
function convDate(c: GhlConversation): number | undefined {
  const raw = c.sort?.[0] ?? c.lastMessageDate ?? c.dateUpdated ?? c.dateAdded;
  if (raw == null) return undefined;
  return typeof raw === "number" ? raw : new Date(raw).getTime();
}

export async function getLocationCallConversations(
  apiKey: string,
  locationId: string,
  since?: Date,
  maxPages = 600,
  initialStartAfterDate?: number,
): Promise<{ conversations: GhlConversation[]; nextCursor: number | null }> {
  const headers = buildHeaders(apiKey);
  const all: GhlConversation[] = [];
  const limit = 100;
  let startAfterDate: number | undefined = initialStartAfterDate;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({
      locationId,
      limit: String(limit),
      type: "TYPE_CALL",
    });
    if (startAfterDate !== undefined) {
      params.set("startAfterDate", String(startAfterDate));
    }

    const res = await ghlFetch(`${GHL_BASE}/conversations/search?${params}`, { headers });
    if (!res.ok) break;

    const data = await res.json();
    const convs: GhlConversation[] = data.conversations ?? data.data ?? [];
    if (convs.length === 0) break;

    let hitOldData = false;
    for (const c of convs) {
      if (since) {
        const ms = convDate(c);
        if (ms !== undefined && ms < since.getTime()) {
          hitOldData = true;
          break;
        }
      }
      all.push(c);
    }

    if (hitOldData || convs.length < limit) break;

    const lastSort = convDate(convs[convs.length - 1]);
    if (!lastSort) break;
    startAfterDate = lastSort;

    // If we used all allowed pages but there may be more, return the cursor to resume
    if (page === maxPages - 1) {
      return { conversations: all, nextCursor: startAfterDate ?? null };
    }
  }

  return { conversations: all, nextCursor: null };
}

/** Get messages for a conversation. Returns only call-type messages. */
export async function getConversationCalls(
  apiKey: string,
  conversationId: string,
  debug = false
): Promise<GhlMessage[]> {
  const allMessages: GhlMessage[] = [];
  let lastId: string | undefined;
  let page = 0;

  // Paginate through all messages (GHL returns up to 100 per page)
  while (page < 10) {
    const url = lastId
      ? `${GHL_BASE}/conversations/${conversationId}/messages?limit=100&lastMessageId=${lastId}`
      : `${GHL_BASE}/conversations/${conversationId}/messages?limit=100`;

    const res = await ghlFetch(url, { headers: buildHeaders(apiKey) });
    if (!res.ok) break;
    const data = await res.json();

    // GHL nests messages under data.messages.messages with a nextPage flag
    const msgs: GhlMessage[] = Array.isArray(data.messages)
      ? data.messages
      : Array.isArray(data.messages?.messages)
      ? (data.messages.messages as GhlMessage[])
      : [];

    allMessages.push(...msgs);

    const hasNext = data.messages?.nextPage === true;
    if (!hasNext || msgs.length === 0) break;
    lastId = data.messages?.lastMessageId as string | undefined;
    page++;
  }

  if (debug) {
    const types = allMessages.map((m) => ({ type: m.type, messageType: m.messageType, contentType: m.contentType, hasDuration: !!(m.meta?.duration ?? m.meta?.durationSecs) }));
    console.log(`[getConversationCalls] conv=${conversationId} total=${allMessages.length}`, JSON.stringify(types.slice(0, 10)));
  }

  // Match by known GHL call type values OR by presence of call duration metadata
  const CALL_TYPES = new Set([10, "TYPE_CALL", "CALL", "10", "type_call"]);
  return allMessages.filter((m) =>
    CALL_TYPES.has(m.type as never) ||
    CALL_TYPES.has(String(m.messageType ?? "")) ||
    !!(m.meta?.duration ?? m.meta?.durationSecs)
  );
}

export interface GhlAgent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role?: string;
}

/** List all users/agents in the GHL location. Tries multiple known endpoints. */
export async function listGhlAgents(
  apiKey: string,
  locationId: string
): Promise<{ agents: GhlAgent[]; debug: Record<string, unknown> }> {
  const headers = buildHeaders(apiKey);
  const debug: Record<string, unknown> = {};

  // Try endpoint 1: /users/search?locationId={}
  const r1 = await ghlFetch(
    `${GHL_BASE}/users/search?locationId=${encodeURIComponent(locationId)}`,
    { headers }
  );
  debug.endpoint1 = { status: r1.status, url: `/users/search?locationId=${locationId}` };
  if (r1.ok) {
    const d = await r1.json();
    debug.endpoint1Raw = d;
    const list: GhlAgent[] = d.users ?? d.data ?? [];
    if (list.length > 0) return { agents: list, debug };
  }

  // Try endpoint 2: /locations/{locationId}/users
  const r2 = await ghlFetch(
    `${GHL_BASE}/locations/${encodeURIComponent(locationId)}/users`,
    { headers }
  );
  debug.endpoint2 = { status: r2.status, url: `/locations/${locationId}/users` };
  if (r2.ok) {
    const d = await r2.json();
    debug.endpoint2Raw = d;
    const list: GhlAgent[] = d.users ?? d.data ?? [];
    if (list.length > 0) return { agents: list, debug };
  }

  // Try endpoint 3: /users/ with locationId filter
  const r3 = await ghlFetch(
    `${GHL_BASE}/users/?locationId=${encodeURIComponent(locationId)}`,
    { headers }
  );
  debug.endpoint3 = { status: r3.status, url: `/users/?locationId=${locationId}` };
  if (r3.ok) {
    const d = await r3.json();
    debug.endpoint3Raw = d;
    const list: GhlAgent[] = d.users ?? d.data ?? [];
    if (list.length > 0) return { agents: list, debug };
  }

  return { agents: [], debug };
}

export interface GhlOpportunity {
  id: string;
  status: string;
  monetaryValue?: number;
  source?: string;
  contactId?: string;
  assignedTo?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Fetch all opportunities for a GHL location assigned to a specific user.
 * Uses offset pagination (opportunities API supports it unlike conversations).
 */
export async function getAgentOpportunities(
  apiKey: string,
  locationId: string,
  ghlUserId: string
): Promise<GhlOpportunity[]> {
  const headers = buildHeaders(apiKey);
  const all: GhlOpportunity[] = [];
  const limit = 100;
  let startAfter = 0;

  for (let page = 0; page < 200; page++) {
    const params = new URLSearchParams({
      location_id: locationId,
      assigned_to: ghlUserId,
      limit: String(limit),
      startAfter: String(startAfter),
    });
    const res = await ghlFetch(`${GHL_BASE}/opportunities/search?${params}`, { headers });
    if (!res.ok) break;
    const data = await res.json();
    const opps: GhlOpportunity[] = data.opportunities ?? [];
    if (opps.length === 0) break;
    all.push(...opps);
    if (opps.length < limit) break;
    startAfter += limit;
  }

  return all;
}

export interface GhlCalendarAppointment {
  id: string;
  calendarId?: string;
  locationId?: string;
  contactId?: string;
  title?: string;
  // GHL has a typo in their API — field appears as both spellings
  appoinmentStatus?: string;
  appointmentStatus?: string;
  status?: string;
  assignedUserId?: string;
  startTime?: string;
  endTime?: string;
  dateAdded?: string;
  [key: string]: unknown;
}

export interface GhlCalendar {
  id: string;
  name?: string;
  locationId?: string;
  [key: string]: unknown;
}

/** List all calendars for a GHL location. */
export async function getLocationCalendars(
  apiKey: string,
  locationId: string,
): Promise<GhlCalendar[]> {
  const res = await ghlFetch(
    `${GHL_BASE}/calendars/?locationId=${encodeURIComponent(locationId)}`,
    { headers: buildHeaders(apiKey) },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.calendars ?? data.data ?? []) as GhlCalendar[];
}

/**
 * Fetch all appointments for a specific calendar within a time window.
 * startTime/endTime are Unix ms. endTime defaults to 90 days from now to include future bookings.
 */
export async function getAppointmentsByCalendar(
  apiKey: string,
  calendarId: string,
  since?: Date,
  maxDays = 90,
): Promise<GhlCalendarAppointment[]> {
  const headers = buildHeaders(apiKey);
  const now = Date.now();
  const endTime = now + maxDays * 24 * 60 * 60 * 1000;
  const startTime = since ? since.getTime() : now - maxDays * 24 * 60 * 60 * 1000;

  const params = new URLSearchParams({
    calendarId,
    startTime: String(startTime),
    endTime: String(endTime),
  });

  const res = await ghlFetch(`${GHL_BASE}/calendars/events?${params}`, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.events ?? data.appointments ?? data.data ?? []) as GhlCalendarAppointment[];
}

/** @deprecated Use getAppointmentsByCalendar instead */
export async function getAppointmentsByUser(
  apiKey: string,
  ghlUserId: string,
  since?: Date,
  maxDays = 90
): Promise<GhlCalendarAppointment[]> {
  const headers = buildHeaders(apiKey);
  const now = Date.now();
  const endTime = now + maxDays * 24 * 60 * 60 * 1000;
  const startTime = since ? since.getTime() : now - maxDays * 24 * 60 * 60 * 1000;

  const params = new URLSearchParams({
    userId: ghlUserId,
    startTime: String(startTime),
    endTime: String(endTime),
  });

  const res = await ghlFetch(`${GHL_BASE}/calendars/events?${params}`, { headers });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.events ?? data.appointments ?? data.data ?? []) as GhlCalendarAppointment[];
}

/**
 * Batch-fetch contacts by ID to read their assignedTo (contact owner).
 * Returns a map of contactId → ghlUserId.
 */
export async function getContactOwners(
  apiKey: string,
  contactIds: string[],
  concurrency = 10
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const unique = [...new Set(contactIds)];

  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (id) => {
        const contact = await getContactById(apiKey, id);
        if (contact?.assignedTo) result.set(id, contact.assignedTo);
      })
    );
  }

  return result;
}

/**
 * Fetch all contacts for a location that have a specific tag.
 * GHL requires a POST body with a filters array — GET query params do not work for tag filtering.
 */
export async function getContactsByTag(
  apiKey: string,
  locationId: string,
  tag: string,
  maxPages = 50,
): Promise<GhlContact[]> {
  const all: GhlContact[] = [];
  let page = 1;

  for (let i = 0; i < maxPages; i++) {
    const res = await ghlFetch(`${GHL_BASE}/contacts/search`, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        locationId,
        page,
        pageLimit: 100,
        filters: [{ field: "tags", operator: "eq", value: tag }],
      }),
    });

    if (!res.ok) break;

    const data = await res.json() as Record<string, unknown>;
    const contacts = (data.contacts ?? data.data ?? []) as GhlContact[];
    all.push(...contacts);

    if (contacts.length < 100) break;
    page++;
  }

  return all;
}

/**
 * Create or upsert a contact in GHL via the direct Contacts API.
 * Returns the created/updated contact ID, or null on failure.
 */
export async function createOrUpdateContact(
  apiKey: string,
  locationId: string,
  payload: Record<string, unknown>,
): Promise<{ id: string } | null> {
  // Try upsert first (idempotent — won't create duplicates on retry)
  const upsertRes = await ghlFetch(`${GHL_BASE}/contacts/upsert`, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ ...payload, locationId }),
  });
  if (upsertRes.ok) {
    const data = await upsertRes.json() as Record<string, unknown>;
    const contact = (data.contact ?? data) as Record<string, unknown>;
    if (typeof contact.id === "string") return { id: contact.id };
  }

  // Fall back to plain create
  const createRes = await ghlFetch(`${GHL_BASE}/contacts/`, {
    method: "POST",
    headers: buildHeaders(apiKey),
    body: JSON.stringify({ ...payload, locationId }),
  });
  if (!createRes.ok) return null;
  const data = await createRes.json() as Record<string, unknown>;
  const contact = (data.contact ?? data) as Record<string, unknown>;
  return typeof contact.id === "string" ? { id: contact.id } : null;
}

/** Map GHL call status to DataForge CallStatus enum values. */
export function mapGhlCallStatus(status: string): "completed" | "missed" | "voicemail" | "no_answer" {
  const s = status?.toLowerCase() ?? "";
  if (s.includes("voicemail")) return "voicemail";
  if (s.includes("miss") || s.includes("cancel")) return "missed";
  if (s.includes("no_answer") || s.includes("no-answer") || s.includes("noanswer")) return "no_answer";
  return "completed";
}
