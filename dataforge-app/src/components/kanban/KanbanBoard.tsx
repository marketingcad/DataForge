"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Calendar, Tag } from "lucide-react";
import { moveTaskAction, deleteTaskAction, createTaskAction } from "@/actions/kanban.actions";
import type { KanbanColumn, KanbanPriority } from "@/generated/prisma/enums";

type Task = {
  id: string;
  title: string;
  description: string | null;
  column: KanbanColumn;
  priority: KanbanPriority;
  dueDate: Date | null;
  tags: string[];
  position: number;
  createdBy: { id: string; name: string | null };
  assignee: { id: string; name: string | null } | null;
};

const COLUMNS: { key: KanbanColumn; label: string; color: string }[] = [
  { key: "backlog",     label: "Backlog",     color: "border-slate-300 dark:border-slate-700" },
  { key: "in_progress", label: "In Progress", color: "border-blue-400 dark:border-blue-600" },
  { key: "in_review",   label: "In Review",   color: "border-amber-400 dark:border-amber-600" },
  { key: "done",        label: "Done",        color: "border-emerald-400 dark:border-emerald-600" },
];

const PRIORITY_CONFIG: Record<KanbanPriority, { label: string; color: string }> = {
  low:    { label: "Low",    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  medium: { label: "Medium", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  high:   { label: "High",   color: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" },
};

function TaskCard({ task, onDelete, onMove }: { task: Task; onDelete: () => void; onMove: (col: KanbanColumn) => void }) {
  const pc = PRIORITY_CONFIG[task.priority];
  const [, startTransition] = useTransition();
  const colIndex = COLUMNS.findIndex((c) => c.key === task.column);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug flex-1">{task.title}</p>
        <button
          onClick={() => startTransition(() => { onDelete(); deleteTaskAction(task.id); })}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-500"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${pc.color}`}>
          {pc.label}
        </span>
        {task.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            <Tag className="h-2.5 w-2.5" />{tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1">
          {task.dueDate && (
            <>
              <Calendar className="h-3 w-3" />
              <span>{new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
            </>
          )}
        </div>
        {task.assignee && (
          <div className="h-5 w-5 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center uppercase">
            {(task.assignee.name ?? "?").charAt(0)}
          </div>
        )}
      </div>

      {/* Move buttons */}
      <div className="flex gap-1 pt-1 border-t">
        {colIndex > 0 && (
          <button
            onClick={() => startTransition(() => { onMove(COLUMNS[colIndex - 1].key); moveTaskAction(task.id, COLUMNS[colIndex - 1].key, task.position); })}
            className="flex-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted rounded px-1 py-0.5 transition-colors"
          >
            ← {COLUMNS[colIndex - 1].label}
          </button>
        )}
        {colIndex < COLUMNS.length - 1 && (
          <button
            onClick={() => startTransition(() => { onMove(COLUMNS[colIndex + 1].key); moveTaskAction(task.id, COLUMNS[colIndex + 1].key, task.position); })}
            className="flex-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted rounded px-1 py-0.5 transition-colors text-right"
          >
            {COLUMNS[colIndex + 1].label} →
          </button>
        )}
      </div>
    </div>
  );
}

function NewTaskForm({ column, onAdd, onClose }: { column: KanbanColumn; onAdd: (task: Task) => void; onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string).trim();
    const description = (fd.get("description") as string).trim() || undefined;
    const priority = (fd.get("priority") as KanbanPriority) || "medium";
    const dueDate = (fd.get("dueDate") as string) || undefined;
    const tagsRaw = (fd.get("tags") as string).trim();
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

    if (!title) { setError("Title is required"); return; }
    setError(null);

    startTransition(async () => {
      const res = await createTaskAction({ title, description, priority, dueDate, tags, assigneeId: undefined });
      if (res.error) { setError(res.error); return; }
      // Optimistically add a placeholder card
      onAdd({ id: crypto.randomUUID(), title, description: description ?? null, column, priority, dueDate: dueDate ? new Date(dueDate) : null, tags, position: 0, createdBy: { id: "", name: "You" }, assignee: null });
      onClose();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-3 space-y-2 shadow-sm">
      <input name="title" autoFocus placeholder="Task title…" className="w-full text-sm bg-transparent border-none outline-none font-medium placeholder:text-muted-foreground" />
      <textarea name="description" placeholder="Description (optional)" rows={2} className="w-full text-xs bg-transparent border-none outline-none resize-none text-muted-foreground placeholder:text-muted-foreground" />
      <div className="flex gap-2">
        <select name="priority" defaultValue="medium" className="text-xs bg-muted rounded px-1.5 py-1 border-none outline-none">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <input name="dueDate" type="date" className="text-xs bg-muted rounded px-1.5 py-1 border-none outline-none flex-1 min-w-0" />
      </div>
      <input name="tags" placeholder="Tags (comma separated)" className="w-full text-xs bg-transparent border-none outline-none text-muted-foreground placeholder:text-muted-foreground" />
      {error && <p className="text-xs text-rose-500">{error}</p>}
      <div className="flex gap-1.5 justify-end pt-1">
        <button type="button" onClick={onClose} className="text-xs px-2 py-1 rounded hover:bg-muted transition-colors">Cancel</button>
        <button type="submit" disabled={isPending} className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium">
          {isPending ? "Adding…" : "Add Task"}
        </button>
      </div>
    </form>
  );
}

export function KanbanBoard({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [addingTo, setAddingTo] = useState<KanbanColumn | null>(null);

  function handleMove(taskId: string, newCol: KanbanColumn) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, column: newCol } : t));
  }

  function handleDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  function handleAdd(task: Task) {
    setTasks((prev) => [...prev, task]);
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.column === col.key);
        return (
          <div key={col.key} className="flex flex-col gap-3">
            {/* Column header */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg border-t-2 bg-muted/30 ${col.color}`}>
              <p className="text-sm font-semibold">{col.label}</p>
              <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5 font-medium">{colTasks.length}</span>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 min-h-[80px]">
              {colTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onDelete={() => handleDelete(task.id)}
                  onMove={(newCol) => handleMove(task.id, newCol)}
                />
              ))}

              {addingTo === col.key && (
                <NewTaskForm
                  column={col.key}
                  onAdd={handleAdd}
                  onClose={() => setAddingTo(null)}
                />
              )}
            </div>

            {/* Add button */}
            {addingTo !== col.key && (
              <button
                onClick={() => setAddingTo(col.key)}
                className="flex items-center gap-1.5 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add task
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
