# Imágenes barraca — COMPLETADO ✓ (2026-05-30)

## Resultado final
12 categorías procesadas esta sesión vía subagentes paralelos (MercadoLibre Chile,
imágenes verificadas limpias, fondo blanco). Todas al 100% mlstatic, 0 genéricas:
Fijaciones 529/529, Seguridad 79/79, Jardin 77/77, Quincalleria 59/59, Cerraduras 47/47,
Cercos 38/38, Techumbre 24/24, Aridos 23/23, Tabiqueria 20/20, Adhesivos 73/73,
Aditivos 7/7, Aislacion 5/5.
Aplicación: UPDATE agrupado por familia, inyectado vía Monaco setValue (sin teclear).
Render verificado live en barraca.jurmaq.cl (mlstatic sirve sin hotlink; CSP/remotePatterns ya desplegados → no requiere redeploy).
Backup reversible: barraca_productos_imagen_bak.

## Cola de categorías previas — TAMBIÉN COMPLETADA
Tras pedido del usuario ("ponerle a todos los productos"), se cubrió la cola de
Herramientas, Baño, Electricidad, Fierros, Perfiles(CANAL×28), Pinturas + bucket
"No Informado" + productos sueltos (UPDATE por nombre exacto).

## Estado final global (1978 productos activos)
- con imagen MercadoLibre (mlstatic): **1974**
- con imagen Falabella real (Escalerillas ×2): 2
- => **1976/1978 (99,9%) con foto-producto real**
- Sin foto (solo 2, placeholder de categoría):
  - "Prueba Sistema" — registro de prueba, NO es producto real (sugerir desactivar)
  - "Pesos Club Maestro de Hierro" — nombre ambiguo, sin match confiable

Nota fuente: el usuario aceptó explícitamente imágenes de MercadoLibre Chile
(que es lo que Google Imágenes muestra para estos productos chilenos); las URLs
gstatic/Google no son viables en producción (inestables, bloquean hotlink).

---
# (histórico) Imágenes barraca — familias pendientes (por categoría)

Método: subagente busca en MercadoLibre Chile (http2.mlstatic.com) imagen LIMPIA por familia
(sin watermark/logo/texto, fondo blanco) → devuelve VALUES → UPDATE agrupado por familia.

Regex familia (1 palabra): `(regexp_match(upper(p.nombre),'([A-ZÑÁÉÍÓÚ]{3,})'))[1]`

UPDATE pattern:
```sql
UPDATE barraca_productos p SET imagen = m.url
FROM (VALUES (...) ) AS m(cat, familia, url)
JOIN barraca_categorias c ON c.nombre = m.cat
WHERE p.categoria_id = c.id AND p.activo
  AND (regexp_match(upper(p.nombre),'([A-ZÑÁÉÍÓÚ]{3,})'))[1] = m.familia;
```

## Estado por categoría (con_ml = imágenes chilenas correctas)
- DONE: Herramientas(200), Pinturas(189), Perfiles(161), Baño(104), Electricidad(67), Fierros(65)
- PENDIENTE:
  - [DONE ✓] Seguridad Industrial (79/79 aplicado)
  - [DONE ✓] Jardin (34 fam aplicado)
  - [DONE ✓] Cercos y Mallas (8 fam aplicado)
  - [DONE ✓] Techumbre (4 fam aplicado)
  - [DONE ✓] Aridos y Morteros (10 fam aplicado)
  - [DONE ✓] Tabiqueria (6 fam aplicado)
  - [DONE ✓] Aditivos e Impermeabilizantes (5 fam aplicado)
  - [DONE ✓] Aislacion (3 fam aplicado)
  - [DONE ✓] Fijaciones (529/529 aplicado) — LA MÁS GRANDE
  - [DONE ✓] Adhesivos y Sellantes (22 fam aplicado)
  - [DONE ✓] Quincalleria (9 fam aplicado)
  - [DONE ✓] Cerraduras (9 fam aplicado)
  - SKIP: No Informado (13, basura)

## Familias por categoría (clave(n))

### Jardin
ESCOBILLA(9), TIJERA(8), MANGUERA(7), PALA(6), ACOPLE(4), CINTA(4), CLORO(3), UNION(3), SODA(3), ESCOBILLON(2), CARRETILLA(2), LLAVE(2), SET(2), GAS(2), DECANTADOR(1), PEGA(1), ASPERSOR(1), REFRIG(1), FUMIGADOR(1), KLERAT(1), VALV(1), NEUMATICO(1), PARRILLA(1), COCINILLA(1), MANGO(1), REGULADOR(1), ANTICUCHO(1), PICOTA(1), RASTRILLO(1), ALGICIDA(1), SOMBRILLA(1), BAJA(1), TRAMPAS(1), KIT(1)

### Fijaciones
BROCA(76), ABRAZADERA(58), ORING(41), TORN(38), PERNO(24), TOR(22), TIRAFONDO(19), PUNTA(18), CANCAMO(17), TAR(16), TORNILLO(16), HEX(14), CLAVO(14), TUERCA(14), REMACHE(12), BISAGRA(12), TARUGO(12), AMARRA(11), ESCUADRA(10), AUTOPERFORANTE(9), CADENA(8), REMACHADORA(8), GOLILLA(8), SET(8), UNION(6), MOSQUETON(6), CORDEL(5), PUNTILLA(4), OVILLO(3), DADO(3), HEXAGONAL(3), PUNTAS(2), GRAPAS(2), REMACHES(2), FIJACIONES(2), ENGRAPADORA(2), TARRAJA(2), GRASA(1), RUEDA(1)

### Adhesivos y Sellantes
SILICONA(19), VINILIT(7), PEGAMENTO(6), PISTOLA(5), ACEITE(4), COLA(4), CINTA(3), TRIPLE(3), SELLOTEC(3), TAPAGOTERA(2), ENDURECEDOR(2), PATE(2), MASILLA(2), ROLLO(2), SIKAFLEX(2), GOTITA(1), ACERO(1), PEGATANKE(1), PORTA(1), BOQUILLA(1), TAPAGOTERAS(1), WEBER(1)

### Quincalleria
RUEDA(30), POMEL(10), GUIA(7), RUEDAS(4), PIVOTE(3), FRAGUADOR(2), TOPE(1), CARROS(1), RIEL(1)

### Cerraduras
CANDADO(12), PICAPORTE(11), CERRADURA(9), PORTACANDADO(4), CERROJO(4), MANILLA(4), PICARPORTE(1), CAJA(1), BISAGRA(1)

### Cercos y Mallas
MALLA(20), ALAMBRE(6), GRAPA(5), POLIETILENO(2), PANEL(2), POLIET(1), CONCERTINA(1), BROCHE(1)

### Techumbre
ZINCALUM(16), ZINC(5), CABALLETES(2), CABALLETE(1)

### Aridos y Morteros
FRAGUE(7), SEPARADORES(5), CEMENTO(2), WEBER(2), YESO(2), BEKRON(1), CAL(1), TIERRA(1), PELLET(1), SIKACERAM(1)

### Tabiqueria
TERCIADO(9), OSB(4), INTERNIT(3), VOLCANITA(2), SIDING(1), TAB(1)

### Aditivos e Impermeabilizantes
GRASA(2), DESENGRASANTE(2), ANTICORROSIVO(1), ACEITE(1), ROSTOF(1)

### Aislacion
FIELTRO(2), LANA(2), ESPUMA(1)
