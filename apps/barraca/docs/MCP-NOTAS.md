# MCP de la tienda: notas técnicas

Rama `claude/mcp-tienda` (base 7a4923b). Este archivo lo amplían todas las piezas. Sin secretos. Fecha de la fundación: 25-11-2026.

## 1. Fundación D1 (pieza 1)

### Base y binding
- Base D1 nueva `jurmaq-barraca-gestion`, binding **`GESTION_DB`**, declarada en `wrangler.jsonc` junto a la D1 de caché (`NEXT_TAG_CACHE_D1`).
- El `database_id` de `wrangler.jsonc` es un **marcador** (`00000000-0000-0000-0000-000000000000`). Al publicar: `wrangler d1 create jurmaq-barraca-gestion`, pegar el id real y correr `wrangler d1 migrations apply jurmaq-barraca-gestion --remote`. Nada de eso se hizo: no existe nada en producción.
- Mientras la base no exista o no esté migrada, el código responde "no disponible" y no rompe la tienda (ver "Acceso" abajo).
- Verificado: `opennextjs-cloudflare build` pasa con el binding y con el helper incluido en el bundle, y `wrangler deploy --dry-run` lista `env.GESTION_DB (jurmaq-barraca-gestion)`. (El `next build` pelado termina con exit 1 por un aviso de seguridad de la versión de Next, después de compilar y listar todas las rutas; no es del binding. Ver riesgos del informe.)

### Migraciones D1: numeración
- Carpeta `apps/barraca/migrations-gestion/` (`migrations_dir` del binding). Archivos `NNNN_nombre.sql`, 4 dígitos, **correlativos sin saltos ni repetidos** (lo verifica `scripts/gestion.test.mjs`).
- Reservado: `0001_base` (auditoría y vistas previas, hecha), `0002_oauth`, `0003_contenido`, `0004_cupones`. Cada pieza agrega solo la suya; si dos piezas coinciden en número, renumera la que llegó después (antes de aplicar en producción).
- Sin `IF NOT EXISTS`: una migración mal aplicada debe fallar fuerte. Una migración ya aplicada nunca se edita: se agrega otra.
- Convenciones: tiempos en milisegundos desde epoch (`INTEGER`), JSON como `TEXT`, ids como `TEXT`.

### Tablas de `0001_base.sql`
- `auditoria(id, lote_id, usuario_id, usuario_email, herramienta, entidad, entidad_id, antes, despues, creado_en, deshecho_en, deshecho_por)`. `usuario_id` es `users.id` de Supabase como texto.
- `vistas_previas(id, usuario_id, tipo, payload, huella, creado_en, expira_en, usada_en)`.

### Código: `src/lib/gestion/` (importar desde `@/lib/gestion`)
- `usarGestion(db => ...)`: toma la D1 vía `getCloudflareContext()` de OpenNext. Lanza `GestionNoDisponibleError` (`codigo "GESTION_NO_DISPONIBLE"`) si falta el binding o la base no tiene tablas (`no such table`). Usa `esGestionNoDisponible(e)` para atraparlo y responder "gestión no disponible" sin detalles. `obtenerGestionDb()` devuelve `null` en vez de lanzar.
- Auditoría: `registrarLote(db, loteId, usuario, cambios[])` (atómico, en tandas de 90), `registrarCambio`, `nuevoLoteId()`, `listarLotes(db, {limite, antesDe, usuarioId, soloVigentes})`, `obtenerLote`, `historialDeEntidad`, `marcarDeshecho(db, loteId, usuarioId)` (devuelve cuántas marcó; 0 = ya estaba deshecho, idempotente) y `marcarEntradaDeshecha`. `antes`/`despues` guardan JSON mínimo para revertir (tope 256 KB). Deshacer de verdad (reescribir Supabase) es del llamador; debe llamar `marcarDeshecho` solo si la reversión salió bien.
- Vistas previas: `crearVistaPrevia(db, {usuarioId, tipo, payload, huella?, ttlMs?})` devuelve `{id, expiraEn}` (id de 12 caracteres sin 0/O/1/I/L, 15 min por defecto, máximo 24 h). `consumirVistaPrevia(db, {id, usuarioId, tipo?, huellaActual?})` es atómico (UPDATE ... RETURNING) y devuelve `{ok:true, payload,...}` o `{ok:false, motivo}` con motivo `no_existe` (incluye "es de otro usuario", sin revelar que existe), `expirada`, `usada`, `tipo_distinto`, `huella_cambiada`. Si la vista tiene huella, confirmar exige `huellaActual` igual; un rechazo por huella no gasta la vista. `limpiarVistasPrevias(db)` borra vencidas y usadas (llamarla desde un cron o de vez en cuando).
- `huellaDeDatos(valor)`: SHA-256 hex de JSON con claves ordenadas (WebCrypto, sin cripto propia). Úsala para `huella`: calcula la huella de los datos reales (p. ej. precios actuales de los productos afectados) al crear la vista y de nuevo al confirmar.
- `sha256Hex`, `idCorto`, `jsonEstable` también exportadas.
- Los imports internos llevan extensión `.ts` (Node las ejecuta directo en las pruebas); por eso `tsconfig.json` ahora tiene `allowImportingTsExtensions`. Código nuevo de `lib/gestion` debe seguir esa regla.

