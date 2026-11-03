#!/usr/bin/env python3
"""Pasa las fotos de obra a WebP (640 y 1280 px) y anota sus medidas.

Uso, desde apps/constructora-sitio:
  python3 scripts/preparar-fotos.py <carpeta-origen> <nombre-final>=<archivo> ...
Si la foto original es más chica que 1280 px no se agranda.
"""
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

SALIDA = Path("public/obras")
MANIFIESTO = Path("src/data/fotos.json")
ANCHOS = (640, 1280)


def main() -> None:
    origen = Path(sys.argv[1])
    medidas = json.loads(MANIFIESTO.read_text()) if MANIFIESTO.exists() else {}
    for par in sys.argv[2:]:
        nombre, archivo = par.split("=", 1)
        foto = ImageOps.exif_transpose(Image.open(origen / archivo)).convert("RGB")
        for ancho in ANCHOS:
            copia = foto.copy()
            copia.thumbnail((ancho, ancho * 2))
            copia.save(SALIDA / f"{nombre}-{ancho}.webp", quality=74, method=6)
        medidas[nombre] = {"w": min(foto.width, 1280), "h": round(foto.height * min(foto.width, 1280) / foto.width)}
    MANIFIESTO.write_text(json.dumps(medidas, indent=2, sort_keys=True) + "\n")


if __name__ == "__main__":
    main()
