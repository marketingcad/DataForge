"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SaveLeadsModal } from "@/components/scraping/SaveLeadsModal";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, ImagePlus, Scan, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";

interface ExtractedLead {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  website: string | null;
  selected: boolean;
}

// ── OCR text parser ──────────────────────────────────────────────────────────

const PHONE_RE = /(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]\d{4})/g;
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const URL_RE   = /(?:https?:\/\/)?(?:www\.)[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}(?:\/\S*)?/gi;

const ADDRESS_KEYWORDS = [
  "st","ave","blvd","rd","dr","ln","ct","way","hwy","pkwy","pl","sq",
  "street","avenue","road","drive","lane","court","highway","parkway","place",
];
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
  "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
  "TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

function isAddressLine(line: string) {
  const hasZip    = /\b\d{5}(?:-\d{4})?\b/.test(line);
  const hasState  = US_STATES.some((s) => new RegExp(`\\b${s}\\b`).test(line));
  const hasStreet = ADDRESS_KEYWORDS.some((k) =>
    new RegExp(`\\b${k}\\b`, "i").test(line)
  );
  return (hasZip || (hasState && hasStreet)) && line.length < 120;
}

function looksLikeJunk(line: string) {
  const junk = [
    "is this your business","claim this business","review now",
    "message business","write a review","add photo","website",
    "directions","hours","edit","open","closed","sponsored",
    "ad ·","yelp","yellowpages","bbb","foursquare","tripadvisor",
    "© ","privacy","terms","all rights reserved",
  ];
  const lower = line.toLowerCase();
  return junk.some((j) => lower.includes(j));
}

function parseOcrText(raw: string): Omit<ExtractedLead, "id" | "selected">[] {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.replace(/[|]{1}/g, "").trim())
    .filter((l) => l.length > 2);

  const leads: Omit<ExtractedLead, "id" | "selected">[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Look for a phone number as a block anchor
    const phoneMatch = line.match(PHONE_RE);
    if (phoneMatch) {
      const phone = phoneMatch[0];
      let name: string | null = null;
      let address: string | null = null;
      let email: string | null = null;
      let website: string | null = null;

      // Scan the next few lines for name and address
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        const next = lines[j];
        if (looksLikeJunk(next)) continue;

        const emailMatch = next.match(EMAIL_RE);
        if (emailMatch && !email) { email = emailMatch[0]; continue; }

        const urlMatch = next.match(URL_RE);
        if (urlMatch && !website) { website = urlMatch[0]; continue; }

        if (isAddressLine(next) && !address) { address = next; continue; }

        // First non-junk non-address line after phone = business name
        if (!name && next.length > 3 && !next.match(PHONE_RE)) {
          name = next;
        }
      }

      if (name || address) {
        leads.push({ name: name ?? "Unknown Business", phone, address, email, website });
      }
      i++;
      continue;
    }

    // Alternatively: bold-ish line followed by address (no phone found first)
    if (!looksLikeJunk(line) && line.length > 4 && line.length < 80 && /[A-Z]/.test(line[0])) {
      let address: string | null = null;
      let phone: string | null = null;
      let email: string | null = null;

      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const next = lines[j];
        if (looksLikeJunk(next)) continue;
        const pm = next.match(PHONE_RE);
        if (pm && !phone) { phone = pm[0]; continue; }
        if (isAddressLine(next) && !address) { address = next; continue; }
        const em = next.match(EMAIL_RE);
        if (em && !email) { email = em[0]; continue; }
      }

      if ((phone || address) && !looksLikeJunk(line)) {
        // Avoid duplicates
        const isDup = leads.some(
          (l) => l.phone === phone || (l.name === line && l.address === address)
        );
        if (!isDup) {
          leads.push({ name: line, phone, address, email, website: null });
        }
      }
    }

    i++;
  }

  return leads;
}

// ── Component ────────────────────────────────────────────────────────────────

