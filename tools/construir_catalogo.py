#!/usr/bin/env python3
"""Genera data/catalogo.json para la web a partir de catalogo.json (código de referencia) y preguntas_1332.json.
Uso: python3 -I tools/construir_catalogo.py RUTA/catalogo.json RUTA/preguntas_1332.json RUTA/cuarentena_interna.json
"""
import sys, os, json, hashlib

cat_p, preg_p, cuar_p = sys.argv[1:4]
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cat = json.load(open(cat_p, encoding="utf8"))
pregs = {q["id"]: q for q in json.load(open(preg_p, encoding="utf8"))}
items = []
for it in cat["items"]:
    q = pregs[it["id"]]
    x = dict(id=it["id"], tipo=it["tipo"], subtipo=it["subtipo"], nombre=it["nombre"], alias=it.get("alias", []),
             nivel=it["nivel"], extra=bool(it.get("extra", False)), orden=it["orden"], dato=it["dato"],
             pregunta=q["pregunta"], titulo=q["titulo_imagen"], imagenes=q["imagenes"])
    if it.get("iso"): x["iso"] = it["iso"]
    if it.get("es_id"): x["es_id"] = it["es_id"]
    if it["tipo"] == "pais":
        x["capitales"] = [dict(nombre=c["nombre"], clave=c["clave"], alias=c.get("alias", [])) for c in it["capitales"]]
    items.append(x)
assert len(items) == 1332 and len({i["id"] for i in items}) == 1332
cuerpo = json.dumps(items, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
h = hashlib.sha256(cuerpo.encode("utf8")).hexdigest()
out = dict(formato="geomundo-catalogo", version=cat.get("version", 1), hash=h, items=items)
json.dump(out, open(os.path.join(APP, "data", "catalogo.json"), "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
cu = json.load(open(cuar_p, encoding="utf8"))
json.dump(dict(nota="Ítems excluidos de las sesiones hasta validar su imagen.", ids=sorted(cu["ids"])),
          open(os.path.join(APP, "data", "cuarentena.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
print("catálogo", len(items), "hash", h[:12], "cuarentena", len(cu["ids"]))
