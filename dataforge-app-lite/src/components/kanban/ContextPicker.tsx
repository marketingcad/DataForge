"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CheckIcon, SearchIcon, PlusIcon } from "lucide-react";

export const PREDEFINED_LABELS: { label: string; display: string; emoji: string }[] = [
  { label: "ui",          display: "UI",          emoji: "🎨" },
  { label: "ux",          display: "UX",          emoji: "✨" },
  { label: "design",      display: "Design",      emoji: "🖌️" },
  { label: "frontend",    display: "Frontend",    emoji: "💻" },
  { label: "backend",     display: "Backend",     emoji: "⚙️" },
  { label: "engineering", display: "Engineering", emoji: "🔧" },
  { label: "data",        display: "Data",        emoji: "📊" },
  { label: "security",    display: "Security",    emoji: "🔒" },
  { label: "devops",      display: "DevOps",      emoji: "🚀" },
  { label: "marketing",   display: "Marketing",   emoji: "📣" },
  { label: "research",    display: "Research",    emoji: "🔬" },
  { label: "bug",         display: "Bug",         emoji: "🐛" },
  { label: "feature",     display: "Feature",     emoji: "⭐" },
  { label: "docs",        display: "Docs",        emoji: "📝" },
  { label: "performance", display: "Performance", emoji: "⚡" },
  { label: "testing",     display: "Testing",     emoji: "🧪" },
  { label: "billing",     display: "Billing",     emoji: "💳" },
  { label: "infra",       display: "Infra",       emoji: "🏗️" },
];

interface ContextPickerProps {
  selected: string[];
  onChange: (tags: string[]) => void;
}

export function ContextPicker({ selected, onChange }: ContextPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered = PREDEFINED_LABELS.filter((c) =>
    c.display.toLowerCase().includes(query) || c.label.includes(query)
  );
  const canAddCustom =
    query.length > 0 &&
    !PREDEFINED_LABELS.find((c) => c.label === query) &&
    !selected.includes(query);

  function toggle(label: string) {
    onChange(
      selected.includes(label) ? selected.filter((t) => t !== label) : [...selected, label]
    );
  }

  function addCustom() {
    if (!query || selected.includes(query)) return;
    onChange([...selected, query]);
    setSearch("");
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs rounded-full border-dashed text-muted-foreground hover:text-foreground"
          />
        }
      >
        <span className="font-bold">@</span>
        Add context
      </PopoverTrigger>

      <PopoverContent className="w-60 p-0 overflow-hidden" side="bottom" align="start">
        {/* Search */}
        <div className="px-2 pt-2 pb-1.5">
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canAddCustom) { e.preventDefault(); addCustom(); }
              }}
              placeholder="Search labels..."
              className="w-full h-8 pl-8 pr-3 rounded-md border border-input bg-background text-sm outline-none focus:border-ring placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* List */}
        <div className="px-1.5 pb-1.5">
          <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Labels
          </p>
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filtered.map((cat) => {
              const isSelected = selected.includes(cat.label);
              return (
                <button
                  key={cat.label}
                  type="button"
                  onClick={() => toggle(cat.label)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-left transition-colors ${
                    isSelected
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/60"
                  }`}
                >
                  <span className="text-base leading-none w-5 text-center">{cat.emoji}</span>
                  <span className="flex-1 font-medium">{cat.display}</span>
                  {isSelected && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
                </button>
              );
            })}

            {canAddCustom && (
              <button
                type="button"
                onClick={addCustom}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-left hover:bg-muted/60 text-muted-foreground"
              >
                <PlusIcon className="h-4 w-4 w-5 text-center" />
                <span>Add <strong className="text-foreground">"{search.trim()}"</strong></span>
              </button>
            )}

            {filtered.length === 0 && !canAddCustom && (
              <p className="py-3 text-center text-xs text-muted-foreground">No labels found</p>
            )}
          </div>
        </div>

        {/* Selected chips preview */}
        {selected.length > 0 && (
          <div className="px-3 py-2 border-t bg-muted/30 flex flex-wrap gap-1">
            {selected.map((label) => {
              const cat = PREDEFINED_LABELS.find((c) => c.label === label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggle(label)}
                  className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium hover:bg-primary/20"
                >
                  {cat?.emoji} {cat?.display ?? label} ×
                </button>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