### Arnés de pruebas con D1 simulada
- `scripts/pruebas/d1-simulada.mjs`: `crearD1Simulada({migraciones})` crea una D1 en memoria sobre `node:sqlite` (viene con Node 22+, cero dependencias) con la API de D1 (`prepare/bind/first/all/run/batch`, batch atómico) y aplica las migraciones reales de `migrations-gestion/` (`true` todas, `false` ninguna, o un nombre de archivo para llegar hasta ahí; útil para probar una migración nueva sobre la anterior). También `listarMigraciones()`.
- `scripts/pruebas/cargar-alias.mjs`: `import "./pruebas/cargar-alias.mjs"` antes de importar módulos de `src/` que usan `@/...` o `@jurmaq/shared/supabase`. Reemplaza Supabase por `scripts/pruebas/supabase-falso.mjs` (datos en `globalThis.__PRODUCTOS_FALSOS__`, escrituras en `globalThis.__ESCRITURAS_FALSAS__`; solo cubre `barraca_productos` con `select/order/range/update/insert/eq`: amplíalo si tu pieza lo necesita). Usa `module.registerHooks` (Node 22.15+).
- Correr todo: `npm test` en `apps/barraca` (`node --test scripts/*.test.mjs`). Pruebas: `scripts/gestion.test.mjs` (auditoría, vistas previas, huellas, "no disponible"), `scripts/importar-barraca.test.mjs`, `scripts/aviso-promo.test.mjs`.
- Los módulos con `import 'server-only'` o dependencias de Next no se pueden cargar así: separa la lógica pura en un archivo sin esas importaciones (como `aviso-promo.ts`).

## 2. Hallazgos (confirmaciones por lectura de código)

### a) Importador con "Precio Tachado": guarda al revés de lo que dice el brief
- Evidencia: `src/lib/import-barraca-smart.ts:303-324`. Con la columna "Precio Tachado" llena: `precio` = tachado (línea 316) y `precio_original` = precio real (línea 319), `en_oferta` = true. El export hace lo mismo a la inversa (`src/app/api/productos/export/route.ts:54-55`: Precio = `precio_original`, Precio Tachado = `precio`). Al crear productos nuevos con promo: `import-barraca-smart.ts:446-447` (igual: `precio` = tachado).
- Hay dos convenciones en el código: el importador, `promotions.ts:165-190` y el encabezado de `pricing.ts:1-22` usan precio_original = el que se cobra; el panel (`src/app/api/admin/productos/bulk-action/route.ts:161-167`) y el modelo del brief usan precio = el que se cobra y precio_original = tachado.
- Qué se cobraría: la tienda resuelve por valor, no por columna: `src/lib/pricing.ts:85` (`Math.min(precio, precio_original)`), `src/lib/precio-web.ts:35` y el carrito/checkout (`src/lib/tienda.ts:120-128` → `resolvePrice(...).precioFinal`). Si Claudia hubiera ejecutado el importador con tachado mayor que el real, se cobraba el real (el menor) y se mostraba el tachado correcto. Riesgos que sí existen: (1) si el tachado queda menor que el real (error de digitación) se cobra el tachado sin aviso (probado); (2) lo que lee `precio` crudo (listados del panel, `cotizaciones`, combos) vería el tachado como precio base; (3) el importador no valida que tachado > real.
- Probado en `scripts/importar-barraca.test.mjs` ("(a) ...").

