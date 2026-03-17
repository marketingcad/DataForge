"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Folder, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface FolderItem {
  id: string;
  name: string;
  color: string;
  _count: { leads: number };
}

interface FolderFilterProps {
  folders: FolderItem[];
  activeFolderId: string;
}

export function FolderFilter({ folders, activeFolderId }: FolderFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(folderId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (folderId) params.set("folder", folderId);
    else params.delete("folder");
    router.replace(`${pathname}?${params.toString()}`);
  }

  if (folders.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {/* All Leads pill */}
      <button
        onClick={() => navigate("")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border",
          !activeFolderId
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
        )}
      >
        <Inbox className="h-3 w-3" />
        All Leads
      </button>

      {/* Unfiled pill */}
      <button
        onClick={() => navigate("unfiled")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border",
          activeFolderId === "unfiled"
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
        )}
      >
        <Folder className="h-3 w-3" />
        Unfiled
      </button>

      {/* Per-folder pills */}
      {folders.map((f) => (
        <button
          key={f.id}
          onClick={() => navigate(f.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border",
            activeFolderId === f.id
              ? "border-transparent shadow-sm text-white"
              : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
          )}
          style={
            activeFolderId === f.id
              ? { backgroundColor: f.color, borderColor: f.color }
              : {}
          }
        >
          <Folder
            className="h-3 w-3"
            style={{ color: activeFolderId === f.id ? "white" : f.color }}
          />
          {f.name}
          <span className={cn(
            "ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold",
            activeFolderId === f.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
          )}>
            {f._count.leads}
          </span>
        </button>
      ))}
    </div>
  );
}
