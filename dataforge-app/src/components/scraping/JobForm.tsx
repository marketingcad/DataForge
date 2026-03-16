"use client";

import { useRef, useState } from "react";
import { createJobAction } from "@/actions/scraping.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function JobForm() {
  const [pending, setPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const result = await createJobAction(fd);
    setPending(false);
    if (result?.error) {
      const msgs = Object.values(result.error).flat().join(", ");
      toast.error(msgs);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">New Scraping Job</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="industry">Industry</Label>
              <Input id="industry" name="industry" placeholder="e.g. HVAC contractors" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="location">Location</Label>
              <Input id="location" name="location" placeholder="e.g. Houston, TX" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="maxLeads">Max Leads</Label>
            <Input id="maxLeads" name="maxLeads" type="number" min={1} max={500} defaultValue={50} required />
          </div>
          <Button type="submit" disabled={pending} className="w-full sm:w-auto">
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {pending ? "Creating…" : "Start Job"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
