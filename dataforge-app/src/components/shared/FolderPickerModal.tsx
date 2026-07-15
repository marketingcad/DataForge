"use client";

/**
 * FolderPickerModal — reusable folder selector used anywhere leads need to be
 * saved or moved to a folder.
 *
 * Usage:
 *   <FolderPickerModal
 *     open={open}
 *     onOpenChange={setOpen}
 *     title="Save 20 leads"
 *     confirmLabel="Save 20 leads →"
 *     onConfirm={async (folderId) => { await myAction(folderId); }}
 *   />
 *
 * The modal handles folder loading, search, industry filter chips, and new-folder
 * creation. The caller only needs to provide the action to run once a folder is chosen.
 */

import { useState, useEffect, useRef } from "react";
import { getFoldersAction, createFolderAction } from "@/actions/folders.actions";
import { getIndustriesAction, getSubcategoriesByIndustryAction } from "@/actions/industry.actions";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

type FolderItem = {
  id: string;
  name: string;
  color: string;
  _count: { leads: number };
  industry: { id: string; name: string; color: string } | null;
  subcategory: { id: string; name: string; color: string } | null;
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

export interface FolderPickerModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Shown in the dialog title, e.g. "Save 20 leads" */
  title: string;
  /** Optional subtitle below the title */
  description?: string;
  /** Label for the confirm button, e.g. "Save 20 leads →" */
  confirmLabel: string;
  /**
   * Called when the user clicks the confirm button.
   * Receives the selected folderId, or null for Unfiled.
   * Should throw on failure so the modal can show an error.
   */
  onConfirm: (folderId: string | null) => Promise<void>;
  /**
   * Optional name to prefill when the user creates a new folder (e.g. the keyword
   * or search term the leads were scraped from). The user can keep it as-is or edit
   * it to a custom name.
   */
  suggestedName?: string;
}

