"use client";

import { useState, useEffect, useCallback } from "react";
import { getFoldersByIndustryAction } from "@/actions/industry.actions";
import { FolderLeadsModal } from "./FolderLeadsModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Folder,
  Inbox,
  Loader2,
  LayoutGrid,
  List,
  Users,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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

type IndustryOption = {
  id: string;
  name: string;
  color: string;
};

type IndustryData = {
  id: string;
  name: string;
  color: string;
};

interface IndustryModalProps {
  industry: IndustryData | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unfiledFolders?: FolderData[];
  allIndustries?: IndustryOption[];
}

function FolderCard({
  folder,
  isUnfiled,
  onClick,
}: {
  folder: FolderData;
  isUnfiled?: boolean;
  onClick: () => void;
}) {
  return (
    <div className="w-56 shrink-0 rounded-xl border bg-card hover:border-border hover:shadow-md transition-all duration-150 overflow-hidden">
      <div className="h-1.5 w-full" style={{ backgroundColor: folder.color }} />

      <button
        onClick={onClick}
        className="w-full text-left p-4 space-y-3 focus:outline-none"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: folder.color + "20" }}
            >
              {isUnfiled
                ? <Inbox className="h-4 w-4" style={{ color: folder.color }} />
                : <Folder className="h-4 w-4" style={{ color: folder.color }} />}
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
          <Badge
            className="shrink-0 text-xs tabular-nums font-semibold"
            style={{ backgroundColor: folder.color + "18", color: folder.color, border: "none" }}
          >
            {folder._count.leads}
          </Badge>
        </div>

        <div className="space-y-1">
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

        <p className="text-[11px] font-medium" style={{ color: folder.color }}>
          Click to view leads →
        </p>
      </button>
    </div>
  );
}

export function IndustryModal({ industry, open, onOpenChange, unfiledFolders, allIndustries = [] }: IndustryModalProps) {
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderData | null>(null);

  const load = useCallback(async () => {
    if (!industry) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await getFoldersByIndustryAction(industry.id) as any[];
      setFolders(data);
    } finally {
      setLoading(false);
    }
  }, [industry]);

  useEffect(() => {
    if (open && industry) load();
  }, [open, industry, load]);

  const allFolders = industry ? folders : (unfiledFolders ?? []);
  const totalLeads = allFolders.reduce((sum, f) => sum + f._count.leads, 0);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton
          style={{ width: "calc(100vw - 40px)", height: "calc(100vh - 60px)", maxWidth: "none" }}
          className="flex flex-col p-0 overflow-hidden"
        >
          {/* Header */}
          <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
            <div className="flex items-center gap-3">
              {industry && (
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                  style={{ backgroundColor: industry.color + "20" }}
                >
                  <Folder className="h-4 w-4" style={{ color: industry.color }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold">
                  {industry ? industry.name : "Uncategorized Folders"}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {allFolders.length} folder{allFolders.length !== 1 ? "s" : ""} · {totalLeads.toLocaleString()} leads
                </p>
              </div>
              {/* View toggle */}
              <div className="flex items-center gap-1 rounded-lg border p-1 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === "grid" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setViewMode("grid")}
                    >
                      <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Grid view</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === "list" ? "secondary" : "ghost"}
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setViewMode("list")}
                    >
                      <List className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>List view</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-9 w-9 animate-spin text-primary" />
              </div>
            )}

            {!loading && allFolders.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <Folder className="h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm">No folders in this industry yet</p>
              </div>
            )}

            {viewMode === "grid" ? (
              <div className="flex flex-wrap gap-4">
                {allFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    isUnfiled={!industry}
                    onClick={() => setSelectedFolder(folder)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col divide-y rounded-lg border overflow-hidden">
                {allFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div
                      className="h-8 w-8 flex items-center justify-center rounded-md shrink-0"
                      style={{ backgroundColor: folder.color + "20" }}
                    >
                      {!industry
                        ? <Inbox className="h-4 w-4" style={{ color: folder.color }} />
                        : <Folder className="h-4 w-4" style={{ color: folder.color }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{folder.name}</p>
                      {folder.user?.name && (
                        <p className="text-xs text-muted-foreground">{folder.user.name}</p>
                      )}
                    </div>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: folder.color + "18", color: folder.color }}
                    >
                      {folder._count.leads} lead{folder._count.leads !== 1 ? "s" : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {selectedFolder && (
        <FolderLeadsModal
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          folder={selectedFolder as any}
          open={!!selectedFolder}
          onOpenChange={(v) => { if (!v) setSelectedFolder(null); }}
          allIndustries={allIndustries}
          currentIndustryId={industry?.id ?? null}
          onFolderDeleted={(id) => {
            setFolders((prev) => prev.filter((f) => f.id !== id));
            setSelectedFolder(null);
          }}
          onCategoryChanged={(id) => {
            setFolders((prev) => prev.filter((f) => f.id !== id));
            setSelectedFolder(null);
          }}
        />
      )}
    </>
  );
}
