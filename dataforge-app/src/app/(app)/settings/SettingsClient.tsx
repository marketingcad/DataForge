"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { updateSettingsAction } from "@/actions/settings.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ACCENT_LS_KEY } from "@/components/providers";

const ACCENT_SCHEMES = [
  { id: "neutral", label: "Neutral",  swatch: "oklch(0.40 0 0)" },
  { id: "blue",    label: "Blue",     swatch: "oklch(0.50 0.24 232)" },
  { id: "violet",  label: "Violet",   swatch: "oklch(0.50 0.245 262)" },
  { id: "emerald", label: "Emerald",  swatch: "oklch(0.50 0.19 155)" },
  { id: "rose",    label: "Rose",     swatch: "oklch(0.52 0.24 7)" },
  { id: "amber",   label: "Amber",    swatch: "oklch(0.60 0.20 65)" },
  { id: "teal",    label: "Teal",     swatch: "oklch(0.50 0.16 195)" },
] as const;

type AccentId = typeof ACCENT_SCHEMES[number]["id"];

function getStoredAccent(): AccentId {
  try {
    const v = localStorage.getItem(ACCENT_LS_KEY) as AccentId | null;
    return ACCENT_SCHEMES.some((s) => s.id === v) ? (v as AccentId) : "neutral";
  } catch { return "neutral"; }
}

function ApplyAccent({ accent }: { accent: AccentId }) {
  if (accent === "neutral") {
    document.documentElement.removeAttribute("data-accent");
  } else {
    document.documentElement.setAttribute("data-accent", accent);
  }
  try { localStorage.setItem(ACCENT_LS_KEY, accent); } catch { /* ignore */ }
}

const CURRENCIES = [
  { symbol: "₱", label: "₱ — Philippine Peso (PHP)" },
  { symbol: "$", label: "$ — US Dollar (USD)" },
  { symbol: "€", label: "€ — Euro (EUR)" },
  { symbol: "£", label: "£ — British Pound (GBP)" },
  { symbol: "¥", label: "¥ — Japanese Yen / Chinese Yuan" },
  { symbol: "₩", label: "₩ — Korean Won (KRW)" },
  { symbol: "₹", label: "₹ — Indian Rupee (INR)" },
  { symbol: "A$", label: "A$ — Australian Dollar (AUD)" },
  { symbol: "C$", label: "C$ — Canadian Dollar (CAD)" },
  { symbol: "R", label: "R — South African Rand (ZAR)" },
];

interface Settings {
  companyName: string;
  scrapingDefaultMaxLeads: number;
  scrapingDefaultInterval: number;
  scrapingGlobalPause: boolean;
  leadQualityGoodThreshold: number;
  leadQualityMediumThreshold: number;
  ghlWebhookUrl: string | null;
  ghlApiKey: string | null;
  ghlSubAccountApiKey: string | null;
  ghlLocationId: string | null;
  commissionCurrency: string;
}

