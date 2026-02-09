import { z } from "zod";

export const SpecialtySchema = z.object({
  id: z.number().int().optional(),
  name: z.string(),
  users: z.array(z.number().int()).optional(),
  institutes: z.array(z.number().int()).optional(),
});
