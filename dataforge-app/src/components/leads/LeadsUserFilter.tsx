"use client";

import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users } from "lucide-react";

interface Props {
  users: { id: string; name: string | null; email: string }[];
  currentFilter?: string;
}

export function LeadsUserFilter({ users, currentFilter }: Props) {
  const router = useRouter();

  function handleChange(value: string | null) {
    if (!value) return;
    const url = new URL(window.location.href);
    if (value === "all") {
      url.searchParams.delete("filter");
    } else {
      url.searchParams.set("filter", value);
    }
    router.push(url.pathname + url.search);
  }

  return (
    <Select value={currentFilter ?? "all"} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-44 text-sm gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <SelectValue placeholder="All users" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All users</SelectItem>
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.name ?? u.email}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
