# Esquema completo — JURMAQ.CL

Mapa funcional de cada página del sistema, con acciones disponibles, APIs que consume y estado actual (✅ funciona / ⚠ incompleto / ❌ roto).

---

## 1. Sitio público (jurmaq.cl)

### `/` — Home (Constructora + Maquinaria)
- **Función:** landing principal de JURMAQ.
- **Acciones:** CTAs a `/maquinarias`, `/contacto`, ver divisiones.
- **APIs:** ninguna (estática).
- **Estado:** ✅

### `/maquinarias`
- **Función:** catálogo público de maquinaria para arriendo.
- **Acciones:** filtrar por tipo, buscar, click → detalle.
- **APIs:** `GET /api/maquinarias`.
- **Estado:** ✅

### `/maquinarias/[id]`
- **Función:** detalle de una máquina + formulario "Solicitar cotización".
- **Acciones:** llenar formulario → genera solicitud + email a admin.
- **APIs:** `GET /api/maquinarias/[id]`, `POST /api/solicitudes`.
- **Estado:** ✅ (email a admin agregado en esta sesión).

### `/contacto`
- **Función:** formulario de contacto general.
- **Acciones:** envío → solicitud + email a admin (BCC contacto+constructora).
- **APIs:** `POST /api/solicitudes`.
- **Estado:** ✅

### `/terminos`, `/privacidad`
- Estáticas. ✅

---

## 2. Barraca (barraca.jurmaq.cl)

### `/` — Home barraca
- **Función:** vitrina + búsqueda + categorías + destacados + ofertas del día.
- **APIs:** `GET /api/barraca/categorias`, `GET /api/barraca/productos?destacado=true`.
- **Estado:** ✅ (rediseño mobile aplicado en esta sesión).

### `/categorias`
- Listado de todas las categorías.
- **APIs:** `GET /api/barraca/categorias`.
- **Estado:** ✅

### `/categorias/[slug]`
- Productos filtrables por categoría, subcategoría, precio, stock, ordenamiento.
- **APIs:** `GET /api/barraca/productos?categoria=`.
- **Estado:** ✅ (filtros colapsables en mobile, sort pills, etc.).

### `/producto/[slug]`
- Detalle producto. Botón agregar al carrito (localStorage).
- **APIs:** `GET /api/barraca/productos/[slug]`.
- **Estado:** ✅

### `/carrito`
- Resumen + ajuste cantidades + botón a `/cotizar`.
- **APIs:** `GET/PUT/DELETE /api/barraca/carrito`.
- **Estado:** ✅

### `/cuenta`
- Perfil cliente + listado de sus cotizaciones.
- **APIs:** `POST /api/barraca/auth` (action=profile).
- **Estado:** ✅

### `/cuenta/login`, `/cuenta/registro`
- Auth de clientes. Registro envía email de bienvenida.
- **APIs:** `POST /api/barraca/auth`.
- **Estado:** ✅

### `/cotizar`
- Form para enviar cotización con items del carrito (+ opción "subir cotización competencia").
- **APIs:** `POST /api/barraca/cotizaciones`. Envía email al cliente y al admin.
- **Estado:** ✅

### `/cotizacion/[numero]`
- Vista pública de la cotización por número. Permite aceptar / rechazar / pagar.
- **APIs:** `GET /api/barraca/cotizaciones/by-numero/[numero]`, `POST /accept`, `GET /pdf`.
- **Estado:** ✅

---

## 3. Admin Panel (jurmaq.cl/admin)

### `/admin` — Dashboard
- **Función:** stats + recientes (solicitudes, proyectos, cotizaciones).
- **APIs:** `GET /api/dashboard`, `/api/solicitudes`, `/api/proyectos`, `/api/cotizaciones`.
- **Estado:** ⚠ tabla "proyectos recientes" muestra `proy.cliente` (campo legacy que la API ya no devuelve) — sale como "-".

### `/admin/clientes`
- CRUD básico de clientes registrados.
- **APIs:** GET/POST/PUT/DELETE `/api/clientes`.
- **Estado:** ✅

### `/admin/maquinarias`
- CRUD maquinarias + control de estado (disponible/arrendada/mantención).
- **Acciones:** crear, editar, eliminar, cambiar estado, especificaciones técnicas.
- **APIs:** `/api/maquinarias`.
- **Estado:** ✅ (campos marca/modelo/serie/año agregados en esta sesión, contrato ahora se llena completo).

### `/admin/cotizaciones`
- CRUD cotizaciones + transición de estados.
- **Acciones:** crear, editar, cambiar estado (pendiente→enviada→aceptada/rechazada).
- **APIs:** `/api/cotizaciones`.
- **Estado:** ✅ (email automático al cliente en cambios de estado, agregado en esta sesión).

### `/admin/proyectos`
- CRUD proyectos.
- **APIs:** `/api/proyectos`.
- **Estado:** ✅

### `/admin/solicitudes`
- Bandeja de solicitudes desde formularios públicos.
- **Acciones:** ver, aprobar, rechazar, marcar en progreso, completar.
- **APIs:** GET/PUT/DELETE `/api/solicitudes`.
- **Estado:** ✅ (email automático al cliente en cambios de estado, agregado en esta sesión).

### `/admin/contratos`
- Listado de contratos con filtro por estado.
- **APIs:** `GET /api/admin/contratos`.
- **Estado:** ✅

