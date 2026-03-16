import Link from "next/link";
import { LeadForm } from "@/components/leads/LeadForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";

export default function NewLeadPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <Link
        href="/leads"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Leads
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Add New Lead</CardTitle>
          <CardDescription>
            Enter business contact details. Business Name, Phone, and Source are required.
            Duplicates are detected automatically by phone, email, or website.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LeadForm />
        </CardContent>
      </Card>
    </div>
  );
}