### b) "0 a actualizar" en /admin/importar con Id, Codigo, Nombre, Precio, Precio Tachado
- La detección de columnas NO es la causa: las cinco cabeceras se reconocen (`import-barraca-smart.ts:44-90`, `detectColumnMapping` 185-207; test "se detecta completo").
- Causa más probable y reproducida: el cruce por **id** (por defecto, `src/app/admin/importar/page.tsx:38`) no encuentra filas cuando los Id del Excel no son los `barraca_productos.id` (p. ej. Ids de Softmad). No hay respaldo por código: `matchProducts` (`import-barraca-smart.ts:213-248`) marca esas filas como `create`, y `src/app/api/importar/preview/route.ts:34-40` las convierte en `skip` cuando "crear nuevos" está apagado. La pantalla suma 0 en "a actualizar" y las muestra como "sin cambios" (`page.tsx:236-239`), sin decir "sin coincidencia". Mismo archivo cruzado por código: sí actualiza (test).
- Otras causas confirmadas que también dan resultados malos (no sin cambios): precios como texto (`$ 900` se descarta en silencio; `1.800` se lee como 1,8, porque `toNumber` usa `Number()`, líneas 150-154); re-importar un export sin tocarlo marca las ofertas como "a actualizar" y las dejaría con precio = precio_original (la oferta desaparece; el bucle genérico de `precio`, líneas 252-261, pisa el valor antes del bloque de tachado); con cruce por código, las fichas duplicadas (mismo código) solo actualizan la última (`lookupMap.set`, línea 233; hay 274 códigos duplicados); `fetchAllProducts` (124-142) ignora `error` (si Supabase falla, todo queda "sin coincidencia") y pagina con `order('nombre')`, que no es único (puede saltarse o repetir filas entre páginas); `resetAll` deja `matchBy='codigo'` (línea 63) pero el inicial es `'id'` (línea 38).
- No pude ver el archivo real de Claudia (no está en el disco). Para confirmar cuál causa fue, basta comparar su columna Id con `barraca_productos.id`.
- Tests: `scripts/importar-barraca.test.mjs`, marcados "[reproduce el bug]" (documentan el comportamiento actual) y tres `todo` "ESPERADO" que describen lo correcto. Quien corrija debe invertir esas aserciones. No se tocó código de negocio.

### c) Cupones
- `src/lib/cupones.ts` (`validarCupon`, `registrarUsoCupon`) lo importan solo `src/app/api/cotizaciones/route.ts:9` (POST, líneas 183-298) y `src/app/api/public/cupones/validar/route.ts:4`. Nadie llama a ese validador desde la UI: `/cotizar` redirige a `/carrito` (`src/app/cotizar/page.tsx`), y ningún componente, carrito ni checkout menciona cupones.
- `/api/pedidos` (`src/app/api/pedidos/route.ts`), `src/lib/tienda.ts`, carrito y checkout **no aplican ningún cupón**. Único descuento hoy: 2 % por transferencia (`route.ts:163-164`, total en 199). `barraca_pedidos` no tiene columnas de cupón (las `cupon_*` se agregaron a `barraca_cotizaciones`). Además `src/content/legal/terminos.md:257` dice expresamente que la tienda no tiene cupones: al activarlos hay que cambiar los términos.
- Definición (de `apps/barraca/scripts/migrate-cupones.sql`, no está en `supabase/migrations/`; no pude confirmar que esté aplicada en producción): `barraca_cupones(id uuid, codigo text único con CHECK ^[A-Z0-9_-]{3,30}$, descripcion, tipo 'porcentaje'|'monto_fijo', valor numeric(12,2) >0, monto_minimo_compra numeric(12,0), max_usos_total int null=ilimitado, max_usos_por_usuario int default 1, usos_actuales int, valido_desde timestamptz, valido_hasta null=sin vencimiento, activo bool, created_at, created_by uuid)` y `barraca_cupones_usos(id, cupon_id, cotizacion_id integer → barraca_cotizaciones, email, descuento_aplicado, monto_compra, usado_at)`. Semilla del archivo: `BIENVENIDO10` (10 %, mínimo 50.000, 1000 usos) y `JUR10K` ($10.000 sobre 100.000). **`VERANO27` no aparece en el repo**: si existe, se creó desde el panel (`/admin/cupones`, API `src/app/api/admin/cupones/route.ts`) y vive solo en la base.
- Concurrencia: `registrarUsoCupon` hace insert + update no atómico de `usos_actuales` (read-modify-write); para pedidos conviene una función en base.
- **No existe una RPC que cree el pedido**: `/api/pedidos` hace `db.from('barraca_pedidos').insert(p)` (`src/lib/pedidos/index.ts:262-263`). Las funciones Postgres de pedidos son solo `barraca_pedido_marcar_pagado`, `barraca_pedido_reservar_stock`, `barraca_pedido_cerrar`, `barraca_pedido_cancelar`, `barraca_pedido_vencer` (migraciones `2026_10_26`, `2026_10_30`, `2026_10_31_..._transferencia_informada`, `2026_11_01_..._vencer_transferencias`). Para cupones en pedidos hay que agregar columnas a `barraca_pedidos` (SQL en `supabase/migrations`, que Jorge aplica) y calcular el descuento en servidor dentro de `route.ts` antes de `total`, validando de nuevo en el pago.

