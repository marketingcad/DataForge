"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QualityBadge } from "./QualityBadge";
import { StatusBadge } from "./StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Users, Trash2, Loader2 } from "lucide-react";
import { bulkDeleteLeadsAction } from "@/actions/leads.actions";
import { toast } from "sonner";

interface Lead {
  id: string;
  businessName: string;
  phone: string;
  email: string | null;
  website: string | null;
  contactPerson: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  source: string;
  dataQualityScore: number;
  duplicateFlag: boolean;
  recordStatus: "active" | "flagged" | "invalid";
  industriesFoundIn: string[];
}

export function LeadTable({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-20 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Users className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium">No leads found</p>
          <p className="text-xs text-muted-foreground mt-0.5">Try adjusting your filters or add a new lead.</p>
        </div>
      </div>
    );
  }

  const allSelected = leads.every((l) => selected.has(l.id));
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(leads.map((l) => l.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const ids = [...selected];
      await bulkDeleteLeadsAction(ids);
      toast.success(`${ids.length} lead${ids.length !== 1 ? "s" : ""} deleted`);
      setSelected(new Set());
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete leads. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-2">
      {/* Bulk-action bar — only when at least one lead is selected */}
      {someSelected && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete {selected.size}
          </Button>
        </div>
      )}

    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
            </TableHead>
            <TableHead className="font-semibold">Business</TableHead>
            <TableHead className="font-semibold">Phone</TableHead>
            <TableHead className="font-semibold">Email</TableHead>
            <TableHead className="font-semibold">Location</TableHead>
            <TableHead className="font-semibold">Industry</TableHead>
            <TableHead className="font-semibold">Quality</TableHead>
            <TableHead className="font-semibold">Status</TableHead>
            <TableHead className="text-right font-semibold">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow
              key={lead.id}
              data-state={selected.has(lead.id) ? "selected" : undefined}
              className={lead.duplicateFlag ? "bg-rose-50/60 dark:bg-rose-950/20 border-l-2 border-l-rose-500" : ""}
            >
              <TableCell>
                <Checkbox
                  checked={selected.has(lead.id)}
                  onCheckedChange={() => toggleOne(lead.id)}
                  aria-label={`Select ${lead.businessName}`}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  {lead.duplicateFlag && (
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium text-sm leading-none">{lead.businessName}</p>
                    {lead.contactPerson && (
                      <p className="text-xs text-muted-foreground mt-1">{lead.contactPerson}</p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="tabular-nums text-sm text-muted-foreground">{lead.phone || "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                {lead.email ?? "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {[lead.city, lead.state].filter(Boolean).join(", ") || "—"}
              </TableCell>
              <TableCell>
                {lead.industriesFoundIn.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {lead.industriesFoundIn.slice(0, 2).map((ind) => (
                      <Badge key={ind} variant="secondary" className="text-xs">
                        {ind}
                      </Badge>
                    ))}
                    {lead.industriesFoundIn.length > 2 && (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        +{lead.industriesFoundIn.length - 2}
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-sm">—</span>
                )}
              </TableCell>
              <TableCell>
                <QualityBadge score={lead.dataQualityScore} />
              </TableCell>
              <TableCell>
                <StatusBadge status={lead.recordStatus} />
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/leads/${lead.id}`}
                  className="text-xs font-medium text-primary hover:underline underline-offset-4"
                >
                  View →
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

      {/* Delete confirmation */}
      <Dialog open={confirmOpen} onOpenChange={(o) => { if (!deleting) setConfirmOpen(o); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selected.size} lead{selected.size !== 1 ? "s" : ""}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently removes the selected lead{selected.size !== 1 ? "s" : ""} from the database. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="gap-1.5">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
