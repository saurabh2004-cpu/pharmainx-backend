import { z } from "zod";
import { UserRoleSchema } from "./role.js";
import { SpecialtySchema } from "./specialty.js";

export const UserSchema = z.object({
  id: z.number().int(),
  created_at: z.coerce.date(),
  name: z.string(),
  location: z.string(),
  verified: z.boolean(),
  specialties: z.array(SpecialtySchema),
  gender: z.string(),
  role: UserRoleSchema.default("DOCTOR"),
  headline: z.string().nullable(),
  about: z.string().nullable(),
});

export const UserQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  specialties: z.string().optional(),
  location: z.string().optional(),
  role: z.string().optional(),
  verified: z.string().optional(),
  gender: z.string().optional(),
  name: z.string().optional(),
});

export type UserQuery = z.infer<typeof UserQuerySchema>;

export const UserCreateUpdateSchema = UserSchema.omit({
  id: true,
  created_at: true,
  verified: true,
}).extend({
  specialties: z.array(SpecialtySchema).optional(),
});
