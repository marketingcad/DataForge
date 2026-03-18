import { ShieldOff } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10">
        <ShieldOff className="h-7 w-7 text-destructive" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">Access Denied</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">
          You do not have permission to view this page.
          Contact your admin if you believe this is a mistake.
        </p>
      </div>
      <a href="/dashboard" className="inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
        Go to Dashboard
      </a>
    </div>
  );
}
