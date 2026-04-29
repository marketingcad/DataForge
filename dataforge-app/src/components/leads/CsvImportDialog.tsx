"use client";

import { useRef, useState } from "react";
import { Upload, FileText, X, AlertCircle, CheckCircle2, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { importLeadsFromCsvAction, type CsvLeadRow } from "@/actions/leads.actions";

const BATCH_SIZE = 50;

const HEADER_MAP: Record<string, keyof CsvLeadRow> = {
  "business name": "businessName", businessname: "businessName", name: "businessName", business: "businessName",
  phone: "phone", "phone number": "phone", phonenumber: "phone", mobile: "phone", tel: "phone",
  email: "email", "email address": "email", emailaddress: "email",
  website: "website", url: "website", web: "website",
  "contact person": "contactPerson", contactperson: "contactPerson", contact: "contactPerson", owner: "contactPerson",
  address: "address", street: "address",
  city: "city",
  state: "state", province: "state",
  country: "country",
  category: "category", industry: "category", type: "category",
};

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|(?<=,)$|^(?=,))/g) ?? line.split(",");
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim().replace(/^"|"$/g, ""); });
    return row;
  }).filter((row) => Object.values(row).some((v) => v !== ""));
}

function mapRow(raw: Record<string, string>): CsvLeadRow | null {
  const mapped: Partial<CsvLeadRow> = {};
  for (const [key, val] of Object.entries(raw)) {
    const field = HEADER_MAP[key.toLowerCase().trim()];
    if (field && val) (mapped as Record<string, string>)[field] = val;
  }
  if (!mapped.businessName || !mapped.phone) return null;
  return mapped as CsvLeadRow;
}

type Folder = { id: string; name: string; industryName?: string | null };

interface Props {
  open: boolean;
  onClose: () => void;
  folders: Folder[];
  userId: string;
  categories?: string[];
}

