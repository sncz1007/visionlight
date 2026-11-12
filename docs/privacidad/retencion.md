# Política de retención de datos

Versión 2026-11-12. Los plazos viven en código en `packages/database/src/retention.ts` (`RETENTION_DAYS`);
si cambias uno, cambia también este documento y la Política de privacidad.

| Dato | Plazo | Cuenta desde |
|---|---|---|
| Eventos del pixel | 90 días | fecha del evento |
| Visitantes | 90 días | última actividad |
| Carritos (correo y teléfono cifrados) | 90 días | última actualización |
| Pedidos | 12 meses | fecha del pedido |
| Avisos de webhooks recibidos | 30 días | recepción |
| Registro de auditoría y de accesos | 24 meses | creación |
| Sesiones y estados de OAuth | al vencer | |
| Tienda desinstalada (todo) | 30 días como máximo | desinstalación |

## Cómo se aplica

- El worker ejecuta `applyRetention` cada día a las 03:00 (tarea `retention`).
- Al desinstalar la app se borra al instante el token de acceso. Shopify envía `shop/redact` a las 48 h y se borra la tienda con todos sus datos; si no llegara, la retención la borra a los 30 días.
- `customers/redact` borra los carritos de ese cliente y quita su correo de pedidos y visitantes en el momento.
- Las copias de seguridad de producción se conservan como máximo 30 días, así que lo borrado desaparece también de ellas en ese plazo.
