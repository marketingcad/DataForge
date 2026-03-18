"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";

export function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        title="Report a bug or request a feature"
      >
        <Flag className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3.5 border-b">
              <div className="flex items-center gap-2">
                <Flag className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">Bug / Feature Report</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>
            <FeedbackDialog onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
