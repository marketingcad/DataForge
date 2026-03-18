"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function LeadsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
      <AlertTriangle className="h-10 w-10 text-muted-foreground/30" />
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-foreground">Failed to load leads</p>
        <p className="text-xs max-w-xs">Database connection timed out. This is usually temporary.</p>
      </div>
      <Button size="sm" variant="outline" className="gap-1.5" onClick={reset}>
        <RefreshCw className="h-3.5 w-3.5" /> Try again
      </Button>
    </div>
  );
}
