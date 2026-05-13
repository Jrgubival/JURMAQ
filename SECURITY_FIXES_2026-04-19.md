# Correcciones de Seguridad — 2026-04-19

## Resumen
11 vulnerabilidades detectadas en auditoria, todas corregidas y desplegadas.

## CRITICAL (3)

### 1. RLS abierto en tablas sensibles
Anteriormente `barraca_cotizaciones`, `barraca_carrito` y `barraca_promociones` tenian politicas `USING (true)` que permitian a cualquiera con la anon key leer/escribir datos de clientes y modificar precios.

Adicionalmente `barraca_productos` exponia el campo `costo` (margen interno) al publico.

**Fix**:
- Se eliminaron las politicas abiertas
- Se revocaron los permisos al rol `anon` y `authenticated` en las 4 tablas
- Se creo la vista `barraca_productos_public` sin el campo `costo` para que el storefront siga funcionando
- Los endpoints del API usan `supabaseAdmin` (service_role) que bypasea RLS, asi que nada se rompe

Script: `scripts/harden-rls.js`

### 2. Bypass de CSRF por `startsWith`
`isValidOrigin()` en `src/lib/sanitize.ts` usaba `origin.startsWith('https://barraca.jurmaq.cl')` que aceptaba `https://barraca.jurmaq.cl.evil.com`.

**Fix**: Parse URL y compara `host` exacto contra un allowlist fijo:
- jurmaq.cl, www.jurmaq.cl, barraca.jurmaq.cl, jurmaq-app.vercel.app
- Tambien acepta dominios `*.vercel.app` que contengan "jurmaq" (previews)

## HIGH (5)

### 3. PDF sin auth + XSS almacenado
`/api/barraca/cotizaciones/[id]/pdf` no verificaba auth y los campos del cliente (`nombre`, `empresa`, etc.) y de los items se interpolaban en HTML sin escapar.

**Fix**:
- Requiere sesion admin OR `?email=` que coincida con la cotizacion
- Funcion `escapeHtml()` aplicada a TODOS los valores del usuario
- Badge de `estado` ahora se sanitiza a `[a-z]` antes de usarlo como clase CSS

### 4. by-numero fugaba PII sin auth
Los numeros de cotizacion son predecibles (`COT-YYYYMMDD-NNN`). Cualquiera podia enumerar y obtener nombre/email/telefono/RUT.

**Fix**: 
- Sesion admin o `?email=` devuelve data completa
- Sin email: devuelve respuesta limitada (items y total, sin PII, nombre enmascarado al primer nombre)

### 5. /accept sin auth
Cualquiera con un id de cotizacion en estado `contraoferta` podia aceptar/rechazarla.

**Fix**: Requiere sesion admin o body `email` que coincida + agrego check `isValidOrigin`. El cliente publico pasa el email desde el URL `?email=`.

### 6. Rate limit ausente en login admin
El callback de NextAuth credentials no tenia rate-limit. Brute force posible sujeto solo al costo CPU de bcrypt.

**Fix**: `rateLimit()` en `authorize()` con clave `admin-login:${ip}:${email}`, 5 intentos / 15 min.

## MEDIUM (3)

### 7. Upload sin auth + validacion debil
`/api/barraca/upload` aceptaba cualquier tipo declarado por el cliente (`file.type`) sin verificar los magic bytes del archivo.

**Fix**:
- Agregado `isValidOrigin`
- Rate limit: 5 subidas/hora/IP
- Validacion de magic bytes (PDF, JPG, PNG)
- Cross-check entre tipo declarado y detectado
- Extension del filename usa el tipo DETECTADO, no el del cliente

### 8. Webhook MercadoPago sin firma
Cualquiera podia enviar payloads al webhook.

**Fix**: Verificacion HMAC-SHA256 segun docs MP usando `MERCADOPAGO_WEBHOOK_SECRET`:
- Template: `id:<id>;request-id:<xRequestId>;ts:<ts>;`
- Rechaza firmas mayores a 5 min (replay protection)
- `crypto.timingSafeEqual` para comparar

### 9. `?all=true` bypass filtro
`/api/barraca/productos?all=true` permitia listar productos inactivos y con stock negativo sin auth.

**Fix**: Si `all=true`, chequea `auth()` antes de honrar el flag. Usuarios anonimos siempre ven la vista filtrada.

## Variable de entorno nueva

Agregar en Vercel:
```
MERCADOPAGO_WEBHOOK_SECRET=<el secret que te da MP al configurar el webhook>
```

Si no se configura, el webhook acepta todo (modo compat), pero escribe warning en logs.

## Datos limpiados

Se eliminaron 8 filas de prueba en `barraca_cotizaciones` creadas durante auditorias:
- #3, #5, #6, #7, #8, #9, #14, #16

## Redirect SEO

`jurmaq.cl/barraca*` ahora redirige 301 a `barraca.jurmaq.cl/*`. Todo el trafico de la barraca vive en el subdominio, consolidando SEO.
