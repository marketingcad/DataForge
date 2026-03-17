"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IndustryModal } from "./IndustryModal";
import { CreateFolderModal } from "./CreateFolderModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteIndustryAction } from "@/actions/industry.actions";
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
} from "lucide-react";
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

  const unfiledLeads = unfiledFolders.reduce((sum, f) => sum + f._count.leads, 0);

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

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground">
          {industries.length} industr{industries.length !== 1 ? "ies" : "y"}
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setCreateFolderOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Folder
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        {industries.map((industry) => (
          <IndustryCard
            key={industry.id}
            industry={industry}
            onClick={() => setSelected(industry)}
            onDelete={() => handleDeleteIndustry(industry)}
            deleting={deletingId === industry.id}
          />
        ))}

        {unfiledFolders.length > 0 && (
          <UncategorizedCard
            count={unfiledFolders.length}
            totalLeads={unfiledLeads}
            onClick={() => setShowUncategorized(true)}
          />
        )}
      </div>

      {/* Industry modal */}
      {selected && (
        <IndustryModal
          industry={selected}
          open={!!selected}
          onOpenChange={(v) => { if (!v) setSelected(null); }}
        />
      )}

      {/* Uncategorized folders modal */}
      <IndustryModal
        industry={null}
        open={showUncategorized}
        onOpenChange={setShowUncategorized}
        unfiledFolders={unfiledFolders}
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
