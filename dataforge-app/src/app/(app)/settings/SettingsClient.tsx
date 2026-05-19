"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Check, Loader2, ChevronsUpDown, MapPin, Copy, RefreshCw } from "lucide-react";
import { updateSettingFieldAction } from "@/actions/settings.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ACCENT_LS_KEY } from "@/components/providers";

// ─── Accent colour ────────────────────────────────────────────────────────────

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

// ─── Currencies ───────────────────────────────────────────────────────────────

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

// ─── Types ────────────────────────────────────────────────────────────────────

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
  ghlInboundSecret: string | null;
}

type SettingKey = Parameters<typeof updateSettingFieldAction>[0];

// ─── Shared auto-save hook ────────────────────────────────────────────────────

function useSaveField(key: SettingKey) {
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save(value: string | number | boolean | null) {
    startTransition(async () => {
      const result = await updateSettingFieldAction(key, value);
      if (result?.error) {
        toast.error(`Failed to save`, { description: result.error });
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return { save, isPending, saved };
}

// ─── Reusable field status indicator ─────────────────────────────────────────

function SaveIndicator({ isPending, saved }: { isPending: boolean; saved: boolean }) {
  if (isPending) return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  if (saved) return <Check className="h-3.5 w-3.5 text-green-500" />;
  return null;
}

// ─── Auto-save text / number input ───────────────────────────────────────────

function AutoInput({
  id, name, label, description, defaultValue, type = "text",
  min, max, placeholder, password,
}: {
  id: string; name: SettingKey; label: string; description?: string;
  defaultValue: string | number; type?: string;
  min?: number; max?: number; placeholder?: string; password?: boolean;
}) {
  const { save, isPending, saved } = useSaveField(name);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        <SaveIndicator isPending={isPending} saved={saved} />
      </div>
      <Input
        id={id}
        type={password ? "password" : type}
        defaultValue={defaultValue}
        min={min}
        max={max}
        placeholder={placeholder}
        autoComplete={password ? "off" : undefined}
        onBlur={(e) => {
          const v = e.target.value;
          if (type === "number") {
            const n = parseFloat(v);
            if (!isNaN(n)) save(n);
          } else {
            save(v || null);
          }
        }}
      />
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

// ─── Auto-save toggle row ─────────────────────────────────────────────────────

function AutoSwitch({
  name, label, description, defaultChecked,
}: {
  name: SettingKey; label: string; description?: string; defaultChecked: boolean;
}) {
  const { save, isPending, saved } = useSaveField(name);
  const [checked, setChecked] = useState(defaultChecked);

  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{label}</p>
          <SaveIndicator isPending={isPending} saved={saved} />
        </div>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={(v) => { setChecked(v); save(v); }}
        disabled={isPending}
      />
    </div>
  );
}

// ─── Auto-save select ─────────────────────────────────────────────────────────

function AutoSelect({
  id, name, label, description, defaultValue, options,
}: {
  id: string; name: SettingKey; label: string; description?: string;
  defaultValue: string; options: { value: string; label: string }[];
}) {
  const { save, isPending, saved } = useSaveField(name);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{label}</Label>
        <SaveIndicator isPending={isPending} saved={saved} />
      </div>
      <select
        id={id}
        defaultValue={defaultValue}
        disabled={isPending}
        onChange={(e) => save(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsClient({ settings }: { settings: Settings }) {
  const [accent, setAccent] = useState<AccentId>(() => {
    if (typeof window === "undefined") return "neutral";
    return getStoredAccent();
  });

  function handleAccentChange(id: AccentId) {
    setAccent(id);
    if (id === "neutral") {
      document.documentElement.removeAttribute("data-accent");
    } else {
      document.documentElement.setAttribute("data-accent", id);
    }
    try { localStorage.setItem(ACCENT_LS_KEY, id); } catch { /* ignore */ }
  }

  return (
    <div className="space-y-6">

      {/* ── General ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription>Basic application configuration.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AutoInput
            id="companyName" name="companyName" label="Company Name"
            defaultValue={settings.companyName} placeholder="DataForge"
          />
          <Separator />
          <AutoSelect
            id="commissionCurrency" name="commissionCurrency" label="Currency"
            defaultValue={settings.commissionCurrency}
            description="Symbol shown on all commission amounts across the app."
            options={CURRENCIES.map((c) => ({ value: c.symbol, label: c.label }))}
          />
        </CardContent>
      </Card>

      {/* ── Appearance ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Choose an accent colour scheme. Applies instantly, saved to your browser.</CardDescription>
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
                    active ? "border-foreground" : "border-transparent hover:border-border"
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

      {/* ── Scraping ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Scraping</CardTitle>
          <CardDescription>Default values applied when creating new keyword scrapers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <AutoInput
              id="scrapingDefaultMaxLeads" name="scrapingDefaultMaxLeads"
              label="Default Max Leads per Run" type="number"
              defaultValue={settings.scrapingDefaultMaxLeads} min={1} max={500}
            />
            <AutoInput
              id="scrapingDefaultInterval" name="scrapingDefaultInterval"
              label="Default Interval (minutes)" type="number"
              defaultValue={settings.scrapingDefaultInterval} min={60}
              description={
                settings.scrapingDefaultInterval >= 1440
                  ? `${Math.round(settings.scrapingDefaultInterval / 1440)} day(s)`
                  : `${settings.scrapingDefaultInterval} minutes`
              }
            />
          </div>
          <Separator />
          <AutoSwitch
            name="scrapingGlobalPause" label="Global Scraping Pause"
            defaultChecked={settings.scrapingGlobalPause}
            description="Pauses all scheduled keyword scraping runs across the app."
          />
        </CardContent>
      </Card>

      {/* ── Lead Quality ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lead Quality Thresholds</CardTitle>
          <CardDescription>Score thresholds used to classify leads as Good, Medium, or Low quality.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <AutoInput
              id="leadQualityGoodThreshold" name="leadQualityGoodThreshold"
              label="Good threshold (≥)" type="number"
              defaultValue={settings.leadQualityGoodThreshold} min={1} max={100}
              description='Scores ≥ this value are "Good"'
            />
            <AutoInput
              id="leadQualityMediumThreshold" name="leadQualityMediumThreshold"
              label="Medium threshold (≥)" type="number"
              defaultValue={settings.leadQualityMediumThreshold} min={1} max={100}
              description='Scores ≥ this value are "Medium"'
            />
          </div>
        </CardContent>
      </Card>

      {/* ── GHL Integration ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">GoHighLevel Integration</CardTitle>
          <CardDescription>Connect DataForge with your GHL account.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AutoInput
            id="ghlWebhookUrl" name="ghlWebhookUrl" label="GHL Outbound Webhook URL"
            defaultValue={settings.ghlWebhookUrl ?? ""}
            placeholder="https://services.leadconnectorhq.com/hooks/..."
            description="Leads will be pushed to this webhook when uploaded to GHL."
          />
          <Separator />
          <AutoInput
            id="ghlApiKey" name="ghlApiKey" label="Agency API Key"
            defaultValue={settings.ghlApiKey ?? ""}
            placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
            password
            description="Agency-level Private Integration API key. Used to sync call logs and opportunities."
          />
          <AutoInput
            id="ghlSubAccountApiKey" name="ghlSubAccountApiKey" label="Sub Account API Key"
            defaultValue={settings.ghlSubAccountApiKey ?? ""}
            placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
            password
            description="Location-level Private Integration API key. Required for syncing calendar appointments."
          />
          <AutoInput
            id="ghlLocationId" name="ghlLocationId" label="Location ID"
            defaultValue={settings.ghlLocationId ?? ""}
            placeholder="abc123XYZ..."
            description="The sub-account Location ID from GHL. Found under Settings → Business Info in your GHL account."
          />
          <Separator />
          <GhlInboundWebhookSection defaultSecret={settings.ghlInboundSecret} />
        </CardContent>
      </Card>

      {/* ── Integration Reference ── */}
      <IntegrationReferenceCard secret={settings.ghlInboundSecret} />

      {/* ── Maintenance ── */}
      <GeocodeBackfillCard />

    </div>
  );
}

// ─── GHL Inbound Webhook section ─────────────────────────────────────────────

function GhlInboundWebhookSection({ defaultSecret }: { defaultSecret: string | null }) {
  const { save, isPending, saved } = useSaveField("ghlInboundSecret");
  const [secret, setSecret] = useState(defaultSecret ?? "");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const webhookUrl = secret
    ? `${origin}/api/ghl/inbound-call?secret=${secret}`
    : `${origin}/api/ghl/inbound-call`;

  function generate() {
    const newSecret = Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setSecret(newSecret);
    save(newSecret);
  }

  function copyUrl() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      toast.success("Webhook URL copied");
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Inbound Call Webhook</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Paste this URL into your GHL automation (Call Status trigger → Send to Webhook). DataForge will log each call instantly without waiting for a sync.
        </p>
      </div>

      {/* Secret key row */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <Label htmlFor="ghlInboundSecret">Webhook Secret</Label>
          <SaveIndicator isPending={isPending} saved={saved} />
        </div>
        <div className="flex gap-2">
          <Input
            id="ghlInboundSecret"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onBlur={() => save(secret || null)}
            placeholder="Leave blank to skip verification (not recommended)"
            className="font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={generate}
            disabled={isPending}
            title="Generate a new random secret"
            className="shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Webhook URL display */}
      <div className="space-y-1.5">
        <Label>Your Webhook URL</Label>
        <div className="flex gap-2">
          <div className="flex-1 rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground break-all select-all">
            {origin ? webhookUrl : "Loading…"}
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copyUrl}
            title="Copy webhook URL"
            className="shrink-0"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          In GHL: Automation → trigger "Call Status" → Add Action "Send to Webhook" → paste this URL.
        </p>
      </div>
    </div>
  );
}

// ─── Single lead geocode combobox ─────────────────────────────────────────────

type LeadResult = {
  id: string;
  businessName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

function SingleLeadGeocoder() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeadResult[]>([]);
  const [selected, setSelected] = useState<LeadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocoded, setGeocoded] = useState<{ latitude: number; longitude: number } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/leads/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  async function handleGeocode() {
    if (!selected) return;
    setGeocoding(true);
    setGeocoded(null);
    try {
      const res = await fetch(`/api/leads/${selected.id}/geocode`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setGeocoded(data);
      toast.success(`Geocoded — ${data.latitude.toFixed(5)}, ${data.longitude.toFixed(5)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Geocoding failed");
    } finally {
      setGeocoding(false);
    }
  }

  const addressLine = selected
    ? (selected.address ?? ([selected.city, selected.state, selected.country].filter(Boolean).join(", ") || "No address"))
    : null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">Geocode a Single Lead</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Search for a specific lead and manually geocode its address.
        </p>
      </div>

      <div className="flex gap-2 items-start">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button variant="outline" role="combobox" aria-expanded={open} className="flex-1 justify-between font-normal truncate" />}>
            <span className="truncate">
              {selected ? selected.businessName : "Search lead by name…"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Type to search…"
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                {loading && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!loading && results.length === 0 && (
                  <CommandEmpty>No leads found.</CommandEmpty>
                )}
                {!loading && results.length > 0 && (
                  <CommandGroup>
                    {results.map((lead) => (
                      <CommandItem
                        key={lead.id}
                        value={lead.id}
                        onSelect={() => {
                          setSelected(lead);
                          setGeocoded(null);
                          setOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selected?.id === lead.id ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm truncate">{lead.businessName}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {lead.address ?? [lead.city, lead.state, lead.country].filter(Boolean).join(", ") ?? "No address"}
                          </span>
                        </div>
                        {lead.latitude != null && (
                          <MapPin className="ml-auto h-3.5 w-3.5 shrink-0 text-green-500" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button size="sm" onClick={handleGeocode} disabled={!selected || geocoding} className="shrink-0">
          {geocoding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {selected && (
        <div className="rounded-md border bg-muted/40 px-3 py-2 space-y-0.5">
          <p className="text-xs font-medium">{selected.businessName}</p>
          <p className="text-xs text-muted-foreground">{addressLine ?? "No address"}</p>
          {geocoded ? (
            <p className="text-xs text-green-500">
              📍 {geocoded.latitude.toFixed(5)}, {geocoded.longitude.toFixed(5)}
            </p>
          ) : selected.latitude != null && selected.longitude != null ? (
            <p className="text-xs text-green-500">
              📍 Already geocoded — {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
            </p>
          ) : (
            <p className="text-xs text-amber-500">Not yet geocoded</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Integration reference card ──────────────────────────────────────────────

function EndpointRow({ label, description, url }: { label: string; description: string; url: string }) {
  function copy() {
    navigator.clipboard.writeText(url).then(() => toast.success(`${label} URL copied`));
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={copy} className="shrink-0 gap-1.5">
          <Copy className="h-3.5 w-3.5" />
          Copy URL
        </Button>
      </div>
      <div className="rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground break-all select-all">
        {url}
      </div>
    </div>
  );
}

function IntegrationReferenceCard({ secret }: { secret: string | null }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const callWebhookUrl = origin
    ? (secret ? `${origin}/api/ghl/inbound-call?secret=${secret}` : `${origin}/api/ghl/inbound-call`)
    : "Loading…";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">DataForge Integration Reference</CardTitle>
        <CardDescription>
          Webhook and API endpoints you can paste into GHL automations or other third-party tools.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">

        {/* ── Inbound Webhooks ── */}
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inbound Webhooks — receive data from GHL</p>
        </div>

        <EndpointRow
          label="Call Logged (GHL → DataForge)"
          description="Paste in GHL: Automation → Call Status trigger → Send to Webhook. Logs each call to the Reports dashboard instantly."
          url={callWebhookUrl}
        />

        <Separator />

        {/* ── Setup notes ── */}
        <div className="rounded-md border border-dashed bg-muted/30 p-3 space-y-1.5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">How to set up the GHL Call Webhook</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>In GHL → <strong>Automations</strong>, create a new workflow.</li>
            <li>Set the trigger to <strong>Call Status</strong> (choose inbound, outbound, or both).</li>
            <li>Add an action: <strong>Send to Webhook</strong> → paste the URL above.</li>
            <li>Make sure each agent's <strong>GHL User ID</strong> is set in DataForge Admin → Users.</li>
            <li>Publish the workflow. Calls will appear in reports within seconds.</li>
          </ol>
        </div>

      </CardContent>
    </Card>
  );
}

// ─── Geocode backfill card ────────────────────────────────────────────────────

function GeocodeBackfillCard() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; updated: number; skipped: number } | null>(null);
  const [done, setDone] = useState(false);

  async function handleRun() {
    setRunning(true);
    setDone(false);
    setProgress(null);

    try {
      const res = await fetch("/api/leads/geocode-backfill", { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const dataLine = line.replace(/^data: /, "").trim();
          if (!dataLine) continue;
          try {
            const msg = JSON.parse(dataLine);
            setProgress({ current: msg.current, total: msg.total, updated: msg.updated, skipped: msg.skipped });
            if (msg.done) {
              setDone(true);
              toast.success(`Geocoded ${msg.updated} of ${msg.total} leads`);
            }
          } catch { /* ignore malformed lines */ }
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Geocoding failed");
    } finally {
      setRunning(false);
    }
  }

  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Maintenance</CardTitle>
        <CardDescription>One-time tools for data repair.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Geocode All Leads</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Converts every lead address to exact coordinates so the globe map is accurate.
              Runs at 1 lead/sec — may take several minutes.
            </p>

            {(running || done) && progress && (
              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{done ? "Done" : `Processing ${progress.current} of ${progress.total}…`}</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${done ? "bg-green-500" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className={`text-xs ${done ? "text-green-500" : "text-muted-foreground"}`}>
                  {progress.updated} geocoded · {progress.skipped} skipped · {progress.current} of {progress.total} processed
                </p>
              </div>
            )}
          </div>

          <Button size="sm" variant="outline" onClick={handleRun} disabled={running} className="shrink-0 mt-0.5">
            {running ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Running…</> : "Run"}
          </Button>
        </div>

        <Separator />
        <SingleLeadGeocoder />
      </CardContent>
    </Card>
  );
}
