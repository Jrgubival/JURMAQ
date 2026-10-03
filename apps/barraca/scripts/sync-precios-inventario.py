#!/usr/bin/env python3
"""
Sincroniza precio / costo / stock de barraca_productos desde el Excel de
inventario del sistema de la barraca.

## Qué toca y qué NO

Toca SOLO: precio, costo, stock.
NO toca (decisión explícita del dueño): nombre, slug, descripcion, imagen,
medida, unidad, categoria_id, destacado, activo, solo_cotizar.

El Excel trae Descripción y Familia, pero los nombres del sitio están
curados a mano y las fotos se asignaron una por una. Pisarlos con el texto
del sistema de inventario ("ABRAZ. FIJACION TUBOS C/CO...") destruiría meses
de trabajo y arruinaría el SEO. Por eso este script ignora esas columnas.

## Reglas de seguridad de los datos

1. **Nunca escribe precio 0.** El Excel trae 8 productos en 0. La tabla
   barraca_precio_historial tiene CHECK (precio > 0), así que un 0 rompería
   el trigger de historial; y un producto a $0 en un ecommerce es una venta
   regalada. Se saltan y se reportan.

1b. **Nunca escribe un precio bajo el costo.** El propio Excel trae 3 filas
   con precio <= costo (ej. TAPA GORRO PPR SO 20: costo 64, precio 50). Es un
   error del sistema de inventario, no una oferta. Se saltan.

1c. **Retiene las bajas mayores a 45% para revisión humana.** Son casi
   siempre un desajuste de ENVASE, no un precio nuevo. Caso real detectado:
   "Tarugo Nylon N#10 Bolsa 500 UN" figuraba en el sitio a $24.020 y el Excel
   traía $50 — porque la fila del Excel es por UNIDAD y el sitio vende la
   bolsa de 500 (500 x 50 = 25.000, que cuadra con el precio del sitio).
   Aplicarlo habría vendido 500 tarugos a $50.

   El umbral es asimétrico a propósito: una baja equivocada se vende bajo
   costo y la plata no vuelve; un alza equivocada solo hace que ese producto
   no se venda, y se corrige cuando alguien lo note. Por eso las alzas SÍ se
   aplican (varias son correcciones necesarias: el "Juego Llaves Hexagonales"
   estaba a $4.160 con costo $13.012, o sea vendiéndose a pérdida).

   Las retenidas quedan en scripts/backups/revisar-precios-<fecha>.csv.

2. **Respeta ofertas activas.** Si un producto tiene en_oferta = true, su
   campo `precio` es el precio CON descuento y `precio_original` el de lista.
   Escribir el precio de lista encima borraría la oferta sin avisar. En esos
   casos se actualiza `precio_original` (que es lo que el Excel realmente
   representa) y se deja `precio` intacto.

3. **Stock negativo se sube a 0.** El sistema de inventario arrastra stocks
   negativos (hasta -225) por descuadres. Publicar stock negativo rompe la
   lógica de disponibilidad del sitio.

4. **Códigos repetidos.** El catálogo tiene productos duplicados con el mismo
   código, ambos activos (275 códigos a oct-2026: una copia vieja de la
   primera carga y otra de la segunda). La versión anterior se quedaba con la
   última fila por código y la otra copia conservaba un precio viejo, así que
   el mismo producto se veía a dos precios. Ahora se actualizan TODAS las
   filas activas del código. Las inactivas no se tocan.

5. **Liquidación (opcional, segundo Excel).** Columnas: Código, Precio lista,
   Oferta unitaria. Por cada fila activa del código:
   - Se muestra tachado el precio lista SOLO si es el precio actual de esa
     fila y estuvo vigente 30 días (RPC precio_vigente_acumulado_dias, la
     misma regla del import de promociones, Ley 19.496 art. 28). Entonces
     precio = oferta, precio_original = lista, en_oferta = true.
   - Si no cumple, la oferta se publica como precio normal, sin "antes": un
     precio más bajo siempre es legal; un "antes" que nunca existió, no.
   - Oferta <= costo, oferta >= lista o lista < 50% del precio de la fila
     (desajuste de envase) se retienen y se reportan.
   Las columnas de combo (Combo cant. / Combo precio) no tienen dónde
   guardarse en barraca_productos y se ignoran.

6. **Dry-run por defecto.** Sin --apply no escribe nada. Con --apply guarda
   antes un backup JSON del estado actual en scripts/backups/.

## Uso

    # ver qué pasaría (no escribe)
    python3 sync-precios-inventario.py "/ruta/INVENTARIO.xlsx"

    # aplicar de verdad
    python3 sync-precios-inventario.py "/ruta/INVENTARIO.xlsx" --apply

    # con liquidación (segundo archivo)
    python3 sync-precios-inventario.py "/ruta/INVENTARIO.xlsx" "/ruta/Liquidacion.xlsx" --apply

Necesita openpyxl. Si no está: python3 -m venv .venv && .venv/bin/pip install openpyxl
Lee credenciales de apps/barraca/.env.local (NEXT_PUBLIC_SUPABASE_URL y
SUPABASE_SERVICE_ROLE_KEY). Nunca las imprime.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
ENV_FILE = REPO / "apps" / "barraca" / ".env.local"
BACKUP_DIR = Path(__file__).resolve().parent / "backups"

# Columnas del Excel que consumimos. El resto se ignora a propósito.
COL_CODIGO = "Código"
COL_PRECIO = "Precio General"
COL_COSTO = "Costo Bru."
# El sistema de la barraca la llamaba "Stock Total"; desde oct-2026 exporta
# "Stock B1" (bodega 1). Se acepta la primera que exista.
COLS_STOCK = ("Stock Total", "Stock B1")


def cargar_env() -> tuple[str, str]:
    """Lee url + service_role de .env.local sin imprimirlos nunca."""
    if not ENV_FILE.exists():
        sys.exit(f"No existe {ENV_FILE}")
    env = {}
    for linea in ENV_FILE.read_text(encoding="utf-8").splitlines():
        linea = linea.strip()
        if not linea or linea.startswith("#") or "=" not in linea:
            continue
        k, v = linea.split("=", 1)
        env[k.strip()] = v.strip().strip('"').strip("'")
    url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        sys.exit("Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local")
    return url.rstrip("/"), key


def rest(url: str, key: str, path: str, method: str = "GET", body=None, extra_headers=None):
    """Llamada a PostgREST. Reintenta una vez ante 5xx / error de red."""
    req_url = f"{url}/rest/v1/{path}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    data = json.dumps(body).encode("utf-8") if body is not None else None

    for intento in (1, 2):
        req = urllib.request.Request(req_url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw.strip() else []
        except urllib.error.HTTPError as e:
            detalle = e.read().decode("utf-8", "replace")[:400]
            if 500 <= e.code < 600 and intento == 1:
                time.sleep(2)
                continue
            # El detalle de PostgREST no lleva secretos; la URL sí lleva el
            # proyecto pero no la key (va en headers).
            raise SystemExit(f"HTTP {e.code} en {method} {path}: {detalle}")
        except urllib.error.URLError as e:
            if intento == 1:
                time.sleep(2)
                continue
            raise SystemExit(f"Red caída en {method} {path}: {e.reason}")
    return []


def leer_excel(ruta: str) -> dict[str, dict]:
    try:
        from openpyxl import load_workbook
    except ImportError:
        sys.exit("Falta openpyxl. Instálalo en un venv: python3 -m venv .venv && .venv/bin/pip install openpyxl")

    wb = load_workbook(ruta, data_only=True, read_only=True)
    ws = wb["Hoja2"] if "Hoja2" in wb.sheetnames else wb[wb.sheetnames[0]]

    filas = ws.iter_rows(values_only=True)
    encabezados = [str(c).strip() if c is not None else "" for c in next(filas)]
    idx = {h: i for i, h in enumerate(encabezados)}
    for col in (COL_CODIGO, COL_PRECIO, COL_COSTO):
        if col not in idx:
            sys.exit(f"El Excel no tiene la columna {col!r}. Tiene: {encabezados}")
    col_stock = next((c for c in COLS_STOCK if c in idx), None)
    if col_stock is None:
        sys.exit(f"El Excel no tiene columna de stock ({' / '.join(COLS_STOCK)}). Tiene: {encabezados}")

    def num(v):
        if v is None:
            return None
        try:
            return int(round(float(v)))
        except (TypeError, ValueError):
            return None

    items: dict[str, dict] = {}
    for fila in filas:
        if not fila:
            continue
        codigo = fila[idx[COL_CODIGO]]
        if codigo is None or str(codigo).strip() == "":
            continue
        codigo = str(codigo).strip()
        items[codigo] = {
            "precio": num(fila[idx[COL_PRECIO]]),
            "costo": num(fila[idx[COL_COSTO]]),
            "stock": num(fila[idx[col_stock]]),
        }
    wb.close()
    return items


def leer_liquidacion(ruta: str) -> dict[str, dict]:
    from openpyxl import load_workbook

    wb = load_workbook(ruta, data_only=True, read_only=True)
    ws = wb[wb.sheetnames[0]]
    filas = ws.iter_rows(values_only=True)
    encabezados = [str(c).strip() if c is not None else "" for c in next(filas)]
    idx = {h: i for i, h in enumerate(encabezados)}
    for col in ("Código", "Precio lista", "Oferta unitaria"):
        if col not in idx:
            sys.exit(f"La liquidación no tiene la columna {col!r}. Tiene: {encabezados}")

    def num(v):
        try:
            return int(round(float(v)))
        except (TypeError, ValueError):
            return None

    out: dict[str, dict] = {}
    for fila in filas:
        if not fila or fila[idx["Código"]] in (None, ""):
            continue
        out[str(fila[idx["Código"]]).strip()] = {
            "lista": num(fila[idx["Precio lista"]]),
            "oferta": num(fila[idx["Oferta unitaria"]]),
            "combo": bool(idx.get("Combo cant.") is not None and num(fila[idx["Combo cant."]])),
        }
    wb.close()
    return out


def dias_vigencia(url: str, key: str, producto_id: int, precio: int) -> int:
    """Días (en los últimos 30) que `precio` fue el precio de esa fila."""
    r = rest(url, key, "rpc/precio_vigente_acumulado_dias", method="POST",
             body={"p_producto_id": producto_id, "p_precio": precio, "p_ventana_dias": 30})
    try:
        return int(r)
    except (TypeError, ValueError):
        return 0


def traer_productos(url: str, key: str) -> list[dict]:
    """Trae todos los productos paginando (PostgREST corta en 1000)."""
    campos = "id,codigo,nombre,precio,costo,stock,en_oferta,precio_original,oferta_fin,activo"
    out, offset, page = [], 0, 1000
    while True:
        lote = rest(
            url, key,
            f"barraca_productos?select={campos}&order=id.asc&limit={page}&offset={offset}",
        )
        out.extend(lote)
        if len(lote) < page:
            break
        offset += page
    return out


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    aplicar = "--apply" in sys.argv
    if not args:
        sys.exit(__doc__)
    ruta_excel = args[0]
    ruta_liq = args[1] if len(args) > 1 else None

    url, key = cargar_env()
    excel = leer_excel(ruta_excel)
    liq = leer_liquidacion(ruta_liq) if ruta_liq else {}
    productos = traer_productos(url, key)

    print(f"Excel: {len(excel)} códigos · Liquidación: {len(liq)} · BD: {len(productos)} productos")

    # Todas las filas ACTIVAS de cada código (ver regla 4 del docstring).
    por_codigo: dict[str, list[dict]] = {}
    sin_codigo = 0
    for p in productos:
        if not p.get("activo"):
            continue
        c = (p.get("codigo") or "").strip()
        if not c:
            sin_codigo += 1
            continue
        por_codigo.setdefault(c, []).append(p)
    repetidos = sum(1 for filas in por_codigo.values() if len(filas) > 1)

    cambios, saltados, sin_match_bd, retenidos = [], [], [], []
    liq_tachado, liq_simple, liq_retenidos = [], [], []
    filas_bd = [(c, p) for c, filas in por_codigo.items() for p in filas]
    for codigo, p in filas_bd:
        fila = excel.get(codigo)
        if fila is None:
            sin_match_bd.append(p)
            continue

        nuevo_precio = fila["precio"]
        if not nuevo_precio or nuevo_precio <= 0:
            saltados.append((p, "precio 0 o vacío en el Excel"))
            continue

        # Guarda 1: el propio Excel a veces trae precio <= costo. Es un error
        # de su sistema, no una liquidación. Nunca publicamos a pérdida.
        costo_excel = fila["costo"]
        if costo_excel and nuevo_precio <= costo_excel:
            saltados.append((p, f"precio {nuevo_precio:,} <= costo {costo_excel:,} en el Excel"))
            continue

        # Guarda 2: baja mayor a 50% = casi siempre desajuste de envase
        # (fila por unidad vs producto vendido por bolsa/paquete). Se retiene
        # para revisión en vez de aplicarse; ver docstring.
        precio_actual = p.get("precio")
        # Umbral 45% (era 50%): en oct-2026 "Carros Aereo Doble D-100 Ducasse"
        # se vende en el sitio por PAR a $18.500 y el Excel trae la UNIDAD a
        # $9.520, una baja de 49% que pasaba la guarda de 50%.
        if codigo not in liq and not p.get("en_oferta") and precio_actual and nuevo_precio < precio_actual * 0.55:
            caida = (nuevo_precio - precio_actual) / precio_actual * 100
            razon = "posible desajuste de envase (unidad vs paquete)"
            if costo_excel:
                razon += f"; costo unitario Excel ${costo_excel:,}"
            retenidos.append((p, nuevo_precio, caida, razon))
            continue

        upd: dict = {}
        l = liq.get(codigo)
        if l:
            lista, oferta = l["lista"], l["oferta"]
            precio_fila = p.get("precio_original") if p.get("en_oferta") else p.get("precio")
            motivo = None
            if not oferta or not lista or oferta >= lista:
                motivo = f"oferta {oferta} no es menor que la lista {lista}"
            elif costo_excel and oferta <= costo_excel:
                motivo = f"oferta {oferta:,} <= costo {costo_excel:,}"
            elif precio_fila and lista < precio_fila * 0.5:
                motivo = f"lista {lista:,} < 50% del precio de la fila {precio_fila:,} (envase)"
            if motivo:
                liq_retenidos.append((p, motivo))
            elif precio_fila == lista and dias_vigencia(url, key, p["id"], lista) >= 30:
                liq_tachado.append(p)
                if p.get("precio") != oferta: upd["precio"] = oferta
                if p.get("precio_original") != lista: upd["precio_original"] = lista
                if not p.get("en_oferta"): upd["en_oferta"] = True
            else:
                liq_simple.append(p)
                if p.get("precio") != oferta: upd["precio"] = oferta
                if p.get("en_oferta"):
                    upd["en_oferta"] = False
                    upd["precio_original"] = None
        if l:
            # Precio ya resuelto por la liquidación; si quedó retenida, el
            # precio de la fila no se toca (sólo costo y stock).
            pass
        elif p.get("en_oferta"):
            # Oferta activa: el Excel trae el precio de LISTA, que corresponde a
            # precio_original. Tocar `precio` borraría el descuento vigente.
            if p.get("precio_original") != nuevo_precio:
                upd["precio_original"] = nuevo_precio
        else:
            if p.get("precio") != nuevo_precio:
                upd["precio"] = nuevo_precio

        costo = fila["costo"]
        if costo is not None and costo > 0 and p.get("costo") != costo:
            upd["costo"] = costo

        stock = fila["stock"]
        if stock is not None:
            stock = max(0, stock)  # el inventario arrastra negativos
            if p.get("stock") != stock:
                upd["stock"] = stock

        if upd:
            cambios.append((p, upd))

    solo_en_excel = [c for c in excel if c not in por_codigo]
    filas_totales = len(filas_bd)

    # --- Informe ---------------------------------------------------------
    print()
    print(f"  Con cambios         : {len(cambios)}")
    print(f"  Sin cambios         : {filas_totales - len(cambios) - len(saltados) - len(retenidos) - len(sin_match_bd)}")
    print(f"  Filas activas evaluadas: {filas_totales} · códigos con 2+ filas activas: {repetidos}")
    print(f"  Saltados (0 o bajo costo)   : {len(saltados)}")
    print(f"  RETENIDOS para revisión     : {len(retenidos)}")
    print(f"  En BD sin fila Excel: {len(sin_match_bd)}")
    print(f"  En Excel sin producto en BD: {len(solo_en_excel)}")
    print(f"  Productos en BD sin código  : {sin_codigo}")

    subidas = [(p, u) for p, u in cambios if "precio" in u and p["precio"] and u["precio"] > p["precio"]]
    bajadas = [(p, u) for p, u in cambios if "precio" in u and p["precio"] and u["precio"] < p["precio"]]
    print()
    print(f"  Precios que SUBEN : {len(subidas)}")
    print(f"  Precios que BAJAN : {len(bajadas)}")

    def variacion(par):
        p, u = par
        return (u["precio"] - p["precio"]) / p["precio"] if p.get("precio") else 0

    for etiqueta, grupo in (("MAYORES ALZAS", subidas), ("MAYORES BAJAS", bajadas)):
        if not grupo:
            continue
        print(f"\n  {etiqueta} (top 8):")
        for p, u in sorted(grupo, key=variacion, reverse=(etiqueta == "MAYORES ALZAS"))[:8]:
            pct = variacion((p, u)) * 100
            print(f"    {pct:+7.1f}%  {p['precio']:>9,} → {u['precio']:>9,}  {p['nombre'][:46]}")

    if saltados:
        print(f"\n  SALTADOS ({len(saltados)}):")
        for p, motivo in saltados[:12]:
            print(f"    [{p['codigo']}] {p['nombre'][:46]} — {motivo}")

    if retenidos:
        print(f"\n  RETENIDOS — bajas >50%, revisar a mano ({len(retenidos)}):")
        for p, nuevo, caida, razon in sorted(retenidos, key=lambda r: r[2]):
            print(f"    {caida:+7.1f}%  {p['precio']:>9,} → {nuevo:>8,}  [{p['codigo']}] {p['nombre'][:40]}")
            print(f"             {razon}")

    if liq:
        print(f"\n  LIQUIDACIÓN: {len(liq_tachado)} filas con precio tachado (lista vigente 30 días)")
        print(f"               {len(liq_simple)} filas con la oferta como precio normal (sin 'antes')")
        print(f"               {len(liq_retenidos)} filas retenidas")
        for p, motivo in liq_retenidos[:15]:
            print(f"      [{p['codigo']}] {p['nombre'][:44]} — {motivo}")
        sin_fila = [c for c in liq if c not in por_codigo]
        print(f"               {len(sin_fila)} códigos de la liquidación sin producto activo: {', '.join(sin_fila[:10])}")
        print(f"               {sum(1 for x in liq.values() if x['combo'])} filas traen combo (no se guardan: no hay columna)")

    ofertas = [(p, u) for p, u in cambios if p.get("en_oferta")]
    if ofertas:
        print(f"\n  EN OFERTA — se actualiza precio_original, NO el precio con descuento ({len(ofertas)}):")
        for p, u in ofertas[:10]:
            print(f"    [{p['codigo']}] {p['nombre'][:44]} · oferta ${p['precio']:,} · lista → ${u.get('precio_original', p.get('precio_original')):,}")

    if not aplicar:
        print("\n=== DRY-RUN. No se escribió nada. Repite con --apply para aplicar. ===")
        return

    # --- Aplicar ---------------------------------------------------------
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    sello = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = BACKUP_DIR / f"precios-antes-{sello}.json"
    backup.write_text(
        json.dumps(
            [
                {k: p.get(k) for k in ("id", "codigo", "precio", "costo", "stock", "en_oferta", "precio_original", "oferta_fin")}
                for p in productos
            ],
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    print(f"\nBackup del estado anterior: {backup}")

    # Los retenidos se dejan en CSV para que el dueño los resuelva a mano:
    # cada uno necesita decidir si el producto del sitio es un paquete (y hay
    # que multiplicar el precio unitario) o si el precio del sitio estaba mal.
    if retenidos:
        csv_path = BACKUP_DIR / f"revisar-precios-{sello}.csv"
        filas = ["codigo,nombre,precio_sitio_actual,precio_excel,variacion_pct,motivo"]
        for p, nuevo, caida, razon in sorted(retenidos, key=lambda r: r[2]):
            nombre = '"' + str(p["nombre"]).replace('"', "'") + '"'
            filas.append(f'{p["codigo"]},{nombre},{p["precio"]},{nuevo},{caida:.1f},"{razon}"')
        csv_path.write_text("\n".join(filas) + "\n", encoding="utf-8")
        print(f"Retenidos para revisar a mano: {csv_path}")

    ok = fallos = 0
    for i, (p, upd) in enumerate(cambios, 1):
        try:
            rest(
                url, key,
                f"barraca_productos?id=eq.{p['id']}",
                method="PATCH",
                body=upd,
                extra_headers={"Prefer": "return=minimal"},
            )
            ok += 1
        except SystemExit as e:
            fallos += 1
            print(f"  FALLO id={p['id']} [{p['codigo']}]: {e}")
        if i % 200 == 0:
            print(f"  {i}/{len(cambios)}…", flush=True)

    print(f"\nListo: {ok} actualizados, {fallos} fallidos.")
    print(f"Para revertir: los valores previos están en {backup}")
    if ok:
        avisar_sitio()


def avisar_sitio() -> None:
    """Pide al sitio que invalide las fichas y categorías en caché.

    Las fichas se cachean 24 h; sin este aviso un precio nuevo tardaría hasta
    un día en verse. Usa CRON_SECRET de .env.local (nunca se imprime).
    """
    env = {}
    for linea in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if "=" in linea and not linea.strip().startswith("#"):
            k, v = linea.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    secreto = env.get("CRON_SECRET")
    base = (env.get("NEXT_PUBLIC_BARRACA_URL") or "https://barraca.jurmaq.cl").rstrip("/")
    if not secreto:
        print("Sin CRON_SECRET en .env.local: el sitio mostrará los precios nuevos cuando venza su caché (hasta 24 h).")
        return
    req = urllib.request.Request(
        f"{base}/api/revalidar", data=b"{}", method="POST",
        headers={"Authorization": f"Bearer {secreto}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print(f"Caché del sitio invalidado ({r.status}): los precios nuevos se ven desde ya.")
    except urllib.error.HTTPError as e:
        print(f"No se pudo invalidar el caché del sitio (HTTP {e.code}); los precios aparecerán al vencer el caché.")
    except urllib.error.URLError as e:
        print(f"No se pudo avisar al sitio ({e.reason}); los precios aparecerán al vencer el caché.")


if __name__ == "__main__":
    main()
