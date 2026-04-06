import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { QualityBadge } from "@/components/leads/QualityBadge";
import { StatusBadge } from "@/components/leads/StatusBadge";
import { LeadForm } from "@/components/leads/LeadForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { deleteLeadAction, updateLeadStatusAction } from "@/actions/leads.actions";
import { ChevronLeft, AlertTriangle, Globe, Phone, Mail, User, MapPin, Tag, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssignCommissionPanel } from "./AssignCommissionPanel";
import { getLeadCommission } from "@/lib/marketing/lead-commissions.service";
import { getAllCommissionRules } from "@/lib/marketing/commissions.service";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ notice?: string }>;
}

export default async function LeadDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { notice } = await searchParams;

  const session = await auth();
  const role = (session?.user as unknown as Record<string, unknown>)?.role as string | undefined;
  const isManager = role === "boss" || role === "admin";

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) notFound();

  // Fetch assignment data only for managers (avoid unnecessary queries for reps)
  const [salesReps, rules, existingCommission] = isManager
    ? await Promise.all([
        prisma.user.findMany({
          where: { role: "sales_rep" },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        }),
        getAllCommissionRules(),
        getLeadCommission(id),
      ])
    : [[], [], null];

  return (
    <div className="max-w-3xl space-y-6">
      {/* Back */}
      <Link
        href="/leads"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Leads
      </Link>

      {/* Notices */}
      {notice === "duplicate" && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          This lead already exists in the database. The existing record has been updated with the new industry and score.
        </div>
      )}
      {notice === "updated" && (
        <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-700 text-sm">
          Lead updated successfully.
        </div>
      )}

      {/* Lead header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {lead.duplicateFlag && (
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            )}
            <h1 className="text-2xl font-bold tracking-tight">{lead.businessName}</h1>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <QualityBadge score={lead.dataQualityScore} />
            <StatusBadge status={lead.recordStatus} />
            {lead.industriesFoundIn.map((ind: string) => (
              <Badge key={ind} variant="secondary">{ind}</Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Contact Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="tabular-nums">{lead.phone}</span>
          </div>
          {lead.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a>
            </div>
          )}
          {lead.website && (
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <a href={`https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {lead.website}
              </a>
            </div>
          )}
          {lead.contactPerson && (
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{lead.contactPerson}</span>
            </div>
          )}
          {(lead.city || lead.state) && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{[lead.city, lead.state, lead.country].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {lead.category && (
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span>{lead.category}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Source: {lead.source}</span>
          </div>
        </CardContent>
      </Card>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record Metadata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>Lead ID: <span className="font-mono text-xs">{lead.id}</span></p>
          <p>Collected: {new Date(lead.dateCollected).toLocaleDateString()}</p>
          <p>Last updated: {new Date(lead.lastUpdated).toLocaleDateString()}</p>
          <p>Industries found in: {lead.industriesFoundIn.join(", ") || "—"}</p>
        </CardContent>
      </Card>

      {/* Assignment & Commission — boss/admin only */}
      {isManager && (
        <AssignCommissionPanel
          leadId={id}
          salesReps={salesReps}
          rules={rules.map((r) => ({ id: r.id, name: r.name, amount: r.amount }))}
          existing={existingCommission as Parameters<typeof AssignCommissionPanel>[0]["existing"]}
        />
      )}

      <Separator />

      {/* Edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Edit Lead</CardTitle>
          <CardDescription>Update contact information. Score will recalculate automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <LeadForm
            leadId={lead.id}
            defaultValues={{
              businessName: lead.businessName,
              phone: lead.phone,
              email: lead.email ?? undefined,
              website: lead.website ?? undefined,
              contactPerson: lead.contactPerson ?? undefined,
              city: lead.city ?? undefined,
              state: lead.state ?? undefined,
              country: lead.country ?? undefined,
              category: lead.category ?? undefined,
              source: lead.source,
            }}
          />
        </CardContent>
      </Card>

      {/* Status actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record Status</CardTitle>
          <CardDescription>Change the status of this lead record.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <form action={updateLeadStatusAction.bind(null, lead.id, "active")}>
            <Button variant="outline" size="sm" type="submit" disabled={lead.recordStatus === "active"}>
              Mark Active
            </Button>
          </form>
          <form action={updateLeadStatusAction.bind(null, lead.id, "flagged")}>
            <Button variant="outline" size="sm" type="submit" disabled={lead.recordStatus === "flagged"}>
              Flag Record
            </Button>
          </form>
          <form action={updateLeadStatusAction.bind(null, lead.id, "invalid")}>
            <Button variant="outline" size="sm" type="submit" disabled={lead.recordStatus === "invalid"}>
              Mark Invalid
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Delete */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={deleteLeadAction.bind(null, lead.id)}>
            <Button variant="destructive" size="sm" type="submit">
              Delete Lead
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
