"use client";

import { useState, useRef, useTransition } from "react";
import Image from "next/image";
import {
  createBadgeAction,
  updateBadgeAction,
  deleteBadgeAction,
} from "@/actions/badges.actions";

type Badge = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  imageUrl: string | null;
  criteriaType: string | null;
  criteriaValue: number | null;
  _count: { userBadges: number };
};

const CRITERIA_TYPES = [
  { value: "",             label: "Manual (boss awards only)" },
  { value: "call_count",  label: "Call Count — reach X calls" },
  { value: "task_complete",label: "Complete a Challenge" },
  { value: "top_rank",    label: "Reach Top Rank" },
  { value: "streak",      label: "Streak — X consecutive days with calls" },
];

const EMPTY: Omit<Badge, "id" | "_count"> = {
  key: "", name: "", description: "", icon: "🏅",
  color: "#6366f1", imageUrl: null, criteriaType: null, criteriaValue: null,
};

export function BadgesManager({ badges: initial }: { badges: Badge[] }) {
  const [badges, setBadges]       = useState(initial);
  const [editing, setEditing]     = useState<Badge | null>(null);
  const [creating, setCreating]   = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [form, setForm]           = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview]     = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function openCreate() {
    setForm(EMPTY);
    setPreview(null);
    setEditing(null);
    setCreating(true);
    setError(null);
  }

  function openEdit(b: Badge) {
    setForm({ key: b.key, name: b.name, description: b.description, icon: b.icon,
               color: b.color, imageUrl: b.imageUrl, criteriaType: b.criteriaType,
               criteriaValue: b.criteriaValue });
    setPreview(b.imageUrl);
    setEditing(b);
    setCreating(false);
    setError(null);
  }

  function closeForm() {
    setCreating(false);
    setEditing(null);
    setPreview(null);
    setError(null);
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/badge", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setForm((f) => ({ ...f, imageUrl: json.url }));
      setPreview(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleField(key: keyof typeof form, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function buildFormData() {
    const fd = new FormData();
    fd.set("key",           form.key);
    fd.set("name",          form.name);
    fd.set("description",   form.description);
    fd.set("icon",          form.icon);
    fd.set("color",         form.color);
    fd.set("imageUrl",      form.imageUrl ?? "");
    fd.set("criteriaType",  form.criteriaType ?? "");
    fd.set("criteriaValue", form.criteriaValue != null ? String(form.criteriaValue) : "");
    return fd;
  }

  function handleSave() {
    if (!form.name.trim() || !form.key.trim()) {
      setError("Name and Key are required.");
      return;
    }
    setError(null);
    const fd = buildFormData();
    startTransition(async () => {
      try {
        if (editing) {
          await updateBadgeAction(editing.id, fd);
          setBadges((prev) => prev.map((b) =>
            b.id === editing.id
              ? { ...b, ...form, criteriaValue: form.criteriaValue ?? null, _count: b._count }
              : b
          ));
        } else {
          await createBadgeAction(fd);
          // Refresh from server — reload page to get new id
          window.location.reload();
          return;
        }
        closeForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function handleDelete(id: string) {
    setDeleting(id);
    startTransition(async () => {
      try {
        await deleteBadgeAction(id);
        setBadges((prev) => prev.filter((b) => b.id !== id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Delete failed");
      } finally {
        setDeleting(null);
      }
    });
  }

  const showForm = creating || !!editing;
  const needsCriteriaValue = form.criteriaType === "call_count" || form.criteriaType === "streak";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Badges</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create and manage achievement badges for your sales team.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold px-4 py-2.5 transition-colors shadow-sm"
        >
          + New Badge
        </button>
      </div>

      {/* Global error */}
      {error && !showForm && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Create / Edit form */}
      {showForm && (
        <div className="rounded-2xl bg-card shadow-sm border border-border/40 overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
            <p className="font-bold text-sm">{editing ? "Edit Badge" : "Create New Badge"}</p>
            <button onClick={closeForm} className="text-xs text-muted-foreground hover:text-foreground">✕ Cancel</button>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Badge Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => {
                      handleField("name", e.target.value);
                      if (!editing) handleField("key", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
                    }}
                    placeholder="e.g. Top Caller"
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Key * <span className="normal-case font-normal">(unique slug)</span></label>
                  <input
                    value={form.key}
                    onChange={(e) => handleField("key", e.target.value.toLowerCase().replace(/[^a-z0-9_]+/g, ""))}
                    placeholder="top_caller"
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => handleField("description", e.target.value)}
                  rows={2}
                  placeholder="What does this badge represent?"
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Emoji Icon</label>
                  <input
                    value={form.icon}
                    onChange={(e) => handleField("icon", e.target.value)}
                    placeholder="🏅"
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-2xl focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                  <p className="text-[10px] text-muted-foreground">Used if no image is uploaded</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) => handleField("color", e.target.value)}
                      className="h-10 w-10 rounded-xl border border-border/60 cursor-pointer p-0.5 bg-background"
                    />
                    <input
                      value={form.color}
                      onChange={(e) => handleField("color", e.target.value)}
                      className="flex-1 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                  </div>
                </div>
              </div>

              {/* Award criteria */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Auto-Award Criteria</label>
                <select
                  value={form.criteriaType ?? ""}
                  onChange={(e) => handleField("criteriaType", e.target.value || null)}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                >
                  {CRITERIA_TYPES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {needsCriteriaValue && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {form.criteriaType === "call_count" ? "Required Call Count" : "Streak Length (days)"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.criteriaValue ?? ""}
                    onChange={(e) => handleField("criteriaValue", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="e.g. 100"
                    className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                </div>
              )}
            </div>

            {/* Right column — image upload */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Badge Image <span className="normal-case font-normal">(optional — overrides emoji)</span></label>

                {/* Preview */}
                <div className="rounded-2xl border-2 border-dashed border-border/60 p-6 flex flex-col items-center gap-3 bg-muted/10 min-h-[180px] justify-center">
                  {preview ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="relative h-24 w-24 rounded-2xl overflow-hidden border border-border/40 shadow-sm">
                        <Image src={preview} alt="Badge preview" fill className="object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => { setPreview(null); handleField("imageUrl", null); if (fileRef.current) fileRef.current.value = ""; }}
                        className="text-xs text-red-500 hover:text-red-600 font-medium"
                      >
                        Remove image
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center text-4xl">
                        {form.icon || "🏅"}
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        No image — using emoji icon<br />
                        <span className="text-[10px]">Upload to replace with a custom image</span>
                      </p>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="w-full rounded-xl border border-border/60 bg-background hover:bg-muted/30 px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {uploading ? "Uploading…" : preview ? "Change Image" : "Upload Image"}
                </button>
                <p className="text-[10px] text-muted-foreground">JPG, PNG, WEBP, GIF or SVG · Max 2MB</p>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </div>

              {/* Live preview card */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</p>
                <div className="rounded-xl bg-muted/20 p-4 flex items-center gap-3 border border-border/30">
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 text-2xl overflow-hidden"
                    style={{ backgroundColor: form.color + "22", border: `2px solid ${form.color}44` }}
                  >
                    {preview
                      ? <Image src={preview} alt="" width={48} height={48} className="object-cover w-full h-full" />
                      : <span>{form.icon || "🏅"}</span>
                    }
                  </div>
                  <div>
                    <p className="text-sm font-bold">{form.name || "Badge Name"}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{form.description || "Badge description"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form footer */}
          {error && (
            <div className="mx-6 mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 px-4 py-2.5 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
          <div className="px-6 pb-6 flex items-center justify-end gap-3">
            <button onClick={closeForm} className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isPending || uploading}
              className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-sm"
            >
              {isPending ? "Saving…" : editing ? "Save Changes" : "Create Badge"}
            </button>
          </div>
        </div>
      )}

      {/* Badge list */}
      {badges.length === 0 && !showForm ? (
        <div className="rounded-2xl bg-card shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">🏅</p>
          <p className="text-sm font-bold">No badges yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first badge to start rewarding your team.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map((b) => (
            <div key={b.id} className="rounded-2xl bg-card shadow-sm border border-border/30 p-5 flex flex-col gap-4">
              {/* Top row */}
              <div className="flex items-start gap-3">
                <div
                  className="h-14 w-14 rounded-xl flex items-center justify-center text-3xl shrink-0 overflow-hidden"
                  style={{ backgroundColor: b.color + "22", border: `2px solid ${b.color}44` }}
                >
                  {b.imageUrl
                    ? <Image src={b.imageUrl} alt={b.name} width={56} height={56} className="object-cover w-full h-full" />
                    : <span>{b.icon}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{b.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{b.key}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{b.description}</p>
                </div>
              </div>

              {/* Criteria chip */}
              <div className="flex items-center gap-2 flex-wrap">
                {b.criteriaType ? (
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                    {CRITERIA_TYPES.find((c) => c.value === b.criteriaType)?.label.split(" —")[0]}
                    {b.criteriaValue != null ? ` · ${b.criteriaValue}` : ""}
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">Manual</span>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {b._count.userBadges} earned
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1 border-t border-border/30">
                <button
                  onClick={() => openEdit(b)}
                  className="flex-1 text-xs font-semibold py-1.5 rounded-lg hover:bg-muted/40 transition-colors text-center"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(b.id)}
                  disabled={deleting === b.id}
                  className="flex-1 text-xs font-semibold py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 transition-colors text-center disabled:opacity-50"
                >
                  {deleting === b.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
