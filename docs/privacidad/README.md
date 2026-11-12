# Protección de datos

Documentos que respaldan las respuestas del cuestionario de **datos de clientes protegidos** de Shopify
(Partners → VISIONLIGHT → Solicitudes de acceso a la API). Si cambia algo aquí, revisa también ese cuestionario.

| Documento | Para qué |
|---|---|
| Política de privacidad (`/privacidad` en el panel) | Qué datos tratamos y por qué. Pública. |
| Términos y acuerdo de tratamiento de datos (`/terminos`) | Acuerdo con cada comerciante. Se acepta al crear la cuenta (queda en la auditoría con su versión). |
| [retencion.md](retencion.md) | Plazos de conservación y cómo se borran. |
| [seguridad.md](seguridad.md) | Cifrado, accesos, contraseñas, copias, entornos y prevención de pérdida de datos. |
| [incidentes.md](incidentes.md) | Qué hacer ante un incidente de seguridad. |

## Respuestas del cuestionario y dónde se cumplen

| Pregunta | Respuesta | Dónde |
|---|---|---|
| Datos mínimos | Sí | Solo nombre/correo/teléfono; sin dirección. `slimLineItems`, `slim()` del pixel. |
| Informas a los comerciantes | Sí | `/privacidad` |
| Limitas el uso al propósito | Sí | Política §3, Términos B |
| Acuerdos con comerciantes | Sí | `/terminos` parte B, aceptado en el registro |
| Respetas el consentimiento | Sí | Pixel en modo estricto; `marketingConsent` en Cart |
| Respetas la no venta | Sí | No vendemos; el pixel no corre sin consentimiento |
| Decisiones automatizadas | No corresponde | |
| Retención | Sí | `packages/database/src/retention.ts`, tarea diaria del worker |
| Cifrado en reposo y tránsito | Sí | HTTPS; `protectEmail`/`encryptOptional` en `apps/api/src/lib/crypto.ts` |
| Copias cifradas | Sí | seguridad.md §4 |
| Prueba vs. producción | Sí | seguridad.md §5 |
| Prevención de pérdida de datos | Sí | seguridad.md §6 |
| Acceso del equipo limitado | Sí | seguridad.md §2 |
| Contraseñas estrictas | Sí | `signupSchema` (12+ caracteres, no comunes); seguridad.md §3 |
| Registro de accesos | Sí | `logPersonalDataAccess` en `apps/api/src/lib/audit.ts` |
| Respuesta ante incidentes | Sí | incidentes.md |
