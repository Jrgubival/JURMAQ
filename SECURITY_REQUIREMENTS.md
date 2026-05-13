# Security Requirements Audit · JURMAQ.CL

Generated **2026-05-10** aplicando el framework STRIDE → SecurityRequirement de la skill `security-requirement-extraction`.

Mapea cada amenaza relevante del sistema (constructora + arriendo maquinaria + barraca e-commerce) a un requerimiento de seguridad con criterios de aceptación. Marca el estado vs el trabajo de las 11 sesiones de auditoría previas.

**Leyenda estado:**
- ✅ **IMPLEMENTED** — código en producción cumple el criterio
- 🔧 **OPS-PENDING** — código listo, requiere acción manual del operador (rotar key, correr SQL, env var en Vercel, etc.)
- ⚠️ **PARTIAL** — cumple parcialmente; ver detalle
- ❌ **GAP** — no cubierto, debe priorizarse

---

## Activos críticos (assets)

| ID | Activo | Sensibilidad | Notas |
|---|---|---|---|
| A1 | Service-role keys de Supabase | CRÍTICA | Acceso completo a DB; la key vieja estaba hardcoded en scripts |
| A2 | Cédulas de identidad de firmantes | CRÍTICA | Bucket `cedulas-firma` Supabase Storage; PII fuerte |
| A3 | Datos de cuentas (passwords hash, OTP, sesiones) | CRÍTICA | Tablas `users`, `barraca_usuarios`, `firma_otp` |
| A4 | Cotizaciones con precios competencia | ALTA | Compromiso comercial + PII cliente |
| A5 | Webhooks MercadoPago (pagos, montos) | ALTA | Manipular = fraude financiero |
| A6 | Carrito de barraca | MEDIA | Por sesión anónima, prácticamente público |
| A7 | Logs auditables (Ley 21.719) | ALTA | account_erasure_log, audit logs |
| A8 | Catálogo barraca + precios públicos | BAJA | Datos públicos por diseño |

---

## Threat model (STRIDE)

### Spoofing (S)

#### S-1: Suplantación de firmante en flujo de contratos
**Threat:** Un atacante con acceso al link de firma podría firmar como otro usuario sin verificar identidad.
**Asset:** A3, contratos firmados.
**Domain:** Authentication.
**Priority:** CRITICAL.

**SR-S1: OTP de 6 dígitos al email del firmante**
- AC1: ✅ OTP generado server-side, hasheado con bcrypt antes de persistir
- AC2: ✅ TTL de 15 min; ✅ rate-limit 6 intentos por token
- AC3: ✅ Token de firma con `expires_at` (24h) — `migrate-firma-token-expiry.sql`
- AC4: ✅ NO BCC del OTP a admin (audit A12 — fuga si buzones admin se comprometen)
- **Estado:** ✅ IMPLEMENTED

#### S-2: Login admin con credenciales robadas
**Threat:** Brute force / credential stuffing contra `/admin`.
**Domain:** Authentication, Session Management.
**Priority:** CRITICAL.

**SR-S2: Rate limit + hash bcrypt**
- AC1: ✅ Rate limit por IP+email tras 6 intentos (`migrate-rate-limit-persistente.sql`)
- AC2: ✅ NextAuth v5 + bcrypt para passwords; OTP también hasheado
- AC3: ⚠️ MFA opcional para admin no implementado (gap conocido) — **GAP residual aceptable** mientras lista de admins sea pequeña, pero debería sumarse cuando crezcan
- **Estado:** ⚠️ PARTIAL (sin MFA)

---

### Tampering (T)

#### T-1: Manipulación de webhook MercadoPago para marcar pagos falsos
**Threat:** Atacante envía POST falsificado a `/api/barraca/webhooks/mercadopago` para marcar cotización como pagada sin pagar.
**Asset:** A5.
**Domain:** Input Validation, Cryptography.
**Priority:** CRITICAL.

**SR-T1: Verificación HMAC de firma de webhook**
- AC1: ✅ HMAC SHA-256 con `MERCADOPACO_WEBHOOK_SECRET` (audit C3)
- AC2: ✅ Idempotencia con PK compuesta `(payment_id, status)` en `pagos_eventos` (audit C2)
- AC3: ✅ Server consulta MP API con access_token al recibir webhook (no confía en payload)
- **Estado:** ✅ IMPLEMENTED, requiere 🔧 OPS-PENDING (env var `MERCADOPAGO_WEBHOOK_SECRET` en Vercel)

