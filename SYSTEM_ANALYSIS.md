# JURMAQ.CL Import/Export System - Complete Analysis

## 1. CURRENT IMPORT SYSTEM

### Frontend: `/src/app/admin/barraca/importar/page.tsx`
**Type:** Client Component with drag-and-drop interface

**User Flow:**
- Drag-drop or file picker for .xlsx/.xls files
- Shows current product count and warning if products exist
- Two import modes:
  - "Importar" (add new products)
  - "Re-importar (reemplazar todo)" (replace all products)

**Component State:**
- `file`: Selected file
- `uploading`: Loading state
- `result`: Success result with counts
- `error`: Error message
- `productCount`: Current product count
- `showReimport`: Whether to show re-import button

**Features:**
- File size validation (.xlsx/.xls only)
- Visual feedback during upload
- Success/error messaging
- Instructions showing expected Excel format

**Expected Excel Format (from UI):**
```
Categoria | Codigo | Nombre | Medida | Precio | Stock | Unidad | Descripcion
```

### Backend API: `/src/app/api/barraca/importar/route.ts`
**Method:** POST
**Auth:** Required (checks session)

**Process:**
1. Receives FormData with file
2. Saves file to temp directory: `/tmp/barraca-import-{timestamp}.xlsx`
3. Calls `importBarracaFromXLSX(tmpPath)`
4. Returns JSON with result

**Response Format:**
```json
{
  "mensaje": "Importacion completada",
  "categorias": number,
  "productos": number
}
```

**Issue:** Supports `replace` FormData parameter in frontend but does NOT handle it in backend API - currently always adds/merges products

---

## 2. IMPORT LIBRARY: `/src/lib/import-barraca.ts`

### Main Function: `importBarracaFromXLSX(filePath: string)`
**Returns:** `{ categories: number; products: number }`

### Processing Steps:

#### Step 1: Read Excel File
- Uses `xlsx` library
- Reads sheet named "Hoja2" (must exist)
- Converts to JSON array of rows

#### Step 2: Category Processing
**Expected columns:**
- `Familia` → creates parent category
- `Sub-Familia` → creates child category (optional)

**Process:**
- Extracts unique Familia values
- Inserts into `barraca_categorias` table with:
  - `nombre`: Familia name
  - `slug`: slugified version
  - `imagen`: mapped from `CATEGORY_IMAGES` dict
  - `orden`: sequential counter
  - `padre_id`: null for parent, parent_id for subfamilies

#### Step 3: Product Collection
**Expected columns:**
- `Codigo` / `Código` → product code
- `Descripcion` / `Descripción` → product name and description
- `Costo Bru.` / `Costo` → cost (rounded)
- `Precio Vta.` / `Precio` → price (rounded)
- `Stock B1` / `Stock` → inventory
- `Peso Kg` / `Peso` → weight (optional)

**Processing:**
- Extracts `medida` (dimensions) using regex patterns from description
- Creates `baseName` by removing dimensions
- Groups products by baseName to detect variants

**Regex Patterns for Dimension Extraction:**
```
- \d+(?:[.,]\d+)?(?:\s*[xX]\s*\d+(?:[.,]\d+)?){1,3}\s*(?:mm|cm|m|mts|mt|pulgadas|plg|pulg|")?
- Supports: 10x20, 10.5x20.5, 1/2", 1000MM, etc.
```

#### Step 4: Product Insertion
**Database Table:** `barraca_productos`

**Fields Inserted:**
- `codigo`: Product code (nullable)
- `nombre`: Product name
- `slug`: slugified name (fallback: `producto-{index}`)
- `descripcion`: Description text
- `precio`: Sale price (rounded)
- `costo`: Cost price (rounded)
- `stock`: Quantity
- `peso`: Weight (decimal)
- `unidad`: Hard-coded as 'UN' (unit)
- `categoria_id`: Category ID (nullable)
- `imagen`: Category image
- `producto_padre_id`: Parent product ID (if grouped)
- `medida`: Extracted dimension

