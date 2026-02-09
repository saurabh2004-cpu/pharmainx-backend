import { z } from "zod";
import { SpecialtySchema } from "./specialty.js";
import { InstituteSchema } from "./institute.js";

export const JobSchema = z.object({
  id: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  title: z.string(),
  fullDescription: z.string(),
  jobType: z.string(),
  role: z.string(),
  skills: z.array(z.string()),
  workLocation: z.string(),
  city: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  experienceLevel: z.string(),
  requirements: z.string(),
  salaryMin: z.coerce.number(),
  salaryMax: z.coerce.number(),
  status: z.string().default("active"),
  shortDescription: z.string().nullable().optional(),
  salaryCurrency: z.string().nullable().default("INR"),
  applicationDeadline: z.coerce.date().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  contactPerson: z.string().nullable().optional(),
  additionalInfo: z.string().nullable().optional(),
  institute: InstituteSchema.optional(),
  speciality: z.string().optional().nullable(),
  subSpeciality: z.string().optional().nullable(),
});

export const JobCreateUpdateSchema = JobSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  status: true,
  institute: true,
}).refine((data) => data.salaryMin <= data.salaryMax, {
  message: "Salary Min must be less than or equal to Salary Max",
  path: ["salaryMin"],
}).refine((data) => {
  if (!data.applicationDeadline) return true;
  return new Date(data.applicationDeadline) > new Date();
}, {
  message: "Application Deadline must be a future date",
  path: ["applicationDeadline"],
});
