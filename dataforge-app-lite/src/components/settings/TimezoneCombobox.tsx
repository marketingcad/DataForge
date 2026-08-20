"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { updateSettingFieldAction } from "@/actions/settings.actions";
import { toast } from "sonner";

type Zone = { tz: string; label: string; search: string; sort: number };

// Every IANA timezone the runtime knows about (~400+). Falls back on older engines.
function getAllTimezones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (fn) return fn("timeZone");
  } catch { /* ignore */ }
  return ["UTC", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "Asia/Manila", "Europe/London"];
}

// Build "GMT-04:00 America/New_York (EDT)" style labels, sorted by offset.
function buildZones(): Zone[] {
  const now = new Date();
  const part = (tz: string, type: "longOffset" | "short") => {
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: type })
        .formatToParts(now).find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch { return ""; }
  };
  const zones = getAllTimezones().map((tz) => {
    const off = part(tz, "longOffset") || "GMT"; // e.g. "GMT-04:00", "GMT+08:00", "GMT"
    const abbr = part(tz, "short");               // e.g. "EDT", "PST", "GMT+8"
    const label = `${off} ${tz}${abbr && abbr !== off ? ` (${abbr})` : ""}`;
    const m = /GMT([+-])(\d{1,2})(?::?(\d{2}))?/.exec(off);
    const sort = m ? (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3] ?? "0", 10)) : 0;
    return { tz, label, search: `${tz} ${abbr} ${off}`.toLowerCase(), sort };
  });
  zones.sort((a, b) => a.sort - b.sort || a.tz.localeCompare(b.tz));
  return zones;
}

export function TimezoneCombobox({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue || "UTC");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const zones = useMemo(buildZones, []);
  const current = zones.find((z) => z.tz === value);

  async function choose(tz: string) {
    setValue(tz);
    setOpen(false);
    setSaving(true);
    setSaved(false);
    const res = await updateSettingFieldAction("timezone", tz);
    setSaving(false);
    if (res?.error) toast.error("Failed to save timezone", { description: res.error });
    else { setSaved(true); setTimeout(() => setSaved(false), 2000); }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 truncate">
          <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{current?.label ?? value ?? "Select timezone…"}</span>
        </span>
        {saving
          ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          : saved
            ? <Check className="h-4 w-4 shrink-0 text-green-500" />
            : <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />}
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search city, region, or GMT offset…" />
          <CommandList className="max-h-72">
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup>
              {zones.map((z) => (
                <CommandItem key={z.tz} value={z.search} onSelect={() => choose(z.tz)}>
                  <Check className={cn("mr-2 h-4 w-4 shrink-0", value === z.tz ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{z.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
