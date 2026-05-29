"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import {
  getUngroupedFoldersByIndustryAction,
  getSubcategoriesByIndustryAction,
  createSubcategoryAction,
  updateSubcategoryAction,
  deleteSubcategoryAction,
} from "@/actions/industry.actions";
import { FolderLeadsModal } from "./FolderLeadsModal";
import { SubcategoryModal } from "./SubcategoryModal";
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
  Plus,
  Pencil,
  Trash2,
  MoreVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  createdAt: Date;
  updatedAt: Date;
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

interface IndustryModalProps {
  industry: IndustryData | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  unfiledFolders?: FolderData[];
  allIndustries?: IndustryOption[];
  filterUserId?: string;
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
      <button
        onClick={onClick}
        className="w-full text-left p-4 space-y-3 focus:outline-none"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 bg-muted">
              {isUnfiled
                ? <Inbox className="h-4 w-4 text-muted-foreground" />
                : <Folder className="h-4 w-4 text-muted-foreground" />}
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

function SubcategoryCard({
  sub,
  onClick,
  onEdit,
  onDelete,
  deleting,
}: {
  sub: SubcategoryData;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting?: boolean;
}) {
  return (
    <div className="group relative w-56 shrink-0 rounded-xl border bg-card hover:border-border hover:shadow-md transition-all duration-150 overflow-hidden">
      {/* three-dot menu */}
      <div className="absolute top-3 right-2 z-10" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
              />
            }
          >
            {deleting
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <MoreVertical className="h-3.5 w-3.5" />}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="min-w-0 w-9 p-1">
            <DropdownMenuItem className="cursor-pointer" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <button onClick={onClick} className="w-full text-left p-4 space-y-3 focus:outline-none">
        <div className="flex items-start justify-between gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0 bg-muted">
            <Folder className="h-4 w-4 text-muted-foreground" />
          </div>
          <Badge variant="secondary" className="shrink-0 text-xs tabular-nums font-semibold">
            {sub.totalLeads.toLocaleString()}
          </Badge>
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold truncate leading-tight">{sub.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {sub._count.folders} folder{sub._count.folders !== 1 ? "s" : ""}
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground font-medium">
          Click to view folders →
        </p>
      </button>
    </div>
  );
}

