import { z } from "zod";

export const AuthRoleSchema = z.enum(["USER", "INSTITUTE"]);

export const UserRoleSchema = z.enum(["DOCTOR", "NURSE"]);

export const InstituteRolesSchema = z.enum(["HOSPITAL", "CLINIC", "PHARMACY", "LAB"]);
