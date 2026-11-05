import { createHmac, randomBytes } from "node:crypto";
import type { PrismaClient } from "@visionlight/database";
import { config } from "./config.js";

// El navegador guarda un token aleatorio; la base de datos solo guarda su HMAC.
// Si alguien roba la base de datos, no puede usar las sesiones.
export function hashToken(token: string): string {
  return createHmac("sha256", config.sessionSecret).update(token).digest("hex");
}

export async function createSession(
  prisma: PrismaClient,
  userId: string,
  meta: { ip?: string; userAgent?: string },
) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.sessionDays * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: { tokenHash: hashToken(token), userId, expiresAt, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300) },
  });
  return { token, expiresAt };
}
