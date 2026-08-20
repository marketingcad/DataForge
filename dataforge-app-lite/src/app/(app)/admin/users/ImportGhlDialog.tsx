"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { importGhlAgentsAction } from "@/actions/users.actions";
import { ROLE_LABELS, type Role } from "@/lib/rbac/roles";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, AlertCircle, CheckCircle2, Link2, Users } from "lucide-react";

interface GhlAgent {
  id: string;
  name: string;
  email: string;
  alreadyLinked: boolean;
}

interface ImportResult {
  name: string;
  email: string;
  tempPassword?: string;
  error?: string;
}

const IMPORTABLE_ROLES: Role[] = ["sales_rep", "lead_specialist", "team_lead", "admin"];

export function ImportGhlDialog() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [agents, setAgents] = useState<GhlAgent[]>([]);
  const [selected, setSelected] = useState<Record<string, { checked: boolean; role: Role }>>({});
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) { setResults(null); setError(null); setSearch(""); return; }
    setLoading(true);
    fetch("/api/ghl/agents")
      .then((r) => r.json())
      .then((data) => {
        setConfigured(data.configured ?? false);
        const list: GhlAgent[] = data.agents ?? [];
        setAgents(list);
        // Pre-select unlinked agents
        const init: Record<string, { checked: boolean; role: Role }> = {};
        list.forEach((a) => { init[a.id] = { checked: false, role: "sales_rep" }; });
        setSelected(init);
      })
      .catch(() => setError("Failed to load GHL agents."))
      .finally(() => setLoading(false));
  }, [open]);

  const selectedAgents = agents.filter((a) => selected[a.id]?.checked);
  const filteredAgents = useMemo(() => {
    const q = search.toLowerCase().trim();
    return q ? agents.filter((a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)) : agents;
  }, [agents, search]);

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: { ...prev[id], checked: !prev[id]?.checked } }));
  }

  function setRole(id: string, role: Role) {
    setSelected((prev) => ({ ...prev, [id]: { ...prev[id], role } }));
  }

  function handleImport() {
    setError(null);
    const payload = selectedAgents.map((a) => ({
      ghlUserId: a.id,
      name: a.name,
      email: a.email,
      role: selected[a.id]?.role ?? "sales_rep",
    }));
    if (!payload.length) { setError("Select at least one agent to import."); return; }

    startTransition(async () => {
      try {
        const res = await importGhlAgentsAction(payload);
        setResults(res);
      } catch (err) {
        setError((err as Error).message);
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        <Download className="h-4 w-4" />
        Import from GHL
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!pending) setOpen(o); }}>
        <DialogContent className="sm:max-w-2xl h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Import Agents from GoHighLevel
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 space-y-4 py-2">

            {/* Success screen */}
            {results ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Import complete. Share these temporary passwords with each agent — they can change them after signing in.
                </p>
                <div className="rounded-lg border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-xs">Name</th>
                        <th className="text-left px-3 py-2 font-medium text-xs">Email</th>
                        <th className="text-left px-3 py-2 font-medium text-xs">Temp Password</th>
                        <th className="text-left px-3 py-2 font-medium text-xs">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {results.map((r, i) => (
                        <tr key={i} className="hover:bg-muted/30">
                          <td className="px-3 py-2 font-medium">{r.name}</td>
                          <td className="px-3 py-2 text-muted-foreground">{r.email}</td>
                          <td className="px-3 py-2">
                            {r.tempPassword
                              ? <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{r.tempPassword}</code>
                              : <span className="text-xs text-muted-foreground">— linked only</span>}
                          </td>
                          <td className="px-3 py-2">
                            {r.error
                              ? <span className="text-xs text-rose-500">{r.error}</span>
                              : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : !configured ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  GHL API key and Location ID are not configured. Go to <strong>Settings → Integrations</strong> to add them.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Select which GHL agents to import. A DataForge account will be created for each with a temporary password.
                </p>

                <input
                  type="text"
                  placeholder="Search by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />

                <div className="space-y-2">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3 animate-pulse">
                        <div className="h-4 w-4 rounded bg-muted shrink-0" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-32 rounded bg-muted" />
                          <div className="h-2.5 w-48 rounded bg-muted" />
                        </div>
                      </div>
                    ))
                  ) : agents.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No agents found in your GHL account.</p>
                  ) : (
                    <>
                      {filteredAgents.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No agents match your search.</p>
                      )}
                      {agents.map((agent) => {
                        const sel = selected[agent.id];
                        const visible = filteredAgents.includes(agent);
                        return (
                          <div
                            key={agent.id}
                            className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                              sel?.checked ? "border-blue-500 bg-blue-500/5" : "border-border"
                            } ${agent.alreadyLinked ? "opacity-60" : "cursor-pointer hover:bg-muted/40"} ${!visible ? "hidden" : ""}`}
                            onClick={() => !agent.alreadyLinked && toggle(agent.id)}
                          >
                        {/* Checkbox */}
                        <div className={`h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 ${
                          sel?.checked ? "border-blue-600 bg-blue-600" : "border-muted-foreground"
                        }`}>
                          {sel?.checked && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>

                        {/* Agent info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium truncate">{agent.name}</p>
                            {agent.alreadyLinked && (
                              <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                                <Link2 className="h-2.5 w-2.5" /> Linked
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
                        </div>

                        {/* Role selector */}
                        {sel?.checked && !agent.alreadyLinked && (
                          <select
                            value={sel.role}
                            onChange={(e) => { e.stopPropagation(); setRole(agent.id, e.target.value as Role); }}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border border-input bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
                          >
                            {IMPORTABLE_ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        )}
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              </>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter showCloseButton>
            {results ? (
              <Button onClick={() => setOpen(false)}>Done</Button>
            ) : (
              <Button
                onClick={handleImport}
                disabled={pending || loading || !configured || selectedAgents.length === 0}
                className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {pending ? "Importing…" : `Import ${selectedAgents.length > 0 ? `${selectedAgents.length} ` : ""}Agent${selectedAgents.length !== 1 ? "s" : ""}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
