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
  Users,
  Calendar,
  RefreshCw,
  MoreVertical,
  Trash2,
  Loader2,
  Plus,
  Search,
  X,
} from "lucide-react";
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

function IndustryCard({ industry, onClick, onDelete, deleting }: IndustryCardProps) {
  return (
    <div
      className="relative w-64 shrink-0 rounded-xl border bg-card hover:border-border hover:shadow-md transition-all duration-150 overflow-hidden group"
    >
      {/* Colored top bar */}
      <div className="h-1.5 w-full" style={{ backgroundColor: industry.color }} />

      {/* Three-dot menu */}
      {onDelete && (
        <div className="absolute top-3.5 right-3 z-10" onClick={(e) => e.stopPropagation()}>
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

      {/* Card body */}
      <button
        onClick={onClick}
        className="w-full text-left p-4 space-y-4 focus:outline-none"
      >
        {/* Icon + name */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: industry.color + "20" }}
            >
              <Building2 className="h-4 w-4" style={{ color: industry.color }} />
            </div>
            <div className="min-w-0 pr-6">
              <p className="text-sm font-semibold truncate leading-tight">{industry.name}</p>
              {industry.user?.name && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {industry.user.name}
                </p>
              )}
            </div>
          </div>
          <Badge
            className="shrink-0 text-xs tabular-nums font-semibold"
            style={{ backgroundColor: industry.color + "18", color: industry.color, border: "none" }}
          >
            {industry._count.folders}
          </Badge>
        </div>

        {/* Meta info */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span>
              {industry._count.folders} folder{industry._count.folders !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3 shrink-0" />
            <span>{industry.totalLeads.toLocaleString()} lead{industry.totalLeads !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>Created {format(new Date(industry.createdAt), "MMM d, yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <RefreshCw className="h-3 w-3 shrink-0" />
            <span>Updated {format(new Date(industry.updatedAt), "MMM d, yyyy")}</span>
          </div>
        </div>

        <p className="text-[11px] font-medium" style={{ color: industry.color }}>
          Click to view folders →
        </p>
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
    <div className="relative w-64 shrink-0 rounded-xl border bg-card hover:border-border hover:shadow-md transition-all duration-150 overflow-hidden">
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
      <button onClick={onClick} className="w-full text-left p-4 space-y-4 focus:outline-none">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shrink-0"
              style={{ backgroundColor: color + "20" }}
            >
              <FolderOpen className="h-4 w-4" style={{ color }} />
            </div>
            <p className="text-sm font-semibold truncate leading-tight pr-2">Uncategorized</p>
          </div>
          <Badge
            className="shrink-0 text-xs tabular-nums font-semibold"
            style={{ backgroundColor: color + "18", color, border: "none" }}
          >
            {count}
          </Badge>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <FolderOpen className="h-3 w-3 shrink-0" />
            <span>{count} folder{count !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3 shrink-0" />
            <span>{totalLeads.toLocaleString()} lead{totalLeads !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <p className="text-[11px] font-medium" style={{ color }}>
          Click to view folders →
        </p>
      </button>
    </div>
  );
}

interface IndustryBoardProps {
  industries: IndustryData[];
  unfiledFolders: FolderData[];
}

export function IndustryBoard({ industries: initialIndustries, unfiledFolders }: IndustryBoardProps) {
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
  const [search, setSearch] = useState("");

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
      toast.success(`Industry "${industry.name}" deleted`);
      router.refresh();
    } catch {
      toast.error("Failed to delete industry");
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

      <div className="flex flex-wrap gap-4">
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
          <p className="text-sm text-muted-foreground py-12 w-full text-center">
            No categories match &ldquo;{search}&rdquo;
          </p>
        )}
      </div>

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
        />
      )}

      {/* Uncategorized folders modal */}
      <IndustryModal
        industry={null}
        open={showUncategorized}
        onOpenChange={setShowUncategorized}
        unfiledFolders={unfiledFolders}
        allIndustries={industries.map((i) => ({ id: i.id, name: i.name, color: i.color }))}
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
