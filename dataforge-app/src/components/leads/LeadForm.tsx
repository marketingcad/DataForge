"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LeadInputSchema, type LeadInput } from "@/types/lead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLeadAction, updateLeadAction } from "@/actions/leads.actions";

interface LeadFormProps {
  defaultValues?: Partial<LeadInput>;
  leadId?: string;
}

const SOURCES = ["Manual Entry", "Google Maps", "Yelp", "Directory", "Other"];
const CATEGORIES = [
  "Roofing", "Dental", "Healthcare", "Real Estate", "Legal",
  "Finance", "Construction", "Automotive", "Retail", "Restaurant", "Other",
];

export function LeadForm({ defaultValues, leadId }: LeadFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LeadInput>({
    resolver: zodResolver(LeadInputSchema),
    defaultValues: defaultValues ?? {},
  });

  async function onSubmit(data: LeadInput) {
    const formData = new FormData();
    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined && v !== null) formData.set(k, String(v));
    });
    if (leadId) {
      await updateLeadAction(leadId, formData);
    } else {
      await createLeadAction(formData);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Business Name */}
        <div className="space-y-1">
          <Label htmlFor="businessName">Business Name <span className="text-red-500">*</span></Label>
          <Input id="businessName" {...register("businessName")} placeholder="ABC Roofing LLC" />
          {errors.businessName && <p className="text-xs text-red-500">{errors.businessName.message}</p>}
        </div>

        {/* Phone */}
        <div className="space-y-1">
          <Label htmlFor="phone">Phone <span className="text-red-500">*</span></Label>
          <Input id="phone" {...register("phone")} placeholder="(555) 123-4567" />
          {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
        </div>

        {/* Email */}
        <div className="space-y-1">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} placeholder="info@example.com" />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>

        {/* Website */}
        <div className="space-y-1">
          <Label htmlFor="website">Website</Label>
          <Input id="website" {...register("website")} placeholder="https://example.com" />
        </div>

        {/* Contact Person */}
        <div className="space-y-1">
          <Label htmlFor="contactPerson">Contact Person</Label>
          <Input id="contactPerson" {...register("contactPerson")} placeholder="John Doe" />
        </div>

        {/* Category / Industry */}
        <div className="space-y-1">
          <Label htmlFor="category">Industry</Label>
          <Select
            defaultValue={(defaultValues?.category as string) || ""}
            onValueChange={(v) => setValue("category", v ?? undefined)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* City */}
        <div className="space-y-1">
          <Label htmlFor="city">City</Label>
          <Input id="city" {...register("city")} placeholder="Chicago" />
        </div>

        {/* State */}
        <div className="space-y-1">
          <Label htmlFor="state">State</Label>
          <Input id="state" {...register("state")} placeholder="IL" />
        </div>

        {/* Country */}
        <div className="space-y-1">
          <Label htmlFor="country">Country</Label>
          <Input id="country" {...register("country")} placeholder="US" />
        </div>

        {/* Source */}
        <div className="space-y-1">
          <Label htmlFor="source">Source <span className="text-red-500">*</span></Label>
          <Select
            defaultValue={(defaultValues?.source as string) || ""}
            onValueChange={(v) => setValue("source", v ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {SOURCES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.source && <p className="text-xs text-red-500">{errors.source.message}</p>}
        </div>

      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : leadId ? "Save Changes" : "Add Lead"}
        </Button>
        <Button type="button" variant="outline" onClick={() => window.history.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