export function IndustryModal({ industry, open, onOpenChange, unfiledFolders, allIndustries = [], filterUserId }: IndustryModalProps) {
  const [subcategories, setSubcategories] = useState<SubcategoryData[]>([]);
  const [ungroupedFolders, setUngroupedFolders] = useState<FolderData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderData | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<SubcategoryData | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Add subcategory dialog
  const [addSubOpen, setAddSubOpen] = useState(false);
  const [subName, setSubName] = useState("");
  const [subColor, setSubColor] = useState(COLOR_SWATCHES[0]);
  const [savingSub, startSavingSub] = useTransition();

  // Edit subcategory dialog
  const [editingSub, setEditingSub] = useState<SubcategoryData | null>(null);
  const [editSubName, setEditSubName] = useState("");
  const [editSubColor, setEditSubColor] = useState(COLOR_SWATCHES[0]);
  const [savingEdit, startSavingEdit] = useTransition();

  // Deleting
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!industry) return;
    setLoading(true);
    try {
      const [subs, ungrouped] = await Promise.all([
        getSubcategoriesByIndustryAction(industry.id, filterUserId) as Promise<SubcategoryData[]>,
        getUngroupedFoldersByIndustryAction(industry.id, filterUserId) as Promise<FolderData[]>,
      ]);
      setSubcategories(subs);
      setUngroupedFolders(ungrouped);
    } finally {
      setLoading(false);
    }
  }, [industry, filterUserId]);

  useEffect(() => {
    if (open && industry) load();
  }, [open, industry, load]);

  // For uncategorized (no industry) view — use prop folders directly
  const unfiledList = unfiledFolders ?? [];
  const unfiledTotal = unfiledList.reduce((sum, f) => sum + f._count.leads, 0);

  const totalSubLeads = subcategories.reduce((s, sub) => s + sub.totalLeads, 0);
  const totalUngroupedLeads = ungroupedFolders.reduce((s, f) => s + f._count.leads, 0);
  const grandTotal = totalSubLeads + totalUngroupedLeads;

  function handleCreateSubcategory() {
    if (!subName.trim() || !industry) return;
    startSavingSub(async () => {
      try {
        const sub = await createSubcategoryAction(industry.id, subName.trim(), subColor);
        setSubcategories((prev) => [
          ...prev,
          { id: sub.id, name: sub.name, color: sub.color, createdAt: sub.createdAt, updatedAt: sub.updatedAt, totalLeads: 0, _count: { folders: 0 } },
        ]);
        toast.success(`Subcategory "${sub.name}" created`);
        setSubName("");
        setSubColor(COLOR_SWATCHES[0]);
        setAddSubOpen(false);
      } catch {
        toast.error("Failed to create subcategory");
      }
    });
  }

  function openEditSub(sub: SubcategoryData) {
    setEditingSub(sub);
    setEditSubName(sub.name);
    setEditSubColor(sub.color);
  }

  function handleSaveEditSub() {
    if (!editingSub || !editSubName.trim()) return;
    startSavingEdit(async () => {
      try {
        await updateSubcategoryAction(editingSub.id, editSubName.trim(), editSubColor);
        setSubcategories((prev) =>
          prev.map((s) => s.id === editingSub.id ? { ...s, name: editSubName.trim(), color: editSubColor } : s)
        );
        toast.success(`Subcategory renamed to "${editSubName.trim()}"`);
        setEditingSub(null);
      } catch {
        toast.error("Failed to update subcategory");
      }
    });
  }

  async function handleDeleteSub(sub: SubcategoryData) {
    setDeletingId(sub.id);
    try {
      await deleteSubcategoryAction(sub.id);
      setSubcategories((prev) => prev.filter((s) => s.id !== sub.id));
      // reload ungrouped folders — they may have moved here after subcategory deletion
      if (industry) {
        const ungrouped = await getUngroupedFoldersByIndustryAction(industry.id, filterUserId) as FolderData[];
        setUngroupedFolders(ungrouped);
      }
      toast.success(`Subcategory "${sub.name}" deleted`);
    } catch {
      toast.error("Failed to delete subcategory");
    } finally {
      setDeletingId(null);
    }
  }

  // ---- Uncategorized / no-industry view ----
  if (!industry) {
    return (
      <>
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            showCloseButton
            style={{ width: "calc(100vw - 40px)", height: "calc(100vh - 60px)", maxWidth: "none" }}
            className="flex flex-col p-0 overflow-hidden"
          >
            <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base font-semibold">Uncategorized Folders</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {unfiledList.length} folder{unfiledList.length !== 1 ? "s" : ""} · {unfiledTotal.toLocaleString()} leads
                  </p>
                </div>
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
            <div className="flex-1 overflow-y-auto p-6">
              {unfiledList.length === 0 && (
                <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                  <Folder className="h-10 w-10 text-muted-foreground/20" />
                  <p className="text-sm">No uncategorized folders</p>
                </div>
              )}
              {viewMode === "grid" ? (
                <div className="flex flex-wrap gap-4">
                  {unfiledList.map((folder) => (
                    <FolderCard key={folder.id} folder={folder} isUnfiled onClick={() => setSelectedFolder(folder)} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col divide-y rounded-lg border overflow-hidden">
                  {unfiledList.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => setSelectedFolder(folder)}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left group"
                    >
                      <div className="h-8 w-8 flex items-center justify-center rounded-md shrink-0 bg-muted">
                        <Inbox className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{folder.name}</p>
                        {folder.user?.name && <p className="text-xs text-muted-foreground">{folder.user.name}</p>}
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

        {selectedFolder && (
          <FolderLeadsModal
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            folder={selectedFolder as any}
            open={!!selectedFolder}
            onOpenChange={(v) => { if (!v) setSelectedFolder(null); }}
            allIndustries={allIndustries}
            currentIndustryId={null}
            filterUserId={filterUserId}
            onFolderDeleted={(id) => setSelectedFolder(null)}
            onCategoryChanged={() => setSelectedFolder(null)}
          />
        )}
      </>
    );
  }

  // ---- Normal category view ----
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
                style={{ backgroundColor: industry.color + "20" }}
              >
                <Folder className="h-4 w-4" style={{ color: industry.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-base font-semibold">{industry.name}</DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {subcategories.length} subcategor{subcategories.length !== 1 ? "ies" : "y"} · {ungroupedFolders.length} ungrouped folder{ungroupedFolders.length !== 1 ? "s" : ""} · {grandTotal.toLocaleString()} leads
                </p>
              </div>
              <Button size="sm" variant="outline" className="gap-1.5 shrink-0" onClick={() => setAddSubOpen(true)}>
                <Plus className="h-3.5 w-3.5" />
                Add Subcategory
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
          <div className="flex-1 overflow-y-auto p-6 relative space-y-8">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-9 w-9 animate-spin text-primary" />
              </div>
            )}

            {/* Subcategories section */}
            {(subcategories.length > 0 || !loading) && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Subcategories
                    {subcategories.length > 0 && (
                      <span className="ml-1.5 normal-case font-normal">({subcategories.length})</span>
                    )}
                  </h3>
                </div>

                {subcategories.length === 0 && !loading ? (
                  <button
                    onClick={() => setAddSubOpen(true)}
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Add your first subcategory
                  </button>
                ) : viewMode === "grid" ? (
                  <div className="flex flex-wrap gap-4">
                    {subcategories.map((sub) => (
                      <SubcategoryCard
                        key={sub.id}
                        sub={sub}
                        onClick={() => setSelectedSubcategory(sub)}
                        onEdit={() => openEditSub(sub)}
                        onDelete={() => handleDeleteSub(sub)}
                        deleting={deletingId === sub.id}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col divide-y rounded-lg border overflow-hidden">
                    {subcategories.map((sub) => (
                      <div key={sub.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group">
                        <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setSelectedSubcategory(sub)}>
                          <div className="h-8 w-8 flex items-center justify-center rounded-md shrink-0 bg-muted">
                            <Folder className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{sub.name}</p>
                            <p className="text-xs text-muted-foreground">{sub._count.folders} folder{sub._count.folders !== 1 ? "s" : ""} · {sub.totalLeads.toLocaleString()} leads</p>
                          </div>
                        </button>
                        <button onClick={() => openEditSub(sub)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDeleteSub(sub)} disabled={deletingId === sub.id} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                          {deletingId === sub.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Ungrouped folders section */}
            {ungroupedFolders.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Ungrouped Folders
                  <span className="ml-1.5 normal-case font-normal">({ungroupedFolders.length})</span>
                </h3>

                {viewMode === "grid" ? (
                  <div className="flex flex-wrap gap-4">
                    {ungroupedFolders.map((folder) => (
                      <FolderCard key={folder.id} folder={folder} onClick={() => setSelectedFolder(folder)} />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col divide-y rounded-lg border overflow-hidden">
                    {ungroupedFolders.map((folder) => (
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
                          {folder.user?.name && <p className="text-xs text-muted-foreground">{folder.user.name}</p>}
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 bg-muted text-muted-foreground">
                          {folder._count.leads} lead{folder._count.leads !== 1 ? "s" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            )}

            {!loading && subcategories.length === 0 && ungroupedFolders.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
                <Folder className="h-10 w-10 text-muted-foreground/20" />
                <p className="text-sm">No subcategories or folders yet</p>
                <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={() => setAddSubOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Subcategory
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add subcategory dialog */}
      <Dialog open={addSubOpen} onOpenChange={(v) => { if (!v) { setSubName(""); setSubColor(COLOR_SWATCHES[0]); } setAddSubOpen(v); }}>
        <DialogContent showCloseButton className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Subcategory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="sub-name">Name</Label>
              <Input
                id="sub-name"
                placeholder="e.g. New York, Premium, Tier 1…"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateSubcategory(); }}
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
                    onClick={() => setSubColor(c)}
                    className={cn("h-6 w-6 rounded-full border-2 transition-transform", subColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleCreateSubcategory} disabled={!subName.trim() || savingSub}>
              {savingSub && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Subcategory
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit subcategory dialog */}
      <Dialog open={!!editingSub} onOpenChange={(v) => { if (!v) setEditingSub(null); }}>
        <DialogContent showCloseButton className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Subcategory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="edit-sub-name">Name</Label>
              <Input
                id="edit-sub-name"
                value={editSubName}
                onChange={(e) => setEditSubName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSaveEditSub(); }}
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
                    onClick={() => setEditSubColor(c)}
                    className={cn("h-6 w-6 rounded-full border-2 transition-transform", editSubColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveEditSub} disabled={!editSubName.trim() || savingEdit}>
              {savingEdit && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subcategory drill-in modal */}
      {selectedSubcategory && (
        <SubcategoryModal
          subcategory={selectedSubcategory}
          industry={industry}
          open={!!selectedSubcategory}
          onOpenChange={(v) => { if (!v) setSelectedSubcategory(null); }}
          allIndustries={allIndustries}
          filterUserId={filterUserId}
          onSubcategoryUpdated={(updated) => setSubcategories((prev) => prev.map((s) => s.id === updated.id ? { ...s, ...updated } : s))}
        />
      )}

      {/* Ungrouped folder drill-in */}
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
            setUngroupedFolders((prev) => prev.filter((f) => f.id !== id));
            setSelectedFolder(null);
          }}
          onCategoryChanged={(id) => {
            setUngroupedFolders((prev) => prev.filter((f) => f.id !== id));
            setSelectedFolder(null);
          }}
        />
      )}
    </>
  );
}
