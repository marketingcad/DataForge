"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { IndustryModal } from "./IndustryModal";
import { CreateFolderModal } from "./CreateFolderModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteIndustryAction, createIndustryAction } from "@/actions/industry.actions";
import {
  Building2,
  FolderOpen,
  MoreVertical,
  Trash2,
  Loader2,
  Plus,
  Search,
  X,
  LayoutGrid,
  List,
} from "lucide-react";
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

type IndustryData = {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
  totalLeads: number;
  _count: { folders: number };
  user: { name: string | null; email: string } | null;
};

interface IndustryCardProps {
  industry: IndustryData;
  onClick: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}

function FolderIcon({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 48 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <path d="M2 8C2 5.79086 3.79086 4 6 4H18L22 8H42C44.2091 8 46 9.79086 46 12V34C46 36.2091 44.2091 38 42 38H6C3.79086 38 2 36.2091 2 34V8Z" fill={color} fillOpacity="0.85" />
      <path d="M2 14H46V34C46 36.2091 44.2091 38 42 38H6C3.79086 38 2 36.2091 2 34V14Z" fill={color} />
    </svg>
  );
}

function IndustryCard({ industry, onClick, onDelete, deleting }: IndustryCardProps) {
  return (
    <div className="group relative rounded-xl border bg-card hover:shadow-md hover:border-border/80 transition-all duration-150 overflow-hidden cursor-pointer">
      {/* Three-dot menu */}
      {onDelete && (
        <div className="absolute top-2.5 right-2.5 z-10" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground" />}
            >
              {deleting
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <MoreVertical className="h-3.5 w-3.5" />}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" className="min-w-0 w-9 p-1">
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

      <button onClick={onClick} className="w-full text-left p-4 flex flex-col items-center gap-3 focus:outline-none">
        {/* Big folder icon */}
        <div className="w-14 h-12 mt-1">
          <FolderIcon color={industry.color} />
        </div>

        {/* Name */}
        <div className="w-full text-center">
          <p className="text-sm font-semibold truncate leading-tight">{industry.name}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {format(new Date(industry.updatedAt), "MMM d, yyyy")}
          </p>
        </div>

        {/* Stats row */}
        <div className="w-full flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <FolderOpen className="h-3 w-3" />
            <span>{industry._count.folders}</span>
          </div>
          <Badge
            className="shrink-0 text-[10px] tabular-nums font-semibold px-1.5 py-0.5"
            style={{ backgroundColor: industry.color + "18", color: industry.color, border: "none" }}
          >
            {industry.totalLeads.toLocaleString()} leads
          </Badge>
        </div>
      </button>
    </div>
  );
}

// Uncategorized card (folders with no industry)
function UncategorizedCard({
  count,
  totalLeads,
  onClick,
}: {
  count: number;
  totalLeads: number;
  onClick: () => void;
}) {
  const color = "#64748b";
  return (
    <div className="group relative rounded-xl border bg-card hover:shadow-md hover:border-border/80 transition-all duration-150 overflow-hidden cursor-pointer">
      <button onClick={onClick} className="w-full text-left p-4 flex flex-col items-center gap-3 focus:outline-none">
        <div className="w-14 h-12 mt-1">
          <FolderIcon color={color} />
        </div>
        <div className="w-full text-center">
          <p className="text-sm font-semibold truncate leading-tight">Uncategorized</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{count} folder{count !== 1 ? "s" : ""}</p>
        </div>
        <div className="w-full flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <FolderOpen className="h-3 w-3" />
            <span>{count}</span>
          </div>
          <Badge
            className="shrink-0 text-[10px] tabular-nums font-semibold px-1.5 py-0.5"
            style={{ backgroundColor: color + "18", color, border: "none" }}
          >
            {totalLeads.toLocaleString()} leads
          </Badge>
        </div>
      </button>
    </div>
  );
}

interface IndustryBoardProps {
  industries: IndustryData[];
  unfiledFolders: FolderData[];
  filterUserId?: string;
}

export function IndustryBoard({ industries: initialIndustries, unfiledFolders, filterUserId }: IndustryBoardProps) {
  const router = useRouter();
  const [industries, setIndustries] = useState<IndustryData[]>(initialIndustries);
  const [selected, setSelected] = useState<IndustryData | null>(null);
  const [showUncategorized, setShowUncategorized] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createFolderOpen, setCreateFolderOpen] = useState(false);

  // New category dialog
  const [createCategoryOpen, setCreateCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState(COLOR_SWATCHES[0]);
  const [savingCategory, startSavingCategory] = useTransition();

  // Filter
  const [search, setSearch]       = useState("");
  const [viewMode, setViewMode]   = useState<"grid" | "list">("grid");

  const unfiledLeads = unfiledFolders.reduce((sum, f) => sum + f._count.leads, 0);

  const filteredIndustries = search.trim()
    ? industries.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : industries;

  const showUncategorizedCard =
    unfiledFolders.length > 0 &&
    (!search.trim() || "uncategorized".includes(search.toLowerCase()));

  async function handleDeleteIndustry(industry: IndustryData) {
    setDeletingId(industry.id);
    try {
      await deleteIndustryAction(industry.id);
      setIndustries((prev) => prev.filter((i) => i.id !== industry.id));
      toast.success(`Category "${industry.name}" deleted`);
      router.refresh();
    } catch {
      toast.error("Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  }

  function handleCreateCategory() {
    if (!categoryName.trim()) return;
    startSavingCategory(async () => {
      try {
        const ind = await createIndustryAction(categoryName.trim(), categoryColor);
        setIndustries((prev) => [
          ...prev,
          {
            id: ind.id,
            name: ind.name,
            color: ind.color,
            createdAt: ind.createdAt,
            updatedAt: ind.updatedAt,
            totalLeads: 0,
            _count: { folders: 0 },
            user: null,
          },
        ]);
        toast.success(`Category "${ind.name}" created`);
        setCategoryName("");
        setCategoryColor(COLOR_SWATCHES[0]);
        setCreateCategoryOpen(false);
        router.refresh();
      } catch {
        toast.error("Failed to create category");
      }
    });
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        {/* Search / filter */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Filter categories…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-7 h-8 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <p className="text-xs text-muted-foreground hidden sm:block">
          {filteredIndustries.length} of {industries.length} categor{industries.length !== 1 ? "ies" : "y"}
        </p>

        <div className="ml-auto flex items-center gap-2">
          <TooltipProvider>
            <div className="flex items-center gap-1 rounded-lg border p-1">
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
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setCreateCategoryOpen(true)}>
            <Plus className="h-4 w-4" />
            New Category
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => setCreateFolderOpen(true)}>
            <Plus className="h-4 w-4" />
            New Folder
          </Button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredIndustries.map((industry) => (
            <IndustryCard
              key={industry.id}
              industry={industry}
              onClick={() => setSelected(industry)}
              onDelete={() => handleDeleteIndustry(industry)}
              deleting={deletingId === industry.id}
            />
          ))}
          {showUncategorizedCard && (
            <UncategorizedCard
              count={unfiledFolders.length}
              totalLeads={unfiledLeads}
              onClick={() => setShowUncategorized(true)}
            />
          )}
          {filteredIndustries.length === 0 && !showUncategorizedCard && search && (
            <p className="text-sm text-muted-foreground py-12 col-span-full text-center">
              No categories match &ldquo;{search}&rdquo;
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col divide-y rounded-lg border overflow-hidden">
          {filteredIndustries.map((industry) => (
            <div key={industry.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group">
              <button className="flex items-center gap-3 flex-1 min-w-0 text-left" onClick={() => setSelected(industry)}>
                <div className="h-8 w-8 flex items-center justify-center rounded-md shrink-0" style={{ backgroundColor: industry.color + "20" }}>
                  <Building2 className="h-4 w-4" style={{ color: industry.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{industry.name}</p>
                  <p className="text-xs text-muted-foreground">{industry._count.folders} folder{industry._count.folders !== 1 ? "s" : ""} · {industry.totalLeads.toLocaleString()} leads</p>
                </div>
              </button>
              <button
                onClick={() => handleDeleteIndustry(industry)}
                disabled={deletingId === industry.id}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                {deletingId === industry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            </div>
          ))}
          {showUncategorizedCard && (
            <button className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left" onClick={() => setShowUncategorized(true)}>
              <div className="h-8 w-8 flex items-center justify-center rounded-md shrink-0 bg-muted">
                <FolderOpen className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Uncategorized</p>
                <p className="text-xs text-muted-foreground">{unfiledFolders.length} folder{unfiledFolders.length !== 1 ? "s" : ""} · {unfiledLeads.toLocaleString()} leads</p>
              </div>
            </button>
          )}
          {filteredIndustries.length === 0 && !showUncategorizedCard && search && (
            <p className="text-sm text-muted-foreground py-12 text-center">
              No categories match &ldquo;{search}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Create category dialog */}
      <Dialog open={createCategoryOpen} onOpenChange={(v) => { if (!v) { setCategoryName(""); setCategoryColor(COLOR_SWATCHES[0]); } setCreateCategoryOpen(v); }}>
        <DialogContent showCloseButton className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Name</Label>
              <Input
                id="cat-name"
                placeholder="e.g. HVAC, Dentists, Real Estate…"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreateCategory(); }}
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
                    onClick={() => setCategoryColor(c)}
                    className={cn(
                      "h-6 w-6 rounded-full border-2 transition-transform",
                      categoryColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleCreateCategory}
              disabled={!categoryName.trim() || savingCategory}
              className="w-full sm:w-auto"
            >
              {savingCategory && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Industry modal */}
      {selected && (
        <IndustryModal
          industry={selected}
          open={!!selected}
          onOpenChange={(v) => { if (!v) setSelected(null); }}
          allIndustries={industries.map((i) => ({ id: i.id, name: i.name, color: i.color }))}
          filterUserId={filterUserId}
        />
      )}

      {/* Uncategorized folders modal */}
      <IndustryModal
        industry={null}
        open={showUncategorized}
        onOpenChange={setShowUncategorized}
        unfiledFolders={unfiledFolders}
        allIndustries={industries.map((i) => ({ id: i.id, name: i.name, color: i.color }))}
        filterUserId={filterUserId}
      />

      {/* Create folder modal */}
      <CreateFolderModal
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        industries={industries.map((i) => ({ id: i.id, name: i.name, color: i.color }))}
        onCreated={() => router.refresh()}
      />
    </>
  );
}
