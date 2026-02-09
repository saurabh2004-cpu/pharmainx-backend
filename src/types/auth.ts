import { z } from "zod";
import { AuthRoleSchema } from "./role.js";

export const AuthSchema = z.object({
  id: z.number().int(),
  created_at: z.coerce.date(),
  email: z.string().email(),
  password: z.string(),
  role: AuthRoleSchema.default("USER"),
});
