#!/usr/bin/env python3
"""Importa las imágenes de los paquetes «ligeros» de Geografía del Mundo tal cual (sin recomprimir).
Comprueba el SHA-256 de cada imagen, la copia a img/f/ con un nombre opaco (hash del contenido) y reescribe img/indice.json.
Uso: python3 -I tools/importar_paquetes.py CARPETA_PAQUETES   (la carpeta con datos*.json e img/)
"""
import sys, os, json, hashlib, glob, shutil

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = sys.argv[1]
cat = {i["id"] for i in json.load(open(os.path.join(APP, "data", "catalogo.json"), encoding="utf8"))["items"]}
dest = os.path.join(APP, "img", "f")
shutil.rmtree(dest, ignore_errors=True); os.makedirs(dest)
ROL = {"pregunta": "q", "contexto": "c", "solucion": "a"}
indice, errores, total = {}, [], 0
for f in sorted(glob.glob(os.path.join(P, "datos*.json"))):
    for it in json.load(open(f, encoding="utf8"))["items"]:
        if it["id"] not in cat: errores.append(f"{it['id']}: no está en el catálogo"); continue
        for rol, img in it["imagenes"].items():
            ruta = os.path.join(P, img["ruta"])
            if not os.path.exists(ruta): errores.append(f"{it['id']}: falta {img['ruta']}"); continue
            b = open(ruta, "rb").read()
            if hashlib.sha256(b).hexdigest() != img["sha256"]: errores.append(f"{it['id']}: SHA-256 no coincide en {img['ruta']}"); continue
            nombre = img["sha256"][:20] + os.path.splitext(ruta)[1].lower()
            open(os.path.join(dest, nombre), "wb").write(b); total += 1
            indice.setdefault(it["id"], {})[ROL[rol]] = f"img/f/{nombre}"
json.dump({"formato": "geomundo-imagenes", "version": 2, "items": indice}, open(os.path.join(APP, "img", "indice.json"), "w"), separators=(",", ":"))
print(f"imágenes: {total} · ítems con imagen: {len(indice)}/{len(cat)} · errores: {len(errores)}")
for e in errores[:20]: print("  ", e)
sys.exit(1 if errores else 0)
