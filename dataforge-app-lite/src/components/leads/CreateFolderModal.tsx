"use client";

import { useState, useTransition, useEffect } from "react";
import { createFolderAction } from "@/actions/folders.actions";
import { createIndustryAction } from "@/actions/industry.actions";
import { getSubcategoriesByIndustryAction, createSubcategoryAction } from "@/actions/industry.actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLOR_SWATCHES = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444",
  "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#64748b",
];

type IndustryOption = {
  id: string;
  name: string;
  color: string;
};

type SubcategoryOption = {
  id: string;
  name: string;
  color: string;
};

interface CreateFolderModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  industries: IndustryOption[];
  onCreated?: () => void;
}

export function CreateFolderModal({
  open,
  onOpenChange,
  industries: initialIndustries,
  onCreated,
}: CreateFolderModalProps) {
  const [pending, startTransition] = useTransition();

  // Folder fields
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_SWATCHES[0]);
  const [selectedIndustryId, setSelectedIndustryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);

  // Industry list
  const [industries, setIndustries] = useState<IndustryOption[]>(initialIndustries);

  // Inline new industry
  const [creatingIndustry, setCreatingIndustry] = useState(false);
  const [newIndustryName, setNewIndustryName] = useState("");
  const [newIndustryColor, setNewIndustryColor] = useState(COLOR_SWATCHES[2]);

  // Subcategories for the selected industry
  const [subcategories, setSubcategories] = useState<SubcategoryOption[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);

  // Inline new subcategory
  const [creatingSubcategory, setCreatingSubcategory] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSubColor, setNewSubColor] = useState(COLOR_SWATCHES[1]);

  // Load subcategories whenever the selected industry changes
  useEffect(() => {
    if (!selectedIndustryId) {
      setSubcategories([]);
      setSelectedSubcategoryId(null);
      return;
    }
    let cancelled = false;
    setLoadingSubs(true);
    getSubcategoriesByIndustryAction(selectedIndustryId)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any[]) => {
        if (!cancelled) {
          setSubcategories(data.map((s) => ({ id: s.id, name: s.name, color: s.color })));
          setSelectedSubcategoryId(null);
        }
      })
      .catch(() => { /* ignore */ })
      .finally(() => { if (!cancelled) setLoadingSubs(false); });
    return () => { cancelled = true; };
  }, [selectedIndustryId]);

  function reset() {
    setName("");
    setColor(COLOR_SWATCHES[0]);
    setSelectedIndustryId(null);
    setSelectedSubcategoryId(null);
    setCreatingIndustry(false);
    setNewIndustryName("");
    setNewIndustryColor(COLOR_SWATCHES[2]);
    setSubcategories([]);
    setCreatingSubcategory(false);
    setNewSubName("");
    setNewSubColor(COLOR_SWATCHES[1]);
  }

  async function handleAddIndustry() {
    if (!newIndustryName.trim()) return;
    try {
      const ind = await createIndustryAction(newIndustryName.trim(), newIndustryColor);
      const option = { id: ind.id, name: ind.name, color: ind.color };
      setIndustries((prev) => [...prev, option]);
      setSelectedIndustryId(ind.id);
      setCreatingIndustry(false);
      setNewIndustryName("");
    } catch {
      toast.error("Failed to create industry");
    }
  }

  async function handleAddSubcategory() {
    if (!newSubName.trim() || !selectedIndustryId) return;
    try {
      const sub = await createSubcategoryAction(selectedIndustryId, newSubName.trim(), newSubColor);
      const option = { id: sub.id, name: sub.name, color: sub.color };
      setSubcategories((prev) => [...prev, option]);
      setSelectedSubcategoryId(sub.id);
      setCreatingSubcategory(false);
      setNewSubName("");
    } catch {
      toast.error("Failed to create subcategory");
    }
  }

  function handleSubmit() {
    if (!name.trim()) return;
    startTransition(async () => {
      try {
        await createFolderAction(name.trim(), color, selectedIndustryId, selectedSubcategoryId);
        toast.success(`Folder "${name.trim()}" created`);
        reset();
        onOpenChange(false);
        onCreated?.();
      } catch {
        toast.error("Failed to create folder");
      }
    });
  }

  const selectedIndustry = industries.find((i) => i.id === selectedIndustryId);
  const selectedSubcategory = subcategories.find((s) => s.id === selectedSubcategoryId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent showCloseButton className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Folder</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="folder-name">Folder name</Label>
            <Input
              id="folder-name"
              placeholder="e.g. New York Dentists"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-6 w-6 rounded-full border-2 transition-transform",
                    color === c ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Industry */}
          <div className="space-y-1.5">
            <Label>Category <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" className="w-full justify-between font-normal" />}
              >
                <span className="flex items-center gap-2">
                  {selectedIndustry ? (
                    <>
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedIndustry.color }} />
                      {selectedIndustry.name}
                    </>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuItem onClick={() => { setSelectedIndustryId(null); setSelectedSubcategoryId(null); }}>
                  <span className="text-muted-foreground">None</span>
                  {!selectedIndustryId && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
                {industries.length > 0 && <DropdownMenuSeparator />}
                {industries.map((ind) => (
                  <DropdownMenuItem
                    key={ind.id}
                    onClick={() => setSelectedIndustryId(ind.id)}
                    className="gap-2"
                  >
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: ind.color }} />
                    {ind.name}
                    {selectedIndustryId === ind.id && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setCreatingIndustry(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create new category
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Inline new industry form */}
            {creatingIndustry && (
              <div className="rounded-lg border p-3 space-y-2.5 bg-muted/40">
                <p className="text-xs font-medium">New category</p>
                <Input
                  placeholder="Category name"
                  value={newIndustryName}
                  onChange={(e) => setNewIndustryName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAddIndustry(); }}
                  autoFocus
                />
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewIndustryColor(c)}
                      className={cn("h-5 w-5 rounded-full border-2 transition-transform", newIndustryColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" onClick={handleAddIndustry} disabled={!newIndustryName.trim()}>Add</Button>
                  <Button size="sm" variant="outline" onClick={() => setCreatingIndustry(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>

          {/* Subcategory — only visible when a category is selected */}
          {selectedIndustryId && (
            <div className="space-y-1.5">
              <Label>Subcategory <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant="outline" className="w-full justify-between font-normal" disabled={loadingSubs} />}
                >
                  <span className="flex items-center gap-2">
                    {loadingSubs ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /><span className="text-muted-foreground">Loading…</span></>
                    ) : selectedSubcategory ? (
                      <><span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: selectedSubcategory.color }} />{selectedSubcategory.name}</>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuItem onClick={() => setSelectedSubcategoryId(null)}>
                    <span className="text-muted-foreground">None</span>
                    {!selectedSubcategoryId && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                  {subcategories.length > 0 && <DropdownMenuSeparator />}
                  {subcategories.map((sub) => (
                    <DropdownMenuItem
                      key={sub.id}
                      onClick={() => setSelectedSubcategoryId(sub.id)}
                      className="gap-2"
                    >
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: sub.color }} />
                      {sub.name}
                      {selectedSubcategoryId === sub.id && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setCreatingSubcategory(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create new subcategory
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Inline new subcategory form */}
              {creatingSubcategory && (
                <div className="rounded-lg border p-3 space-y-2.5 bg-muted/40">
                  <p className="text-xs font-medium">New subcategory</p>
                  <Input
                    placeholder="Subcategory name"
                    value={newSubName}
                    onChange={(e) => setNewSubName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddSubcategory(); }}
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewSubColor(c)}
                        className={cn("h-5 w-5 rounded-full border-2 transition-transform", newSubColor === c ? "border-foreground scale-110" : "border-transparent hover:scale-105")}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={handleAddSubcategory} disabled={!newSubName.trim()}>Add</Button>
                    <Button size="sm" variant="outline" onClick={() => setCreatingSubcategory(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || pending}
            className="w-full sm:w-auto"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Create Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
