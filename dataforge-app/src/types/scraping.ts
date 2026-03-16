import { z } from "zod";

export const ScrapingJobInputSchema = z.object({
  industry: z.string().min(1, "Industry is required"),
  location: z.string().min(1, "Location is required"),
  maxLeads: z.coerce.number().min(1).max(200).default(50),
  source: z.enum(["serpapi", "manual"]).default("serpapi"),
});

export type ScrapingJobInput = z.infer<typeof ScrapingJobInputSchema>;

export interface DiscoveredBusiness {
  businessName: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  category?: string;
}

export interface ScrapedContact {
  email?: string;
  phone?: string;
  contactPerson?: string;
}
