"use client";

import { useState, useTransition } from "react";
import { Bug, Lightbulb, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { submitFeedbackAction } from "@/actions/feedback.actions";

interface Props {
  onClose: () => void;
}

export function FeedbackDialog({ onClose }: Props) {
  const [type, setType] = useState<"bug" | "feature">("bug");
  const [priority, setPriority] = useState("medium");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("type", type);
    fd.set("priority", priority);
    setError(null);

    startTransition(async () => {
      const res = await submitFeedbackAction(fd);
      if (res.error) { setError(res.error); return; }
      setSuccess(true);
      setTimeout(onClose, 1500);
    });
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
        <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        </div>
        <div>
          <p className="font-semibold text-sm">Report submitted!</p>
          <p className="text-xs text-muted-foreground mt-1">Thanks for the feedback. We'll look into it.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">

      {/* Type toggle */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Report type</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType("bug")}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-medium transition-all ${
              type === "bug"
                ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-600 shadow-sm"
                : "border-border hover:border-muted-foreground/30 hover:bg-accent text-muted-foreground"
            }`}
          >
            <Bug className="h-4 w-4" />
            Bug Report
          </button>
          <button
            type="button"
            onClick={() => setType("feature")}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-medium transition-all ${
              type === "feature"
                ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-600 shadow-sm"
                : "border-border hover:border-muted-foreground/30 hover:bg-accent text-muted-foreground"
            }`}
          >
            <Lightbulb className="h-4 w-4" />
            Feature Request
          </button>
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="feedback-title">Title</Label>
        <Input
          id="feedback-title"
          name="title"
          required
          placeholder={type === "bug" ? "e.g. Login page crashes on mobile" : "e.g. Export leads to CSV"}
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="feedback-desc">Description</Label>
        <Textarea
          id="feedback-desc"
          name="description"
          required
          rows={4}
          placeholder={
            type === "bug"
              ? "Steps to reproduce, expected vs actual behavior…"
              : "Describe the feature and why it would be useful…"
          }
          className="resize-none"
        />
      </div>

      {/* Priority */}
      <div className="space-y-1.5">
        <Label>Priority</Label>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="low">🟢 Low</SelectItem>
            <SelectItem value="medium">🟡 Medium</SelectItem>
            <SelectItem value="high">🔴 High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[110px]">
          {isPending ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Submitting…
            </span>
          ) : "Submit Report"}
        </Button>
      </div>
    </form>
  );
}
