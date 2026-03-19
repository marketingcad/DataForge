"use client";

import { useState, useEffect } from "react";
import { getFoldersAction, createFolderAction } from "@/actions/folders.actions";
import { getIndustriesAction } from "@/actions/industry.actions";
import { saveLeadsAction, LeadRow } from "@/actions/domain-scrape.actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2, FolderOpen, FolderPlus, Check, Folder, ChevronDown, Search,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useNotifications } from "@/lib/notifications";

type FolderItem = {
  id: string;
  name: string;
  color: string;
  _count: { leads: number };
  industry: { id: string; name: string; color: string } | null;
};

type IndustryOption = { id: string; name: string; color: string };

const PRESET_COLORS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#f43f5e", label: "Rose" },
  { value: "#8b5cf6", label: "Violet" },
  { value: "#64748b", label: "Slate" },
];

interface SaveLeadsModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leads: LeadRow[];
  onSaved: (result: { saved: number; duplicates: number; failed: number }) => void;
}

export function SaveLeadsModal({ open, onOpenChange, leads, onSaved }: SaveLeadsModalProps) {
  const { add: addNotif } = useNotifications();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>("none");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0].value);
  const [newIndustryId, setNewIndustryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [search, setSearch] = useState("");
  const [filterIndustryId, setFilterIndustryId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadingFolders(true);
    getFoldersAction()
      .then((f) => setFolders(f as unknown as FolderItem[]))
      .catch(() => toast.error("Could not load folders"))
      .finally(() => setLoadingFolders(false));
    getIndustriesAction()
      .then((ind) => setIndustries(ind as IndustryOption[]))
      .catch(() => {}); // industries are optional — silent fail
  }, [open]);

  async function handleCreateFolder() {
    if (!newName.trim()) return;
    setCreatingFolder(true);
    try {
      const raw = await createFolderAction(newName.trim(), newColor, newIndustryId);
      const ind = industries.find((i) => i.id === newIndustryId) ?? null;
      const folder: FolderItem = {
        ...(raw as { id: string; name: string; color: string }),
        _count: { leads: 0 },
        industry: ind ? { id: ind.id, name: ind.name, color: ind.color } : null,
      };
      setFolders((prev) => [...prev, folder]);
      setSelectedFolder(folder.id);
      setCreatingNew(false);
      setNewName("");
      setNewIndustryId(null);
    } catch {
      toast.error("Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const folderId = selectedFolder === "none" ? undefined : selectedFolder;
      const result = await saveLeadsAction(leads, folderId);
      onSaved(result);
      onOpenChange(false);
      const folderName = folders.find((f) => f.id === folderId)?.name;
      addNotif({
        type: "success",
        title: `${result.saved} lead${result.saved !== 1 ? "s" : ""} saved${folderName ? ` to "${folderName}"` : ""}`,
        message: `${result.duplicates} duplicate${result.duplicates !== 1 ? "s" : ""} · ${result.failed} failed`,
      });
    } catch {
      addNotif({ type: "error", title: "Failed to save leads", message: "Something went wrong. Please try again." });
    } finally {
      setSaving(false);
    }
  }

  const selectedIndustry = industries.find((i) => i.id === newIndustryId);

  const filteredFolders = folders.filter((f) => {
    const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
    const matchIndustry = filterIndustryId === null || f.industry?.id === filterIndustryId;
    return matchSearch && matchIndustry;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            Save {leads.length} lead{leads.length !== 1 ? "s" : ""}
          </DialogTitle>
          <DialogDescription>
            Choose a folder to keep your leads organized, or save them unfiled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Search + industry filter */}
          {!loadingFolders && folders.length > 0 && (
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search folders…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              {industries.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFilterIndustryId(null)}
                    className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors", filterIndustryId === null ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted")}
                  >
                    All
                  </button>
                  {industries.map((ind) => (
                    <button
                      key={ind.id}
                      type="button"
                      onClick={() => setFilterIndustryId(ind.id === filterIndustryId ? null : ind.id)}
                      className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5", filterIndustryId === ind.id ? "bg-blue-600 text-white border-blue-600" : "border-border hover:bg-muted")}
                    >
                      <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: ind.color }} />
                      {ind.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {loadingFolders ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading folders…</span>
            </div>
          ) : (
            <RadioGroup value={selectedFolder} onValueChange={setSelectedFolder} className="gap-1.5 max-h-60 overflow-y-auto pr-1">
              {/* No folder option */}
              <label
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all",
                  selectedFolder === "none"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                )}
              >
                <RadioGroupItem value="none" id="folder-none" />
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                  <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Unfiled</p>
                  <p className="text-xs text-muted-foreground">No folder assigned</p>
                </div>
              </label>

              {/* Existing folders */}
              {filteredFolders.length === 0 && search && (
                <p className="text-xs text-muted-foreground text-center py-4">No folders match &quot;{search}&quot;</p>
              )}
              {filteredFolders.map((folder) => (
                <label
                  key={folder.id}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all",
                    selectedFolder === folder.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <RadioGroupItem value={folder.id} id={`folder-${folder.id}`} />
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-md shrink-0"
                    style={{ backgroundColor: folder.color + "22" }}
                  >
                    <Folder className="h-3.5 w-3.5" style={{ color: folder.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{folder.name}</p>
                    {folder.industry && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: folder.industry.color }}
                        />
                        {folder.industry.name}
                      </p>
                    )}
                  </div>
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {folder._count.leads}
                  </Badge>
                </label>
              ))}
            </RadioGroup>
          )}

          <Separator />

          {/* Create new folder */}
          {!creatingNew ? (
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
            >
              <FolderPlus className="h-4 w-4" />
              Create new folder
            </button>
          ) : (
            <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
              <p className="text-sm font-medium">New folder</p>

              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Name</Label>
                <Input
                  placeholder="e.g. HVAC Houston 2025"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                  autoFocus
                  className="h-8 text-sm"
                />
              </div>

              {/* Color */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Color</Label>
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setNewColor(c.value)}
                      className={cn(
                        "h-6 w-6 rounded-full transition-all ring-offset-2",
                        newColor === c.value ? "ring-2 ring-foreground scale-110" : "hover:scale-105"
                      )}
                      style={{ backgroundColor: c.value }}
                    >
                      {newColor === c.value && (
                        <Check className="h-3 w-3 text-white mx-auto" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Industry */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Industry <span className="text-muted-foreground/60">(optional)</span>
                </Label>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-between h-8 text-sm font-normal"
                      />
                    }
                  >
                    <span className="flex items-center gap-2">
                      {selectedIndustry ? (
                        <>
                          <span
                            className="h-2 w-2 rounded-full shrink-0"
                            style={{ backgroundColor: selectedIndustry.color }}
                          />
                          {selectedIndustry.name}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Uncategorized</span>
                      )}
                    </span>
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-52">
                    <DropdownMenuItem
                      className="text-sm cursor-pointer"
                      onClick={() => setNewIndustryId(null)}
                    >
                      <span className="text-muted-foreground">Uncategorized</span>
                      {!newIndustryId && <Check className="ml-auto h-3.5 w-3.5" />}
                    </DropdownMenuItem>
                    {industries.length > 0 && <DropdownMenuSeparator />}
                    {industries.map((ind) => (
                      <DropdownMenuItem
                        key={ind.id}
                        className="text-sm cursor-pointer gap-2"
                        onClick={() => setNewIndustryId(ind.id)}
                      >
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: ind.color }}
                        />
                        {ind.name}
                        {newIndustryId === ind.id && <Check className="ml-auto h-3.5 w-3.5" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleCreateFolder}
                  disabled={!newName.trim() || creatingFolder}
                  className="h-7 text-xs"
                >
                  {creatingFolder && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                  Create
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => { setCreatingNew(false); setNewName(""); setNewIndustryId(null); }}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              : <>Save {leads.length} lead{leads.length !== 1 ? "s" : ""} →</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