## 3. Mapa para las demás piezas

### Contenido hoy
- Términos y privacidad: `src/content/legal/terminos.md` y `privacidad.md`, leídos con `fs.readFileSync` en `src/components/barraca/DocumentoLegal.tsx:20` (`leerDocumento`); páginas `src/app/terminos/page.tsx` y `privacidad/page.tsx` con `dynamic = "force-static"` (se arman al compilar: editar contenido en vivo exige otra estrategia, p. ej. leer de D1 y `revalidatePath`). Versión vigente de términos: `VERSION_TERMINOS` en `src/lib/vigencia.ts`.
- Envíos y devoluciones: `src/app/envios-y-devoluciones/page.tsx` (`revalidate = 3600`), texto fijo; tarifas desde `barraca_zonas_despacho` vía `src/lib/despacho/tarifas-db.ts` (respaldo en `zonas.ts`).
- Nosotros y contacto: `src/app/nosotros/page.tsx`, `src/app/contacto/page.tsx`, `src/app/sucursales/page.tsx`; datos de empresa en `LEGAL_INFO`, `HQ`, `HORARIO_BARRACA` (`packages/shared/src/seo/index.ts:968-1069`).
- Popup: `src/components/barraca/AvisoVentasOnline.tsx` + `src/lib/aviso-promo.ts` (vence 02-12-2026 00:00 Chile; rutas excluidas), montado en `src/app/layout.tsx:216`. `NewsletterPopup.tsx` está retirado del shell (`BarracaShell.tsx:25`).
- Slides: un solo `src/components/barraca/HeroSlider.tsx` para escritorio y celular (textos en `SLIDES_FIJAS`, línea 29, y el arreglo de la línea 71; precios en vivo solo del tubo), usado en `src/app/page.tsx:369` (`revalidate = 3600`, línea 162). `MobileHero.tsx` y `MobileTrustStrip.tsx` existen pero **nadie los importa** (código muerto).
- Cinta superior: **no existe** en barraca hoy (el header de `src/app/BarracaShell.tsx:154` empieza directo con logo y menú). Hay que crearla si se pide.

### Sesión, rol y permisos
- Sesión: `auth()` de `packages/shared/src/auth/index.ts` (NextAuth v5, JWT de 90 días con renovación diaria, `auth/config.ts:54-63`). `session.user.id` = `token.sub` (string del `users.id`), `.role`, `.scope` (`config.ts:188-208`; si el scope del token no coincide con `AUTH_SCOPE` el usuario queda anónimo).
- Guardas en rutas: `requirePermission(modulo, accion)` y `requireRole([...])` de `@jurmaq/shared/auth/guard`; permisos `can(role, modulo, accion)` en `packages/shared/src/roles/index.ts:252` (roles: admin, gerente, vendedor, operador, contador; módulos `barraca_*`, p. ej. `barraca_productos`, `barraca_precios`, `barraca_importar`, `barraca_ventas`).
- **El rol viaja en el JWT**: un cambio de rol o una baja de usuario no se nota hasta la próxima renovación (hasta 24 h). Para acciones sensibles (MCP) hay que revalidar contra la base. No existe un helper para eso: la tabla es `users(id bigint, email, name, password, role, scope, created_at)`; se consulta con `supabaseAdmin.from('users').select('id, email, role, scope').eq('id', Number(sub)).maybeSingle()` (referencia: `findAdminPorSsoEmail`, `auth/index.ts:65-85`, hace lo mismo por email). Comprobar además `scope in (AUTH_SCOPE, 'both')`.

