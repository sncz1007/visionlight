import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

// Cifrado AES-256-GCM para secretos y datos personales guardados en la base.
// Formato: v1:<iv>:<tag>:<datos>, todo en base64url.
// La clave sale de ENCRYPTION_KEY (64 caracteres hex). Solo en desarrollo hay una clave por defecto.
function key(): Buffer {
  const hex = process.env.ENCRYPTION_KEY ?? (process.env.NODE_ENV === "production" ? "" : "0".repeat(64));
  if (!/^[0-9a-f]{64}$/i.test(hex)) throw new Error("ENCRYPTION_KEY debe ser de 64 caracteres hexadecimales (32 bytes)");
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Formato de cifrado no válido");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

// ── Datos personales de clientes (correo, teléfono) ──
// Se guardan cifrados. Para poder buscarlos (p. ej. al borrar un cliente)
// guardamos además un "índice ciego": HMAC del valor normalizado, con una
// clave derivada distinta de la de cifrado.
const indexKey = () => createHmac("sha256", key()).update("visionlight:blind-index:v1").digest();

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function blindIndex(value: string): string {
  return createHmac("sha256", indexKey()).update(value).digest("base64url");
}

export function encryptOptional(value: string | null | undefined): string | null {
  return value ? encrypt(value) : null;
}

export function decryptOptional(value: string | null | undefined): string | null {
  return value ? decrypt(value) : null;
}

/** Cifra un correo y calcula su índice ciego, listos para guardar. */
export function protectEmail(email: string | null | undefined): { emailEnc: string | null; emailHash: string | null } {
  if (!email || !email.trim()) return { emailEnc: null, emailHash: null };
  const normalized = normalizeEmail(email);
  return { emailEnc: encrypt(normalized), emailHash: blindIndex(normalized) };
}

/** Firma corta (HMAC) para enlaces que no deben poder falsificarse, como el de darse de baja. */
export function sign(value: string): string {
  return createHmac("sha256", key()).update(`visionlight:sign:v1:${value}`).digest("base64url").slice(0, 32);
}
