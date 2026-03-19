"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";

export function FeedbackPageSubmitButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors shrink-0"
      >
        <Plus className="h-3.5 w-3.5" />
        Submit Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border bg-card shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b">
              <p className="text-sm font-semibold">Bug / Feature Report</p>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground text-lg leading-none">×</button>
            </div>
            <FeedbackDialog onClose={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
