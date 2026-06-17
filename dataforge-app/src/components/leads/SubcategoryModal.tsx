"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { getFoldersBySubcategoryAction } from "@/actions/industry.actions";
import { createFolderAction } from "@/actions/folders.actions";
import { FolderLeadsModal } from "./FolderLeadsModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Folder,
  Loader2,
  LayoutGrid,
  List,
  Users,
  Calendar,
  RefreshCw,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLOR_SWATCHES = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#64748b",
];

type FolderData = {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  _count: { leads: number };
  user: { name: string | null; email: string } | null;
};

type SubcategoryData = {
  id: string;
  name: string;
  color: string;
  totalLeads: number;
  _count: { folders: number };
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

interface SubcategoryModalProps {
  subcategory: SubcategoryData;
  industry: IndustryData;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  allIndustries?: IndustryOption[];
  filterUserId?: string;
  onSubcategoryUpdated?: (updated: Partial<SubcategoryData> & { id: string }) => void;
}

function FolderCard({ folder, onClick }: { folder: FolderData; onClick: () => void }) {
  return (
    <div className="w-56 shrink-0 rounded-xl border bg-card hover:border-border hover:shadow-md transition-all duration-150 overflow-hidden">
      <button onClick={onClick} className="w-full text-left p-4 space-y-3 focus:outline-none">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 bg-muted">
              <Folder className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{folder.name}</p>
              {folder.user?.name && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{folder.user.name}</p>
              )}
            </div>
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs tabular-nums font-semibold">
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
        <p className="text-[11px] text-muted-foreground font-medium">
          Click to view leads →
        </p>
      </button>
    </div>
  );
}

export function SubcategoryModal({
  subcategory,
  industry,
  open,
  onOpenChange,
  allIndustries = [],
  filterUserId,
}: SubcategoryModalProps) {
  const [folders, setFolders] = useState<FolderData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderData | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Create folder
  const [createOpen, setCreateOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderColor, setFolderColor] = useState(COLOR_SWATCHES[0]);
  const [saving, startSaving] = useTransition();

  function openCreate() {
    setFolderName("");
    setFolderColor(COLOR_SWATCHES[0]);
    setCreateOpen(true);
  }

  function handleCreate() {
    if (!folderName.trim()) return;
    startSaving(async () => {
      try {
        const result = await createFolderAction(folderName.trim(), folderColor, industry.id, subcategory.id);
        const newFolder: FolderData = {
          id: result.id,
          name: result.name,
          color: result.color,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
          _count: { leads: 0 },
          user: null,
        };
        setFolders((prev) => [...prev, newFolder]);
        toast.success(`Folder "${result.name}" created`);
        setCreateOpen(false);
      } catch {
        toast.error("Failed to create folder");
      }
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getFoldersBySubcategoryAction(subcategory.id, filterUserId) as FolderData[];
      setFolders(data);
    } finally {
      setLoading(false);
    }
  }, [subcategory.id, filterUserId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const totalLeads = folders.reduce((sum, f) => sum + f._count.leads, 0);

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
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
                style={{ backgroundColor: subcategory.color + "20" }}
              >
                <Folder className="h-4 w-4" style={{ color: subcategory.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">{industry.name}</span>
                  <span className="text-xs text-muted-foreground">›</span>
                  <DialogTitle className="text-base font-semibold">{subcategory.name}</DialogTitle>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {folders.length} folder{folders.length !== 1 ? "s" : ""} · {totalLeads.toLocaleString()} leads
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" />
                New Folder
              </Button>
              <TooltipProvider>
                <div className="flex items-center gap-1 rounded-lg border p-1 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setViewMode("grid")}>
                        <LayoutGrid className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Grid view</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="icon" className="h-7 w-7" onClick={() => setViewMode("list")}>
                        <List className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>List view</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          </DialogHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-9 w-9 animate-spin text-primary" />
              </div>
            )}

            {!loading && folders.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <Folder className="h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm">No folders in this subcategory yet</p>
                <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={openCreate}>
                  <Plus className="h-3.5 w-3.5" />
                  Add your first folder
                </Button>
              </div>
            )}

            {viewMode === "grid" ? (
              <div className="flex flex-wrap gap-4">
                {folders.map((folder) => (
                  <FolderCard key={folder.id} folder={folder} onClick={() => setSelectedFolder(folder)} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col divide-y rounded-lg border overflow-hidden">
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => setSelectedFolder(folder)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="h-8 w-8 flex items-center justify-center rounded-md shrink-0 bg-muted">
                      <Folder className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{folder.name}</p>
                      {folder.user?.name && (
                        <p className="text-xs text-muted-foreground">{folder.user.name}</p>
                      )}
                    </div>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 bg-muted text-muted-foreground">
                      {folder._count.leads} lead{folder._count.leads !== 1 ? "s" : ""}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create folder dialog */}
      <Dialog open={createOpen} onOpenChange={(v) => { if (!v) setCreateOpen(false); }}>
        <DialogContent showCloseButton className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                placeholder="e.g. New York Dentists"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFolderColor(c)}
                    className={cn("h-6 w-6 rounded-full border-2 transition-transform", folderColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={!folderName.trim() || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedFolder && (
        <FolderLeadsModal
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          folder={selectedFolder as any}
          open={!!selectedFolder}
          onOpenChange={(v) => { if (!v) setSelectedFolder(null); }}
          allIndustries={allIndustries}
          currentIndustryId={industry.id}
          filterUserId={filterUserId}
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
