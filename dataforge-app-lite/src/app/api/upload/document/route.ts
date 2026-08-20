import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function supabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file     = formData.get("file") as File | null;
  const type     = formData.get("type") as "note" | "script" | null;
  const parentId = formData.get("id") as string | null;

  if (!file || !type || !parentId) {
    return NextResponse.json({ error: "Missing file, type, or id" }, { status: 400 });
  }

  const ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain", "text/csv",
  ];
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
  }
  if (file.size > 20 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });
  }

  const userId = session.user.id!;
  const role   = (session.user as { role?: string }).role ?? "";
  const isBossAdmin = ["boss", "admin"].includes(role);

  // Verify ownership
  if (type === "note") {
    const note = await prisma.note.findUnique({ where: { id: parentId } });
    if (!note || (!isBossAdmin && note.userId !== userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    const script = await prisma.script.findUnique({ where: { id: parentId } });
    if (!script || (!isBossAdmin && script.createdById !== userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const ext         = file.name.split(".").pop() ?? "bin";
  const storagePath = `${type}s/${parentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer      = Buffer.from(await file.arrayBuffer());

  const sb = supabaseAdmin();
  const { error: uploadError } = await sb.storage
    .from("documents")
    .upload(storagePath, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = sb.storage.from("documents").getPublicUrl(storagePath);
  const url = urlData.publicUrl;

  if (type === "note") {
    const record = await prisma.noteFile.create({
      data: { noteId: parentId, name: file.name, url, storagePath, size: file.size, mimeType: file.type },
    });
    return NextResponse.json({ file: record });
  } else {
    const record = await prisma.scriptFile.create({
      data: { scriptId: parentId, name: file.name, url, storagePath, size: file.size, mimeType: file.type },
    });
    return NextResponse.json({ file: record });
  }
}