**Grouping Logic:**
- Products with same `baseName` are grouped
- First product in group becomes "parent"
- Subsequent variants get `producto_padre_id` pointing to parent

### Category Image Mapping:
```javascript
{
  'FIERROS CONSTRUCCION': '/images/barraca/fierros.jpg',
  'FIJACIONES': '/images/barraca/fijaciones.jpg',
  'HERRAMIENTAS Y MAQ': '/images/barraca/herramientas.jpg',
  'PINTURAS': '/images/barraca/pinturas.jpg',
  'PERFILES Y PLANCHAS': '/images/barraca/perfiles.jpg',
  'ELECTRICIDAD E ILUMINACION': '/images/barraca/electricidad.jpg',
  'BAÑO COCINA Y LOGGIA': '/images/barraca/bano.jpg',
  'SEGURIDAD INDUSTRIAL': '/images/barraca/seguridad.jpg',
  'JARDIN': '/images/barraca/jardin.jpg',
  'ADHESIVOS Y SELLANTES': '/images/barraca/adhesivos.jpg',
  'CERRADURAS': '/images/barraca/cerraduras.jpg',
  'QUINCALLERIA': '/images/barraca/quincalleria.jpg',
  'CERCOS Y MALLAS': '/images/barraca/cercos.jpg',
  'ARIDOS Y MORTEROS': '/images/barraca/aridos.jpg',
  'TABIQUERIA': '/images/barraca/tabiqueria.jpg',
  'TECHUMBRE': '/images/barraca/techumbre.jpg',
  'ADITIVOS E IMPERMEABILIZANTES': '/images/barraca/aditivos.jpg',
  'AISLACION': '/images/barraca/aislacion.jpg'
}
```
Default: `/images/barraca/producto-default.jpg`

---

## 3. PRODUCT DATABASE SCHEMA

### Table: `barraca_productos`
**Columns (from API and imports):**
- `id`: PRIMARY KEY
- `codigo`: VARCHAR (product code, nullable)
- `nombre`: VARCHAR (product name, required)
- `slug`: VARCHAR (URL-friendly name, required, unique)
- `descripcion`: TEXT (full description)
- `precio`: INTEGER (sale price in CLP)
- `costo`: INTEGER (cost price)
- `stock`: INTEGER (quantity available)
- `peso`: DECIMAL (weight in kg, nullable)
- `unidad`: VARCHAR (unit of measure, default 'UN')
- `categoria_id`: FOREIGN KEY -> barraca_categorias(id)
- `imagen`: VARCHAR (image URL)
- `producto_padre_id`: FOREIGN KEY -> barraca_productos(id) (parent product)
- `medida`: VARCHAR (extracted dimensions, e.g., "10x20")
- `activo`: BOOLEAN (default TRUE)
- `destacado`: BOOLEAN (featured product, default FALSE)
- `precio_original`: INTEGER (for fake offers, nullable)
- `en_oferta`: BOOLEAN (currently in offer, default FALSE)
- `solo_cotizar`: BOOLEAN (quote-only mode, default FALSE)
- `created_at`: TIMESTAMPTZ
- `updated_at`: TIMESTAMPTZ

### Table: `barraca_categorias`
**Columns:**
- `id`: PRIMARY KEY
- `nombre`: VARCHAR (category name)
- `slug`: VARCHAR (URL-friendly name)
- `imagen`: VARCHAR (category image URL)
- `orden`: INTEGER (sort order)
- `padre_id`: FOREIGN KEY -> barraca_categorias(id) (parent category, nullable)

---

## 4. PRICE MODIFICATION SYSTEM

### Admin Page: `/src/app/admin/barraca/precios/page.tsx`
**Type:** Client Component

### Available Operations (via `/api/barraca/productos/bulk-price`):

