# Pricing oficial maquinarias — fuente única de verdad

> Última actualización: 2026-05-12.
> Todos los valores son **NETO + IVA**. El sistema debe mostrar el precio con IVA al cliente y guardar el neto para SII F29.

## Tarifa máquinas (por máquina)

| Categoría | Máquina | Precio neto | Unidad | Mínimo |
|---|---|---|---|---|
| Retroexcavadora | **Retroexcavadora** | **$30.000** | hora | 6 horas |
| Miniexcavadora  | **Miniexcavadora**  | **$25.000** | hora | 6 horas |
| Minicargador    | **Minicargador S650** | **$25.000** | hora | 6 horas |
| Minicargador    | **Minicargador S550** | **$24.000** | hora | 6 horas |
| Minicargador    | **Minicargador Mustang** | **$24.000** | hora | 6 horas |
| Plataforma articulada | **Brazo articulado** | **$120.000** | día | 1 día |
| Plataforma     | **Fullen**  | **$80.000** | día | 1 día |
| Plataforma     | **Genie**   | **$60.000** | día | 1 día |
| Camión          | **Camión tolva** | **$30.000** | hora | 6 horas |

## Cargo de traslado (camión)

Aplica cuando la máquina necesita transporte desde la base al sitio (toda máquina excepto Camión tolva en operación).

| Concepto | Valor | Notas |
|---|---|---|
| **Rendimiento por km** | $300 / km | **considerar ida + vuelta** |
| **Peajes** | costo real | sumar al traslado |
| **Subir y bajar** | 30 min de operario | tiempo fijo de carga/descarga |
| **Operario por hora** | $5.000 / hora | tiempo total trabajado |

### Internos (NO se muestran al cliente, se usan para P&L)

| Reserva | % sobre subtotal |
|---|---|
| Mantención camión | 25% |
| Utilidad real | 25% |

Estos dos representan **50% del subtotal** que debe quedar para reservas internas. El precio publicado al cliente ya los incluye.

## Algoritmo de cotización

```
INPUTS:
  - máquina seleccionada
  - horas/días solicitados (min según máquina)
  - distancia desde base al sitio (km)
  - peajes (CLP)
  - cantidad de operarios (default: 1)

CÁLCULO:
  precio_uso     = tarifa_neta × max(horas_solicitadas, mínimo_máquina)
  km_total       = distancia_km × 2          // ida + vuelta
  traslado_combustible = km_total × $300
  traslado_carga = 0.5 hora × $5.000 = $2.500   // 30 min fijos
  traslado_op    = (horas_op_estimadas) × $5.000   // tiempo real operario
  subtotal_neto  = precio_uso + traslado_combustible + traslado_carga + traslado_op + peajes
  iva            = subtotal_neto × 0.19
  total_cliente  = subtotal_neto + iva

  // Internos:
  reserva_mantencion = subtotal_neto × 0.25
  utilidad_real      = subtotal_neto × 0.25
```

## Schema sugerido (DB)

Tabla `maquinarias` debe extenderse con:

```sql
ALTER TABLE maquinarias
  ADD COLUMN tarifa_neta numeric(10, 0) NOT NULL,    -- $ sin IVA
  ADD COLUMN unidad_tarifa text NOT NULL CHECK (unidad_tarifa IN ('hora', 'dia')),
  ADD COLUMN minimo_unidades numeric(4, 1) NOT NULL,  -- 6 = 6 hrs ó 1 día
  ADD COLUMN requiere_traslado boolean NOT NULL DEFAULT true;
```

Tabla nueva `tarifas_traslado` (parámetros sistémicos):
```sql
CREATE TABLE tarifas_traslado (
  id serial PRIMARY KEY,
  vigente_desde timestamptz NOT NULL DEFAULT now(),
  costo_km numeric(8,0) NOT NULL,           -- 300
  costo_hora_operario numeric(8,0) NOT NULL, -- 5000
  carga_descarga_horas numeric(4,2) NOT NULL DEFAULT 0.5,
  reserva_mantencion_pct numeric(4,2) NOT NULL DEFAULT 0.25,
  reserva_utilidad_pct numeric(4,2) NOT NULL DEFAULT 0.25
);
```

Tabla nueva `cotizaciones_arriendo` (renombre/refactor de actual `cotizaciones`):
```sql
CREATE TABLE cotizaciones_arriendo (
  id serial PRIMARY KEY,
  numero text UNIQUE NOT NULL,           -- COT-AR-2026-NNN
  cliente_id integer REFERENCES clientes(id),
  maquinaria_id integer REFERENCES maquinarias(id) NOT NULL,
  fecha_solicitud timestamptz NOT NULL DEFAULT now(),
  fecha_servicio date NOT NULL,
  ubicacion_servicio text NOT NULL,
  distancia_km numeric(6,1) NOT NULL,
  unidades_solicitadas numeric(4,1) NOT NULL,  -- 8 hrs ó 2 días
  unidad text NOT NULL CHECK (unidad IN ('hora', 'dia')),
  peajes numeric(10,0) NOT NULL DEFAULT 0,
  operarios integer NOT NULL DEFAULT 1,
  horas_operario_estimadas numeric(4,1),
  -- desglose (snapshot al momento de crear)
  precio_uso numeric(10,0) NOT NULL,
  traslado_combustible numeric(10,0) NOT NULL,
  traslado_carga numeric(10,0) NOT NULL,
  traslado_operario numeric(10,0) NOT NULL,
  subtotal_neto numeric(10,0) NOT NULL,
  iva numeric(10,0) NOT NULL,
  total numeric(10,0) NOT NULL,
  -- estado
  estado text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'enviada', 'aceptada', 'rechazada', 'contrato_creado', 'finalizada')),
  contrato_id integer REFERENCES contratos(id),
  -- audit
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```