### Tablas (Supabase; db-types está desactualizado para pedidos, cupones, despacho y combos: ver migraciones)
- `barraca_productos`: id (int), codigo (no único: 274 duplicados), nombre, slug, descripcion, precio, precio_original, en_oferta, oferta_fin, combo_cantidad, combo_precio (migración `2026_11_01_barraca_combos.sql`), costo, stock, unidad, medida, peso, imagen, categoria_id, producto_padre_id, destacado, solo_cotizar, activo, created_at. Vista pública sin costo: `barraca_productos_public` (migración `2026_11_01_barraca_productos_sin_costo_publico.sql`).
- `barraca_categorias`: id, nombre, slug, descripcion, imagen, orden, padre_id, activa.
- Despacho: `barraca_zonas_despacho(id text, nombre, comuna, costo, gratis_desde, activo, orden, updated_at, updated_by)` (`2026_10_31_barraca_admin.sql:21`); comunas en `src/lib/despacho/comunas.ts`.
- Pedidos: `barraca_pedidos` (numero, acceso_hash, estado, metodo_pago, entrega, direccion, comuna, nombre, rut, telefono, email, items jsonb, subtotal, costo_despacho, descuento_transferencia, total, stock_descontado, pagado_at, courier_*, factura_*, documento_*, created_at...) y `barraca_pedidos_eventos`; estados en `src/lib/pedidos/index.ts:18`. Se crean con insert directo (`index.ts:262`).
- Opiniones: `barraca_reviews(id uuid, producto_id, usuario_id null, pedido_numero null, autor_publico, usuario_nombre, rating, titulo, comentario, estado, compra_verificada, utiles_count, moderado_at/by, notas_moderacion)`; moderación en `src/app/admin/reviews`, lógica en `src/lib/opiniones.ts`.
- Cupones: ver 2c. Cotizaciones: `barraca_cotizaciones` (flujo antiguo).

### Caché
- No se usa `revalidateTag` en ninguna parte. Se revalida con `revalidatePath` desde `src/lib/revalidar.ts` (`revalidarCatalogo`, `revalidarFichas`, `revalidarFichasDePedido`, `conRevalidacion`) y la ruta `src/app/api/revalidar/route.ts` (con `CRON_SECRET`). Techos: fichas `revalidate = 604800` (`producto/[slug]/page.tsx:47`), categorías 86400, home y envíos 3600.
- OpenNext incremental cache **sí está configurado** (`open-next.config.ts`): páginas en R2 (`NEXT_INC_CACHE_R2_BUCKET`) con caché regional, tag cache en D1 (`NEXT_TAG_CACHE_D1`), cola en Durable Object, `enableCacheInterception: true`. `revalidatePath` marca en el tag cache y refresca al instante. Tras cambiar precios con el MCP, llamar `revalidarFichas(ids)` (pocos productos) o `revalidarCatalogo()` (masivo; costoso: regenera ~2.000 fichas).

## 4. Pendientes y riesgos de esta pieza
- Crear la D1 real, poner el `database_id` y aplicar migraciones: lo hace Jorge al publicar.
- `next build` pelado devuelve exit 1 por el aviso `SecurityFatalError` (versión de Next afectada por una vulnerabilidad conocida, Next 16.4.3 fijado en el `package.json` raíz) después de compilar y generar todas las rutas; `opennextjs-cloudflare build` termina bien. Actualizar Next es decisión de Jorge.

## 5. Conexión de Claude: servidor MCP, OAuth, aprobaciones, /admin/conexiones (pieza A)