export function SettingsClient({ settings }: { settings: Settings }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [globalPause, setGlobalPause] = useState(settings.scrapingGlobalPause);
  const [isPending, startTransition] = useTransition();
  const [accent, setAccent] = useState<AccentId>(() => {
    if (typeof window === "undefined") return "neutral";
    return getStoredAccent();
  });

  function handleAccentChange(id: AccentId) {
    setAccent(id);
    ApplyAccent({ accent: id });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("scrapingGlobalPause", String(globalPause));

    startTransition(async () => {
      const result = await updateSettingsAction(formData);
      if (result?.error) {
        toast.error("Failed to save settings", { description: result.error });
      } else {
        toast.success("Settings saved");
      }
    });
  }

  return (
    <div className="space-y-6">
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* General */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription>Basic application settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              name="companyName"
              defaultValue={settings.companyName}
              maxLength={80}
              placeholder="DataForge"
            />
          </div>
        </CardContent>
      </Card>

      {/* Scraping */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Scraping</CardTitle>
          <CardDescription>Default values applied when creating new keyword scrapers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="scrapingDefaultMaxLeads">Default Max Leads per Run</Label>
              <Input
                id="scrapingDefaultMaxLeads"
                name="scrapingDefaultMaxLeads"
                type="number"
                min={1}
                max={500}
                defaultValue={settings.scrapingDefaultMaxLeads}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scrapingDefaultInterval">Default Interval (minutes)</Label>
              <Input
                id="scrapingDefaultInterval"
                name="scrapingDefaultInterval"
                type="number"
                min={60}
                defaultValue={settings.scrapingDefaultInterval}
              />
              <p className="text-xs text-muted-foreground">
                {settings.scrapingDefaultInterval >= 1440
                  ? `${Math.round(settings.scrapingDefaultInterval / 1440)} day(s)`
                  : `${settings.scrapingDefaultInterval} minutes`}
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Global Scraping Pause</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pauses all scheduled keyword scraping runs across the app.
              </p>
            </div>
            <Switch
              checked={globalPause}
              onCheckedChange={setGlobalPause}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lead Quality */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lead Quality Thresholds</CardTitle>
          <CardDescription>
            Score thresholds used to classify leads as Good, Medium, or Low quality.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="leadQualityGoodThreshold">Good threshold (≥)</Label>
              <Input
                id="leadQualityGoodThreshold"
                name="leadQualityGoodThreshold"
                type="number"
                min={1}
                max={100}
                defaultValue={settings.leadQualityGoodThreshold}
              />
              <p className="text-xs text-muted-foreground">Scores ≥ this value are "Good"</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leadQualityMediumThreshold">Medium threshold (≥)</Label>
              <Input
                id="leadQualityMediumThreshold"
                name="leadQualityMediumThreshold"
                type="number"
                min={1}
                max={100}
                defaultValue={settings.leadQualityMediumThreshold}
              />
              <p className="text-xs text-muted-foreground">Scores ≥ this value are "Medium"</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Commissions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Commissions</CardTitle>
          <CardDescription>Configure how commission amounts are displayed across the app.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="commissionCurrency">Currency</Label>
            <select
              id="commissionCurrency"
              name="commissionCurrency"
              defaultValue={settings.commissionCurrency}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {CURRENCIES.map((c) => (
                <option key={c.symbol} value={c.symbol}>{c.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              This symbol is shown on all commission amounts in the app.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Integrations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Integrations</CardTitle>
          <CardDescription>Connect DataForge with external platforms.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ghlWebhookUrl">Webhook URL</Label>
            <Input
              id="ghlWebhookUrl"
              name="ghlWebhookUrl"
              type="url"
              defaultValue={settings.ghlWebhookUrl ?? ""}
              placeholder="https://services.leadconnectorhq.com/hooks/..."
            />
            <p className="text-xs text-muted-foreground">
              Leads will be pushed to this webhook when uploaded to GHL.
            </p>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="ghlApiKey">API Key</Label>
            <Input
              id="ghlApiKey"
              name="ghlApiKey"
              type="password"
              defaultValue={settings.ghlApiKey ?? ""}
              placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Agency-level Private Integration API key. Used to sync call logs and opportunities.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ghlSubAccountApiKey">Sub Account API Key</Label>
            <Input
              id="ghlSubAccountApiKey"
              name="ghlSubAccountApiKey"
              type="password"
              defaultValue={settings.ghlSubAccountApiKey ?? ""}
              placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Location-level Private Integration API key. Required for syncing calendar appointments.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ghlLocationId">Location ID</Label>
            <Input
              id="ghlLocationId"
              name="ghlLocationId"
              defaultValue={settings.ghlLocationId ?? ""}
              placeholder="abc123XYZ..."
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              The sub-account Location ID from GHL. Found under Settings → Business Info in your GHL account.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </form>

    {/* Appearance — localStorage only, outside the server-action form */}
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Appearance</CardTitle>
        <CardDescription>Choose an accent colour scheme for the app.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {ACCENT_SCHEMES.map((scheme) => {
            const active = accent === scheme.id;
            return (
              <button
                key={scheme.id}
                type="button"
                onClick={() => handleAccentChange(scheme.id)}
                className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-colors ${
                  active
                    ? "border-foreground"
                    : "border-transparent hover:border-border"
                }`}
                title={scheme.label}
              >
                <span
                  className="relative flex h-8 w-8 items-center justify-center rounded-full shadow-sm"
                  style={{ backgroundColor: scheme.swatch }}
                >
                  {active && <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">{scheme.label}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
    </div>
  );
}
