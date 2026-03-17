"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderLeadsModal } from "./FolderLeadsModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteFolderAction } from "@/actions/folders.actions";
import { Folder, Inbox, Users, Calendar, RefreshCw, MoreVertical, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  onDelete?: () => void;
  deleting?: boolean;
}

function FolderCard({ folder, isUnfiled, onClick, onDelete, deleting }: FolderCardProps) {
  return (
    <div
      className="relative w-64 shrink-0 rounded-xl border bg-card hover:border-border hover:shadow-md transition-all duration-150 overflow-hidden group"
    >
      {/* Colored top bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: folder.color }} />

      {/* Three-dot menu — only for real folders, not Unfiled */}
      {!isUnfiled && onDelete && (
        <div className="absolute top-3.5 right-3 z-10" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              >
                {deleting
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <MoreVertical className="h-3.5 w-3.5" />}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive cursor-pointer"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Card body — clickable */}
      <button
        onClick={onClick}
        className="w-full text-left p-4 space-y-4 focus:outline-none"
      >
        {/* Folder icon + name */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: folder.color + "20" }}
            >
              {isUnfiled
                ? <Inbox className="h-4 w-4" style={{ color: folder.color }} />
                : <Folder className="h-4 w-4" style={{ color: folder.color }} />}
            </div>
            <div className="min-w-0 pr-6">
              <p className="text-sm font-semibold truncate leading-tight">{folder.name}</p>
              {folder.user?.name && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {folder.user.name}
                </p>
              )}
            </div>
          </div>
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

        {/* Hover hint */}
        <p
          className={cn("text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity")}
          style={{ color: folder.color }}
        >
          Click to view leads →
        </p>
      </button>
    </div>
  );
}

interface FolderBoardProps {
  folders: FolderData[];
  unfiledCount: number;
}

export function FolderBoard({ folders: initialFolders, unfiledCount }: FolderBoardProps) {
  const router = useRouter();
  const [folders, setFolders] = useState<FolderData[]>(initialFolders);
  const [selected, setSelected] = useState<FolderData | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const unfiledFolder: FolderData = {
    id: "unfiled",
    name: "Unfiled",
    color: "#64748b",
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: { leads: unfiledCount },
    user: null,
  };

  async function handleDeleteFolder(folder: FolderData) {
    setDeletingId(folder.id);
    try {
      await deleteFolderAction(folder.id);
      setFolders((prev) => prev.filter((f) => f.id !== folder.id));
      toast.success(`Folder "${folder.name}" deleted`);
      router.refresh();
    } catch {
      toast.error("Failed to delete folder");
    } finally {
      setDeletingId(null);
    }
  }

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
            onDelete={() => handleDeleteFolder(folder)}
            deleting={deletingId === folder.id}
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