### Fuentes leídas (25-11-2026)
- MCP, autorización, revisión 2026-07-28: modelcontextprotocol.io/specification/latest/basic/authorization (+ `authorization/authorization-server-discovery`, `authorization/client-registration`).
- MCP, transporte Streamable HTTP, revisión 2026-07-28 y notas de compatibilidad con 2025-03-26 a 2025-11-25: modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http.
- Claude, conectores personalizados: claude.com/docs/connectors/building/authentication, `.../building/lazy-authentication`, `.../building/mcp`, `.../custom` (la página de support.claude.com/articles/11503834 ya no existe; la reemplazó claude.com/docs).
- Qué exige Claude (resumen): `401` real con `WWW-Authenticate: Bearer resource_metadata=...` (ignora el header en un 200); `resource` de la metadata = URL exacta del conector; solo usa el primer `authorization_servers`; PKCE S256 siempre; `Content-Type: application/x-www-form-urlencoded` en `/token`; 10 s de plazo en discovery/registro/token (30 s en refresh); `invalid_grant` al fallar un refresh; rotar refresh de clientes públicos; DCR o CIMD. Callback de las apps de Claude: `https://claude.ai/api/mcp/auth_callback` (puede pasar a claude.com: se aceptan ambas). Claude Code: loopback `http://localhost/callback` y `http://127.0.0.1/callback` con cualquier puerto. Salida de Anthropic: `160.79.104.0/21` (no hay WAF en este sitio que la bloquee).
- Decisión de versión de MCP: el servidor habla 2024-11-05 a 2025-11-25 (`initialize` + `tools/*`, sin sesiones, solo POST con respuesta JSON; GET/DELETE dan 405). La revisión 2026-07-28 (sin `initialize`, DCR deprecada) se rechaza con 400 y la lista `supported`, que es lo que su spec pide a un servidor que no la implementa. Revisar cuando Claude la use.

### Librerías evaluadas y por qué no
- `@cloudflare/workers-oauth-provider`: envuelve TODO el worker (aquí es el de OpenNext con cron propio en `custom-worker.ts`), exige un KV nuevo (recurso de producción, el brief lo prohíbe) y el login real es NextAuth + Supabase, no calza.
- `@modelcontextprotocol/sdk`: trae transportes de Node/Express, suma peso al bundle del worker y su soporte de la spec 2026-07-28 es incierto. El protocolo que se necesita (initialize, ping, tools/list, tools/call) son ~150 líneas.
- Cripto propia: ninguna. Solo WebCrypto (SHA-256, HMAC-SHA-256, números al azar) en `src/lib/mcp/cripto.ts`; PKCE verificado contra el vector oficial del RFC 7636.
- CIMD: no se anuncia (`client_id_metadata_document_supported` ausente): Claude cae a DCR, que es lo que acepta la lista blanca. Si algún día se quiere, habría que bajar el documento del cliente (SSRF: solo hosts claude.ai/claude.com).

### URLs (todas bajo https://barraca.jurmaq.cl)
- Conector a pegar en Claude: `/api/mcp`.
- Metadata de recurso protegido (RFC 9728): `/.well-known/oauth-protected-resource/api/mcp` y `/.well-known/oauth-protected-resource`. Servidor de autorización (RFC 8414): `/.well-known/oauth-authorization-server` (issuer = el origen).
- `/oauth/register` (DCR), `/oauth/token`, `/oauth/revoke` (RFC 7009), `/oauth/decision` (botón Autorizar/Cancelar), `/admin/conexiones/autorizar` (pantalla de autorización; vive bajo /admin para reutilizar el login con código por correo: el middleware manda a /login y vuelve; `safeCallback` del login solo acepta rutas /admin).
- `/admin/conexiones` (panel, solo admin), `/api/mcp/admin` (revocar/deshacer), `/aprobar/<token>` (pública).
- Origen canónico: `NEXT_PUBLIC_BARRACA_URL` o `https://barraca.jurmaq.cl` (`baseCanonica()` en `lib/mcp/config.ts`). El `resource` es `<origen>/api/mcp`; un token emitido para otro recurso se rechaza.

