"use client";

import { useState, useTransition, useEffect } from "react";
import { createUserAction } from "@/actions/users.actions";
import { ROLE_LABELS, ROLE_CAN_CREATE, type Role } from "@/lib/rbac/roles";
import { useNotifications } from "@/lib/notifications";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, Eye, EyeOff, AlertCircle, Loader2, Link } from "lucide-react";

// sales_rep accounts must be created via GHL import — not allowed here
const ROLE_ORDER: Role[] = ["boss", "admin", "team_lead", "lead_specialist"];

const ROLE_DESC: Record<Role, string> = {
  boss:           "Full access to everything",
  admin:          "Full access, manages users",
  team_lead:      "Leads department + auto scraping",
  lead_specialist: "Leads department only",
  sales_rep:      "Marketing department only",
};

interface GhlAgent {
  id: string;
  name: string;
  email: string;
  alreadyLinked: boolean;
}

interface Props { actorRole: Role }

export function CreateUserDialog({ actorRole }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>("lead_specialist");
  const [selectedGhlUserId, setSelectedGhlUserId] = useState<string>("");
  const [ghlAgents, setGhlAgents] = useState<GhlAgent[]>([]);
  const [ghlConfigured, setGhlConfigured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { add } = useNotifications();

  const assignableRoles = ROLE_CAN_CREATE[actorRole];

  useEffect(() => {
    if (!open) return;
    fetch("/api/ghl/agents")
      .then((r) => r.json())
      .then((data) => {
        setGhlConfigured(data.configured ?? false);
        setGhlAgents(data.agents ?? []);
      })
      .catch(() => {});
  }, [open]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const data = {
      name:         (fd.get("name")     as string).trim(),
      email:        (fd.get("email")    as string).trim(),
      password:      fd.get("password") as string,
      role:          selectedRole,
      ghlUserId:     selectedGhlUserId || null,
    };

    startTransition(async () => {
      try {
        await createUserAction(data);
        add({ title: "User created", message: `${data.name || data.email} was added successfully.`, type: "success" });
        setOpen(false);
        setSelectedGhlUserId("");
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <UserPlus className="h-4 w-4" />
          Create User
        </Button>
      } />

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" name="name" placeholder="Jane Smith" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
              <Input id="email" name="email" type="email" required placeholder="jane@company.com" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Role <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ROLE_ORDER.filter((r) => assignableRoles.includes(r)).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelectedRole(r)}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                    selectedRole === r
                      ? "border-blue-600 bg-blue-600/5 ring-1 ring-blue-600"
                      : "hover:bg-muted/40 border-border"
                  }`}
                >
                  <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    selectedRole === r ? "border-blue-600" : "border-muted-foreground"
                  }`}>
                    {selectedRole === r && <div className="h-2 w-2 rounded-full bg-blue-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{ROLE_LABELS[r]}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{ROLE_DESC[r]}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* GHL Agent link — only shown if GHL API is configured */}
          {ghlConfigured && (
            <div className="space-y-2">
              <Label htmlFor="ghlAgent" className="flex items-center gap-1.5">
                <Link className="h-3.5 w-3.5 text-muted-foreground" />
                Link to GHL Agent
                <span className="text-xs font-normal text-muted-foreground">(optional)</span>
              </Label>
              <select
                id="ghlAgent"
                value={selectedGhlUserId}
                onChange={(e) => setSelectedGhlUserId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">— No GHL link —</option>
                {ghlAgents.map((a) => (
                  <option key={a.id} value={a.id} disabled={a.alreadyLinked}>
                    {a.name} ({a.email}){a.alreadyLinked ? " — already linked" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Associates this user with their GHL agent so call logs sync correctly.
              </p>
            </div>
          )}

          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            To add a <strong>Sales Rep</strong> (marketing) account, use <strong>Import from GHL</strong> instead.
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={pending} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {pending ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
