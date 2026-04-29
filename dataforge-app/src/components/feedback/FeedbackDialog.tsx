"use client";

import { useState, useTransition } from "react";
import { Bug, Lightbulb, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitFeedbackAction } from "@/actions/feedback.actions";
import { cn } from "@/lib/utils";

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

const AREAS = [
  "Dashboard",
  "Leads",
  "Scraping",
  "Marketing",
  "Commissions",
  "Kanban",
  "Calendar",
  "Reports",
  "Profile",
  "Settings",
  "Admin / Users",
  "Notifications",
  "Other",
];

const PRIORITIES = [
  { value: "low",    label: "Low",    color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", dot: "bg-emerald-500" },
  { value: "medium", label: "Medium", color: "bg-amber-500/10 text-amber-600 border-amber-200",       dot: "bg-amber-500"   },
  { value: "high",   label: "High",   color: "bg-red-500/10 text-red-600 border-red-200",             dot: "bg-red-500"     },
];

export function FeedbackDialog({ onClose, onSuccess }: Props) {
  const [type, setType]         = useState<"bug" | "feature">("bug");
  const [priority, setPriority] = useState("medium");
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState(false);
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
      onSuccess?.();
      setTimeout(onClose, 2000);
    });
  }

  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-14 px-6 text-center">
        <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center ring-4 ring-emerald-100 dark:ring-emerald-950">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <div className="space-y-1">
          <p className="font-bold text-base">Report submitted!</p>
          <p className="text-sm text-muted-foreground">
            Thanks for the feedback — we'll review it shortly.
          </p>
        </div>
      </div>
    );
  }

  const isBug = type === "bug";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col">

      {/* ── Type selector ──────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-4">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 block">
          Report type
        </Label>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { value: "bug",     label: "Bug Report",       Icon: Bug,       active: "border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-600",       inactive: "hover:bg-muted/40" },
            { value: "feature", label: "Feature Request",  Icon: Lightbulb, active: "border-violet-500 bg-violet-50 dark:bg-violet-950/30 text-violet-600", inactive: "hover:bg-muted/40" },
          ].map(({ value, label, Icon, active, inactive }) => (
            <button
              key={value}
              type="button"
              onClick={() => setType(value as "bug" | "feature")}
              className={cn(
                "flex items-center justify-center gap-2.5 rounded-xl border-2 py-3.5 text-sm font-semibold transition-all",
                type === value ? active : `border-border text-muted-foreground ${inactive}`
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* ── Main fields ────────────────────────────────────────────────── */}
      <div className="px-6 py-5 space-y-4">

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="fb-title" className="text-xs font-semibold">
            Title <span className="text-red-500">*</span>
          </Label>
          <Input
            id="fb-title"
            name="title"
            required
            maxLength={120}
            placeholder={isBug ? "e.g. Leads page crashes on Safari" : "e.g. Export leads to CSV"}
            className="h-9"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="fb-desc" className="text-xs font-semibold">
            {isBug ? "Description & Steps to Reproduce" : "Description"}{" "}
            <span className="text-red-500">*</span>
          </Label>
          <Textarea
            id="fb-desc"
            name="description"
            required
            rows={4}
            className="resize-none text-sm"
            placeholder={
              isBug
                ? "1. Go to …\n2. Click on …\n3. Observe …\n\nExpected: …\nActual: …"
                : "Describe the feature and the problem it solves for you…"
            }
          />
        </div>

        {/* Bug-specific fields */}
        {isBug && (
          <div className="space-y-1.5">
            <Label htmlFor="fb-expected" className="text-xs font-semibold">
              Expected vs Actual Behavior
            </Label>
            <Textarea
              id="fb-expected"
              name="expectedBehavior"
              rows={2}
              className="resize-none text-sm"
              placeholder="Expected: …  /  Actual: …"
            />
          </div>
        )}

        {/* Affected area + Priority row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Affected Area</Label>
            <Select name="area" defaultValue="Other">
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Select area" />
              </SelectTrigger>
              <SelectContent>
                {AREAS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Priority</Label>
            <div className="flex gap-1.5 pt-1">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 rounded-lg border py-1.5 text-[11px] font-bold transition-all",
                    priority === p.value ? p.color : "border-border text-muted-foreground hover:bg-muted/40"
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", priority === p.value ? p.dot : "bg-muted-foreground")} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Feature-specific: use case */}
        {!isBug && (
          <div className="space-y-1.5">
            <Label htmlFor="fb-usecase" className="text-xs font-semibold">
              Who would benefit from this?
            </Label>
            <Input
              id="fb-usecase"
              name="useCase"
              placeholder="e.g. Sales reps exporting leads for outreach"
              className="h-9 text-sm"
            />
          </div>
        )}

        {/* Current badge summary */}
        <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5">
          {isBug
            ? <Bug className="h-3.5 w-3.5 text-rose-500 shrink-0" />
            : <Lightbulb className="h-3.5 w-3.5 text-violet-500 shrink-0" />}
          <p className="text-xs text-muted-foreground flex-1">
            Submitting a <strong>{isBug ? "Bug Report" : "Feature Request"}</strong> with{" "}
            <strong>{PRIORITIES.find((p) => p.value === priority)?.label}</strong> priority.
          </p>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {priority}
          </Badge>
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-6 mb-4 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-2.5">
          <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* ── Footer actions ─────────────────────────────────────────────── */}
      <Separator />
      <div className="flex gap-2 justify-end px-6 py-4">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={isPending}
          className={cn(
            "min-w-[120px] font-semibold",
            isBug
              ? "bg-rose-600 hover:bg-rose-700 text-white"
              : "bg-violet-600 hover:bg-violet-700 text-white"
          )}
        >
          {isPending ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Submitting…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              {isBug ? <Bug className="h-3.5 w-3.5" /> : <Lightbulb className="h-3.5 w-3.5" />}
              Submit {isBug ? "Bug" : "Request"}
            </span>
          )}
        </Button>
      </div>
    </form>
  );
}
