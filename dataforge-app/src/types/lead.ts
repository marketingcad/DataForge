import { z } from "zod";

export const LeadInputSchema = z.object({
  businessName: z.string().min(1, "Business name is required"),
  phone: z.string().min(1, "Phone number is required"),
  email: z
    .string()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.string().email("Invalid email format").optional())
    .optional(),
  website: z
    .string()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.string().optional())
    .optional(),
  contactPerson: z
    .string()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.string().optional())
    .optional(),
  address: z
    .string()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.string().optional())
    .optional(),
  city: z
    .string()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.string().optional())
    .optional(),
  state: z
    .string()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.string().optional())
    .optional(),
  country: z
    .string()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.string().optional())
    .optional(),
  category: z
    .string()
    .transform((v) => (v === "" ? undefined : v))
    .pipe(z.string().optional())
    .optional(),
  source: z.string().min(1, "Source is required"),
  keywordId: z.string().optional(),
});

export type LeadInput = z.infer<typeof LeadInputSchema>;

export type DedupResult =
  | { isDuplicate: false }
  | { isDuplicate: true; existingId: string };

export type InsertResult =
  | { status: "created"; id: string }
  | { status: "duplicate"; existingId: string };
