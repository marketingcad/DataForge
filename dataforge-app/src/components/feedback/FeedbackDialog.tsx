"use client";

import { useState, useTransition } from "react";
import { Bug, Lightbulb, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitFeedbackAction } from "@/actions/feedback.actions";

interface Props {
  onClose: () => void;
}

export function FeedbackDialog({ onClose }: Props) {
  const [type, setType]     = useState<"bug" | "feature">("bug");
  const [priority, setPriority] = useState("medium");
  const [error, setError]   = useState<string | null>(null);
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
      setTimeout(onClose, 1200);
    });
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 px-6 text-center">
        <span className="text-4xl">✅</span>
        <p className="font-semibold text-sm">Report submitted!</p>
        <p className="text-xs text-muted-foreground">Thanks for the feedback. We'll look into it.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
      <div>
        <p className="text-sm font-semibold mb-1">Report type</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType("bug")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors ${type === "bug" ? "border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-600" : "hover:bg-accent"}`}
          >
            <Bug className="h-3.5 w-3.5" /> Bug Report
          </button>
          <button
            type="button"
            onClick={() => setType("feature")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors ${type === "feature" ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-600" : "hover:bg-accent"}`}
          >
            <Lightbulb className="h-3.5 w-3.5" /> Feature Request
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Priority</label>
        <div className="relative">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full appearance-none rounded-md border bg-background px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Title</label>
        <input
          name="title"
          required
          placeholder={type === "bug" ? "e.g. Login page crashes on mobile" : "e.g. Export leads to CSV"}
          className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-muted-foreground">Description</label>
        <textarea
          name="description"
          required
          rows={4}
          placeholder={type === "bug" ? "Steps to reproduce, expected vs actual behavior..." : "Describe the feature and why it would be useful..."}
          className="rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <div className="flex gap-2 justify-end pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Submitting…" : "Submit Report"}
        </Button>
      </div>
    </form>
  );
}