export function CsvImportDialog({ open, onClose, folders, userId, categories = [] }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvLeadRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [fileName, setFileName] = useState("");
  const [folderId, setFolderId] = useState("");
  const [folderOpen, setFolderOpen] = useState(false);
  const [categoryOverride, setCategoryOverride] = useState("none");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ imported: 0, total: 0 });
  const [result, setResult] = useState<{ created: number; duplicates: number; errors: number } | null>(null);

  // Group folders by industry for the combobox
  const grouped = folders.reduce<Record<string, Folder[]>>((acc, f) => {
    const key = f.industryName ?? "Uncategorized";
    if (!acc[key]) acc[key] = [];
    acc[key].push(f);
    return acc;
  }, {});

  const selectedFolder = folders.find((f) => f.id === folderId);
  const folderLabel = selectedFolder
    ? (selectedFolder.industryName ? `${selectedFolder.industryName} / ${selectedFolder.name}` : selectedFolder.name)
    : "";

  const categoryLabel = categoryOverride === "none" ? "Use category from CSV" : categoryOverride;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rawRows = parseCSV(text);
      const mapped = rawRows.map(mapRow);
      const valid = mapped.filter((r): r is CsvLeadRow => r !== null);
      setRows(valid);
      setSkipped(rawRows.length - valid.length);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!rows.length) return;
    setIsImporting(true);
    setProgress({ imported: 0, total: rows.length });
    let created = 0, duplicates = 0, errors = 0;
    const cat = categoryOverride === "none" ? null : categoryOverride;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const res = await importLeadsFromCsvAction(batch, folderId || null, cat, userId);
      created += res.created;
      duplicates += res.duplicates;
      errors += res.errors;
      setProgress({ imported: Math.min(i + BATCH_SIZE, rows.length), total: rows.length });
    }

    setResult({ created, duplicates, errors });
    setIsImporting(false);
  }

  function handleClose() {
    if (isImporting) return;
    setRows([]);
    setSkipped(0);
    setFileName("");
    setFolderId("");
    setCategoryOverride("none");
    setResult(null);
    setProgress({ imported: 0, total: 0 });
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

  const progressPct = progress.total > 0 ? Math.round((progress.imported / progress.total) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Leads from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* File upload */}
          <div
            className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/30 transition-colors"
            onClick={() => !isImporting && fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            {fileName ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">{fileName}</span>
                {!isImporting && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setRows([]); setFileName(""); setSkipped(0); if (fileRef.current) fileRef.current.value = ""; }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Upload className="h-7 w-7 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium">Click to upload a CSV file</p>
                <p className="text-xs text-muted-foreground">Columns: Business Name, Phone, Email, Website, Contact, Address, City, State, Country, Category</p>
              </div>
            )}
          </div>

          {/* Row preview */}
          {rows.length > 0 && !isImporting && !result && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span>
                <strong>{rows.length}</strong> valid rows ready to import
                {skipped > 0 && <span className="text-muted-foreground"> · {skipped} skipped (missing name or phone)</span>}
              </span>
            </div>
          )}
          {fileName && rows.length === 0 && !result && !isImporting && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>No valid rows found. Make sure your CSV has &ldquo;Business Name&rdquo; and &ldquo;Phone&rdquo; columns.</span>
            </div>
          )}

          {/* Import progress — shown during and after import */}
          {(isImporting || result) && progress.total > 0 && (
            <div className="rounded-xl border bg-muted/40 p-4 space-y-4">
              {/* Progress bar + counter */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="flex items-center gap-1.5">
                    {isImporting
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Importing…</>
                      : <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Import complete</>
                    }
                  </span>
                  <span className="tabular-nums">
                    {Math.min(progress.imported, progress.total)}&nbsp;/&nbsp;{progress.total} leads
                  </span>
                </div>
                <Progress value={progressPct} className="h-3" />
                <p className="text-xs text-muted-foreground text-right">{progressPct}%</p>
              </div>

              {/* Result breakdown — shown after import */}
              {result && (
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 p-3 text-center space-y-0.5">
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400 tabular-nums">{result.created}</p>
                    <p className="text-xs text-green-700 dark:text-green-300 font-medium">Imported</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3 text-center space-y-0.5">
                    <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{result.duplicates}</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Already in DB</p>
                  </div>
                  <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-center space-y-0.5">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{result.errors}</p>
                    <p className="text-xs text-red-700 dark:text-red-300 font-medium">Errors</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Folder combobox */}
          {!isImporting && !result && (
            <>
              <div className="space-y-1.5">
                <Label>Save to Folder <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Popover open={folderOpen} onOpenChange={setFolderOpen}>
                  <PopoverTrigger
                    className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-expanded={folderOpen}
                  >
                    <span className="truncate">{folderLabel || "Select a folder…"}</span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-0"
                    align="start"
                    style={{ width: "var(--anchor-width)" }}
                  >
                    <Command>
                      <CommandInput placeholder="Search folders…" />
                      <CommandList>
                        <CommandEmpty>No folder found.</CommandEmpty>
                        {Object.entries(grouped).map(([industry, flds]) => (
                          <CommandGroup key={industry} heading={industry}>
                            {flds.map((f) => (
                              <CommandItem
                                key={f.id}
                                value={`${industry} ${f.name}`}
                                onSelect={() => { setFolderId(f.id); setFolderOpen(false); }}
                              >
                                <Check className={cn("mr-2 h-4 w-4 shrink-0", folderId === f.id ? "opacity-100" : "opacity-0")} />
                                {f.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ))}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {!folderId && (
                  <p className="text-xs text-muted-foreground">
                    No folder selected — leads will go to <strong>CSV Imports › General</strong>
                  </p>
                )}
              </div>

              {/* Category combobox */}
              <div className="space-y-1.5">
                <Label>Category <span className="text-muted-foreground text-xs">(optional override)</span></Label>
                <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                  <PopoverTrigger
                    className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-normal shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-expanded={categoryOpen}
                  >
                    <span className="truncate">{categoryLabel}</span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-0"
                    align="start"
                    style={{ width: "var(--anchor-width)" }}
                  >
                    <Command>
                      <CommandInput placeholder="Search categories…" />
                      <CommandList>
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="none"
                            onSelect={() => { setCategoryOverride("none"); setCategoryOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4 shrink-0", categoryOverride === "none" ? "opacity-100" : "opacity-0")} />
                            Use category from CSV
                          </CommandItem>
                          {categories.map((c) => (
                            <CommandItem
                              key={c}
                              value={c}
                              onSelect={() => { setCategoryOverride(c); setCategoryOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4 shrink-0", categoryOverride === c ? "opacity-100" : "opacity-0")} />
                              {c}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isImporting}>Cancel</Button>
          <Button
            onClick={result ? handleClose : handleImport}
            disabled={isImporting || (!result && rows.length === 0)}
          >
            {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {result ? "Done" : isImporting ? "Importing…" : `Import ${rows.length > 0 ? rows.length : ""} Leads`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
