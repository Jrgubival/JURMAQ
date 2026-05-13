# Sistema de Contratos de Arriendo — JURMAQ

## Que hace el sistema

Genera, almacena y permite firmar electronicamente (con validez legal en Chile, Ley 19.799) contratos de arriendo de maquinaria. Todo queda registrado y es revisable desde `/admin/contratos`.

## Flujo tipico

1. Admin va a `/admin/contratos` → boton "Nuevo Contrato"
2. Wizard de 4 pasos:
   - Paso 1: elige la maquinaria del catalogo
   - Paso 2: ingresa datos del arrendatario (persona natural o empresa)
   - Paso 3: condiciones (fechas, precio, con/sin operador, garantia, direcciones)
   - Paso 4: preview del contrato renderizado. Elige "Guardar borrador" o "Crear y enviar para firma"
3. Si "enviar para firma": se manda email al arrendatario con link `barraca.jurmaq.cl/contrato/firmar/TOKEN`
4. Arrendatario abre el link:
   - Lee el contrato
   - Hace click en "Enviar codigo" → recibe OTP de 6 digitos por email (15 min validez)
   - Ingresa el codigo y verifica
   - Dibuja su firma en el canvas
   - Click "Firmar contrato" → se guarda firma + IP + timestamp + hash SHA-256
5. Admin ve el contrato firmado en `/admin/contratos/[id]` — estado "firmado", con firma visible

## Datos del arrendador (fijos)

```
Razon social: Constructora Jorge Ubilla Rivera E.I.R.L.
RUT: 76.624.872-1
Domicilio: Lote 3 del lote A, HJ 11, Maquehua, Curico, Region del Maule
Representante legal: Jorge Ubilla Rivera
```
Estos valores estan hardcodeados en `src/app/api/admin/contratos/_helpers.ts` (`JURMAQ_ARRENDADOR`).

## Firma electronica — Ley 19.799

El sistema implementa **Firma Electronica Simple** (FES), valida para arriendo de maquinaria entre privados.

**Evidencia legal capturada en cada firma:**
- Dibujo de firma (base64 PNG del canvas)
- IP del firmante
- User agent del navegador
- Timestamp UTC del momento de firma
- Hash SHA-256 del contenido exacto del contrato al momento de firmar
- Codigo OTP de 6 digitos enviado por **email** al firmante, hasheado con bcrypt en DB
- Token de firma con expiry 24h server-side
- Cedula del firmante (foto) almacenada en bucket privado, hash SHA-256 ligado al evento

Esto cumple el art. 3 de la Ley 19.799 (ID unica + integridad del documento + imputacion al firmante).

## OTP por Email (Resend)

El OTP de firma se envia por email (Resend) en lugar de SMS. Twilio fue removido del flujo (su cuenta trial solo permite numeros verificados y la cuenta paga era costosa para Chile, ~USD 20/mes + $20 CLP por SMS).

Configuracion requerida en Vercel:
- `RESEND_API_KEY` — API key de Resend
- `EMAIL_FROM` — sender (default `JURMAQ <noreply@jurmaq.cl>`)
- `MAILDOMAIN_VERIFIED` en Resend para dominio jurmaq.cl

### Validez legal del email vs SMS
El email es factor unico de autenticacion. La Ley 19.799 art. 3 (Firma Electronica Simple) NO exige canal especifico — pide identificacion del firmante + integridad del documento + expresion de voluntad. Cumplimos las tres con: cedula subida (identificacion), hash SHA-256 (integridad), OTP confirmado por click + canvas de firma (voluntad).

⚠️ Si el cliente disputa argumentando "alguien accedio a mi email", el respaldo en juicio es:
1. IP + geolocalizacion del firmante (registrada)
2. User-agent (registrado)
3. Cedula subida con hash que coincide con RUT del contrato
4. Audit log inmutable en `contratos_audit_log`

## Rutas creadas

**Admin** (requieren sesion admin):
- `GET /admin/contratos` — listado con filtros
- `GET /admin/contratos/nuevo` — wizard crear
- `GET /admin/contratos/[id]` — detalle + acciones
- `GET /admin/contratos/templates` — editor de plantillas

**APIs admin**:
- `GET|POST /api/admin/contratos` — listar/crear
- `GET|PUT|DELETE /api/admin/contratos/[id]` — CRUD
- `GET /api/admin/contratos/[id]/render` — html renderizado
- `GET /api/admin/contratos/[id]/pdf` — html imprimible
- `POST /api/admin/contratos/[id]/send-signature` — envia email de firma
- `GET|POST|PUT /api/admin/contratos/templates[/id]` — plantillas

**Publico (token-based)**:
- `GET /contrato/firmar/[token]` — pagina publica de firma
- `GET /api/public/contratos/firmar/[token]` — datos del contrato
- `POST .../request-otp` — genera OTP, lo hashea y envia codigo plano por email
- `POST .../verify-otp` — verifica codigo
- `POST .../sign` — guarda firma

## Base de datos

Tablas nuevas en Supabase:
- `contratos_templates` — plantillas versionadas con {{placeholders}}
- `contratos` — instancias concretas con datos arrendatario, firma, estado
- `contratos_otp` — codigos OTP para verificacion (expiran 10 min)

Columna nueva:
- `maquinarias.garantia_monto` — monto de garantia configurable por maquina

RLS activo en las 3 tablas nuevas. Solo service_role accede (API routes).

## Template legal

El template default (seeded en DB) tiene:
- 17 clausulas numeradas
- Condicionales persona natural vs juridica (Handlebars-like)
- Cita Ley 19.799 + art. 44/45 CC + Ley 18.010 + Ley 19.496 (SERNAC)
- ~35K caracteres, imprimible en ~5 paginas A4
- Protege JURMAQ: multa 50% diaria por mora en devolucion, pago valor reposicion por robo/perdida total, terminacion anticipada por 7 causales, blindaje laboral del operador

Para modificarlo: `/admin/contratos/templates` → editar → guardar nueva version.

## Ordenar emails de confirmacion

La notificacion al arrendatario sale desde `noreply@jurmaq.cl` via Resend (ya configurado). El email contiene el link de firma con el token unico.

## Pruebas rapidas

1. Entra a `/admin/contratos` — debe mostrar lista vacia
2. Crea contrato de prueba con un email al que tengas acceso
3. Abre el link de firma → prueba el flujo completo
4. Verifica que el PDF firmado quede bien impreso

## Variables de entorno en Vercel (ya configuradas)

```
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+12185683920
RESEND_API_KEY=re_... (ya existia)
EMAIL_FROM=JURMAQ <noreply@jurmaq.cl> (ya existia)
```