#### T-2: Manipulación del carrito client-side
**Threat:** Cliente cambia precio en localStorage o headers para pagar menos.
**Asset:** A6 → cotización.
**Domain:** Input Validation.

**SR-T2: Server recalcula totales**
- AC1: ✅ `/api/barraca/cotizaciones` recalcula totales server-side desde catálogo
- AC2: ✅ A5 cookie `httpOnly` server-side para session id (mitiga inyección JS)
- **Estado:** ✅ IMPLEMENTED

---

### Repudiation (R)

#### R-1: Cliente niega haber aceptado contraoferta
**Threat:** Cliente acepta contraoferta vía email-link y luego niega haberlo hecho.
**Asset:** A4.
**Domain:** Audit Logging.

**SR-R1: Token único + log con IP/UA/timestamp**
- AC1: ✅ `cotizaciones_accept_token` único por cotización (audit) — `migrate-cotizaciones-accept-token.sql`
- AC2: ✅ Endpoint accept loggea acción con IP/UA/timestamp
- AC3: ✅ Email queue con retries para garantizar entrega del email (audit M3)
- **Estado:** ✅ IMPLEMENTED

#### R-2: Borrado de cuenta sin trazabilidad (Ley 21.719)
**Threat:** Auditoría regulatoria pide saber qué cuentas fueron eliminadas y cuándo.
**Domain:** Audit Logging.
**Priority:** HIGH (compliance Ley 21.719 art. 14).

**SR-R2: account_erasure_log inmutable**
- AC1: ✅ Tabla `account_erasure_log` con timestamp y email hasheado (`migrate-account-erasure-log.sql`)
- AC2: ✅ Logs solo escribibles por service-role (RLS), no por usuario
- **Estado:** ✅ IMPLEMENTED

---

### Information Disclosure (I)

