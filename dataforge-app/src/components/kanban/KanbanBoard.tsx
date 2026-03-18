"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Calendar, Tag, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createTaskAction, deleteTaskAction } from "@/actions/kanban.actions";
import { TaskDetailModal } from "./TaskDetailModal";
import type { KanbanColumn, KanbanPriority } from "@/generated/prisma/enums";
import type { KanbanTaskData as Task, KanbanUserData as User } from "./types";

const COLUMNS: { key: KanbanColumn; label: string; topColor: string; countColor: string }[] = [
  { key: "backlog",     label: "Backlog",     topColor: "border-slate-300 dark:border-slate-700",    countColor: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  { key: "in_progress", label: "In Progress", topColor: "border-blue-400 dark:border-blue-600",      countColor: "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400" },
  { key: "in_review",   label: "In Review",   topColor: "border-amber-400 dark:border-amber-600",    countColor: "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" },
  { key: "done",        label: "Done",        topColor: "border-emerald-400 dark:border-emerald-600", countColor: "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400" },
];

const PRIORITY_CONFIG: Record<KanbanPriority, { label: string; dot: string }> = {
  low:    { label: "Low",    dot: "bg-slate-400" },
  medium: { label: "Medium", dot: "bg-amber-400" },
  high:   { label: "High",   dot: "bg-rose-500" },
};

const ROLE_COLORS: Record<string, string> = {
  boss:            "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  admin:           "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400",
  sales_rep:       "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
  lead_specialist: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
};

function TaskCard({
  task,
  currentUserId,
  isAdmin,
  onDelete,
  onClick,
}: {
  task: Task;
  currentUserId: string;
  isAdmin: boolean;
  onDelete: () => void;
  onClick: () => void;
}) {
  const [, startTransition] = useTransition();
  const pc = PRIORITY_CONFIG[task.priority];
  const isAssignee = task.assignee?.id === currentUserId;
  const canDelete = isAdmin;

  return (
    <div
      onClick={onClick}
      className="rounded-lg border bg-card p-3 space-y-2.5 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`mt-0.5 h-2 w-2 rounded-full shrink-0 ${pc.dot}`} />
          <p className="text-sm font-medium leading-snug">{task.title}</p>
        </div>
        {canDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); startTransition(async () => { onDelete(); await deleteTaskAction(task.id); }); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-500 shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 pl-3.5">{task.description}</p>
      )}

      <div className="flex flex-wrap gap-1 pl-3.5">
        {task.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            <Tag className="h-2.5 w-2.5" />{tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between pl-3.5 pt-0.5 border-t">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {task.dueDate && (
            <span className="flex items-center gap-0.5">
              <Calendar className="h-3 w-3" />
              {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {task.comments.length > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {task.comments.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Assignee flag for non-admins */}
          {!isAdmin && isAssignee && task.column === "in_progress" && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              Action needed
            </span>
          )}
          {task.assignee && (
            <div
              title={task.assignee.name ?? undefined}
              className={`h-6 w-6 rounded-full text-[9px] font-bold flex items-center justify-center uppercase shrink-0 ${ROLE_COLORS[task.assignee.role ?? ""] ?? "bg-muted text-muted-foreground"}`}
            >
              {(task.assignee.name ?? "?").charAt(0)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── New Task Dialog (admin only) ── */
function NewTaskDialog({
  open,
  onClose,
  onAdd,
  allUsers,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (task: Task) => void;
  allUsers: User[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [priority, setPriority] = useState<KanbanPriority>("medium");
  const [assigneeId, setAssigneeId] = useState("none");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string).trim();
    const description = (fd.get("description") as string).trim() || undefined;
    const dueDate = (fd.get("dueDate") as string) || undefined;
    const tagsRaw = (fd.get("tags") as string).trim();
    const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];
    const resolvedAssignee = assigneeId === "none" ? undefined : assigneeId;

    if (!title) { setError("Title is required"); return; }
    setError(null);

    startTransition(async () => {
      const res = await createTaskAction({ title, description, priority, dueDate, tags, assigneeId: resolvedAssignee });
      if (res.error) { setError(res.error); return; }
      const assignee = allUsers.find((u) => u.id === resolvedAssignee) ?? null;
      onAdd({
        id: (res.task as Task | undefined)?.id ?? crypto.randomUUID(),
        title, description: description ?? null,
        column: "backlog", priority,
        dueDate: dueDate ? new Date(dueDate) : null,
        tags, position: 0,
        createdBy: { id: "", name: "You" },
        assignee: assignee ? { id: assignee.id, name: assignee.name, role: assignee.role } : null,
        comments: [],
      });
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent showCloseButton className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title <span className="text-rose-500">*</span></Label>
            <Input id="title" name="title" autoFocus placeholder="What needs to be done?" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} placeholder="More details…" className="resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as KanbanPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" name="dueDate" type="date" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Assign To</Label>
            <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v ?? "none")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Unassigned —</SelectItem>
                {allUsers.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name ?? u.id} · {u.role.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tags">Tags</Label>
            <Input id="tags" name="tags" placeholder="bug, frontend, urgent  (comma separated)" />
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Creating…</> : "Create Task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main board ── */
interface Props {
  initialTasks: Task[];
  currentUserId: string;
  isAdmin: boolean;
  allUsers: User[];
}

export function KanbanBoard({ initialTasks, currentUserId, isAdmin, allUsers }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  function handleDelete(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  function handleAdd(task: Task) {
    setTasks((prev) => [...prev, task]);
  }

  function handleTaskUpdated(updated: Task) {
    setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
    setSelectedTask(updated);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? "s" : ""} total</p>
        {isAdmin && (
          <Button size="sm" onClick={() => setNewTaskOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" /> New Task
          </Button>
        )}
      </div>

      {/* Board */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.column === col.key);
          return (
            <div key={col.key} className="flex flex-col gap-2">
              <div className={`flex items-center justify-between px-3 py-2 rounded-lg border-t-2 bg-muted/30 ${col.topColor}`}>
                <p className="text-sm font-semibold">{col.label}</p>
                <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${col.countColor}`}>{colTasks.length}</span>
              </div>

              <div className="flex flex-col gap-2 min-h-[80px]">
                {colTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    currentUserId={currentUserId}
                    isAdmin={isAdmin}
                    onDelete={() => handleDelete(task.id)}
                    onClick={() => setSelectedTask(task)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(v) => { if (!v) setSelectedTask(null); }}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          allUsers={allUsers}
          onTaskUpdated={handleTaskUpdated}
        />
      )}

      {/* New task dialog */}
      {isAdmin && (
        <NewTaskDialog
          open={newTaskOpen}
          onClose={() => setNewTaskOpen(false)}
          onAdd={handleAdd}
          allUsers={allUsers}
        />
      )}
    </>
  );
}