### OAuth: reglas implementadas (`src/lib/mcp/oauth.ts`, `redirects.ts`, `autorizar.ts`)
- PKCE S256 obligatorio; clientes públicos (`token_endpoint_auth_method: none`); `iss` en la respuesta (RFC 9207).
- Lista blanca de redirect_uri: las dos URLs oficiales de Claude (exactas) y loopback `http://127.0.0.1|localhost|[::1]:<puerto>/callback` (puerto libre, solo esa ruta, sin query/fragmento/usuario). Se valida al registrar y otra vez al autorizar; si no coincide NO se redirige (pantalla de error).
- Código: 60 s, un solo uso (UPDATE atómico); reusarlo revoca los tokens que ya salieron de él. Acceso 1 h. Refresco 30 días deslizante con tope absoluto de 90 días por conexión; rotación atómica y detección de reuso (se revoca la familia). Un acceso ya rotado aguanta 60 s (peticiones en vuelo).
- Tokens opacos con prefijo (`mcpa_`, `mcpr_`, `mcpc_`, `mcpv_`), guardados solo como SHA-256. Nada de claves en URL (el Bearer va en el header; en la URL solo viaja el `code` de un solo uso que exige el estándar y el enlace de aprobación que pidió Jorge).
- Scopes: `tienda:leer` y `tienda:escribir` (escribir implica leer); `offline_access` se acepta y se ignora. Las herramientas con `readOnlyHint: false` exigen `escribir` (403 `insufficient_scope`); con solo `leer` no aparecen en `tools/list`.
- Cada llamada al MCP: Origin (solo sin Origin, el propio sitio o claude.ai/claude.com) → token (hash, vigencia, audiencia) → **usuario revalidado en Supabase** (`users`: rol `admin`, scope `barraca` o `both`, correo en `LOGIN_BARRACA_PERMITIDOS`; no usa el rol del JWT, que tarda hasta 24 h) → límite de uso → tamaño (128 KB) y JSON → método. Si el usuario deja de calificar: 401 y se revoca toda la conexión. Si Supabase no responde: 503 sin revocar.
- Límites en D1 (`mcp_limites`, ventana fija, UPSERT atómico; D1 y no KV porque ya está enlazada y KV es eventualmente consistente): 120 llamadas/min por conexión, 30 escrituras/min, 20 registros/h por IP (hash), 30 tokens/min por IP, 10 autorizaciones/10 min por usuario, 40 vistas de aprobación/min por IP. Tope de 500 clientes registrados sin uso; los de más de 7 días sin tokens se pueden limpiar con `limpiarOauth`.
- Errores: las herramientas solo muestran `ErrorHerramienta`; cualquier otra falla sale como mensaje genérico y el log lleva solo el nombre del tipo de error (sin mensaje, sin datos).

### Pantalla de autorización y aprobación (anti clickjacking y CSRF)
- Son rutas (no páginas) para controlar encabezados: `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'`, `no-store`, `no-referrer`, `noindex`. El CSP global de `next.config.ts` (`frame-ancestors 'self'`) se suma; el más estricto gana.
- Autorizar: el paquete firmado (HMAC con subclave de `AUTH_SECRET`, atado al usuario, 10 min) viaja en un campo oculto; POST exige mismo origen, sesión viva, usuario revalidado y vuelve a validar la solicitud contra la base. El retorno al cliente es una página con `meta refresh` + enlace, no un 302: Chrome aplica `form-action` del CSP global a las redirecciones de un formulario y bloquearía `claude.ai`.
- Texto de lo que Claude puede/no puede hacer: `src/lib/mcp/permisos-texto.ts` (las piezas de herramientas deben mantenerlo fiel).

### Cómo agregar una herramienta (interfaz estable)
1. Crea `src/lib/mcp/tools/<nombre>.ts` con `defineHerramienta({ nombre (snake_case), titulo, descripcion (español), esquema: z.object({...}), anotaciones: { readOnlyHint, destructiveHint, idempotentHint }, ejecutar(args, ctx), revertidor? })` (importa `defineHerramienta`, `z`, `ErrorHerramienta` de `./registro.ts`).
2. Agrégala en `tools/index.ts` con `registro.agregar(...)`. No se toca el servidor ni el OAuth.
3. El servidor vuelve estricto el esquema (campos extra = error) y lo expone como JSON Schema. `ctx` trae `usuario`, `clienteId`, `loteId` (un lote de auditoría por llamada), `db` (GESTION_DB), `ahora`, `auditar([{ entidad, entidadId, antes, despues }])` y `catalogo`. Primero escribe en Supabase y después `auditar` con `antes`/`despues` mínimos.
4. Deshacer: el `revertidor({ db, usuario, ahora, entradas })` debe reescribir `antes` sin pisar cambios posteriores (comparar con `despues`), ser repetible y devolver `{ ok, mensaje }`. `deshacerLote` es todo o nada: marca el lote como deshecho solo si todos los revertidores salieron bien. Un lote cuya herramienta no tiene revertidor no muestra el botón Deshacer.
5. Herramienta `guia` base en `tools/guia.ts` (temas general, aprobaciones, deshacer, herramientas); las demás piezas la completan.

