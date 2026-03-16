"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

const CATEGORIES = [
  "Roofing", "Dental", "Healthcare", "Real Estate", "Legal",
  "Finance", "Construction", "Automotive", "Retail", "Restaurant", "Other",
];

export function LeadFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("page"); // reset to page 1 on filter change
      router.replace(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const hasFilters =
    searchParams.has("search") ||
    searchParams.has("industry") ||
    searchParams.has("state") ||
    searchParams.has("status");

  function clearAll() {
    router.replace(pathname);
  }

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-8 w-64"
          placeholder="Search name, phone, email…"
          defaultValue={searchParams.get("search") ?? undefined}
          onChange={(e) => {
            const value = e.target.value;
            const timeout = setTimeout(() => setParam("search", value), 350);
            return () => clearTimeout(timeout);
          }}
        />
      </div>

      {/* Industry filter */}
      <Select
        value={(searchParams.get("industry") as string) || ""}
        onValueChange={(v) => setParam("industry", !v || v === "all" ? "" : v)}
      >
        <SelectTrigger className="w-44">
          <SelectValue placeholder="All industries" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All industries</SelectItem>
          {CATEGORIES.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status filter */}
      <Select
        value={(searchParams.get("status") as string) || ""}
        onValueChange={(v) => setParam("status", !v || v === "all" ? "" : v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="flagged">Flagged</SelectItem>
          <SelectItem value="invalid">Invalid</SelectItem>
        </SelectContent>
      </Select>

      {/* Clear filters */}
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1.5">
          <X className="h-3.5 w-3.5" />
          Clear filters
        </Button>
      )}
    </div>
  );
}
