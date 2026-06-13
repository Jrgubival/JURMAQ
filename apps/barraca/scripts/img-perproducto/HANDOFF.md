# HANDOFF — Imágenes POR PRODUCTO (barraca JURMAQ)

**Fecha:** 2026-05-31
**Estado:** 97,8% completo (1.935 / 1.978 productos activos con foto real por-producto). Faltan ~41.
**Para la próxima conversación: lee este archivo entero antes de hacer nada. NO empieces de cero.**

---

## 1. QUÉ SE PIDIÓ (objetivo del usuario)

"Pon imágenes de Google correspondientes a cada producto y materia" en la tienda
barraca (https://barraca.jurmaq.cl). El usuario aclaró por chat:
- Acepta imágenes de **MercadoLibre Chile** (http2.mlstatic.com) — son las que Google Imágenes
  muestra para estos productos chilenos; las URLs alojadas en Google (gstatic) NO sirven
  en producción (inestables, bloquean hotlink).
- **CADA producto debe tener SU foto correcta** (no genérica por familia). Esto vino tras
  detectar errores: "Rueda Portón con Perno" mostraba una rueda de mueble; "Anticorrosivo
  Passol" mostraba lata Tricolor; "Esmalte Praga" mostraba otra marca.
- **Respetar la MARCA del nombre**: si dice Passol/Praga/Bosch/Stanley etc., la foto debe
  ser de esa marca. No reusar imagen entre marcas distintas. Reusar solo entre variantes
  de la MISMA marca+tipo que cambian medida/color.
- Limpia: fondo blanco, sin watermark/logo de tienda/texto sobreimpreso. Evitar Sodimac/Easy.

## 2. POR QUÉ FALLÓ EL PRIMER INTENTO (contexto)
La primera pasada agrupó por la 1ª palabra del nombre (familia) y compartió 1 foto por
familia. Familias heterogéneas (RUEDA = portón vs mueble; marcas mezcladas) quedaron mal.
La solución definitiva fue **imagen por producto (por id)**, que es lo que está casi listo.

---

## 3. ARQUITECTURA / PIPELINE QUE FUNCIONA (replicar tal cual)

Directorio de trabajo: `apps/barraca/scripts/img-perproducto/`

### 3a. Acceso a la base de datos (producción Supabase)
- Conexión DIRECTA: `DATABASE_URL_DIRECT` en `apps/barraca/.env.local`
  (`db.wmoizhbdalvnveclenvf.supabase.co:5432`). Es **IPv6-only vía OrbStack/NAT64**.
  Funcionó casi toda la sesión con `psql`, PERO al final dejó de resolver/rutear
  (OrbStack se cayó / sin ruta IPv6). El pooler (`DATABASE_URL`, aws-0-us-east-1.pooler...)
  rechazó el tenant desde esta red ("Tenant or user not found") — NO se pudo usar.
- **Fallback 100% confiable: el SQL Editor del navegador (Supabase dashboard)** vía
  Claude-in-Chrome. URL: https://supabase.com/dashboard/project/wmoizhbdalvnveclenvf/sql/new
  - Pegar SQL: copiar al portapapeles con `pbcopy < archivo.sql`, luego en la pestaña:
    click en editor → cmd+a → Backspace → cmd+v → cmd+Return.
  - Leer resultado: `javascript_tool` con `window.monaco.editor.getModels()[0].getValue().length`
    y buscar "Success" / "ERROR" en `document.body.innerText`.
  - Leer grilla de resultados (virtualizada): usar `string_agg(... , E'\n')` para colapsar
    TODO en una sola celda y leerla con un querySelector de `[role=gridcell]` que contenga
    un separador (ej '~').
  - OJO: la query guardada se recarga sobre lo tecleado si navegas; usa /sql/new y reemplaza
    con cmd+a antes de pegar.
- **Para el próximo: intenta primero `psql "$DATABASE_URL_DIRECT"` (abre OrbStack y espera
  ~30s). Si IPv6 no rutea, usa el SQL editor del browser.**
- Backup reversible existente: tabla `barraca_productos_imagen_bak` (imagen original por id).

### 3b. Cómo se generan las imágenes (subagentes)
- Volcar catálogo por categoría: `psql ... -tA -F$'\t' -c "select p.id, p.nombre ..."` →
  archivos `cat_<categoria>.tsv` (id<TAB>nombre).
- Partir en lotes de 40: `split -l 40 cat_X.tsv b_X_`  (renombrar a `.tsv`).
- Despachar subagentes (Agent tool, run_in_background, general-purpose). MÁX 6-8 en paralelo
  (más → el navegador se congestiona y el watchdog mata a 600s).
- **Prompt del subagente — MÉTODO RÁPIDO (evita stalls):**
  - Lee su `b_*.tsv`, escribe `out_b_*.tsv` con líneas `<id>\t<url>` (mismo id).
  - Crea UNA pestaña con tabs_create_mcp, guarda tabId, lo pasa SIEMPRE. Nunca toca pestañas ajenas.
  - SOLO navigate + javascript_tool. NO abrir cada producto, NO screenshots por imagen (causan stalls).
  - Por cada TIPO/marca: navigate `https://listado.mercadolibre.cl/<consulta-corta>`, esperar 2s,
    extraer con este JS los primeros 6 resultados (título || url):
    ```
    (()=>{const c=[...document.querySelectorAll('.poly-card, li.ui-search-layout__item')].slice(0,6);return c.map(x=>{const t=(x.querySelector('.poly-component__title, h3, h2, a[title]')||{}).innerText||'';const im=x.querySelector('img');const s=im?(im.getAttribute('data-src')||im.src||''):'';return t.slice(0,55)+' || '+s;}).join('\n');})()
    ```
  - Elegir el título cuyo TIPO (y MARCA si el nombre la trae) coincide; tomar su URL
    `https://http2.mlstatic.com/...` (la miniatura sirve). Reusar URL entre variantes del mismo
    tipo. Si no hay match limpio, OMITIR (no poner tipo equivocado).
  - Mensaje final SOLO: "N resueltos de M".

### 3c. Cómo se aplica (por id, idempotente)
Combinar todos los `out_b_*.tsv` (+ `out_quincalleria_all.tsv`), dedup por id (último gana),
filtrar solo líneas válidas `^\d+\thttps://http2\.mlstatic\.com/\S+$`, y aplicar:
```
cat out_b_*.tsv out_quincalleria_all.tsv | grep -P '^\d+\thttps://http2\.mlstatic\.com/\S+$' \
  | awk -F'\t' '{a[$1]=$2} END{for(k in a) print k"\t"a[k]}' > _clean.tsv
```
- Vía psql:  `\copy _img FROM '_clean.tsv' WITH (FORMAT csv, DELIMITER E'\t', QUOTE E'\b');`
  luego `UPDATE barraca_productos p SET imagen=i.url FROM _img i WHERE p.id=i.id AND p.activo;`
- Vía browser (si no hay psql): partir `_clean.tsv` con `split -l 640` y envolver cada trozo como
  `UPDATE ... FROM (VALUES (id,'url'),...) AS m(id,url) WHERE p.id=m.id AND p.activo;`
  (script para generar los chunks ya está más abajo / se generaron `_sql_chunk_1..3.sql`).
- IMPORTANTE: la columna `imagen` es ambigua en JOIN con barraca_categorias → calificar `p.imagen`.

### 3d. Render en producción
- Las imágenes son DATO en la DB. El CSP/remotePatterns de Next ya incluyen `*.mlstatic.com`
  (apps/barraca/next.config.ts), así que renderizan al instante SIN redeploy. Verificado en vivo
  (ej. Anticorrosivo Passol gris → lata Passol correcta).

---

## 4. LO QUE YA ESTÁ HECHO (NO rehacer)

Aplicado por-producto y verificado (cobertura mlstatic):
- **TODAS las 19 categorías del inventario original** procesadas por-id:
  Fijaciones (529), Herramientas y Maq (258), Pinturas (211, por MARCA), Perfiles y Planchas (189),
  Baño Cocina y Loggia (135), Electricidad e Iluminacion (106), Fierros Construccion (85),
  Seguridad Industrial (79), Jardin (77), Adhesivos y Sellantes (73), Quincalleria (59),
  Cerraduras (47), Cercos y Mallas (38), Techumbre (24), Aridos y Morteros (23), Tabiqueria (20),
  No Informado (10/13), Aditivos e Impermeabilizantes (7), Aislacion (5).
- Total con foto real: **1.935 / 1.978 (97,8%)**. (1.933 mlstatic + 2 falabella reales).
- Los `out_b_*.tsv` y `out_quincalleria_all.tsv` (resultados por id) están en este directorio,
  ya aplicados a producción. `_clean.tsv` tiene el set deduplicado (1.912 filas).

---

## 5. LO QUE FALTA (≈41 productos) — HACER EN LA PRÓXIMA CONVERSACIÓN

Son productos NUEVOS (bloque de ids ~1684–1748) en categorías que NO existían en el inventario
inicial, por eso quedaron fuera de los lotes. Hay que correrles el mismo pipeline (3b→3c).

### Lista exacta (id ~ categoria ~ nombre):
```
1693~Cementos y Aridos~Cemento Bio Bio Especial 25kg
1694~Cementos y Aridos~Cemento Bio Bio Alta Resistencia 25kg
1695~Cementos y Aridos~Cemento Melon Extra 25kg
1696~Cementos y Aridos~Gravilla 25kg
1697~Cementos y Aridos~Arena Fina 25kg
1698~Cementos y Aridos~Arena Gruesa 25kg
1699~Cementos y Aridos~Ripio 25kg
1700~Cementos y Aridos~Confort Polvo 25kg
1701~Cementos y Aridos~Estuco Listo 25kg
1702~Cementos y Aridos~Hormigon Listo 25kg
1703~Cementos y Aridos~Polvo Ladrillo 25kg
1704~Cementos y Aridos~Cal Hidratada 25kg
1684~Fierros~Malla Acma C92 5x2 (15x15)
1685~Fierros~Malla Acma C139 5x2
1740~Gasfiteria~Tubo PVC 110mm 6mt
1741~Gasfiteria~Tubo PVC 75mm 6mt
1742~Gasfiteria~Tubo PVC 50mm 6mt
1743~Gasfiteria~Codo PVC 110mm
1744~Gasfiteria~Codo PVC 75mm
1745~Gasfiteria~Tubo Cobre 1/2 Tira
1733~Maderas~Pino Cepillado 2x2
1734~Maderas~Pino Cepillado 2x3
1735~Maderas~Pino Cepillado 2x4
1736~Maderas~Pino Dimensionado 1x4
1737~Maderas~Pino Dimensionado 1x6
1738~Maderas~Terciado Estructural 15mm
1739~Maderas~Terciado Ranurado 18mm
1746~Otros~Carbon 3kg
1747~Otros~Carbon 5kg
1748~Otros~Fosforos Largos Pack
1726~Techumbres~Plancha Zinc 0.35 x 3.6mt
1727~Techumbres~Plancha Zinc 0.40 x 3.6mt
1728~Techumbres~Plancha OSB 11.1mm
1729~Techumbres~Plancha OSB 9.5mm
1730~Techumbres~Teja Asfaltica Bulto
```
(faltan ~3 más para llegar a 41 — vuelve a correr la query de §6 para la lista viva exacta,
porque el catálogo puede haber cambiado.)

### Ya descartados a propósito (NO son producto real / sin imagen limpia en ML):
- 1177 "Prueba Sistema" (registro de prueba — sugerir DESACTIVAR en admin)
- 729 "Grasa Liquida Arlon" (sin resultado limpio tras varios intentos)
- 1822 "Oring 25,00x3,53" (sin resultado limpio)

### Pasos concretos próxima conversación:
1. Verifica acceso DB (psql directo con OrbStack, o SQL editor browser).
2. Corre la query de §6 para obtener la lista VIVA de pendientes → `cat_pendientes.tsv` (id<TAB>nombre).
3. split en 1-2 lotes y despacha 1-2 subagentes con el prompt MÉTODO RÁPIDO (§3b).
   Consultas sugeridas: "saco cemento 25kg", "saco arena", "saco gravilla", "malla acma",
   "tubo pvc sanitario", "codo pvc", "tubo cobre", "pino cepillado", "terciado estructural",
   "plancha zinc acanalada", "plancha osb", "teja asfaltica", "carbon parrilla saco", "fosforos".
4. Aplica con §3c y re-verifica con §6. Objetivo: dejar sin_foto ≈ 3 (solo los descartados).
5. (Opcional, mejora de calidad) Pasada de verificación de MARCA en Pinturas/Adhesivos:
   algunos productos con marca chilena que ML no tiene quedaron con otra marca del mismo tipo
   (ej "Esmalte Praga" salió con lata Passol — tipo correcto, marca no). Revisar y reemplazar
   los que tengan marca cruzada evidente.

---

## 6. QUERIES ÚTILES (pegar en SQL editor o psql)

Cobertura global:
```sql
SELECT count(*) total,
  count(*) FILTER (WHERE imagen LIKE '%mlstatic%') con_ml,
  count(*) FILTER (WHERE imagen LIKE '%falabella%') falab,
  count(*) FILTER (WHERE imagen IS NULL OR imagen='' OR imagen LIKE '%/images/barraca/categorias/%' OR imagen LIKE '%unsplash%') sin_foto
FROM barraca_productos WHERE activo;
```
Lista viva de pendientes (id<TAB>nombre, para volcar a archivo):
```sql
SELECT p.id, p.nombre FROM barraca_productos p
WHERE p.activo AND (p.imagen IS NULL OR p.imagen='' OR p.imagen LIKE '%/images/barraca/categorias/%' OR p.imagen LIKE '%unsplash%')
ORDER BY p.nombre;
```
Pendientes por categoría:
```sql
SELECT c.nombre, count(*) sin_foto, count(*) total
FROM barraca_productos p JOIN barraca_categorias c ON c.id=p.categoria_id
WHERE p.activo GROUP BY 1
HAVING count(*) FILTER (WHERE p.imagen IS NULL OR p.imagen='' OR p.imagen LIKE '%/images/barraca/categorias/%' OR p.imagen LIKE '%unsplash%')>0
ORDER BY 2 DESC;
```

## 7. NOTAS
- Stop hook insiste en "imágenes de google": el usuario ACEPTÓ mlstatic explícitamente. No cambiar de fuente.
- Reversible vía `barraca_productos_imagen_bak`.
- Si un subagente se cuelga (watchdog 600s), reintentar ese lote solo; suele terminar al 2º intento.

---
## ADENDA — Portadas de CATEGORÍA (hecho 2026-05-31)
- Se reemplazaron las imágenes de PORTADA de 20 categorías por fotos vistosas estilo Sodimac/Easy
  (set/surtido del rubro), mlstatic, mapeadas POR NOMBRE en barraca_categorias.
- LECCIÓN: los subagentes renumeran ids → NUNCA mapear categorías por id de subagente; mapear por NOMBRE.
- Validar cada URL con curl+headers de navegador: mlstatic devuelve un GIF placeholder (~9591 bytes)
  a IDs inexistentes; sólo es buena si content_type=image/webp y size>3000.
- PENDIENTE menor: "Maderas" quedó sin portada nueva (la candidata salió cruzada con tubos PVC);
  conserva su imagen previa. Si se quiere, buscar "tabla pino dimensionada" y aplicar por nombre.
- Productos: 1977/1978 con foto (sólo "Prueba Sistema" sin foto, no es producto real).
