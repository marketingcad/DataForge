"use client";

import Link from "next/link";
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
import { AlertTriangle, Users } from "lucide-react";

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

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
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
              className={lead.duplicateFlag ? "bg-orange-50/40 dark:bg-orange-950/10" : ""}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  {lead.duplicateFlag && (
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
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
  );
}