#### Operation 1: Percentage Increase/Decrease
**Action:** `percentage`
**Parameters:**
- `categoriaId`: Category to affect (required)
- `percentage`: +/- percentage (required)

**Logic:** `newPrice = round(oldPrice * (1 + percentage/100))`

**Example:** 20% increase on $1000 = $1200

#### Operation 2: Price by Weight (Fierros only)
**Action:** `by_weight`
**Parameters:**
- `categoriaId`: Category (optional, defaults to "FIERROS CONSTRUCCION")
- `valorKg`: Price per kilogram (required)

**Logic:** `newPrice = round(peso_kg * valorKg)`

**Filters:** Only products with `peso > 0`

#### Operation 3: Bulk Image Update
**API Endpoint:** `/api/barraca/productos/bulk-image` (PUT)
**Parameters:**
- `categoriaId`: Category to affect
- `imagen`: Image URL

#### Operation 4: Create Fake Offers
**Action:** `create_offers`
**Parameters:**
- `categoriaId` OR `codigoPrefix`: Filter by category or code prefix
- `inflacion`: Inflation percentage (required)

**Logic:**
1. Stores current price in `precio_original`
2. Inflates price: `precioInflado = round(precio * (1 + inflacion/100))`
3. Sets `en_oferta = true`
4. Customer sees: ~~$1200~~ -> $1000 (appears to be 16% off)

**Constraint:** Only applies to products with `en_oferta = false`

#### Operation 5: Preview Fake Offers
**Action:** `preview_offers`
**Parameters:** Same as create_offers