export function ImageScrapeForm() {
  const [image, setImage] = useState<{ dataUrl: string } | null>(null);
  const [leads, setLeads] = useState<ExtractedLead[]>([]);
  const [scanning, setScanning] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const counterRef = useRef(0);

  function processFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please provide an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setImage({ dataUrl: e.target?.result as string });
      setLeads([]);
      setOcrProgress(0);
    };
    reader.readAsDataURL(file);
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (item) { const f = item.getAsFile(); if (f) processFile(f); }
  }, []);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  async function extractLeads() {
    if (!image) return;
    setScanning(true);
    setLeads([]);
    setOcrProgress(0);

    try {
      // Dynamically import tesseract to avoid SSR issues
      const Tesseract = (await import("tesseract.js")).default;

      const result = await Tesseract.recognize(image.dataUrl, "eng", {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setOcrProgress(Math.round((m.progress ?? 0) * 100));
          }
        },
      });

      const rawText = result.data.text;
      const parsed = parseOcrText(rawText);

      const extracted: ExtractedLead[] = parsed.map((l) => ({
        ...l,
        id: ++counterRef.current,
        selected: true,
      }));

      if (extracted.length === 0) {
        toast.info("No business listings detected. Try a clearer screenshot.");
      } else {
        toast.success(`Extracted ${extracted.length} lead${extracted.length !== 1 ? "s" : ""}`);
      }
      setLeads(extracted);
    } catch (err) {
      console.error(err);
      toast.error("OCR failed. Please try again.");
    } finally {
      setScanning(false);
      setOcrProgress(0);
    }
  }

  function toggleSelect(id: number) {
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, selected: !l.selected } : l));
  }

  function removeRow(id: number) {
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  const selected = leads.filter((l) => l.selected);
  const savePayload = selected.map((l) => ({
    businessName: l.name,
    phone: l.phone ?? undefined,
    address: l.address ?? undefined,
    email: l.email ?? undefined,
    website: l.website ?? "",
    sourceUrl: "",
  }));

  return (
    <div className="space-y-4" onPaste={handlePaste}>
      {/* Drop / paste zone */}
      <div
        className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer ${
          dragging
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        } ${image ? "p-2" : "p-10"}`}
        onClick={() => !image && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        {image ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.dataUrl} alt="Screenshot" className="max-h-72 w-full object-contain rounded-lg" />
            <button
              onClick={(e) => { e.stopPropagation(); setImage(null); setLeads([]); }}
              className="absolute top-2 right-2 bg-background border rounded-full p-1 hover:bg-muted transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <ImagePlus className="h-10 w-10 text-muted-foreground/40" />
            <div className="text-center">
              <p className="text-sm font-medium">Paste a screenshot or drag an image here</p>
              <p className="text-xs mt-1">Ctrl+V · drag & drop · or click to browse</p>
            </div>
            <Badge variant="secondary" className="text-xs">No API key needed · runs locally</Badge>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }}
      />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          onClick={extractLeads}
          disabled={!image || scanning}
          className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
        >
          {scanning
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Scan className="h-4 w-4" />}
          {scanning
            ? ocrProgress > 0 ? `Scanning… ${ocrProgress}%` : "Loading OCR…"
            : "Extract Leads"}
        </Button>

        {leads.length > 0 && (
          <Button
            variant="outline"
            className="gap-2"
            disabled={selected.length === 0}
            onClick={() => setModalOpen(true)}
          >
            <Save className="h-4 w-4" />
            Save {selected.length} Lead{selected.length !== 1 ? "s" : ""}
          </Button>
        )}

        {leads.length > 0 && (
          <p className="text-sm text-muted-foreground ml-auto">{leads.length} extracted</p>
        )}
      </div>

      {/* Results table */}
      {leads.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Business Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id} className={!lead.selected ? "opacity-40" : ""}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={lead.selected}
                      onChange={() => toggleSelect(lead.id)}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{lead.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.phone ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{lead.address ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.email ?? "—"}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => removeRow(lead.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {modalOpen && (
        <SaveLeadsModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          leads={savePayload}
          onSaved={() => {
            setLeads([]);
            setImage(null);
            toast.success("Leads saved!");
          }}
        />
      )}
    </div>
  );
}
