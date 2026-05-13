"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import {
  createNoteAction, updateNoteAction, deleteNoteAction, deleteNoteFileAction,
  createScriptAction, updateScriptAction, deleteScriptAction, deleteScriptFileAction,
} from "@/actions/documents.actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export type DocFile = {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  createdAt: Date;
};

export type DocItem = {
  id: string;
  title: string;
  content: object;
  createdAt: Date;
  updatedAt: Date;
  files: DocFile[];
  user?: { name: string | null; nickname: string | null } | null;
  createdBy?: { name: string | null; nickname: string | null } | null;
};

type Props = {
  type: "note" | "script";
  initialDocs: DocItem[];
  isBossAdmin: boolean;
  title: string;
  emptyLabel: string;
  emptyHint: string;
  newLabel: string;
  ownerLabel: string;
};

// ── Toolbar ───────────────────────────────────────────────────────────────────

function ToolbarBtn({
  active, disabled, onClick, title, children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-7 min-w-7 px-1.5 rounded text-xs font-bold transition-colors flex items-center justify-center",
        active
          ? "bg-primary text-primary-foreground"
          : "hover:bg-accent text-muted-foreground hover:text-foreground",
        disabled && "opacity-30 pointer-events-none"
      )}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const groups: {
    key: string;
    items: { label: string; title: string; active?: boolean; action: () => void }[];
  }[] = [
    {
      key: "style",
      items: [
        { label: "B", title: "Bold", active: editor.isActive("bold"), action: () => editor.chain().focus().toggleBold().run() },
        { label: "I", title: "Italic", active: editor.isActive("italic"), action: () => editor.chain().focus().toggleItalic().run() },
        { label: "U", title: "Underline", active: editor.isActive("underline"), action: () => editor.chain().focus().toggleUnderline().run() },
        { label: "S̶", title: "Strikethrough", active: editor.isActive("strike"), action: () => editor.chain().focus().toggleStrike().run() },
      ],
    },
    {
      key: "headings",
      items: [
        { label: "H1", title: "Heading 1", active: editor.isActive("heading", { level: 1 }), action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
        { label: "H2", title: "Heading 2", active: editor.isActive("heading", { level: 2 }), action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
        { label: "H3", title: "Heading 3", active: editor.isActive("heading", { level: 3 }), action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
      ],
    },
    {
      key: "lists",
      items: [
        { label: "• List", title: "Bullet List", active: editor.isActive("bulletList"), action: () => editor.chain().focus().toggleBulletList().run() },
        { label: "1. List", title: "Ordered List", active: editor.isActive("orderedList"), action: () => editor.chain().focus().toggleOrderedList().run() },
        { label: "❝", title: "Blockquote", active: editor.isActive("blockquote"), action: () => editor.chain().focus().toggleBlockquote().run() },
        { label: "</>", title: "Code Block", active: editor.isActive("codeBlock"), action: () => editor.chain().focus().toggleCodeBlock().run() },
      ],
    },
    {
      key: "align",
      items: [
        { label: "⬅", title: "Align Left", active: editor.isActive({ textAlign: "left" }), action: () => editor.chain().focus().setTextAlign("left").run() },
        { label: "⬛", title: "Align Center", active: editor.isActive({ textAlign: "center" }), action: () => editor.chain().focus().setTextAlign("center").run() },
        { label: "➡", title: "Align Right", active: editor.isActive({ textAlign: "right" }), action: () => editor.chain().focus().setTextAlign("right").run() },
      ],
    },
    {
      key: "history",
      items: [
        { label: "↩", title: "Undo", action: () => editor.chain().focus().undo().run() },
        { label: "↪", title: "Redo", action: () => editor.chain().focus().redo().run() },
      ],
    },
  ];

  return (
    <div className="flex flex-wrap gap-0.5 px-3 py-2 border-b border-border/50 bg-muted/30">
      {groups.map((g, gi) => (
        <div key={g.key} className={cn("flex gap-0.5", gi < groups.length - 1 && "pr-2 mr-1 border-r border-border/40")}>
          {g.items.map((item) => (
            <ToolbarBtn key={item.title} active={item.active} title={item.title} onClick={item.action}>
              {item.label}
            </ToolbarBtn>
          ))}
        </div>
      ))}
    </div>
  );
}

// ── File attachment row ────────────────────────────────────────────────────────

function FileRow({ file, onDelete }: { file: DocFile; onDelete: (id: string) => void }) {
  const isImage = file.mimeType.startsWith("image/");
  const isPdf   = file.mimeType === "application/pdf";
  const ext     = file.name.split(".").pop()?.toUpperCase() ?? "FILE";
  const size    = file.size < 1024 * 1024
    ? `${(file.size / 1024).toFixed(0)} KB`
    : `${(file.size / 1024 / 1024).toFixed(1)} MB`;

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-accent/50 group">
      {isImage ? (
        <img src={file.url} alt={file.name} className="w-9 h-9 rounded object-cover shrink-0 border border-border/50" />
      ) : (
        <div className={cn(
          "w-9 h-9 rounded flex items-center justify-center text-[9px] font-black shrink-0 border",
          isPdf ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400"
                : "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-400"
        )}>
          {ext}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <a href={file.url} target="_blank" rel="noreferrer" className="text-xs font-medium truncate block hover:underline">
          {file.name}
        </a>
        <p className="text-[10px] text-muted-foreground">{size}</p>
      </div>
      <button
        onClick={() => onDelete(file.id)}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded"
        title="Remove file"
      >
        ✕
      </button>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function DocumentsClient({
  type, initialDocs, isBossAdmin, title, emptyLabel, emptyHint, newLabel,
}: Props) {
  const [docs, setDocs]               = useState<DocItem[]>(initialDocs);
  const [selected, setSelected]       = useState<DocItem | null>(initialDocs[0] ?? null);
  const [search, setSearch]           = useState("");
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [creating, setCreating]       = useState(false);
  const [titleValue, setTitleValue]   = useState(selected?.title ?? "");
  const fileInputRef                  = useRef<HTMLInputElement>(null);
  const saveTimerRef                  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef                   = useRef(selected);
  const titleValueRef                 = useRef(titleValue);
  selectedRef.current                 = selected;
  titleValueRef.current               = titleValue;

  const isOwner = useCallback((doc: DocItem) => {
    if (isBossAdmin) return true;
    return true; // reps can edit their own — server enforces
  }, [isBossAdmin]);

  // Swap title when selection changes
  useEffect(() => {
    setTitleValue(selected?.title ?? "");
  }, [selected?.id]);

  // ── TipTap editor ──
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image,
      Placeholder.configure({ placeholder: "Start writing…" }),
    ],
    content: selected?.content ?? {},
    onUpdate: ({ editor }) => {
      if (!selectedRef.current) return;
      scheduleSave(selectedRef.current.id, titleValueRef.current, editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: "tiptap focus:outline-none min-h-[300px] px-5 py-4 text-sm",
      },
    },
  });

  // Replace editor content when selection changes
  useEffect(() => {
    if (!editor || !selected) return;
    const json = selected.content as object;
    const current = editor.getJSON();
    if (JSON.stringify(current) !== JSON.stringify(json)) {
      editor.commands.setContent(json);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  function scheduleSave(id: string, t: string, content: object) {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persist(id, t, content), 900);
  }

  async function persist(id: string, t: string, content: object) {
    setSaving(true);
    const fn = type === "note" ? updateNoteAction : updateScriptAction;
    const res = await fn(id, { title: t, contentJson: JSON.stringify(content) });
    setSaving(false);
    if ("error" in res && res.error) { toast.error(res.error); return; }
    const updated = "note" in res ? res.note : "script" in res ? res.script : null;
    if (updated) {
      const u = updated as unknown as DocItem;
      setDocs(prev => prev.map(d => d.id === id ? { ...d, ...u } : d));
      setSelected(prev => prev?.id === id ? { ...prev, ...u } : prev);
    }
  }

  function handleTitleChange(val: string) {
    setTitleValue(val);
    if (!selected) return;
    scheduleSave(selected.id, val, editor?.getJSON() ?? {});
    setDocs(prev => prev.map(d => d.id === selected.id ? { ...d, title: val } : d));
    setSelected(prev => prev ? { ...prev, title: val } : prev);
  }

  async function handleNew() {
    setCreating(true);
    const fn = type === "note" ? createNoteAction : createScriptAction;
    const res = await fn();
    setCreating(false);
    if ("error" in res && res.error) { toast.error(res.error); return; }
    const doc = "note" in res ? res.note : "script" in res ? res.script : null;
    if (doc) {
      setDocs(prev => [doc as DocItem, ...prev]);
      setSelected(doc as DocItem);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this? This cannot be undone.")) return;
    const fn = type === "note" ? deleteNoteAction : deleteScriptAction;
    const res = await fn(id);
    if (res.error) { toast.error(res.error); return; }
    const remaining = docs.filter(d => d.id !== id);
    setDocs(remaining);
    if (selected?.id === id) setSelected(remaining[0] ?? null);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    e.target.value = "";

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("type", type);
    fd.append("id", selected.id);

    const res = await fetch("/api/upload/document", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);

    if (!res.ok) { toast.error(data.error ?? "Upload failed"); return; }

    const newFile: DocFile = data.file;
    setDocs(prev => prev.map(d => d.id === selected.id ? { ...d, files: [...d.files, newFile] } : d));
    setSelected(prev => prev ? { ...prev, files: [...prev.files, newFile] } : prev);
    toast.success("File uploaded");
  }

  async function handleDeleteFile(fileId: string) {
    if (!confirm("Remove this file?")) return;
    const fn = type === "note" ? deleteNoteFileAction : deleteScriptFileAction;
    const res = await fn(fileId);
    if (res.error) { toast.error(res.error); return; }
    setDocs(prev => prev.map(d => ({ ...d, files: d.files.filter(f => f.id !== fileId) })));
    setSelected(prev => prev ? { ...prev, files: prev.files.filter(f => f.id !== fileId) } : prev);
  }

  const filtered = docs.filter(d =>
    d.title.toLowerCase().includes(search.toLowerCase())
  );

  const ownerName = (doc: DocItem) => {
    const p = doc.user ?? doc.createdBy;
    return p?.nickname ?? p?.name ?? null;
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      {/* ── Left panel: list ── */}
      <div className="w-64 shrink-0 flex flex-col border-r border-border/50">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-border/50">
          <h1 className="text-sm font-black truncate">{title}</h1>
          <button
            onClick={handleNew}
            disabled={creating}
            className="shrink-0 text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {creating ? "…" : "+ New"}
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-border/30">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${title.toLowerCase()}…`}
            className="w-full text-xs bg-muted/50 border border-border/40 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-muted-foreground">{search ? "No matches" : emptyLabel}</p>
            </div>
          ) : (
            filtered.map(doc => (
              <button
                key={doc.id}
                onClick={() => setSelected(doc)}
                className={cn(
                  "w-full text-left px-3 py-2.5 transition-colors group relative",
                  selected?.id === doc.id
                    ? "bg-primary/8 border-l-2 border-primary"
                    : "hover:bg-accent border-l-2 border-transparent"
                )}
              >
                <p className={cn("text-xs font-semibold truncate", selected?.id === doc.id && "text-primary")}>
                  {doc.title || "Untitled"}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <p className="text-[10px] text-muted-foreground truncate flex-1">
                    {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                  </p>
                  {doc.files.length > 0 && (
                    <span className="text-[9px] text-muted-foreground/60">📎 {doc.files.length}</span>
                  )}
                </div>
                {isBossAdmin && ownerName(doc) && (
                  <p className="text-[9px] text-muted-foreground/60 mt-0.5 truncate">by {ownerName(doc)}</p>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Right panel: editor ── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Title bar */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-border/50">
            <input
              value={titleValue}
              onChange={e => handleTitleChange(e.target.value)}
              className="flex-1 text-base font-black bg-transparent outline-none placeholder:text-muted-foreground/40 min-w-0"
              placeholder="Untitled"
            />
            <div className="flex items-center gap-2 shrink-0">
              {saving && <span className="text-[10px] text-muted-foreground">Saving…</span>}
              <button
                onClick={() => handleDelete(selected.id)}
                className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Toolbar */}
          {editor && <EditorToolbar editor={editor} />}

          {/* Editor body */}
          <div className="flex-1 overflow-y-auto">
            <EditorContent editor={editor} />
          </div>

          {/* Attachments */}
          <div className="border-t border-border/50">
            <div className="flex items-center justify-between px-4 py-2.5">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                📎 Attachments {selected.files.length > 0 && `(${selected.files.length})`}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "+ Add file"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.txt,.csv"
                onChange={handleFileUpload}
              />
            </div>
            {selected.files.length > 0 && (
              <div className="px-2 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-0.5 max-h-36 overflow-y-auto">
                {selected.files.map(f => (
                  <FileRow key={f.id} file={f} onDelete={handleDeleteFile} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
          <p className="text-3xl">📄</p>
          <p className="text-sm font-semibold">{emptyLabel}</p>
          <p className="text-xs text-muted-foreground max-w-xs">{emptyHint}</p>
          <button
            onClick={handleNew}
            disabled={creating}
            className="mt-2 text-xs font-bold px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {newLabel}
          </button>
        </div>
      )}
    </div>
  );
}
