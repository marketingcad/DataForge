"use client";

import { useState, useEffect, useTransition } from "react";
import { Share2, Copy, Loader2, Link2Off, Check } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { generateReportsShareTokenAction, revokeReportsShareTokenAction } from "@/actions/reports.actions";

export function ShareReportButton({ initialToken }: { initialToken: string | null }) {
  const [token, setToken] = useState<string | null>(initialToken);
  const [origin, setOrigin] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const link = token && origin ? `${origin}/share/reports/${token}` : "";

  function copyLink() {
    start(async () => {
      try {
        let t = token;
        if (!t) {
          const res = await generateReportsShareTokenAction();
          t = res.token;
          setToken(t);
        }
        await navigator.clipboard.writeText(`${origin}/share/reports/${t}`);
        toast.success("Shareable link copied — anyone with it can view this table.");
      } catch {
        toast.error("Couldn't create the share link. Please try again.");
      }
    });
  }

  function revoke() {
    start(async () => {
      try {
        await revokeReportsShareTokenAction();
        setToken(null);
        toast.success("Share link disabled.");
      } catch {
        toast.error("Couldn't disable the link. Please try again.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-accent transition-colors disabled:opacity-50"
        disabled={pending}
      >
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
        Share
        {token && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Share link active" />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem className="text-xs cursor-pointer gap-2" onClick={copyLink} disabled={pending}>
          <Copy className="h-3.5 w-3.5" />
          {token ? "Copy shareable link" : "Create & copy shareable link"}
        </DropdownMenuItem>
        {token && (
          <>
            <div className="px-2 py-1.5 text-[10px] text-muted-foreground break-all select-all border-y border-border/40 my-1">
              {link || "…"}
            </div>
            <div className="px-2 pb-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Check className="h-3 w-3 text-emerald-500" /> Public, read-only — popups disabled.
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-xs cursor-pointer gap-2 text-destructive" onClick={revoke} disabled={pending}>
              <Link2Off className="h-3.5 w-3.5" />
              Disable link
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