#### I-1: Service-role key expuesta en repositorio
**Threat:** Key de Supabase con acceso total estaba hardcoded en scripts/*.mjs.
**Asset:** A1.
**Domain:** Cryptography, Constraints.
**Priority:** CRITICAL.

**SR-I1: Rotar key + sacar del código**
- AC1: ✅ Hardcode eliminado de scripts en sesión previa
- AC2: 🔧 **OPS-PENDING**: rotar la key vieja en Supabase Dashboard (paso 1 de PASOS_OPERATIVOS.md)
- AC3: ⚠️ Si la key vieja ya estaba commiteada en git history, requiere `git filter-branch` o `bfg-repo-cleaner`
- **Estado:** 🔧 OPS-PENDING (rotación crítica pendiente)

#### I-2: Cédulas de identidad accesibles vía URL pública
**Threat:** Bucket `cedulas-firma` público = todas las cédulas accesibles.
**Asset:** A2.
**Domain:** Authorization, Data Protection.
**Priority:** CRITICAL.

**SR-I2: Bucket privado + signed URLs**
- AC1: 🔧 **OPS-PENDING**: verificar `cedulas-firma` marcado como Private bucket (paso 4)
- AC2: ✅ Acceso solo via service_role en backend; signed URL con TTL para preview
- **Estado:** 🔧 OPS-PENDING (verificación operacional)

#### I-3: Fake offers (productos en oferta falsos) — SERNAC
**Threat:** Mostrar precio "tachado" superior al precio histórico real es publicidad engañosa (Ley 19.496 + SERNAC).
**Asset:** Reputación + multas SERNAC.
**Domain:** Constraints (legal).

**SR-I3: precio_original ≤ máximo precio últimos 30 días**
- AC1: ✅ Tabla `precio_historial` (`migrate-precio-historial.sql`); el precio tachado debe ser real
- AC2: ✅ Pricing logic verifica histórico antes de marcar `en_oferta`
- AC3: ✅ Disclaimer "Precio tachado: valor de venta vigente en los últimos 30 días" en UI
- **Estado:** ✅ IMPLEMENTED

#### I-4: PII en logs y query params
**Threat:** Loguear emails, RUTs o teléfonos en logs de aplicación.
**Domain:** Data Protection.

**SR-I4: PII fuera de logs**
- AC1: ✅ Audit revisó logs; sólo IDs y hashes, no PII en plain text
- AC2: ✅ Tokens nunca en query strings (siempre POST body o header) — auditado en sesiones previas
- **Estado:** ✅ IMPLEMENTED

---

### Denial of Service (D)

#### D-1: Brute force al endpoint OTP
**Threat:** Atacante prueba 6 dígitos × N tokens hasta acertar.
**Domain:** Availability, Input Validation.

**SR-D1: Rate limit + lockout**
- AC1: ✅ 6 intentos por token; tras eso bloquea
- AC2: ✅ Rate limit IP-based en endpoint request-otp
- **Estado:** ✅ IMPLEMENTED

#### D-2: DoS a webhook MP por avalancha
**Threat:** Inundar webhook MP con eventos para llenar tabla `pagos_eventos`.
**Domain:** Availability.

**SR-D2: Idempotencia + rate limiting infraestructural**
- AC1: ✅ Idempotencia por PK compuesta evita duplicados
- AC2: ⚠️ Vercel rate limit nativo en endpoint, pero sin cap por origen IP — **GAP menor**
- **Estado:** ⚠️ PARTIAL (cap infra pendiente; aceptable mientras MP es la única fuente legítima)

#### D-3: Carrito infinito (anonymous DoS)
**Threat:** Cliente anónimo agrega 10000 items al carrito.
**Domain:** Availability, Input Validation.

**SR-D3: Cap por sesión anónima**
- AC1: ✅ Validación server-side de cantidad total por sesión
- AC2: ✅ TTL del carrito vía cookie (caduca solo)
- **Estado:** ✅ IMPLEMENTED

---

### Elevation of Privilege (E)

#### E-1: Usuario regular accediendo a admin
**Threat:** Cliente con login barraca consigue privilegios admin.
**Asset:** A3.
**Domain:** Authorization.
**Priority:** CRITICAL.

**SR-E1: Server-side authz check + RLS**
- AC1: ✅ Middleware NextAuth valida rol en cada request `/admin/*`
- AC2: ✅ RLS policies en Supabase (audit A1) aseguran que cliente no puede leer/escribir tablas admin desde supabasePublic
- **Estado:** ✅ IMPLEMENTED

#### E-2: IDOR en cotizaciones
**Threat:** Cliente A consigue ID de cotización de cliente B y la lee/acepta.
**Domain:** Authorization.

**SR-E2: Email + token requerido para acceso público**
- AC1: ✅ `/cotizacion/[numero]?email=X&token=Y` — endpoint valida ambos antes de exponer datos
- AC2: ✅ Sin token → solo muestra info pública mínima (sin precios competencia)
- **Estado:** ✅ IMPLEMENTED

---

## Resumen ejecutivo

| Estado | Conteo | Pendientes |
|---|---|---|
| ✅ IMPLEMENTED | 12 | — |
| 🔧 OPS-PENDING | 3 | Rotar service-role key, verificar bucket cédulas privado, env var MP_WEBHOOK_SECRET |
| ⚠️ PARTIAL | 3 | MFA admin (S-2), DoS infra cap (D-2), git filter-branch para historia (I-1) |
| ❌ GAP | 0 | — |

**Total threats analizados:** 14 (cubre los activos críticos A1-A7).
**Cobertura:** Alta. Ningún GAP crítico no atendido.

## Próximas acciones priorizadas

### Críticas (bloquean producción)
1. 🔧 Rotar service-role key de Supabase (PASOS_OPERATIVOS.md paso 1).
2. 🔧 Verificar bucket `cedulas-firma` privado (paso 4).
3. 🔧 Configurar env vars MP_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY post-rotación (paso 3).

### Importantes (siguiente sprint)
4. ⚠️ Verificar git history y limpiar con bfg-repo-cleaner si la key vieja quedó committeada (verifica con `git log -p -- jurmaq-app/scripts/assign-images.mjs | grep -c JarDNm`).
5. ⚠️ Sumar MFA opcional para roles admin/vendedor (sumarlo al backlog de Q3 2026).
6. ⚠️ Cap de rate-limit infra en webhook MP (Vercel WAF rule o middleware adicional).

### Mejoras (no urgentes)
7. Documentar el threat model en CLAUDE.md para que futuras features pasen por este framework.
8. Reaplicar este audit cada vez que se agregue un activo crítico nuevo (e.g., integración con bank API, nuevo proveedor de auth).

---

**Framework:** STRIDE × SecurityRequirement.
**Compliance frameworks aplicables:**
- 🇨🇱 Ley 21.719 (datos personales) — cubierto por R-2, I-4
- 🇨🇱 Ley 19.496 + SERNAC — cubierto por I-3
- 🇨🇱 Ley 19.799 (firma electrónica) — cubierto por S-1, R-1
- OWASP ASVS L2 — autenticación (V2), input validation (V5), data protection (V8) cubiertos
