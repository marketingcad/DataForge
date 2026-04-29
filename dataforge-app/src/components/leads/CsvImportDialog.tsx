"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, FileText, X, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { importLeadsFromCsvAction, type CsvLeadRow } from "@/actions/leads.actions";

const CATEGORIES = [
  "Roofing", "Dental", "Healthcare", "Real Estate", "Legal",
  "Finance", "Construction", "Automotive", "Retail", "Restaurant", "Other",
];

// Maps common CSV header variations to our field names
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
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? "").trim().replace(/^"|"$/g, "");
    });
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
}

export function CsvImportDialog({ open, onClose, folders, userId }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CsvLeadRow[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [fileName, setFileName] = useState("");
  const [folderId, setFolderId] = useState<string>("");
  const [categoryOverride, setCategoryOverride] = useState<string>("none");
  const [result, setResult] = useState<{ created: number; duplicates: number; errors: number } | null>(null);
  const [isPending, startTransition] = useTransition();

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

  function handleImport() {
    if (!rows.length || !folderId) return;
    startTransition(async () => {
      const res = await importLeadsFromCsvAction(
        rows,
        folderId,
        categoryOverride === "none" ? null : categoryOverride,
        userId,
      );
      setResult(res);
    });
  }

  function handleClose() {
    setRows([]);
    setSkipped(0);
    setFileName("");
    setFolderId("");
    setCategoryOverride("none");
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
    onClose();
  }

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
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
            {fileName ? (
              <div className="flex items-center justify-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">{fileName}</span>
                <button onClick={(e) => { e.stopPropagation(); setRows([]); setFileName(""); setSkipped(0); if (fileRef.current) fileRef.current.value = ""; }} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
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
          {rows.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span><strong>{rows.length}</strong> valid rows ready to import{skipped > 0 && <span className="text-muted-foreground"> · {skipped} skipped (missing name or phone)</span>}</span>
            </div>
          )}
          {fileName && rows.length === 0 && !result && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>No valid rows found. Make sure your CSV has &ldquo;Business Name&rdquo; and &ldquo;Phone&rdquo; columns.</span>
            </div>
          )}

          {/* Folder selector */}
          <div className="space-y-1.5">
            <Label>Save to Folder <span className="text-destructive">*</span></Label>
            <Select value={folderId} onValueChange={(v) => v != null && setFolderId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a folder…" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.industryName ? `${f.industryName} / ` : ""}{f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category override */}
          <div className="space-y-1.5">
            <Label>Category <span className="text-muted-foreground text-xs">(optional override)</span></Label>
            <Select value={categoryOverride} onValueChange={(v) => v != null && setCategoryOverride(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Use category from CSV</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Result */}
          {result && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-0.5">
              <p className="font-medium">Import complete</p>
              <p className="text-muted-foreground">✅ {result.created} created &nbsp;·&nbsp; ⚠️ {result.duplicates} duplicates &nbsp;·&nbsp; ❌ {result.errors} errors</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>Cancel</Button>
          <Button
            onClick={result ? handleClose : handleImport}
            disabled={isPending || (!result && (rows.length === 0 || !folderId))}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {result ? "Done" : isPending ? "Importing…" : `Import ${rows.length > 0 ? rows.length : ""} Leads`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
