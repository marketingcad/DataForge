"use client";

import { useState, useTransition, useRef } from "react";
import { Plus, Trash2, Calendar, MessageSquare, Loader2, Paperclip, ArrowUp, Globe, X, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import { ContextPicker, PREDEFINED_LABELS } from "./ContextPicker";
import { createTaskAction, deleteTaskAction } from "@/actions/kanban.actions";
import { TaskDetailModal } from "./TaskDetailModal";
import type { KanbanColumn, KanbanPriority } from "@/generated/prisma/enums";
import type { KanbanTaskData as Task, KanbanUserData as User } from "./types";

const COLUMNS: { key: KanbanColumn; label: string; accent: string; countClass: string }[] = [
  { key: "backlog",     label: "Backlog",     accent: "bg-slate-400 dark:bg-slate-500",    countClass: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  { key: "in_progress", label: "In Progress", accent: "bg-blue-500",                       countClass: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300" },
  { key: "in_review",   label: "In Review",   accent: "bg-amber-400",                      countClass: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  { key: "done",        label: "Done",        accent: "bg-emerald-500",                    countClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" },
];

const PRIORITY_CONFIG: Record<KanbanPriority, { label: string; pill: string }> = {
  low:    { label: "Low",    pill: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" },
  medium: { label: "Medium", pill: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300" },
  high:   { label: "High",   pill: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300" },
};

const ROLE_COLORS: Record<string, string> = {
  boss:            "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  admin:           "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400",
  sales_rep:       "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
  lead_specialist: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
};

const TAG_PALETTE = [
  "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
];

function getTagColor(tag: string) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_PALETTE[Math.abs(hash) % TAG_PALETTE.length];
}

function getInitials(name: string | null) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

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

  return (
    <div
      onClick={onClick}
      className="rounded-xl border bg-card px-4 py-3.5 space-y-3 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
      {/* Tags row */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {task.tags.slice(0, 4).map((tag) => (
            <span key={tag} className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${getTagColor(tag)}`}>
              {tag}
            </span>
          ))}
          {task.tags.length > 4 && (
            <span className="text-[11px] text-muted-foreground self-center">+{task.tags.length - 4}</span>
          )}
        </div>
      )}

      {/* Title + delete */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-snug">{task.title}</p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{task.description}</p>
          )}
        </div>
        {isAdmin && (
          <button
            onClick={(e) => { e.stopPropagation(); startTransition(async () => { onDelete(); await deleteTaskAction(task.id); }); }}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-rose-500 shrink-0 mt-0.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Bottom row: priority + date + comments + avatar */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${pc.pill}`}>
            {pc.label}
          </span>
          {task.dueDate && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          )}
          {task.comments.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              {task.comments.length}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!isAdmin && isAssignee && task.column === "in_progress" && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              Action needed
            </span>
          )}
          {task.assignee && (
            <div
              title={task.assignee.name ?? undefined}
              className={`h-7 w-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${ROLE_COLORS[task.assignee.role ?? ""] ?? "bg-muted text-muted-foreground"}`}
            >
              {getInitials(task.assignee.name)}
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
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [tags, setTags] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  function toggleTag(label: string) {
    setTags((prev) => prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = (fd.get("title") as string).trim();
    const description = (fd.get("description") as string).trim() || undefined;
    const resolvedAssignee = assigneeId || undefined;

    if (!title) { setError("Title is required"); titleRef.current?.focus(); return; }
    setError(null);

    startTransition(async () => {
      const res = await createTaskAction({
        title, description, priority,
        dueDate: dueDate?.toISOString().split("T")[0],
        tags, assigneeId: resolvedAssignee,
      });
      if (res.error) { setError(res.error); return; }
      const assignee = allUsers.find((u) => u.id === resolvedAssignee) ?? null;
      onAdd({
        id: (res.task as Task | undefined)?.id ?? crypto.randomUUID(),
        title, description: description ?? null,
        column: "backlog", priority,
        dueDate: dueDate ?? null,
        tags, position: 0,
        createdBy: { id: "", name: "You" },
        assignee: assignee ? { id: assignee.id, name: assignee.name, role: assignee.role } : null,
        comments: [],
      });
      setPriority("medium");
      setAssigneeId(null);
      setDueDate(undefined);
      setTags([]);
      setAttachments([]);
      onClose();
    });
  }

  const PRIORITY_ICONS: Record<KanbanPriority, string> = { low: "🟢", medium: "🟡", high: "🔴" };
  const assignee = allUsers.find((u) => u.id === assigneeId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent showCloseButton={false} className="max-w-lg p-0 gap-0 overflow-hidden rounded-2xl shadow-2xl">
        <form onSubmit={handleSubmit}>

          {/* ── Top: @context + title + description ── */}
          <div className="px-4 pt-4 pb-2">
            {/* Header row: @context + chips + close */}
            <div className="flex items-start gap-2 mb-3">
              <ContextPicker selected={tags} onChange={setTags} />
              <div className="flex flex-wrap gap-1.5 flex-1">
                {tags.map((tag) => (
                  <span key={tag} className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${getTagColor(tag)}`}>
                    {tag}
                    <button type="button" onClick={() => toggleTag(tag)} className="opacity-60 hover:opacity-100 leading-none">×</button>
                  </span>
                ))}
              </div>
              <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Borderless title */}
            <input
              ref={titleRef}
              name="title"
              autoFocus
              placeholder="Task title…"
              className="w-full bg-transparent border-none outline-none text-[15px] font-semibold placeholder:text-muted-foreground/50 mb-1"
            />

            {/* Borderless description textarea */}
            <textarea
              name="description"
              rows={3}
              placeholder="Ask, search, or make anything…"
              className="w-full bg-transparent border-none outline-none resize-none text-sm text-foreground/80 placeholder:text-muted-foreground/50 leading-relaxed"
            />
          </div>

          {/* ── Category pills ── */}
          <div className="px-4 py-3 border-t border-border/40">
            <div className="flex flex-wrap gap-2">
              {PREDEFINED_LABELS.map((cat) => {
                const isSelected = tags.includes(cat.label);
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => toggleTag(cat.label)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      isSelected
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                    }`}
                  >
                    {isSelected && <CheckIcon className="h-3 w-3 shrink-0" />}
                    <span>{cat.emoji}</span>
                    {cat.display}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Metadata: Priority, Date, Assignee ── */}
          <div className="px-4 py-3 border-t border-border/40">
            <div className="grid grid-cols-3 gap-2">
              <Select value={priority} onValueChange={(v) => setPriority(v as KanbanPriority)}>
                <SelectTrigger className="h-8 text-xs gap-1.5 border-border/50">
                  <span>{PRIORITY_ICONS[priority]}</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">🟢 Low</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="high">🔴 High</SelectItem>
                </SelectContent>
              </Select>

              <DatePicker value={dueDate} onChange={setDueDate} placeholder="📅 Due date" className="h-8 text-xs border-border/50" />

              <Combobox value={assigneeId} onValueChange={(v) => setAssigneeId(v)}>
                <ComboboxInput
                  placeholder={assignee ? undefined : "👤 Assign…"}
                  showClear={!!assigneeId}
                  className="h-8 text-xs w-full border-border/50"
                />
                <ComboboxContent>
                  <ComboboxEmpty>No members found.</ComboboxEmpty>
                  <ComboboxList>
                    {allUsers.map((u) => (
                      <ComboboxItem key={u.id} value={u.id}>
                        <span className={`h-5 w-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 ${
                          u.role === "boss" ? "bg-amber-100 text-amber-800" :
                          u.role === "admin" ? "bg-violet-100 text-violet-800" :
                          u.role === "sales_rep" ? "bg-blue-100 text-blue-800" :
                          "bg-emerald-100 text-emerald-800"
                        }`}>{getInitials(u.name)}</span>
                        {u.name ?? u.id}
                        <span className="text-xs text-muted-foreground ml-auto">{u.role.replace("_", " ")}</span>
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>

            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {attachments.map((f, i) => (
                  <span key={i} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                    <Paperclip className="h-3 w-3" />{f.name}
                    <button type="button" onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))} className="opacity-60 hover:opacity-100">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── Bottom toolbar ── */}
          <div className="flex items-center gap-3 px-4 py-3 border-t border-border/40">
            {/* Attach */}
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => setAttachments((p) => [...p, ...Array.from(e.target.files ?? [])])} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <span className="text-sm text-muted-foreground select-none">Auto</span>

            <span className="flex items-center gap-1 text-sm text-muted-foreground select-none">
              <Globe className="h-3.5 w-3.5" /> All Sources
            </span>

            {error && <p className="text-xs text-rose-500 flex-1">{error}</p>}

            {/* Send / submit */}
            <div className="ml-auto">
              <Button
                type="submit"
                size="icon"
                disabled={isPending}
                className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 shadow-md shadow-primary/30"
              >
                {isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <ArrowUp className="h-4 w-4" />
                }
              </Button>
            </div>
          </div>

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
        {COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.column === col.key);
          return (
            <div key={col.key} className="flex flex-col gap-3">
              {/* Column header */}
              <div className="flex items-center gap-2.5 px-1">
                <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${col.accent}`} />
                <p className="text-sm font-semibold flex-1">{col.label}</p>
                <span className={`text-xs font-semibold rounded-full min-w-[22px] text-center px-1.5 py-0.5 ${col.countClass}`}>
                  {colTasks.length}
                </span>
              </div>

              {/* Task cards */}
              <div className="flex flex-col gap-3 min-h-[80px]">
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
