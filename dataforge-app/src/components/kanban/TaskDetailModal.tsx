"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/components/ui/combobox";
import {
  Calendar, User as UserIcon, CheckCircle2, RotateCcw, Send,
  Clock, MessageSquare, Loader2,
} from "lucide-react";
import { moveTaskAction, addCommentAction, updateTaskAction } from "@/actions/kanban.actions";
import { ContextPicker } from "./ContextPicker";
import type { KanbanColumn, KanbanPriority } from "@/generated/prisma/enums";
import type { KanbanTaskData as Task, KanbanCommentData as Comment, KanbanUserData as User } from "./types";

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

const PRIORITY_CONFIG: Record<KanbanPriority, { label: string; color: string }> = {
  low:    { label: "Low",    color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
  medium: { label: "Medium", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" },
  high:   { label: "High",   color: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400" },
};

const ROLE_COLORS: Record<string, string> = {
  boss:            "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  admin:           "bg-violet-100 text-violet-800 dark:bg-violet-950/40 dark:text-violet-400",
  sales_rep:       "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
  lead_specialist: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
};

function Avatar({ name, role }: { name: string | null; role?: string }) {
  return (
    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${ROLE_COLORS[role ?? ""] ?? "bg-muted text-muted-foreground"}`}>
      {(name ?? "?").charAt(0).toUpperCase()}
    </div>
  );
}

interface Props {
  task: Task;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isAdmin: boolean;
  currentUserId: string;
  allUsers: User[];
  onTaskUpdated: (task: Task) => void;
}

export function TaskDetailModal({ task: initialTask, open, onOpenChange, isAdmin, currentUserId, allUsers, onTaskUpdated }: Props) {
  const [task, setTask] = useState<Task>(initialTask);
  const [comments, setComments] = useState<Comment[]>(initialTask.comments);
  const [commentText, setCommentText] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const [isMoving, startMoving] = useTransition();
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description ?? "");
  const [editPriority, setEditPriority] = useState<KanbanPriority>(task.priority);
  const [editDueDate, setEditDueDate] = useState<Date | undefined>(task.dueDate ? new Date(task.dueDate) : undefined);
  const [editAssigneeId, setEditAssigneeId] = useState<string | null>(task.assignee?.id ?? null);
  const [editTags, setEditTags] = useState<string[]>(task.tags);
  const endRef = useRef<HTMLDivElement>(null);

  // Sync when task prop changes
  useEffect(() => {
    setTask(initialTask);
    setComments(initialTask.comments);
  }, [initialTask]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  const isAssignee = task.assignee?.id === currentUserId;
  const canSubmitQA = !isAdmin && isAssignee && task.column === "in_progress";
  const canApprove  = isAdmin && task.column === "in_review";
  const canSendBack = isAdmin && (task.column === "in_review" || task.column === "done");

  function handleMove(col: KanbanColumn) {
    startMoving(async () => {
      const res = await moveTaskAction(task.id, col);
      if (res.success && res.task) {
        const updated = { ...task, column: col, comments };
        setTask(updated);
        onTaskUpdated(updated);
      }
    });
  }

  function handleComment() {
    if (!commentText.trim()) return;
    const text = commentText.trim();
    setCommentText("");
    startTransition(async () => {
      const res = await addCommentAction(task.id, text);
      if (res.success && res.comment) {
        setComments((prev) => [...prev, res.comment as Comment]);
      }
    });
  }

  function handleSaveEdit() {
    startSaving(async () => {
      const res = await updateTaskAction(task.id, {
        title: editTitle,
        description: editDesc || undefined,
        priority: editPriority,
        dueDate: editDueDate ? editDueDate.toISOString().split("T")[0] : null,
        assigneeId: editAssigneeId,
        tags: editTags,
      });
      if (res.success && res.task) {
        const updated = {
          ...res.task as unknown as Task,
          comments,
        };
        setTask(updated);
        onTaskUpdated(updated);
        setEditMode(false);
      }
    });
  }

  const pc = PRIORITY_CONFIG[task.priority];
  const assignableUsers = allUsers.filter((u) => u.role === "sales_rep" || u.role === "lead_specialist" || u.role === "admin" || u.role === "boss");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b">
          <DialogHeader>
            {editMode ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-base font-semibold h-auto py-1"
              />
            ) : (
              <DialogTitle className="text-base font-semibold leading-snug pr-6">{task.title}</DialogTitle>
            )}
          </DialogHeader>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${pc.color}`}>
              {pc.label}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              task.column === "backlog"     ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" :
              task.column === "in_progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" :
              task.column === "in_review"   ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
              "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
            }`}>
              {task.column === "backlog" ? "Backlog" : task.column === "in_progress" ? "In Progress" : task.column === "in_review" ? "In Review" : "Done"}
            </span>
            {task.dueDate && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            )}
            {task.tags.map((t) => (
              <span key={t} className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${getTagColor(t)}`}>
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Description */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Description</Label>
            {editMode ? (
              <Textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                placeholder="Task description…"
                className="resize-none text-sm"
              />
            ) : (
              <p className="text-sm text-muted-foreground">{task.description || "No description."}</p>
            )}
          </div>

          {/* Edit fields (admin only) */}
          {editMode && isAdmin && (
            <div className="space-y-4">
              {/* Labels with @Add context */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Labels</Label>
                <div className="rounded-lg border bg-muted/20 px-3 py-2 flex flex-wrap items-center gap-1.5 min-h-9">
                  <ContextPicker selected={editTags} onChange={setEditTags} />
                  {editTags.map((tag) => (
                    <span key={tag} className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${getTagColor(tag)}`}>
                      {tag}
                      <button type="button" onClick={() => setEditTags((p) => p.filter((t) => t !== tag))} className="opacity-60 hover:opacity-100">×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">Priority</Label>
                  <Select value={editPriority} onValueChange={(v) => setEditPriority(v as KanbanPriority)}>
                    <SelectTrigger className="w-full h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">🟢 Low</SelectItem>
                      <SelectItem value="medium">🟡 Medium</SelectItem>
                      <SelectItem value="high">🔴 High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground font-medium">Due Date</Label>
                  <DatePicker
                    value={editDueDate}
                    onChange={setEditDueDate}
                    placeholder="Pick a date"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-medium">Assign To</Label>
                <Combobox value={editAssigneeId} onValueChange={(v) => setEditAssigneeId(v)}>
                  <ComboboxInput placeholder="Search team member…" showClear className="w-full" />
                  <ComboboxContent>
                    <ComboboxEmpty>No members found.</ComboboxEmpty>
                    <ComboboxList>
                      {assignableUsers.map((u) => (
                        <ComboboxItem key={u.id} value={u.id}>
                          {u.name ?? u.id} · {u.role.replace("_", " ")}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
            </div>
          )}

          {/* Assignee display (when not editing) */}
          {!editMode && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Assigned to</span>
              </div>
              {task.assignee ? (
                <div className="flex items-center gap-2">
                  <Avatar name={task.assignee.name} role={task.assignee.role} />
                  <span className="text-sm font-medium">{task.assignee.name ?? "Unknown"}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${ROLE_COLORS[task.assignee.role ?? ""] ?? "bg-muted text-muted-foreground"}`}>
                    {(task.assignee.role ?? "").replace("_", " ")}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Unassigned</span>
              )}
            </div>
          )}

          <Separator />

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {canSubmitQA && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                onClick={() => handleMove("in_review")}
                disabled={isMoving}
              >
                {isMoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
                Submit for QA Review
              </Button>
            )}
            {canApprove && (
              <Button
                size="sm"
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => handleMove("done")}
                disabled={isMoving}
              >
                {isMoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Approve & Mark Done
              </Button>
            )}
            {canSendBack && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-rose-400 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={() => handleMove("in_progress")}
                disabled={isMoving}
              >
                {isMoving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                Send Back to In Progress
              </Button>
            )}
            {isAdmin && !editMode && (
              <Button size="sm" variant="ghost" onClick={() => setEditMode(true)} className="ml-auto">
                Edit Task
              </Button>
            )}
            {editMode && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditMode(false)} className="ml-auto">Cancel</Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Save Changes
                </Button>
              </>
            )}
          </div>

          <Separator />

          {/* Comments */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Comments ({comments.length})
              </p>
            </div>

            <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No comments yet.</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar name={c.author.name} role={c.author.role} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-semibold">{c.author.name ?? "Unknown"}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-sm mt-0.5 leading-snug">{c.content}</p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>

            {/* Add comment */}
            <div className="flex gap-2 pt-1">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment…"
                rows={2}
                className="resize-none text-sm flex-1"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
              />
              <Button size="icon" onClick={handleComment} disabled={isPending || !commentText.trim()} className="self-end shrink-0">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
