"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";

type DocFile = {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
};

export function SharedDocViewer({
  title,
  content,
  files,
  ownerName,
  type,
}: {
  title: string;
  content: object;
  files: DocFile[];
  ownerName: string | null;
  type: "note" | "script";
}) {
  const editor = useEditor({
    editable: false,
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: true } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image,
    ],
    content,
  });

  function formatBytes(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
              {type === "script" ? "📋 Call Script" : "📝 Note"}
            </span>
          </div>
          <h1 className="text-3xl font-black leading-tight mb-2">{title || "Untitled"}</h1>
          {ownerName && (
            <p className="text-sm text-muted-foreground">By {ownerName}</p>
          )}
        </div>

        {/* Content */}
        <div className="prose prose-sm dark:prose-invert max-w-none rounded-xl border border-border/50 bg-card p-6 shadow-sm">
          {editor ? (
            <EditorContent editor={editor} />
          ) : (
            <p className="text-muted-foreground text-sm">Loading…</p>
          )}
        </div>

        {/* Attachments */}
        {files.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
              📎 Attachments ({files.length})
            </p>
            <div className="grid gap-2">
              {files.map((f) => (
                <a
                  key={f.id}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-card px-4 py-3 hover:bg-accent transition-colors group"
                >
                  <span className="text-lg shrink-0">
                    {f.mimeType.startsWith("image/") ? "🖼️" : f.mimeType === "application/pdf" ? "📄" : "📎"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{f.name}</p>
                    <p className="text-[11px] text-muted-foreground">{formatBytes(f.size)}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">↗ Open</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="mt-12 text-center text-[11px] text-muted-foreground/40">
          Shared via DataForge
        </p>
      </div>
    </div>
  );
}
