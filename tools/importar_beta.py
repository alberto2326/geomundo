#!/usr/bin/env python3
"""Importa un paquete de imágenes «beta» de Geografía del Mundo (datos.json + img/pNNN_{pregunta,contexto,solucion}.png).
Comprueba el SHA-256 de cada imagen, la convierte a WebP sin pérdida con nombre opaco y escribe img/indice.json.
Uso: python3 -I tools/importar_beta.py RUTA/datos.json CARPETA_IMG [CARPETA_IMG ...]
"""
import sys, os, json, hashlib, io
from PIL import Image

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
datos = json.load(open(sys.argv[1], encoding="utf8"))
carpetas = sys.argv[2:]
cat = {i["id"] for i in json.load(open(os.path.join(APP, "data", "catalogo.json"), encoding="utf8"))["items"]}
dest = os.path.join(APP, "img", "f"); os.makedirs(dest, exist_ok=True)
ROL = {"pregunta": "q", "contexto": "c", "solucion": "a"}
indice_p = os.path.join(APP, "img", "indice.json")
indice = json.load(open(indice_p)).get("items", {}) if os.path.exists(indice_p) else {}

def buscar(nombre):
    for c in carpetas:
        p = os.path.join(c, nombre)
        if os.path.exists(p): return p
    return None

errores = []
for it in datos["items"]:
    if it["id"] not in cat: errores.append(f"{it['id']}: no está en el catálogo"); continue
    entrada = {}
    for rol, img in it["imagenes"].items():
        p = buscar(os.path.basename(img["ruta"]))
        if not p: errores.append(f"{it['id']}: falta {img['ruta']}"); continue
        b = open(p, "rb").read()
        if hashlib.sha256(b).hexdigest() != img["sha256"]: errores.append(f"{it['id']}: SHA-256 no coincide en {img['ruta']}"); continue
        out = io.BytesIO(); Image.open(io.BytesIO(b)).save(out, "WEBP", lossless=True, method=4)
        w = out.getvalue(); nombre = hashlib.sha256(w).hexdigest()[:20] + ".webp"
        open(os.path.join(dest, nombre), "wb").write(w)
        entrada[ROL[rol]] = f"img/f/{nombre}"
    indice[it["id"]] = entrada
json.dump({"formato": "geomundo-imagenes", "version": datos.get("version", 1), "items": indice}, open(indice_p, "w"), indent=0)
print(f"ítems con imágenes: {len(indice)} · errores: {len(errores)}")
for e in errores[:20]: print("  ", e)
sys.exit(1 if errores else 0)
