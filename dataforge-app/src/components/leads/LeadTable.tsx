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
import { AlertTriangle } from "lucide-react";

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

interface LeadTableProps {
  leads: Lead[];
}

export function LeadTable({ leads }: LeadTableProps) {
  if (leads.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        No leads found. Try adjusting your filters or add a new lead.
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Industry</TableHead>
            <TableHead>Quality</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id} className={lead.duplicateFlag ? "bg-orange-50/50" : ""}>
              <TableCell>
                <div className="flex items-center gap-2">
                  {lead.duplicateFlag && (
                    <AlertTriangle className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  )}
                  <div>
                    <p className="font-medium leading-none">{lead.businessName}</p>
                    {lead.contactPerson && (
                      <p className="text-xs text-muted-foreground mt-0.5">{lead.contactPerson}</p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="tabular-nums text-sm">{lead.phone}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
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
                      <Badge variant="secondary" className="text-xs">
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
                  className="text-sm font-medium text-blue-600 hover:underline"
                >
                  View
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
