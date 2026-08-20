"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Bug } from "lucide-react";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";

export function FeedbackPageSubmitButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

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
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <div className="fixed top-0 right-0 z-50 h-full w-full max-w-[460px] flex flex-col bg-background border-l shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center">
                  <Bug className="h-3.5 w-3.5 text-rose-600" />
                </div>
                <p className="text-sm font-semibold">Submit a Report</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Scrollable form body */}
            <div className="flex-1 overflow-y-auto">
              <FeedbackDialog
                onClose={() => setOpen(false)}
                onSuccess={() => router.refresh()}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}