### Aprobaciones (`src/lib/mcp/aprobaciones.ts`; cableado real en `aprobaciones-servidor.ts`)
- `requiereAprobacion({ acumulado?, productos?, precios?, banderas? })` (pura): más de 300 productos distintos o un precio con variación acumulada > 30 % en 24 h; precio < costo (`precio_bajo_costo`) o < costo × 1,15 (`margen_menor_15`); más las `banderas` que la herramienta ya sabe: `descuento_transferencia`, `despacho`, `envio_gratis`, `texto_legal`, `cupones_interruptor`, `correo_cliente`. Devuelve `{ requiere, motivos }`.
- Acumulado: antes de decidir, `leerAcumulado(db, usuarioId)`; después de aplicar, `registrarAcumulado(db, usuarioId, items, { aprobado })`. `clave` = código del producto (las 274 fichas duplicadas cuentan como uno). Lo aprobado por Jorge no cuenta. Dividir un cambio grande en varios chicos no evade el umbral (probado).
- Flujo: `solicitarAprobacionReal(db, { usuario, herramienta, motivos, resumen, detalle, huella })` (con `huella = huellaDeDatos(<contenido exacto del cambio>)`) → correo a `BARRACA_APROBADOR_EMAIL` con enlace `/aprobar/<token>` (un solo uso, 4 h, solo hash en la base) → Jorge abre (GET solo muestra, no cambia nada) y toca Aprobar/Rechazar (POST + CSRF + mismo origen). La herramienta, al repetirse, calcula la huella ACTUAL y llama `estadoAprobacion(db, id, { usuarioId, huellaActual })`: `aprobada` → `consumirAprobacion` (una vez) y recién ahí aplica; `datos_cambiaron`, `vencida`, `rechazada`, `usada`, `pendiente`, `no_existe` → no aplica y se lo dice a Jorge.
- **Sin el secreto `BARRACA_APROBADOR_EMAIL` (o con correo inválido) la acción queda BLOQUEADA** (`{ ok:false, estado:'bloqueada', motivo:'sin_aprobador' }`), también si el correo no sale (`correo_fallo`) o hay más de 10 solicitudes/hora (`limite`). Se lee de `process.env` (secreto de Cloudflare: `wrangler secret put BARRACA_APROBADOR_EMAIL`); no se tocó `packages/shared/src/env.ts`. El correo va sin copia oculta (`skipAdminBcc`) por Resend, igual que el código de login.

### Usuarios con acceso (comprobado por REST de solo lectura, 25-11-2026)
- La tabla `users` tiene 5 filas; solo 2 tienen scope `barraca` o `both`: `contacto@jurmaq.cl` (rol admin, scope both) y un vendedor (scope barraca). Es decir, el único admin que cubre la barraca es la cuenta compartida contacto@jurmaq.cl; el MCP queda atado a esa cuenta (y a cualquier admin futuro que esté en `LOGIN_BARRACA_PERMITIDOS`). No hay columna de "activo": una baja es borrar la fila o bajar rol/scope, y eso corta el MCP en la siguiente llamada.
- Consecuencia: la auditoría registra `contacto@jurmaq.cl`, no a una persona. Si Claudia y Jorge usan la misma cuenta, el historial no distingue quién fue.

### Pendientes de esta pieza (antes de publicar)
- Crear la D1 real y aplicar las migraciones (ver sección 1); la `0002_oauth.sql` agrega `oauth_clientes`, `oauth_codigos`, `oauth_tokens`, `mcp_limites`, `aprobaciones` y `cambios_acumulados`.
- Poner el secreto `BARRACA_APROBADOR_EMAIL` en el worker (sin él, todo lo que pida aprobación queda bloqueado).
- Probar el flujo con un cliente real (Claude o Claude Code) una vez publicado: no se pudo probar contra el worker, porque no hay D1 ni servidor local (regla de Jorge). Lo cubierto por pruebas automáticas es la lógica (`scripts/mcp-oauth.test.mjs`, `mcp-aprobaciones.test.mjs`, `mcp-web.test.mjs`), no el cableado de Next/OpenNext.
- Programar `limpiarOauth`, `limpiarLimites`, `limpiarAprobaciones` (por ejemplo desde el cron existente); hoy nadie las llama.
- La pantalla de autorización y `/aprobar` no se vieron en un navegador (no se prende el servidor local).
