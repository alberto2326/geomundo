#!/usr/bin/env python3
"""Copia las imágenes de una carpeta de origen a img/ con nombres opacos y genera img/indice.json.

La carpeta de origen debe tener, por cada ítem del catálogo, ficheros con su id:
    <id>.png                         imagen de la pregunta (vista cercana, bandera o mapa de España)
    <id>_contexto.png  (o <id>b.png) vista de contexto (país + capital y física)
    <id>_solucion.png  (o <id>a.png) mapa con la respuesta (opcional)
Se admiten .png, .jpg, .jpeg y .webp. Los nombres de salida son el hash del contenido, para que no delaten la respuesta.

Uso: python3 -I tools/importar_imagenes.py CARPETA_ORIGEN [--webp]
"""
import sys, os, json, hashlib, shutil, re

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
origen = sys.argv[1]; webp = "--webp" in sys.argv
cat = json.load(open(os.path.join(APP, "data", "catalogo.json"), encoding="utf8"))
ids = {i["id"]: i for i in cat["items"]}
ROL = {"": "q", "_contexto": "c", "b": "c", "_solucion": "a", "a": "a"}
pat = re.compile(r"^(?P<id>.+?)(?P<rol>_contexto|_solucion|b|a)?\.(png|jpe?g|webp)$", re.I)
dest = os.path.join(APP, "img", "f"); os.makedirs(dest, exist_ok=True)
indice, desconocidos = {}, []
for raiz, _, fichs in os.walk(origen):
    for f in sorted(fichs):
        m = pat.match(f)
        if not m: continue
        iid, rol = m["id"], m["rol"] or ""
        if iid not in ids:  # «<id>b» o «<id>a» podrían ser ids reales que acaban en b/a
            if rol in ("a", "b") and iid + rol in ids: iid, rol = iid + rol, ""
            else: desconocidos.append(f); continue
        ruta = os.path.join(raiz, f)
        datos = open(ruta, "rb").read(); ext = os.path.splitext(f)[1].lower()
        if webp and ext != ".webp":
            from PIL import Image; import io
            b = io.BytesIO(); Image.open(io.BytesIO(datos)).save(b, "WEBP", quality=82, method=6); datos = b.getvalue(); ext = ".webp"
        nombre = hashlib.sha256(datos).hexdigest()[:20] + ext
        open(os.path.join(dest, nombre), "wb").write(datos)
        indice.setdefault(iid, {})[ROL[rol]] = f"img/f/{nombre}"
falta_q = [i for i in ids if "q" not in indice.get(i, {})]
falta_c = [i for i, it in ids.items() if it["imagenes"] == "cercana+contexto" and "c" not in indice.get(i, {})]
json.dump({"formato": "geomundo-imagenes", "version": 1, "items": indice}, open(os.path.join(APP, "img", "indice.json"), "w"), indent=0)
print(f"ítems con imagen: {len(indice)}/{len(ids)} · sin imagen de pregunta: {len(falta_q)} · sin contexto: {len(falta_c)} · ficheros ignorados: {len(desconocidos)}")
print("Los ítems sin imagen de pregunta no saldrán en las sesiones hasta tenerla.")
