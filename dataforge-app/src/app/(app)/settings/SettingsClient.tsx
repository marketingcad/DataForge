"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateSettingsAction } from "@/actions/settings.actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";

interface Settings {
  companyName: string;
  scrapingDefaultMaxLeads: number;
  scrapingDefaultInterval: number;
  scrapingGlobalPause: boolean;
  leadQualityGoodThreshold: number;
  leadQualityMediumThreshold: number;
}

export function SettingsClient({ settings }: { settings: Settings }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [globalPause, setGlobalPause] = useState(settings.scrapingGlobalPause);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("scrapingGlobalPause", String(globalPause));

    startTransition(async () => {
      const result = await updateSettingsAction(formData);
      if (result?.error) {
        toast.error("Failed to save settings", { description: result.error });
      } else {
        toast.success("Settings saved");
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* General */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription>Basic application settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="companyName">Company Name</Label>
            <Input
              id="companyName"
              name="companyName"
              defaultValue={settings.companyName}
              maxLength={80}
              placeholder="DataForge"
            />
          </div>
        </CardContent>
      </Card>

      {/* Scraping */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Scraping</CardTitle>
          <CardDescription>Default values applied when creating new keyword scrapers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="scrapingDefaultMaxLeads">Default Max Leads per Run</Label>
              <Input
                id="scrapingDefaultMaxLeads"
                name="scrapingDefaultMaxLeads"
                type="number"
                min={1}
                max={500}
                defaultValue={settings.scrapingDefaultMaxLeads}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scrapingDefaultInterval">Default Interval (minutes)</Label>
              <Input
                id="scrapingDefaultInterval"
                name="scrapingDefaultInterval"
                type="number"
                min={60}
                defaultValue={settings.scrapingDefaultInterval}
              />
              <p className="text-xs text-muted-foreground">
                {settings.scrapingDefaultInterval >= 1440
                  ? `${Math.round(settings.scrapingDefaultInterval / 1440)} day(s)`
                  : `${settings.scrapingDefaultInterval} minutes`}
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Global Scraping Pause</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Pauses all scheduled keyword scraping runs across the app.
              </p>
            </div>
            <Switch
              checked={globalPause}
              onCheckedChange={setGlobalPause}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lead Quality */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lead Quality Thresholds</CardTitle>
          <CardDescription>
            Score thresholds used to classify leads as Good, Medium, or Low quality.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="leadQualityGoodThreshold">Good threshold (≥)</Label>
              <Input
                id="leadQualityGoodThreshold"
                name="leadQualityGoodThreshold"
                type="number"
                min={1}
                max={100}
                defaultValue={settings.leadQualityGoodThreshold}
              />
              <p className="text-xs text-muted-foreground">Scores ≥ this value are "Good"</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="leadQualityMediumThreshold">Medium threshold (≥)</Label>
              <Input
                id="leadQualityMediumThreshold"
                name="leadQualityMediumThreshold"
                type="number"
                min={1}
                max={100}
                defaultValue={settings.leadQualityMediumThreshold}
              />
              <p className="text-xs text-muted-foreground">Scores ≥ this value are "Medium"</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save Settings"}
        </Button>
      </div>
    </form>
  );
}
