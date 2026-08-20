"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Users } from "lucide-react";

interface Props {
  users: { id: string; name: string | null; email: string }[];
  currentFilter?: string;
}

export function LeadsUserFilter({ users, currentFilter }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleChange(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("filter");
    } else {
      params.set("filter", value);
    }
    const qs = params.toString();
    router.push(pathname + (qs ? `?${qs}` : ""));
  }

  const selectedUser = users.find((u) => u.id === currentFilter);
  const label = selectedUser ? (selectedUser.name ?? selectedUser.email) : "All users";

  return (
    <Select value={currentFilter ?? "all"} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-48 text-sm gap-1.5">
        <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-left truncate">{label}</span>
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
