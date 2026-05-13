# Audit 1E — Price Consistency (DB ↔ UI)

> Generated 2026-05-12. Foco: ¿el precio mostrado en cada página coincide con el precio en DB?

## Summary
- Páginas/componentes que muestran precio: ~25
- Live DB (SSR sin cache estático): 11 (las que usan `supabaseAdmin` desde SSR)
- Cached (ISR `revalidate`): pendiente revisar uno-a-uno
- Hardcoded prices en JSX: **0**
- Calculadora-derived: 5 calculadoras NO muestran precios (solo cantidades)

## 1. Hardcoded prices

**Ninguno detectado** en JSX. ✅

Las calculadoras (`ELEMENTOS_CEMENTO`, `ELEMENTOS_FIERRO`, `GRADOS_HORMIGON`) tienen **constantes de ingeniería** (sacos por m³, kg de fierro por m², etc.) — no precios. Los clientes muestran solo cantidades, no $.

## 2. Duplicate formatting logic — **PROBLEMA REAL**

Hay **dos copias canónicas** de `formatCLP()`:
- `src/lib/format.ts:11` — usado por solo 4 archivos
- `src/lib/email.ts` y `src/lib/mail/utils.ts` y `src/lib/email-sequences.ts` — copias separadas

Y **8+ archivos definen su propio `formatCLP`/`formatPrice` localmente** en vez de importar:

| Tipo | Archivos |
|---|---|
| `const formatCLP = ...` local | 8 archivos |
| `function formatCLP` local | 7 archivos |
| Inline `toLocaleString("es-CL")` sin helper | 25+ instancias |

### Ejemplos de duplicación
- `src/lib/format.ts:12` — `"$" + amount.toLocaleString("es-CL")` ← canonical
- `src/lib/email-sequences.ts:4` — IGUAL
- `src/lib/mail/utils.ts:6` — IGUAL
- `src/lib/combustible-utils.ts:76` — variante con `'$' + v.toLocaleString('es-CL')`
- `src/lib/contrato-render.ts:83` — variante con `Math.round` previo
- `src/app/barraca/cotizacion/[numero]/page.tsx:41` — local re-definition
- `src/app/barraca/material/[slug]/page.tsx:125` — inline template literal
- `src/app/barraca/producto/[slug]/page.tsx` (líneas 79, 326, 330, 354, 358, 379) — inline 6 veces en mismo archivo
- `src/app/barraca/carrito/page.tsx` (líneas 164, 174, 207, 216, 230, +más) — inline 6+ veces

### Riesgo
- Si cambian formato (ej: agregar puntos miles, signo CLP en vez de $, redondeo), tenés que tocar **30+ lugares** y vas a olvidar alguno → inconsistencia visible al usuario.
- `contrato-render.ts:83` redondea con `Math.round(Number(n) || 0)` antes de format — los otros no. **Contratos pueden mostrar precio distinto al carrito** si hay decimales.

## 3. Cache staleness — pendiente verificación detallada

Archivos que pueden tener `revalidate` muy largo (no auditado en este pase):
- `src/app/barraca/page.tsx` (homepage barraca)
- `src/app/barraca/categorias/page.tsx`
- `src/app/(public)/maquinarias/page.tsx`
- `src/app/(public)/page.tsx`

**Acción de seguimiento:** grep `export const revalidate` en estos archivos y confirmar valores razonables (≤ 600s para precios).

## 4. Cross-page price mismatch — análisis

### ✅ Cart flow (DB live, server-side)
- `src/app/api/barraca/carrito/route.ts:97,224` usa `getCartPrice(...)` de `src/lib/pricing.ts`.
- `pricing.ts` aplica la regla canonical: si `en_oferta && precio_original > 0` → cobrar `precio_original`, mostrar tachado.
- **Validado:** el carrito recalcula precio server-side en cada operación. El cliente NO puede inyectar precio.

### ⚠️ Product detail (`src/app/barraca/producto/[slug]/page.tsx`)
- 6 instancias inline de `toLocaleString("es-CL")` mostrando `producto.precio`, `precio_original`, `promoPrecioDescuento`
- Riesgo: la lógica de qué precio mostrar (tachado vs principal vs promo) está duplicada con la del carrito. Si difiere, el usuario ve precio X en producto y X+1 al pagar.
- **Recomendación:** usar `resolvePrice()` de `pricing.ts` también aquí.

### ⚠️ Cotización (`src/app/barraca/cotizacion/[numero]/page.tsx`)
- `formatCLP` local re-definido. Si las cotizaciones se generan server-side con `email.ts` (otro helper), y el cliente las muestra con el local, los formatos divergen.
- **Recomendación:** UN solo `formatCLP` importado desde `@/lib/format`.

## 5. SERNAC `precio_original` compliance

- **Definido en:** `src/lib/pricing.ts:74-79` — se usa para calcular `precioFinal = precio_original` cuando `en_oferta=true`
- **Validación 30 días server-side:** **NO verificada al crear/editar producto**
- **Tabla `barraca_precio_historial`** existe (con migración) — probablemente alimentada por trigger
- **Gap:** no se vio en POST `/api/admin/barraca/productos/[id]` un check tipo `precio_original <= MAX(precio últimos 30 días)`. Ya levantado como **H2** en `1D_SECREVIEW.md`.

## 6. Recomendaciones priorizadas

1. **HIGH** — Consolidar `formatCLP` a **una sola** fuente (`src/lib/format.ts`). Borrar duplicados en `email.ts`, `mail/utils.ts`, `email-sequences.ts`, `combustible-utils.ts`, `contrato-render.ts`. Migrar las 25+ instancias inline a `import { formatCLP } from '@/lib/format'`.
2. **HIGH** — Usar `resolvePrice()` de `pricing.ts` en `producto/[slug]/page.tsx` y `material/[slug]/page.tsx` en vez de lógica inline. Asegura que detalle de producto y carrito muestran lo mismo.
3. **MED** — Auditar `revalidate` en las 4 páginas listadas en §3. Confirmar ≤ 600s.
4. **MED** — Implementar H2 del audit 1D (SERNAC 30 días).
5. **LOW** — Lint rule custom: rechazar `toLocaleString.*es-CL` sin import de `formatCLP`.
