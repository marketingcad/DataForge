"use client";

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";

export type MigrationLead = { id: string; name: string };

export type MigrationResult = {
  id: string;
  name: string;
  success: boolean;
  error?: string;
};

export type MigrationState = {
  active: boolean;       // a migration session exists (running or finished)
  running: boolean;      // currently processing leads
  minimized: boolean;    // modal dismissed, running in background
  folderName: string;
  total: number;
  done: number;
  errors: number;
  current: string | null; // lead name being processed right now
  results: MigrationResult[];
};

type MigrationContextValue = {
  state: MigrationState;
  start: (leads: MigrationLead[], folderName: string) => void;
  stop: () => void;
  minimize: () => void;
  restore: () => void;
  dismiss: () => void;
};

const INITIAL: MigrationState = {
  active: false, running: false, minimized: false,
  folderName: "", total: 0, done: 0, errors: 0, current: null, results: [],
};

const MigrationContext = createContext<MigrationContextValue | null>(null);

export function useMigration() {
  const ctx = useContext(MigrationContext);
  if (!ctx) throw new Error("useMigration must be used inside MigrationProvider");
  return ctx;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function MigrationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MigrationState>(INITIAL);
  const stopRef = useRef(false);

  const stop = useCallback(() => {
    stopRef.current = true;
    setState((p) => ({ ...p, running: false, current: null }));
  }, []);

  const minimize = useCallback(() => setState((p) => ({ ...p, minimized: true })), []);
  const restore  = useCallback(() => setState((p) => ({ ...p, minimized: false })), []);
  const dismiss  = useCallback(() => {
    stopRef.current = true;
    setState(INITIAL);
  }, []);

  const start = useCallback((leads: MigrationLead[], folderName: string) => {
    stopRef.current = false;
    setState({
      active: true, running: true, minimized: false,
      folderName, total: leads.length, done: 0, errors: 0, current: null, results: [],
    });

    // Run migration loop asynchronously
    (async () => {
      for (const lead of leads) {
        if (stopRef.current) break;

        setState((p) => ({ ...p, current: lead.name }));

        try {
          const res = await fetch("/api/ghl/migrate-lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId: lead.id }),
          });

          const json = await res.json().catch(() => ({ error: "Bad response" }));

          if (!res.ok || json.error) {
            throw new Error(json.error ?? `HTTP ${res.status}`);
          }

          setState((p) => ({
            ...p,
            done: p.done + 1,
            results: [...p.results, { id: lead.id, name: lead.name, success: true }],
          }));
        } catch (e) {
          setState((p) => ({
            ...p,
            errors: p.errors + 1,
            results: [...p.results, { id: lead.id, name: lead.name, success: false, error: String(e) }],
          }));
        }

        await sleep(250); // avoid hammering GHL
      }

      setState((p) => ({ ...p, running: false, current: null }));
    })();
  }, []);

  return (
    <MigrationContext.Provider value={{ state, start, stop, minimize, restore, dismiss }}>
      {children}
    </MigrationContext.Provider>
  );
}
