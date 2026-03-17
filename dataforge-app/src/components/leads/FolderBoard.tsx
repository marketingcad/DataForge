"use client";

import { useState } from "react";
import { FolderLeadsModal } from "./FolderLeadsModal";
import { Badge } from "@/components/ui/badge";
import { Folder, Inbox, Users, Calendar, RefreshCw } from "lucide-react";
import { format } from "date-fns";

type FolderData = {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { leads: number };
  user: { name: string | null; email: string } | null;
};

interface FolderCardProps {
  folder: FolderData;
  isUnfiled?: boolean;
  onClick: () => void;
}

function FolderCard({ folder, isUnfiled, onClick }: FolderCardProps) {
  return (
    <button
      onClick={onClick}
      className="w-64 shrink-0 rounded-xl border bg-card text-left hover:border-border hover:shadow-md transition-all duration-150 overflow-hidden group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Colored top bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: folder.color }} />

      <div className="p-4 space-y-4">
        {/* Folder icon + name */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: folder.color + "20" }}
            >
              {isUnfiled
                ? <Inbox className="h-4.5 w-4.5" style={{ color: folder.color }} />
                : <Folder className="h-4.5 w-4.5" style={{ color: folder.color }} />
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{folder.name}</p>
              {folder.user?.name && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {folder.user.name}
                </p>
              )}
            </div>
          </div>

          {/* Lead count badge */}
          <Badge
            className="shrink-0 text-xs tabular-nums font-semibold"
            style={{ backgroundColor: folder.color + "18", color: folder.color, border: "none" }}
          >
            {folder._count.leads}
          </Badge>
        </div>

        {/* Meta info */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3 shrink-0" />
            <span>{folder._count.leads} lead{folder._count.leads !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>Created {format(new Date(folder.createdAt), "MMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <RefreshCw className="h-3 w-3 shrink-0" />
            <span>Updated {format(new Date(folder.updatedAt), "MMM d, yyyy")}</span>
          </div>
        </div>

        {/* Click hint */}
        <p
          className="text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: folder.color }}
        >
          Click to view leads →
        </p>
      </div>
    </button>
  );
}

interface FolderBoardProps {
  folders: FolderData[];
  unfiledCount: number;
}

export function FolderBoard({ folders, unfiledCount }: FolderBoardProps) {
  const [selected, setSelected] = useState<FolderData | null>(null);

  const unfiledFolder: FolderData = {
    id: "unfiled",
    name: "Unfiled",
    color: "#64748b",
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { leads: unfiledCount },
    user: null,
  };

  return (
    <>
      <div className="flex flex-wrap gap-4">
        {unfiledCount > 0 && (
          <FolderCard
            folder={unfiledFolder}
            isUnfiled
            onClick={() => setSelected(unfiledFolder)}
          />
        )}
        {folders.map((folder) => (
          <FolderCard
            key={folder.id}
            folder={folder}
            onClick={() => setSelected(folder)}
          />
        ))}
      </div>

      {selected && (
        <FolderLeadsModal
          folder={selected}
          open={!!selected}
          onOpenChange={(v) => { if (!v) setSelected(null); }}
        />
      )}
    </>
  );
}
