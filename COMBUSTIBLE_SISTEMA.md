# Sistema de Combustible — JURMAQ

## Para que sirve
Registra cada factura de compra de combustible (diesel, gasolina, etc) asociandola a una o varias maquinarias, opcionalmente a un contrato activo, y genera el respaldo tributario para **recuperar el Impuesto Especifico a los Combustibles (IEC) en el Formulario 29 (F29) del SII**, conforme a la Ley 18.502.

## Como usarlo (flujo tipico)

### 1. Registrar una factura nueva
1. Admin entra a `/admin/combustible`
2. Click en **"Nueva Factura"**
3. Llena:
   - **Datos tributarios**: fecha, tipo de documento (factura electronica, boleta, etc), folio, proveedor (nombre, RUT, direccion)
   - **Montos**: total (obligatorio), neto/IVA se auto-calculan, IEC recuperable (opcional), checkbox "recuperable"
   - **Archivo**: sube el PDF/JPG/PNG de la factura (max 10MB, detectado por magic bytes)
4. **Detalle de consumo** (multi-items):
   - Una fila por maquinaria que consumio de esa factura
   - Elige maquinaria (opcional), contrato activo (opcional, filtrado por maquinaria)
   - Tipo combustible (se autoelige si la maquinaria tiene uno declarado)
   - Litros, monto, horometro (opcional)
   - **Boton "+ Agregar equipo"** para sumar otra maquinaria al mismo documento
5. El sistema advierte si la suma de items no coincide con el monto total declarado (>5% diferencia)
6. Guarda como **borrador** o directamente **valida** (cambia estado)

### 2. Revisar y validar
- Listado principal muestra todas las facturas del mes seleccionado
- Tarjetas resumen arriba: Total facturas, Total monto, Total litros, IEC recuperable
- Filtros: mes tributario, estado, busqueda por folio/proveedor/RUT
- Click en una fila la expande y muestra los items (maquinaria + litros + monto)
- Acciones por fila: Ver detalle, abrir archivo, Validar, Marcar recuperada, Anular, Eliminar

### 3. Exportar a Excel para contabilidad / SII
- Boton **"Exportar Excel"** genera un `.xlsx` con todos los items del mes:
  - Fecha, Folio, Tipo Doc, Proveedor, RUT, Maquinaria, Contrato, Tipo combustible, Litros, Monto, Precio/L, Neto, IVA, IEC, Recuperable, Mes Tributario, Estado
- Se lo pasas a tu contador para declarar en F29

## Estados de una factura

| Estado | Significado |
|---|---|
| `registrada` | Recien creada, pendiente revision |
| `validada` | Revisada por admin, lista para presentar |
| `recuperada` | Ya incluida en F29, IEC recuperado (no se puede borrar) |
| `anulada` | Cancelada, no se contabiliza |

Transiciones tipicas: registrada → validada → recuperada.

## Datos de la empresa (automaticos en contratos)

Fijos en el sistema:
```
Constructora Jorge Ubilla Rivera E.I.R.L.
RUT: 76.624.872-1
Lote 3 del lote A, HJ 11, Maquehua, Curico, Maule
Representante Legal: Jorge Ubilla Rivera
```

## Integracion con contratos de arriendo

- Cada item de consumo puede linkearse a un **contrato activo**
- Util para: imputar el costo de combustible al arriendo especifico (si se recupera del cliente), reportes de rentabilidad por contrato
- El selector de contratos filtra automaticamente los que correspondan a la maquinaria seleccionada

## Bases de datos
Tablas creadas:
- `combustible_facturas` — header con totales, proveedor, estado, archivo
- `combustible_items` — linea por maquinaria (multi-items por factura)
- `combustible_resumen_mensual` (view) — agregado por mes + maquinaria + tipo

Columna agregada:
- `maquinarias.tipo_combustible` — para autoseleccion en el formulario

Storage bucket privado:
- `facturas-combustible` — guarda los PDF/imagenes con URLs firmadas de 1 año de vigencia

## Rutas creadas

**UI Admin**:
- `/admin/combustible` — listado + filtros + tarjetas resumen
- `/admin/combustible/nueva` — formulario nueva factura (multi-items)
- `/admin/combustible/[id]` — detalle + acciones

**APIs**:
- `GET/POST /api/admin/combustible/facturas`
- `GET/PUT/DELETE /api/admin/combustible/facturas/[id]`
- `POST /api/admin/combustible/upload` (magic bytes validation)
- `GET /api/admin/combustible/resumen?mes=YYYY-MM`
- `GET /api/admin/combustible/export?mes=YYYY-MM` (descarga .xlsx)

## Cambios adicionales

### Contratos: descarga sin firma
En `/admin/contratos/[id]` hay dos botones:
- **Abrir PDF** — contrato normal (con firma si existe)
- **Descargar sin firma** — version limpia con espacio para firma manual, abre directamente el cuadro de impresion del navegador (se puede guardar como PDF con Cmd/Ctrl+P)

El template ahora oculta el bloque "Registro de firma electronica" si el contrato NO tiene firma capturada — asi no aparece cuando imprimes la version sin firma.

## Sidebar
Nuevo link **"Combustible"** al lado de "Contratos" en el menu admin.

## Pendiente (legal review profundo)
Queria lanzar un agente especializado en leyes chilenas para una revision exhaustiva del template de contrato (17 clausulas actualmente), pero el agente tuvo timeout. El template actual es solido y cubre Codigo Civil 1915-1941, Ley 19.799 (firma), Ley 18.010 (intereses), Ley 19.496 (SERNAC).

Para una revision profunda adicional (Ley 18.490 seguro obligatorio, responsabilidad solidaria art. 169 Ley Transito, indemnidad laboral del operador, etc), cuando quieras lo relanzo.
