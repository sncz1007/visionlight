// Datos legales que aparecen en la Política de privacidad y los Términos.
// Confirma la razón social exacta y define NEXT_PUBLIC_PRIVACY_EMAIL en .env.
export const LEGAL = {
  company: "Light Software Solutions LLC",
  product: "VISIONLIGHT",
  contactEmail: process.env.NEXT_PUBLIC_PRIVACY_EMAIL || "(correo de privacidad pendiente)",
  version: "2026-11-12",
};
