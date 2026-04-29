"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Country, State, City } from "country-state-city";
import { cn } from "@/lib/utils";
import {
  Command, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface Props {
  /** Current location string e.g. "Phoenix, Arizona, United States" or "Arizona, United States" */
  value: string;
  onChange: (location: string) => void;
}

function parseLocation(value: string): { countryCode: string; stateCode: string; cityName: string } {
  if (!value) return { countryCode: "", stateCode: "", cityName: "" };
  const parts = value.split(",").map((s) => s.trim());
  const countryName = parts[parts.length - 1];

  const country = Country.getAllCountries().find(
    (c) => c.name.toLowerCase() === countryName.toLowerCase()
  );
  if (!country) return { countryCode: "", stateCode: "", cityName: "" };

  if (parts.length >= 3) {
    const stateName = parts[parts.length - 2];
    const state = State.getStatesOfCountry(country.isoCode).find(
      (s) => s.name.toLowerCase() === stateName.toLowerCase()
    );
    const cityName = parts.slice(0, parts.length - 2).join(", ");
    return { countryCode: country.isoCode, stateCode: state?.isoCode ?? "", cityName };
  }

  if (parts.length === 2) {
    const stateName = parts[0];
    const state = State.getStatesOfCountry(country.isoCode).find(
      (s) => s.name.toLowerCase() === stateName.toLowerCase()
    );
    return { countryCode: country.isoCode, stateCode: state?.isoCode ?? "", cityName: "" };
  }

  return { countryCode: country.isoCode, stateCode: "", cityName: "" };
}

function buildLocation(countryCode: string, stateCode: string, cityName: string): string {
  const country = Country.getCountryByCode(countryCode);
  if (!country) return "";
  if (!stateCode) return country.name;
  const state = State.getStateByCodeAndCountry(stateCode, countryCode);
  if (!state) return country.name;
  if (!cityName) return `${state.name}, ${country.name}`;
  return `${cityName}, ${state.name}, ${country.name}`;
}

export function LocationCombobox({ value, onChange }: Props) {
  const parsed = useMemo(() => parseLocation(value), []);  // parse once on mount
  const [countryCode, setCountryCode] = useState(parsed.countryCode);
  const [stateCode,   setStateCode]   = useState(parsed.stateCode);
  const [cityName,    setCityName]    = useState(parsed.cityName);
  const [countryOpen, setCountryOpen] = useState(false);
  const [stateOpen,   setStateOpen]   = useState(false);
  const [cityOpen,    setCityOpen]    = useState(false);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const states    = useMemo(
    () => countryCode ? State.getStatesOfCountry(countryCode) : [],
    [countryCode]
  );
  const cities    = useMemo(
    () => countryCode && stateCode ? City.getCitiesOfState(countryCode, stateCode) : [],
    [countryCode, stateCode]
  );

  useEffect(() => {
    onChange(buildLocation(countryCode, stateCode, cityName));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countryCode, stateCode, cityName]);

  function handleCountrySelect(code: string) {
    setCountryCode(code === countryCode ? "" : code);
    setStateCode("");
    setCityName("");
    setCountryOpen(false);
  }

  function handleStateSelect(code: string) {
    setStateCode(code === stateCode ? "" : code);
    setCityName("");
    setStateOpen(false);
  }

  function handleCitySelect(name: string) {
    setCityName(name === cityName ? "" : name);
    setCityOpen(false);
  }

  const selectedCountry = countryCode ? Country.getCountryByCode(countryCode) : null;
  const selectedState   = stateCode && countryCode
    ? State.getStateByCodeAndCountry(stateCode, countryCode)
    : null;

  return (
    <div className="space-y-2">
      {/* Country */}
      <div className="space-y-1.5">
        <Label>Country</Label>
        <Popover open={countryOpen} onOpenChange={setCountryOpen}>
          <PopoverTrigger
            className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-expanded={countryOpen}
          >
            <span className={cn("truncate", !selectedCountry && "text-muted-foreground")}>
              {selectedCountry
                ? `${selectedCountry.flag} ${selectedCountry.name}`
                : "Select country…"}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search country…" />
              <CommandList>
                <CommandEmpty>No country found.</CommandEmpty>
                <CommandGroup>
                  {countries.map((c) => (
                    <CommandItem
                      key={c.isoCode}
                      value={`${c.name} ${c.isoCode}`}
                      onSelect={() => handleCountrySelect(c.isoCode)}
                    >
                      <Check className={cn("mr-2 h-4 w-4 shrink-0", countryCode === c.isoCode ? "opacity-100" : "opacity-0")} />
                      <span className="mr-2">{c.flag}</span>
                      <span className="truncate">{c.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* State / Province */}
      <div className="space-y-1.5">
        <Label className={cn(!countryCode && "text-muted-foreground")}>
          State / Province
        </Label>
        <Popover open={stateOpen} onOpenChange={(o) => { if (countryCode) setStateOpen(o); }}>
          <PopoverTrigger
            className={cn(
              "inline-flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              !countryCode
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-accent hover:text-accent-foreground"
            )}
            aria-expanded={stateOpen}
            aria-disabled={!countryCode}
          >
            <span className={cn("truncate", !selectedState && "text-muted-foreground")}>
              {states.length === 0 && countryCode
                ? "No states available"
                : selectedState
                  ? selectedState.name
                  : "Select state / province…"}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </PopoverTrigger>
          {countryCode && states.length > 0 && (
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search state…" />
                <CommandList>
                  <CommandEmpty>No state found.</CommandEmpty>
                  <CommandGroup>
                    {states.map((s) => (
                      <CommandItem
                        key={s.isoCode}
                        value={`${s.name} ${s.isoCode}`}
                        onSelect={() => handleStateSelect(s.isoCode)}
                      >
                        <Check className={cn("mr-2 h-4 w-4 shrink-0", stateCode === s.isoCode ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{s.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          )}
        </Popover>
        {!countryCode && (
          <p className="text-xs text-muted-foreground">Select a country first.</p>
        )}
      </div>

      {/* City */}
      <div className="space-y-1.5">
        <Label className={cn(!stateCode && "text-muted-foreground")}>
          City{" "}
          <span className="font-normal text-muted-foreground">(optional — auto-cycles if empty)</span>
        </Label>
        <Popover open={cityOpen} onOpenChange={(o) => { if (stateCode && cities.length > 0) setCityOpen(o); }}>
          <PopoverTrigger
            className={cn(
              "inline-flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              !stateCode || cities.length === 0
                ? "cursor-not-allowed opacity-50"
                : "hover:bg-accent hover:text-accent-foreground"
            )}
            aria-expanded={cityOpen}
            aria-disabled={!stateCode}
          >
            <span className={cn("truncate", !cityName && "text-muted-foreground")}>
              {!stateCode
                ? "Select a state first"
                : cities.length === 0
                  ? "No cities available"
                  : cityName || "Auto-cycle all cities…"}
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </PopoverTrigger>
          {stateCode && cities.length > 0 && (
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search city…" />
                <CommandList>
                  <CommandEmpty>No city found.</CommandEmpty>
                  <CommandGroup>
                    {cities.map((c) => (
                      <CommandItem
                        key={c.name}
                        value={c.name}
                        onSelect={() => handleCitySelect(c.name)}
                      >
                        <Check className={cn("mr-2 h-4 w-4 shrink-0", cityName === c.name ? "opacity-100" : "opacity-0")} />
                        <span className="truncate">{c.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          )}
        </Popover>
        {stateCode && !cityName && cities.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Each run will scrape a different city — {cities.length} cities available in this state.
          </p>
        )}
      </div>
    </div>
  );
}