**Returns:** Array of products with projected prices (doesn't apply changes)

#### Operation 6: Remove Fake Offers
**Action:** `remove_offers`
**Parameters:**
- `categoriaId` OR `codigoPrefix`: Filter

**Logic:**
1. Restores `precio = precio_original`
2. Sets `en_oferta = false`
3. Clears `precio_original = null`

#### Operation 7: List Active Offers
**Action:** `list_offers`
**Parameters:** `categoriaId` OR `codigoPrefix`

**Returns:** Array of products with `en_oferta = true`

#### Operation 8: Toggle Quote-Only Mode
**Action:** `toggle_cotizar`
**Parameters:**
- `categoriaId`: Category to affect (required)
- `soloCotizar`: true/false

**Effect:** Sets `solo_cotizar` field on all products in category

---

## 5. EXPORT FUNCTIONALITY

### Current Status: **NO EXPORT SYSTEM EXISTS**

**What's Missing:**
- No export API endpoint
- No export button in admin pages
- No CSV/XLSX download functionality
- Only subscriber export exists (in suscriptores page via CSV)

**Existing Export Pattern:** 
In `/src/app/admin/barraca/suscriptores/page.tsx`:
```javascript
const exportCSV = () => {
  const csv = /* generate CSV string */;
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `suscriptores_barraca_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
};
```

---

## 6. BULK PRICE API: `/src/app/api/barraca/productos/bulk-price/route.ts`

### Route Details
**Method:** PUT
**Auth:** Required (checks session)
**Origin Check:** Validates request origin

### Response Format (Success):
```json
{
  "updated": number,
  "productos": array
}
```

### Response Format (Errors):
```json
{
  "error": "Error message"
}
```

### Status Codes:
- 200: Success
- 400: Bad request (missing parameters)
- 401: Not authorized
- 403: Invalid origin
- 404: No products found
- 500: Server error

---

## 7. PRODUCT API: `/src/app/api/barraca/productos/route.ts`

### GET Endpoint
**Query Parameters:**
- `categoria`: Filter by category slug
- `buscar`: Search in nombre/descripcion
- `page`: Pagination (default 1)
- `limit`: Items per page (default 24)
- `destacado`: Filter featured products
- `all`: Include inactive products (default false)

**Response:**
```json
{
  "productos": [...],
  "total": number,
  "paginas": number,
  "pagina": number
}
```

### POST Endpoint
**Creates new product**
**Required Fields:**
- `nombre`
- `slug`

**Optional Fields:**
- `codigo`
- `descripcion`
- `precio`
- `costo`
- `stock`
- `peso`
- `unidad`
- `categoria_id`
- `imagen`
- `producto_padre_id`
- `medida`
- `activo`
- `destacado`

---

## 8. SQL MIGRATION SCRIPTS

### `/scripts/add-price-columns.sql`
Adds columns for fake offer system:
```sql
ALTER TABLE barraca_productos ADD COLUMN IF NOT EXISTS precio_original INTEGER;
ALTER TABLE barraca_productos ADD COLUMN IF NOT EXISTS en_oferta BOOLEAN DEFAULT FALSE;
ALTER TABLE barraca_productos ADD COLUMN IF NOT EXISTS solo_cotizar BOOLEAN DEFAULT FALSE;
```

### `/scripts/create-promociones.sql`
Creates separate promotions table (not currently used by import system):
```sql
CREATE TABLE barraca_promociones (
  id SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  descuento_porcentaje INTEGER DEFAULT 10,
  categoria_id INTEGER REFERENCES barraca_categorias(id),
  imagen TEXT,
  activa BOOLEAN DEFAULT TRUE,
  fecha_inicio DATE,
  fecha_fin DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 9. KNOWN ISSUES & GAPS

### Import System
1. **Replace functionality not implemented**
   - Frontend sends `replace=true` but backend ignores it
   - All imports currently merge/add (never delete existing)

2. **Error handling incomplete**
   - Individual product failures logged but not returned to frontend
   - `errors` array in response is defined but never populated

3. **Excel format inflexible**
   - Hard-coded sheet name "Hoja2"
   - Requires exact column names with limited aliases

### Export System
1. **No export exists**
   - Cannot download products as Excel/CSV
   - Cannot export prices
   - No bulk export functionality

### Price Management
1. **Fake offers logic complex**
   - Can create confusing discount displays
   - No audit trail of original prices

2. **Weight-based pricing limited**
   - Hard-coded to search for "FIERROS CONSTRUCCION"
   - Only works for products with peso > 0

### Missing Features
- No import validation/preview before commit
- No duplicate product detection
- No rollback on partial failures
- No import history/audit log
- No automated backup before import
- No concurrent import protection

---

## 10. DATA FLOW SUMMARY

```
Excel File (.xlsx)
       |
[importar/page.tsx] (client)
       |
POST /api/barraca/importar
       |
[route.ts] - Save to /tmp, call import library
       |
[import-barraca.ts]
   |-- Read "Hoja2" from Excel
   |-- Extract Familia/Sub-Familia -> Insert into barraca_categorias
   |-- Extract Codigo/Descripcion/etc -> Insert into barraca_productos
   \-- Return {categories, products}
       |
Return JSON response to frontend
       |
Display success message with counts
```

**Price Management Flow:**
```
[precios/page.tsx] (client)
       |
PUT /api/barraca/productos/bulk-price
       |
[bulk-price/route.ts]
   |-- Query products by filter (categoria/codigo)
   |-- Apply operation (percentage, weight, offers, etc)
   |-- Update barraca_productos
   \-- Return updated count
       |
Display success message
```

---

## 11. AUTHENTICATION & AUTHORIZATION

**Import Protection:**
- Checks `session` via `auth()` from `@/lib/auth`
- Returns 401 if not authenticated

**Price API Protection:**
- Checks session
- Validates request origin via `isValidOrigin()`
- Returns 401 if not authenticated, 403 if invalid origin

---

## 12. DEPENDENCIES

**Libraries Used:**
- `xlsx`: Excel file reading/writing
- `@supabase/supabase-js`: Database client
- `next/server`: NextJS request/response helpers
- Custom: `@/lib/auth`, `@/lib/sanitize`

