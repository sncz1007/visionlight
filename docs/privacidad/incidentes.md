# Plan de respuesta ante incidentes de seguridad

Versión 2026-11-12. Un incidente es cualquier acceso, pérdida, alteración o divulgación no autorizada de datos
personales o de secretos (tokens, claves, contraseñas).

## 1. Detectar y contener (primeras horas)
1. Anotar la hora de detección y qué se sabe.
2. Contener: rotar los secretos afectados (`ENCRYPTION_KEY`, `SESSION_SECRET`, secreto de la app de Shopify, claves del proveedor de correo), cerrar sesiones (`DELETE FROM "Session"`), revocar accesos sospechosos y, si hace falta, detener el servicio.
3. Conservar evidencias: registros del servidor y la auditoría (`AuditLog`).

## 2. Evaluar (primeras 24 h)
- Qué datos y qué tiendas se vieron afectados, cuántas personas y si los datos estaban cifrados.
- Causa raíz y si el riesgo sigue activo.

## 3. Notificar (máximo 72 h desde la detección)
- A cada comerciante afectado, por correo: qué pasó, qué datos, qué hicimos y qué recomendamos.
- A Shopify, a través de los canales de soporte para partners, si afecta a datos obtenidos de su API.
- Los comerciantes deciden cómo avisar a sus clientes; les damos la información necesaria.

## 4. Corregir y aprender
- Corregir la causa, añadir una prueba que lo cubra y desplegar.
- Escribir un informe breve (qué pasó, impacto, causa, acciones) y guardarlo junto a este documento.
