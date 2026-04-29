"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const LS_KEY = "kw-favorite-categories";

function loadFavorites(): string[] {
  try {
    const v = localStorage.getItem(LS_KEY);
    return v ? JSON.parse(v) : [];
  } catch { return []; }
}

function saveFavorites(list: string[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(list));
}

interface CategoryComboboxProps {
  categories: string[];
  value: string;
  onSelect: (category: string) => void;
  placeholder?: string;
  /** Width class for the trigger button, defaults to "w-full" */
  triggerClass?: string;
  /** Width class for the popover content, defaults to "w-[260px]" */
  contentWidth?: string;
}

export function CategoryCombobox({
  categories,
  value,
  onSelect,
  placeholder = "Select category…",
  triggerClass = "w-full",
  contentWidth = "w-[260px]",
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

  function toggleFavorite(e: React.MouseEvent, cat: string) {
    e.stopPropagation();
    const next = favorites.includes(cat)
      ? favorites.filter((f) => f !== cat)
      : [...favorites, cat];
    setFavorites(next);
    saveFavorites(next);
  }

  const favoriteCats = favorites.filter((f) => categories.includes(f));
  const otherCats = categories.filter((c) => !favorites.includes(c));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          triggerClass
        )}
        aria-expanded={open}
      >
        <span className="truncate">{value || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className={cn("p-0", contentWidth)} align="start">
        <Command>
          <CommandInput placeholder="Search categories…" />
          <CommandList>
            <CommandEmpty>No category found.</CommandEmpty>

            {favoriteCats.length > 0 && (
              <>
                <CommandGroup heading="Favorites">
                  {favoriteCats.map((cat) => (
                    <CommandItem
                      key={cat}
                      value={cat}
                      onSelect={() => { onSelect(cat); setOpen(false); }}
                      className="group flex items-center gap-2 pr-1"
                    >
                      <Check
                        className={cn("h-4 w-4 shrink-0", value === cat ? "opacity-100" : "opacity-0")}
                      />
                      <Star className="h-3 w-3 shrink-0 fill-yellow-400 text-yellow-400" />
                      <span className="flex-1 truncate">{cat}</span>
                      <button
                        type="button"
                        onClick={(e) => toggleFavorite(e, cat)}
                        className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                        title="Remove from favorites"
                      >
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      </button>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup heading={favoriteCats.length > 0 ? "All Categories" : undefined}>
              {otherCats.map((cat) => (
                <CommandItem
                  key={cat}
                  value={cat}
                  onSelect={() => { onSelect(cat); setOpen(false); }}
                  className="group flex items-center gap-2 pr-1"
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0", value === cat ? "opacity-100" : "opacity-0")}
                  />
                  <span className="flex-1 truncate">{cat}</span>
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(e, cat)}
                    className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                    title="Add to favorites"
                  >
                    <Star className="h-3 w-3 text-muted-foreground" />
                  </button>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
