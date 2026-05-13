"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

const NOTE_INCLUDE = {
  files: { orderBy: { createdAt: "asc" as const } },
  user: { select: { name: true, nickname: true } },
};

const SCRIPT_INCLUDE = {
  files: { orderBy: { createdAt: "asc" as const } },
  createdBy: { select: { name: true, nickname: true } },
};

// ── Notes ─────────────────────────────────────────────────────────────────────

export async function getNotesAction() {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  const userId = session.user.id!;
  const role = (session.user as { role?: string }).role ?? "";
  const isBossAdmin = ["boss", "admin"].includes(role);

  const notes = await prisma.note.findMany({
    where: isBossAdmin ? {} : { userId },
    orderBy: { updatedAt: "desc" },
    include: NOTE_INCLUDE,
  });
  return { notes };
}

export async function createNoteAction() {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  const note = await prisma.note.create({
    data: { userId: session.user.id!, title: "Untitled", content: {} },
    include: NOTE_INCLUDE,
  });
  return { note };
}

export async function updateNoteAction(id: string, data: { title?: string; contentJson?: string }) {
  try {
    const session = await auth();
    if (!session) return { error: "Unauthorized" };
    const role = (session.user as { role?: string }).role ?? "";
    const isBossAdmin = ["boss", "admin"].includes(role);

    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing) return { error: "Not found" };
    if (!isBossAdmin && existing.userId !== session.user.id) return { error: "Forbidden" };

    const content = data.contentJson !== undefined ? JSON.parse(data.contentJson) : undefined;
    const note = await prisma.note.update({
      where: { id },
      data: { title: data.title, ...(content !== undefined && { content }) },
      include: NOTE_INCLUDE,
    });
    return { note };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[updateNoteAction]", msg);
    return { error: msg };
  }
}

export async function deleteNoteAction(id: string) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  const role = (session.user as { role?: string }).role ?? "";
  const isBossAdmin = ["boss", "admin"].includes(role);

  const existing = await prisma.note.findUnique({ where: { id }, include: { files: true } });
  if (!existing) return { error: "Not found" };
  if (!isBossAdmin && existing.userId !== session.user.id) return { error: "Forbidden" };

  if (existing.files.length > 0) {
    const sb = supabaseAdmin();
    await sb.storage.from("documents").remove(existing.files.map((f) => f.storagePath));
  }

  await prisma.note.delete({ where: { id } });
  return { ok: true };
}

export async function deleteNoteFileAction(fileId: string) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  const role = (session.user as { role?: string }).role ?? "";
  const isBossAdmin = ["boss", "admin"].includes(role);

  const file = await prisma.noteFile.findUnique({ where: { id: fileId }, include: { note: true } });
  if (!file) return { error: "Not found" };
  if (!isBossAdmin && file.note.userId !== session.user.id) return { error: "Forbidden" };

  const sb = supabaseAdmin();
  await sb.storage.from("documents").remove([file.storagePath]);
  await prisma.noteFile.delete({ where: { id: fileId } });
  return { ok: true };
}

// ── Scripts ───────────────────────────────────────────────────────────────────

export async function getScriptsAction() {
  try {
    const session = await auth();
    if (!session) return { error: "Unauthorized" };

    const scripts = await prisma.script.findMany({
      orderBy: { updatedAt: "desc" },
      include: SCRIPT_INCLUDE,
    });
    return { scripts };
  } catch (err) {
    console.error("[getScriptsAction]", err);
    return { scripts: [] };
  }
}

export async function createScriptAction() {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  const script = await prisma.script.create({
    data: { createdById: session.user.id!, title: "Untitled Script", content: {} },
    include: SCRIPT_INCLUDE,
  });
  return { script };
}

export async function updateScriptAction(id: string, data: { title?: string; contentJson?: string }) {
  try {
    const session = await auth();
    if (!session) return { error: "Unauthorized" };
    const role = (session.user as { role?: string }).role ?? "";
    const isBossAdmin = ["boss", "admin"].includes(role);

    const existing = await prisma.script.findUnique({ where: { id } });
    if (!existing) return { error: "Not found" };
    if (!isBossAdmin && existing.createdById !== session.user.id) return { error: "Forbidden" };

    const content = data.contentJson !== undefined ? JSON.parse(data.contentJson) : undefined;
    const script = await prisma.script.update({
      where: { id },
      data: { title: data.title, ...(content !== undefined && { content }) },
      include: SCRIPT_INCLUDE,
    });
    return { script };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[updateScriptAction]", msg);
    return { error: msg };
  }
}

export async function deleteScriptAction(id: string) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  const role = (session.user as { role?: string }).role ?? "";
  const isBossAdmin = ["boss", "admin"].includes(role);

  const existing = await prisma.script.findUnique({ where: { id }, include: { files: true } });
  if (!existing) return { error: "Not found" };
  if (!isBossAdmin && existing.createdById !== session.user.id) return { error: "Forbidden" };

  if (existing.files.length > 0) {
    const sb = supabaseAdmin();
    await sb.storage.from("documents").remove(existing.files.map((f) => f.storagePath));
  }

  await prisma.script.delete({ where: { id } });
  return { ok: true };
}

export async function deleteScriptFileAction(fileId: string) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  const role = (session.user as { role?: string }).role ?? "";
  const isBossAdmin = ["boss", "admin"].includes(role);

  const file = await prisma.scriptFile.findUnique({ where: { id: fileId }, include: { script: true } });
  if (!file) return { error: "Not found" };
  if (!isBossAdmin && file.script.createdById !== session.user.id) return { error: "Forbidden" };

  const sb = supabaseAdmin();
  await sb.storage.from("documents").remove([file.storagePath]);
  await prisma.scriptFile.delete({ where: { id: fileId } });
  return { ok: true };
}

// ── Share tokens ──────────────────────────────────────────────────────────────

export async function generateShareTokenAction(type: "note" | "script", id: string) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  const role = (session.user as { role?: string }).role ?? "";
  if (!["boss", "admin"].includes(role)) return { error: "Forbidden" };

  const token = randomUUID();

  if (type === "note") {
    await prisma.note.update({ where: { id }, data: { shareToken: token } });
  } else {
    await prisma.script.update({ where: { id }, data: { shareToken: token } });
  }

  return { token };
}

export async function revokeShareTokenAction(type: "note" | "script", id: string) {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  const role = (session.user as { role?: string }).role ?? "";
  if (!["boss", "admin"].includes(role)) return { error: "Forbidden" };

  if (type === "note") {
    await prisma.note.update({ where: { id }, data: { shareToken: null } });
  } else {
    await prisma.script.update({ where: { id }, data: { shareToken: null } });
  }

  return { ok: true };
}

// Public — no auth required
export async function getSharedDocAction(token: string) {
  const note = await prisma.note.findUnique({
    where: { shareToken: token },
    include: {
      files: { orderBy: { createdAt: "asc" } },
      user: { select: { name: true, nickname: true } },
    },
  });
  if (note) return { type: "note" as const, doc: note };

  const script = await prisma.script.findUnique({
    where: { shareToken: token },
    include: {
      files: { orderBy: { createdAt: "asc" } },
      createdBy: { select: { name: true, nickname: true } },
    },
  });
  if (script) return { type: "script" as const, doc: script };

  return { error: "Not found" };
}
