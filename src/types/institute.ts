import { z } from "zod";
import { SpecialtySchema } from "./specialty.js";
import { InstituteRolesSchema } from "./role.js";

export const InstituteSchema = z.object({
  id: z.number().int(),
  created_at: z.coerce.date(),
  name: z.string(),
  location: z.string(),
  verified: z.boolean(),
  contactEmail: z.string().email(),
  contactNumber: z.string(),
  role: InstituteRolesSchema.default("HOSPITAL"),
  specialties: z.array(SpecialtySchema),
  affiliatedUniversity: z.string().nullable().optional(),
  yearEstablished: z.number().nullable().optional(),
  ownership: z.string().nullable().optional(),
  headline: z.string().nullable().optional(),
  about: z.string().nullable().optional(),
});

export const InstituteQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  specialties: z.string().optional(),
  location: z.string().optional(),
  role: z.string().optional(),
  verified: z.string().optional(),
  name: z.string().optional(),
});

export type InstituteQuery = z.infer<typeof InstituteQuerySchema>;

// Add schema for creation/update if it was implicit or missing
export const InstituteCreateUpdateSchema = InstituteSchema.omit({
  id: true,
  created_at: true,
  verified: true,
}).extend({
  specialties: z.array(SpecialtySchema).optional(),
});
