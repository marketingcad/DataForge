import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QualityBadge } from "@/components/leads/QualityBadge";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

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
      <CardHeader className="flex flex-row items-start justify-between pb-3">
        <div>
          <CardTitle className="text-sm font-semibold">Recent Leads</CardTitle>
          <CardDescription className="text-xs mt-0.5">Latest entries added to your database</CardDescription>
        </div>
        <Link href="/leads">
          <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
            View all
            <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="p-0">
        {leads.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No leads yet — start scraping to populate your database.
          </div>
        ) : (
          <div className="divide-y">
            {leads.map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 transition-colors"
              >
                <div className="min-w-0">
                  <Link
                    href={`/leads/${lead.id}`}
                    className="font-medium text-sm hover:underline underline-offset-4 block truncate"
                  >
                    {lead.businessName}
                  </Link>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {lead.category ?? "Uncategorized"} · {lead.phone || "No phone"}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4 shrink-0">
                  <QualityBadge score={lead.dataQualityScore} />
                  <Badge
                    variant={lead.recordStatus === "active" ? "default" : "secondary"}
                    className="text-xs capitalize"
                  >
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
