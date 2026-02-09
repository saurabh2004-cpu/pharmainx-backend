import { z } from "zod";

export const ApplicationSchema = z.object({
  id: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  status: z.string().default("pending"),
  appliedDate: z.coerce.date(),
  resumeUrl: z.string().optional(),
  coverLetter: z.string().nullable().optional(),
  experienceYears: z.number().nullable().optional(),
  currentPosition: z.string().nullable().optional(),
  currentInstitute: z.string().nullable().optional(),
  additionalDetails: z.any().nullable().optional(),
  jobId: z.string(),
  userId: z.string(),
});

export const ApplicationCreateUpdateSchema = ApplicationSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  status: true,
  userId: true,
  appliedDate: true,
});