### `/admin/contratos/nuevo`
- Wizard 4 pasos: Maquinaria → Arrendatario → Condiciones → Preview.
- **APIs:** `GET /api/maquinarias`, `POST /api/admin/contratos`, `GET /[id]/render`, `POST /[id]/send-signature`.
- **Estado:** ✅ (con maquinaria + marca/modelo/serie/año el contrato sale completo).

### `/admin/contratos/[id]`
- Detalle + acciones por estado: enviar para firma, marcar vigente/vencido, anular, eliminar borrador, descargar PDF firmado/sin firma.
- **APIs:** `/api/admin/contratos/[id]/{render,pdf,send-signature,...}`.
- **Estado:** ⚠ no permite editar después de creado (solo borrar y rehacer si está en `borrador`).

### `/admin/contratos/templates`
- Editor del template HTML del contrato. Permite versiones.
- **APIs:** `/api/admin/contratos/templates`.
- **Estado:** ✅

### `/admin/combustible`
- Listado de facturas de combustible + resumen mensual.
- **APIs:** `/api/admin/combustible/facturas`, `/resumen`.
- **Estado:** ✅

### `/admin/combustible/nueva`
- Subida de PDF/imagen de factura + OCR + asignación a maquinaria.
- **APIs:** `POST /api/admin/combustible/upload`.
- **Estado:** ✅

### `/admin/combustible/[id]`
- Detalle + edición de líneas.
- **Estado:** ✅

### `/admin/barraca/categorias`
- CRUD categorías de la barraca.
- **APIs:** `/api/barraca/categorias`.
- **Estado:** ✅

### `/admin/barraca/productos`
- CRUD masivo de productos: crear, editar, activar/desactivar, búsqueda paginada.
- **APIs:** `/api/barraca/productos*`.
- **Estado:** ✅

### `/admin/barraca/cotizaciones`
- Bandeja de cotizaciones barraca + mensajería + contraofertas + generar pago Webpay.
- **APIs:** `/api/barraca/cotizaciones`, `/contraoferta-email`, `/message`, `/api/barraca/pagos`.
- **Estado:** ✅

### `/admin/barraca/promociones`
- CRUD promociones + setup inicial de tabla.
- **APIs:** `/api/barraca/promociones`, `/api/barraca/setup`.
- **Estado:** ✅

### `/admin/barraca/imagenes` y `/imagenes-masivas`
- Búsqueda Pixabay + asignación masiva de imágenes a productos.
- **APIs:** `/api/barraca/imagenes/search`, `/assign`, `/api/barraca/productos/bulk-image`.
- **Estado:** ✅

### `/admin/barraca/precios`
- Actualización masiva de precios (CSV + ajuste %).
- **APIs:** `/api/barraca/productos/bulk-price`.
- **Estado:** ✅

### `/admin/barraca/importar`
- Importador Excel: parse → preview → execute.
- **APIs:** `/api/barraca/importar/*`.
- **Estado:** ✅

### `/admin/barraca/suscriptores`
- CRUD suscriptores newsletter.
- **APIs:** `/api/barraca/suscriptores`.
- **Estado:** ✅

---

## 4. Firma electrónica (público)

### `/contrato/firmar/[token]`
- Cliente firma el contrato con OTP por **email** (validez 15 min, hasheado con bcrypt en DB) + canvas de firma + cedula.
- Token de firma vence 24h despues de generado por send-signature.
- **APIs:** `GET /api/public/contratos/firmar/[token]`, `/request-otp`, `/verify-otp`, `/sign`, `/upload-identidad`.
- **Estado:** ✅

---

## 5. Flujo de emails (BCC contacto+constructora)

| Trigger | Origen | Destinatario | Estado |
|---|---|---|---|
| Solicitud nueva (jurmaq.cl/contacto) | `POST /api/solicitudes` | admin | ✅ NUEVO |
| Cambio estado solicitud | `PUT /api/solicitudes/[id]` | cliente | ✅ NUEVO |
| Cotización nueva (barraca) | `POST /api/barraca/cotizaciones` | cliente + admin | ✅ |
| Cambio estado cotización | `PUT /api/cotizaciones/[id]` | cliente | ✅ NUEVO |
| Registro cliente barraca | `POST /api/barraca/auth` action=register | cliente (welcome) | ✅ |
| Aceptar cotización barraca | `POST /api/barraca/cotizaciones/[id]/accept` | cliente | ✅ |
| Mensaje admin → cliente | `POST /api/barraca/cotizaciones/[id]/message` | cliente | ✅ |
| Contraoferta competencia | `POST /api/barraca/cotizaciones/contraoferta-email` | cliente | ✅ |
| Link de pago | `POST /api/barraca/pagos` | cliente | ✅ |
| Solicitud de firma contrato | `POST /api/admin/contratos/[id]/send-signature` | cliente | ✅ |

**Todos los correos** llevan BCC a `contacto@jurmaq.cl` y `constructora@jurmaq.cl`.

---

## 6. Pendientes menores (no críticos)

- ⚠ Dashboard tabla "proyectos recientes" lee `proy.cliente` (legacy) — debería leer `proy.cliente_nombre` o el join con `clientes`.
- ⚠ `/admin/contratos/[id]` no permite editar después de creado. Si es borrador, solo borrar y rehacer; en otros estados, sin opción.
- ⚠ Dashboard no muestra cotizaciones barraca recientes (solo las de cotizaciones-main).
- ⚠ Combustible: al validar factura no se notifica a nadie (es interno, OK por ahora).
- ⚠ Sidebar admin no tiene link a `/admin/contratos/templates` (se accede solo desde flujo).

Estos son mejoras incrementales. El sistema está funcional para operar.
