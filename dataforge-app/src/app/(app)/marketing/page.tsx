import { Megaphone } from "lucide-react";

export default function MarketingPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
        <Megaphone className="h-7 w-7 text-primary" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Marketing Department</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          This department is coming soon. Campaign management, outreach tools,
          and CRM integrations will live here.
        </p>
      </div>
    </div>
  );
}