export function FolderPickerModal({
  open,
  onOpenChange,
  title,
  description = "Choose a folder to keep your leads organized, or save them unfiled.",
  confirmLabel,
  onConfirm,
  suggestedName,
}: FolderPickerModalProps) {
  const [folders, setFolders]         = useState<FolderItem[]>([]);
  const [industries, setIndustries]   = useState<IndustryOption[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>("none");
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName]         = useState("");
  const [newColor, setNewColor]       = useState(PRESET_COLORS[0].value);
  const [newIndustryId, setNewIndustryId] = useState<string | null>(null);
  const [newSubcategoryId, setNewSubcategoryId] = useState<string | null>(null);
  const [subcategories, setSubcategories] = useState<IndustryOption[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [search, setSearch]           = useState("");
  const [filterIndustryId, setFilterIndustryId] = useState<string | null>(null);
  // Subcategory drill-down for the folder grid: when a category chip is active,
  // its subcategories appear as a second chip row to narrow the folders further.
  const [filterSubcategories, setFilterSubcategories] = useState<IndustryOption[]>([]);
  const [filterSubcategoryId, setFilterSubcategoryId] = useState<string | null>(null);
  const [loadingFilterSubs, setLoadingFilterSubs] = useState(false);
  // When creating a new folder that should inherit the active subcategory filter,
  // we can't set it immediately (the category-change effect resets it). Stash it
  // here and apply it once that category's subcategories have loaded.
  const pendingSubRef = useRef<string | null>(null);

  // Load folders + industries whenever the modal opens
  useEffect(() => {
    if (!open) return;
    setLoadingFolders(true);
    setSelectedFolder("none");
    setCreatingNew(false);
    setNewName("");
    setNewColor(PRESET_COLORS[0].value);
    setNewIndustryId(null);
    setNewSubcategoryId(null);
    setSubcategories([]);
    setSearch("");
    setFilterIndustryId(null);
    setFilterSubcategories([]);
    setFilterSubcategoryId(null);

    getFoldersAction()
      .then((f) => setFolders(f as unknown as FolderItem[]))
      .catch(() => toast.error("Could not load folders"))
      .finally(() => setLoadingFolders(false));

    getIndustriesAction()
      .then((ind) => setIndustries(ind as IndustryOption[]))
      .catch(() => {}); // industries are optional
  }, [open]);

  // Load subcategories for the chosen category. Reset any prior subcategory pick
  // whenever the category changes so we never save a subcategory from another category.
  useEffect(() => {
    setNewSubcategoryId(null);
    if (!newIndustryId) { setSubcategories([]); return; }
    setLoadingSubs(true);
    getSubcategoriesByIndustryAction(newIndustryId)
      .then((subs) => {
        setSubcategories(subs as IndustryOption[]);
        // Apply an inherited subcategory (from the folder-grid filter) once its
        // category's subcategories exist, so a new folder lands in the right place.
        if (pendingSubRef.current && (subs as IndustryOption[]).some((s) => s.id === pendingSubRef.current)) {
          setNewSubcategoryId(pendingSubRef.current);
        }
        pendingSubRef.current = null;
      })
      .catch(() => setSubcategories([]))
      .finally(() => setLoadingSubs(false));
  }, [newIndustryId]);

  // When a category filter chip is (de)selected, load that category's subcategories
  // for the drill-down row and reset any active subcategory filter.
  useEffect(() => {
    setFilterSubcategoryId(null);
    if (!filterIndustryId) { setFilterSubcategories([]); return; }
    setLoadingFilterSubs(true);
    getSubcategoriesByIndustryAction(filterIndustryId)
      .then((subs) => setFilterSubcategories(subs as IndustryOption[]))
      .catch(() => setFilterSubcategories([]))
      .finally(() => setLoadingFilterSubs(false));
  }, [filterIndustryId]);

  async function handleConfirm() {
    setSaving(true);
    try {
      let folderId: string | null = null;

      if (creatingNew || selectedFolder === "new") {
        if (!newName.trim()) {
          toast.error("Please enter a folder name.");
          setSaving(false);
          return;
        }
        const created = await createFolderAction(newName.trim(), newColor, newIndustryId, newSubcategoryId) as {
          id: string; name: string; color: string;
        };
        // Add the new folder to the local list so it appears if the modal stays open
        const ind = industries.find((i) => i.id === newIndustryId) ?? null;
        const sub = subcategories.find((s) => s.id === newSubcategoryId) ?? null;
        setFolders((prev) => [
          ...prev,
          {
            ...created,
            _count: { leads: 0 },
            industry: ind ? { id: ind.id, name: ind.name, color: ind.color } : null,
            subcategory: sub ? { id: sub.id, name: sub.name, color: sub.color } : null,
          },
        ]);
        folderId = created.id;
      } else {
        folderId = selectedFolder === "none" ? null : selectedFolder;
      }

      await onConfirm(folderId);
      onOpenChange(false);
    } catch {
      toast.error("Failed to save leads. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const selectedIndustry = industries.find((i) => i.id === newIndustryId);
  const selectedSubcategory = subcategories.find((s) => s.id === newSubcategoryId);

  const filteredFolders = folders.filter((f) => {
    const matchSearch      = f.name.toLowerCase().includes(search.toLowerCase());
    const matchIndustry    = filterIndustryId === null || f.industry?.id === filterIndustryId;
    const matchSubcategory = filterSubcategoryId === null || f.subcategory?.id === filterSubcategoryId;
    return matchSearch && matchIndustry && matchSubcategory;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex flex-col p-0 gap-0"
        style={{ width: "calc(100vw - 100px)", maxWidth: "calc(100vw - 100px)", height: "calc(100vh - 120px)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FolderOpen className="h-5 w-5 text-primary" />
              {title}
            </DialogTitle>
            {description && (
              <DialogDescription className="mt-0.5 text-xs">{description}</DialogDescription>
            )}
          </div>
        </div>

        {/* Body — two-column layout */}
        <div className="flex flex-1 min-h-0">
          {/* Left: folder grid */}
          <div className="flex-1 flex flex-col min-w-0 p-5 gap-3">
            {/* Search + industry filter */}
            {!loadingFolders && (
              <div className="space-y-2 shrink-0">
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
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full border transition-colors",
                        filterIndustryId === null
                          ? "bg-blue-600 text-white border-blue-600"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      All
                    </button>
                    {industries.map((ind) => (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => setFilterIndustryId(ind.id === filterIndustryId ? null : ind.id)}
                        className={cn(
                          "text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5",
                          filterIndustryId === ind.id
                            ? "bg-blue-600 text-white border-blue-600"
                            : "border-border hover:bg-muted"
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: ind.color }} />
                        {ind.name}
                      </button>
                    ))}
                  </div>
                )}

                {/* Subcategory drill-down — appears under the selected category so
                    you can narrow the folders to a specific subcategory. */}
                {filterIndustryId && (loadingFilterSubs || filterSubcategories.length > 0) && (
                  <div className="flex flex-wrap items-center gap-1.5 pl-2 ml-0.5 border-l-2 border-blue-600/40">
                    {loadingFilterSubs ? (
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5 py-1">
                        <Loader2 className="h-3 w-3 animate-spin" /> Loading subcategories…
                      </span>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setFilterSubcategoryId(null)}
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-full border transition-colors",
                            filterSubcategoryId === null
                              ? "bg-blue-600 text-white border-blue-600"
                              : "border-border hover:bg-muted"
                          )}
                        >
                          All
                        </button>
                        {filterSubcategories.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => setFilterSubcategoryId(sub.id === filterSubcategoryId ? null : sub.id)}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1.5",
                              filterSubcategoryId === sub.id
                                ? "bg-blue-600 text-white border-blue-600"
                                : "border-border hover:bg-muted"
                            )}
                          >
                            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                            {sub.name}
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {loadingFolders ? (
              <div className="flex flex-1 items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading folders…</span>
              </div>
            ) : (
              <RadioGroup
                value={selectedFolder}
                onValueChange={setSelectedFolder}
                className="grid grid-cols-4 gap-2.5 overflow-y-auto content-start flex-1 min-h-0"
              >
                {/* Unfiled */}
                <label
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 cursor-pointer transition-all text-center relative",
                    selectedFolder === "none"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:bg-muted/40"
                  )}
                >
                  <RadioGroupItem value="none" id="fp-folder-none" className="sr-only" />
                  {selectedFolder === "none" && (
                    <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </span>
                  )}
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
                    <Folder className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 w-full">
                    <p className="text-sm font-medium truncate">Unfiled</p>
                    <p className="text-xs text-muted-foreground">No folder</p>
                  </div>
                </label>

                {/* Existing folders */}
                {filteredFolders.map((folder) => (
                  <label
                    key={folder.id}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 cursor-pointer transition-all text-center relative",
                      selectedFolder === folder.id
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:bg-muted/40"
                    )}
                  >
                    <RadioGroupItem value={folder.id} id={`fp-folder-${folder.id}`} className="sr-only" />
                    {selectedFolder === folder.id && (
                      <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </span>
                    )}
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                      style={{ backgroundColor: folder.color + "22" }}
                    >
                      <Folder className="h-6 w-6" style={{ color: folder.color }} />
                    </div>
                    <div className="min-w-0 w-full">
                      <p className="text-sm font-medium truncate">{folder.name}</p>
                      {folder.industry ? (
                        <p className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
                          <span
                            className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: folder.industry.color }}
                          />
                          <span className="truncate">{folder.industry.name}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">{folder._count.leads} leads</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {folder._count.leads} leads
                    </Badge>
                  </label>
                ))}

                {filteredFolders.length === 0 && search && (
                  <p className="col-span-4 text-xs text-muted-foreground text-center py-8">
                    No folders match &quot;{search}&quot;
                  </p>
                )}
              </RadioGroup>
            )}
          </div>

          {/* Right: create new folder panel */}
          <div className="w-72 shrink-0 border-l flex flex-col">
            <div className="p-5 flex-1 space-y-4">
              <div className="flex items-center gap-2">
                <FolderPlus className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">New folder</p>
              </div>

              {!creatingNew ? (
                <button
                  type="button"
                  onClick={() => {
                    setCreatingNew(true);
                    setSelectedFolder("new");
                    setNewName(suggestedName?.trim() ?? "");
                    // Inherit whatever category/subcategory is selected in the folder-grid
                    // filter so the new folder lands there (not "Uncategorized").
                    pendingSubRef.current = filterSubcategoryId;
                    setNewIndustryId(filterIndustryId);
                  }}
                  className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all py-8 text-muted-foreground hover:text-primary"
                >
                  <FolderPlus className="h-8 w-8" />
                  <span className="text-sm font-medium">Create new folder</span>
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg border border-primary bg-primary/5 px-3 py-1.5 flex items-center justify-between">
                    <span className="text-xs text-primary font-medium">Will be selected after save</span>
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Name</Label>
                    <Input
                      placeholder={suggestedName?.trim() ? suggestedName : "e.g. HVAC Houston 2025"}
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                      autoFocus
                      className="h-8 text-sm"
                    />
                    {suggestedName?.trim() && newName.trim() !== suggestedName.trim() && (
                      <button
                        type="button"
                        onClick={() => setNewName(suggestedName.trim())}
                        className="text-xs text-primary hover:underline text-left"
                      >
                        Use existing name: “{suggestedName.trim()}”
                      </button>
                    )}
                  </div>

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
                          {newColor === c.value && <Check className="h-3 w-3 text-white mx-auto" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Category <span className="text-muted-foreground/60">(optional)</span>
                    </Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button variant="outline" size="sm" className="w-full justify-between h-8 text-sm font-normal" />
                        }
                      >
                        <span className="flex items-center gap-2">
                          {selectedIndustry ? (
                            <>
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: selectedIndustry.color }} />
                              {selectedIndustry.name}
                            </>
                          ) : (
                            <span className="text-muted-foreground">Uncategorized</span>
                          )}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-52">
                        <DropdownMenuItem className="text-sm cursor-pointer" onClick={() => setNewIndustryId(null)}>
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
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: ind.color }} />
                            {ind.name}
                            {newIndustryId === ind.id && <Check className="ml-auto h-3.5 w-3.5" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Subcategory — only relevant once a category is chosen. If the
                      user leaves this on "None", the folder sits directly under the
                      category with no subcategory. */}
                  {newIndustryId && (
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        Subcategory <span className="text-muted-foreground/60">(optional)</span>
                      </Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button variant="outline" size="sm" className="w-full justify-between h-8 text-sm font-normal" disabled={loadingSubs} />
                          }
                        >
                          <span className="flex items-center gap-2">
                            {selectedSubcategory ? (
                              <>
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: selectedSubcategory.color }} />
                                {selectedSubcategory.name}
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                {loadingSubs ? "Loading…" : "None"}
                              </span>
                            )}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-52">
                          <DropdownMenuItem className="text-sm cursor-pointer" onClick={() => setNewSubcategoryId(null)}>
                            <span className="text-muted-foreground">None</span>
                            {!newSubcategoryId && <Check className="ml-auto h-3.5 w-3.5" />}
                          </DropdownMenuItem>
                          {subcategories.length > 0 && <DropdownMenuSeparator />}
                          {subcategories.map((sub) => (
                            <DropdownMenuItem
                              key={sub.id}
                              className="text-sm cursor-pointer gap-2"
                              onClick={() => setNewSubcategoryId(sub.id)}
                            >
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                              {sub.name}
                              {newSubcategoryId === sub.id && <Check className="ml-auto h-3.5 w-3.5" />}
                            </DropdownMenuItem>
                          ))}
                          {!loadingSubs && subcategories.length === 0 && (
                            <p className="px-2 py-1.5 text-xs text-muted-foreground">No subcategories in this category yet.</p>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCreatingNew(false);
                      setNewName("");
                      setNewIndustryId(null);
                      setNewSubcategoryId(null);
                      setSelectedFolder("none");
                    }}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={saving || loadingFolders}>
            {saving
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving…</>
              : confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
