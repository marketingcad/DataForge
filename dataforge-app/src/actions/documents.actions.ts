"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

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
    include: {
      files: { orderBy: { createdAt: "asc" } },
      user: { select: { name: true, nickname: true } },
    },
  });
  return { notes };
}

export async function createNoteAction() {
  const session = await auth();
  if (!session) return { error: "Unauthorized" };
  const note = await prisma.note.create({
    data: { userId: session.user.id!, title: "Untitled", content: {} },
    include: { files: true, user: { select: { name: true, nickname: true } } },
  });
  return { note };
}

export async function updateNoteAction(id: string, data: { title?: string; content?: object }) {
  try {
    const session = await auth();
    if (!session) return { error: "Unauthorized" };
    const role = (session.user as { role?: string }).role ?? "";
    const isBossAdmin = ["boss", "admin"].includes(role);

    const existing = await prisma.note.findUnique({ where: { id } });
    if (!existing) return { error: "Not found" };
    if (!isBossAdmin && existing.userId !== session.user.id) return { error: "Forbidden" };

    const note = await prisma.note.update({
      where: { id },
      data,
      include: { files: true, user: { select: { name: true, nickname: true } } },
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

  // Delete storage files
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
      include: {
        files: { orderBy: { createdAt: "asc" } },
        createdBy: { select: { name: true, nickname: true } },
      },
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
    include: { files: true, createdBy: { select: { name: true, nickname: true } } },
  });
  return { script };
}

export async function updateScriptAction(id: string, data: { title?: string; content?: object }) {
  try {
    const session = await auth();
    if (!session) return { error: "Unauthorized" };
    const role = (session.user as { role?: string }).role ?? "";
    const isBossAdmin = ["boss", "admin"].includes(role);

    const existing = await prisma.script.findUnique({ where: { id } });
    if (!existing) return { error: "Not found" };
    if (!isBossAdmin && existing.createdById !== session.user.id) return { error: "Forbidden" };

    const script = await prisma.script.update({
      where: { id },
      data,
      include: { files: true, createdBy: { select: { name: true, nickname: true } } },
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
