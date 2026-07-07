"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Trash2, Loader2 } from "lucide-react";
import { deleteAllUnfiledLeadsAction } from "@/actions/leads.actions";
import { toast } from "sonner";

/** Deletes every folder-less lead in one shot (not just the current page). */
export function DeleteAllUnfiledButton({ count }: { count: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await deleteAllUnfiledLeadsAction();
      toast.success(`${res.count.toLocaleString()} unfiled lead${res.count !== 1 ? "s" : ""} deleted`);
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete unfiled leads. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Delete all {count.toLocaleString()} unfiled
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!deleting) setOpen(o); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete all {count.toLocaleString()} unfiled lead{count !== 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently removes every lead that isn&apos;t in a folder — across all pages, not just this one. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-1.5">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
