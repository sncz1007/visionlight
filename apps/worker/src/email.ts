import type { RecoveryMessage } from "@visionlight/database";

// Envío con Resend (https://resend.com/docs/api-reference/emails/send-email).
// Sin RESEND_API_KEY no se envía nada: el correo queda registrado como prueba (DRY_RUN).
export async function sendWithResend(msg: RecoveryMessage): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || "onboarding@resend.dev";
  const fromName = msg.fromName.replace(/["<>\r\n]/g, "").slice(0, 60) || "Tu tienda";
  if (!apiKey) {
    console.log(`[worker] (prueba, sin RESEND_API_KEY) correo "${msg.subject}" listo para enviar`);
    return null;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: `${fromName} <${fromAddress}>`,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      // Baja con un clic desde Gmail/Outlook (RFC 8058).
      headers: { "List-Unsubscribe": `<${msg.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !body.id) throw new Error(`Resend respondió ${res.status}: ${body.message ?? "sin detalle"}`);
  return body.id;
}
