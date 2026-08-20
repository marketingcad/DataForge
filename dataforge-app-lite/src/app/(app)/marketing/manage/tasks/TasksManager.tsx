"use client";

import { useState, useTransition } from "react";
import { createTaskAction, updateTaskAction, deleteTaskAction } from "@/actions/tasks.actions";

type Task = {
  id: string;
  title: string;
  description: string | null;
  targetCalls: number;
  pointReward: number;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  _count: { progress: number };
  progress: { id: string }[];
};

const toDateInput = (d: Date) => new Date(d).toISOString().slice(0, 10);
const today       = () => new Date().toISOString().slice(0, 10);
const nextWeek    = () => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); };

const EMPTY = {
  title: "", description: "", targetCalls: 50, pointReward: 100,
  startDate: today(), endDate: nextWeek(),
};

function statusBadge(task: Task) {
  const now   = Date.now();
  const start = new Date(task.startDate).getTime();
  const end   = new Date(task.endDate).getTime();
  if (now < start) return <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 uppercase tracking-wide">Upcoming</span>;
  if (now > end)   return <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wide">Ended</span>;
  return <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 uppercase tracking-wide">Active</span>;
}

export function TasksManager({ tasks: initial }: { tasks: Task[] }) {
  const [tasks, setTasks]       = useState(initial);
  const [editing, setEditing]   = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm]         = useState(EMPTY);
  const [error, setError]       = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function openCreate() {
    setForm(EMPTY); setEditing(null); setCreating(true); setError(null);
  }

  function openEdit(t: Task) {
    setForm({
      title: t.title, description: t.description ?? "",
      targetCalls: t.targetCalls, pointReward: t.pointReward,
      startDate: toDateInput(t.startDate), endDate: toDateInput(t.endDate),
    });
    setEditing(t); setCreating(false); setError(null);
  }

  function closeForm() { setCreating(false); setEditing(null); setError(null); }

  function f(key: keyof typeof EMPTY, val: unknown) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  function buildFd() {
    const fd = new FormData();
    fd.set("title",       form.title);
    fd.set("description", form.description);
    fd.set("targetCalls", String(form.targetCalls));
    fd.set("pointReward", String(form.pointReward));
    fd.set("startDate",   form.startDate);
    fd.set("endDate",     form.endDate);
    return fd;
  }

  function handleSave() {
    if (!form.title.trim()) { setError("Title is required."); return; }
    if (form.targetCalls < 1) { setError("Target calls must be at least 1."); return; }
    if (new Date(form.startDate) >= new Date(form.endDate)) { setError("End date must be after start date."); return; }
    setError(null);
    startTransition(async () => {
      try {
        if (editing) {
          await updateTaskAction(editing.id, buildFd());
          setTasks((prev) => prev.map((t) =>
            t.id === editing.id
              ? { ...t, title: form.title, description: form.description || null,
                  targetCalls: form.targetCalls, pointReward: form.pointReward,
                  startDate: new Date(form.startDate), endDate: new Date(form.endDate) }
              : t
          ));
          closeForm();
        } else {
          await createTaskAction(buildFd());
          window.location.reload();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  function handleDelete(id: string) {
    setDeleting(id);
    startTransition(async () => {
      try {
        await deleteTaskAction(id);
        setTasks((prev) => prev.filter((t) => t.id !== id));
      } finally {
        setDeleting(null);
      }
    });
  }

  const showForm = creating || !!editing;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-black tracking-tight">Challenges</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage team challenges and missions.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2.5 transition-colors shadow-sm">
          + New Challenge
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="rounded-2xl bg-card shadow-sm border border-border/40 overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
            <p className="font-bold text-sm">{editing ? "Edit Challenge" : "Create New Challenge"}</p>
            <button onClick={closeForm} className="text-xs text-muted-foreground hover:text-foreground">✕ Cancel</button>
          </div>
          <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Title *</label>
                <input value={form.title} onChange={(e) => f("title", e.target.value)} placeholder="e.g. 50 Calls Week" className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</label>
                <textarea value={form.description} onChange={(e) => f("description", e.target.value)} rows={3} placeholder="Describe the challenge…" className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Target Calls</label>
                  <input type="number" min={1} value={form.targetCalls} onChange={(e) => f("targetCalls", parseInt(e.target.value) || 1)} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Point Reward</label>
                  <input type="number" min={1} value={form.pointReward} onChange={(e) => f("pointReward", parseInt(e.target.value) || 1)} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Date</label>
                  <input type="date" value={form.startDate} onChange={(e) => f("startDate", e.target.value)} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">End Date</label>
                  <input type="date" value={form.endDate} onChange={(e) => f("endDate", e.target.value)} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
                </div>
              </div>
              <div className="rounded-xl bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
                💡 Reps earn <strong>{form.pointReward} points</strong> upon reaching <strong>{form.targetCalls} calls</strong>.
              </div>
            </div>
          </div>
          {error && <div className="mx-6 mb-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 px-4 py-2.5 text-sm text-red-700">{error}</div>}
          <div className="px-6 pb-6 flex justify-end gap-3">
            <button onClick={closeForm} className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted/40 transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={isPending} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-sm">
              {isPending ? "Saving…" : editing ? "Save Changes" : "Create Challenge"}
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      {tasks.length === 0 && !showForm ? (
        <div className="rounded-2xl bg-card shadow-sm p-12 text-center">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-sm font-bold">No challenges yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create a challenge to motivate your team.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tasks.map((task) => {
            const completed = task.progress.length;
            const total     = task._count.progress;
            return (
              <div key={task.id} className="rounded-2xl bg-card shadow-sm border border-border/30 p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm">{task.title}</p>
                      {statusBadge(task)}
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>}
                  </div>
                  <span className="shrink-0 text-xs font-bold text-violet-600 bg-violet-500/10 px-2.5 py-1 rounded-full whitespace-nowrap">
                    +{task.pointReward} pts
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-xl bg-muted/20 px-3 py-2">
                    <p className="text-sm font-black">{task.targetCalls}</p>
                    <p className="text-[10px] text-muted-foreground">target calls</p>
                  </div>
                  <div className="rounded-xl bg-muted/20 px-3 py-2">
                    <p className="text-sm font-black">{total}</p>
                    <p className="text-[10px] text-muted-foreground">enrolled</p>
                  </div>
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 px-3 py-2">
                    <p className="text-sm font-black text-emerald-600">{completed}</p>
                    <p className="text-[10px] text-muted-foreground">completed</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>📅 {new Date(task.startDate).toLocaleDateString()} — {new Date(task.endDate).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-2 pt-1 border-t border-border/30">
                  <button onClick={() => openEdit(task)} className="flex-1 text-xs font-semibold py-1.5 rounded-lg hover:bg-muted/40 transition-colors text-center">Edit</button>
                  <button onClick={() => handleDelete(task.id)} disabled={deleting === task.id} className="flex-1 text-xs font-semibold py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 transition-colors text-center disabled:opacity-50">
                    {deleting === task.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
