import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QualityBadge } from "@/components/leads/QualityBadge";

interface Lead {
  id: string;
  businessName: string;
  phone: string;
  category: string | null;
  dataQualityScore: number;
  dateCollected: Date;
  recordStatus: string;
}

export function RecentLeadsTable({ leads }: { leads: Lead[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Recent Leads</CardTitle>
        <Link href="/leads" className="text-sm text-blue-600 hover:underline">View all</Link>
      </CardHeader>
      <CardContent className="p-0">
        {leads.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">No leads yet</div>
        ) : (
          <div className="divide-y">
            {leads.map((lead) => (
              <div key={lead.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30">
                <div>
                  <Link href={`/leads/${lead.id}`} className="font-medium text-sm hover:underline">
                    {lead.businessName}
                  </Link>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {lead.category ?? "—"} · {lead.phone}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <QualityBadge score={lead.dataQualityScore} />
                  <Badge variant={lead.recordStatus === "active" ? "default" : "secondary"} className="text-xs capitalize">
                    {lead.recordStatus}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
