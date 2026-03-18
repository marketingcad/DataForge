"use client";

import { useState, useTransition } from "react";
import { createUserAction } from "@/actions/users.actions";
import { ROLE_LABELS, ROLE_CAN_CREATE, type Role } from "@/lib/rbac/roles";
import { useNotifications } from "@/lib/notifications";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UserPlus, Eye, EyeOff } from "lucide-react";

const ROLE_ORDER: Role[] = ["boss", "admin", "lead_specialist", "sales_rep"];

interface Props {
  actorRole: Role;
}

export function CreateUserDialog({ actorRole }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { add } = useNotifications();

  const assignableRoles = ROLE_CAN_CREATE[actorRole];

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const data = {
      name:     (fd.get("name")     as string).trim(),
      email:    (fd.get("email")    as string).trim(),
      password: fd.get("password")  as string,
      role:     fd.get("role")      as Role,
    };

    startTransition(async () => {
      try {
        await createUserAction(data);
        add({ title: "User created", message: `${data.name || data.email} was added successfully.`, type: "success" });
        setOpen(false);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" />
            Create User
          </Button>
        }
      />

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New User</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Name + Email row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Full Name
              </label>
              <input
                name="name"
                type="text"
                placeholder="Jane Smith"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Email <span className="text-destructive">*</span>
              </label>
              <input
                name="email"
                type="email"
                required
                placeholder="jane@company.com"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Password <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="Minimum 8 characters"
                className="w-full rounded-lg border bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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

          {/* Role */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Role <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ROLE_ORDER.filter((r) => assignableRoles.includes(r)).map((r) => (
                <label
                  key={r}
                  className="relative flex cursor-pointer rounded-lg border p-3 gap-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5 transition-colors hover:bg-muted/40"
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    required
                    defaultChecked={r === "lead_specialist"}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium">{ROLE_LABELS[r]}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r === "boss"            && "Full access to everything"}
                      {r === "admin"           && "Full access, manages users"}
                      {r === "lead_specialist" && "Leads department only"}
                      {r === "sales_rep"       && "Marketing department only"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter showCloseButton>
            <Button type="submit" disabled={pending} className="gap-2">
              <UserPlus className="h-4 w-4" />
              {pending ? "Creating…" : "Create User"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
