import { z } from "zod";

// Versión vigente de Términos + Política de privacidad. Cambiarla cuando cambie su texto.
export const LEGAL_VERSION = "2026-11-12";

export const ROLES = ["OWNER", "ADMIN", "MEMBER"] as const;
export type RoleName = (typeof ROLES)[number];

// Fragmentos que hacen una contraseña fácil de adivinar.
const COMMON_PASSWORDS = ["123456", "password", "contraseña", "contrasena", "qwerty", "abc123", "111111", "visionlight", "shopify"];

export const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z
    .string()
    .min(12, "La contraseña debe tener al menos 12 caracteres")
    .max(200)
    .refine((p) => new Set(p).size >= 6, "La contraseña es demasiado repetitiva")
    .refine((p) => !COMMON_PASSWORDS.some((c) => p.toLowerCase().includes(c)), "La contraseña es demasiado común"),
  organizationName: z.string().trim().min(2).max(100),
  // Aceptación de los Términos, que incluyen el acuerdo de tratamiento de datos.
  acceptTerms: z.union([z.literal(true), z.literal("on")], { errorMap: () => ({ message: "Debes aceptar los Términos y la Política de privacidad" }) }),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["ADMIN", "MEMBER"]).default("MEMBER"),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40) || "empresa";
}
