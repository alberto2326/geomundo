#!/usr/bin/env python3
"""Reconstruye data/catalogo.json a partir del catálogo actual + los paquetes de Geografía del Mundo
(datos.json, datos_banderas200.json, datos_fisica566.json, datos_espana371.json, datos_estados50.json, datos_ciudades40.json).
Los paquetes mandan en textos (curiosidad, alias, capitales, pregunta, nivel). Añade estados (us-*) y ciudades (ci-*).
Uso: python3 -I tools/construir_catalogo_paquetes.py CARPETA_PAQUETES
"""
import sys, os, json, hashlib

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = sys.argv[1]
cat = json.load(open(os.path.join(APP, "data", "catalogo.json"), encoding="utf8"))
items = {i["id"]: i for i in cat["items"]}
ld = lambda f: json.load(open(os.path.join(P, f), encoding="utf8"))["items"]
caps = lambda l: [dict(nombre=c["nombre"], clave=c.get("clave", c["nombre"]), alias=c.get("alias", [])) for c in l]
cambios = {}
def poner(i, **kw):
    for k, v in kw.items():
        if v is None: continue
        if items[i].get(k) != v: cambios[k] = cambios.get(k, 0) + 1; items[i][k] = v

for it in ld("datos.json"):
    poner(it["id"], nombre=it["pais"], alias=it["alias_pais"], capitales=caps(it["capitales"]), dato=it.get("curiosidad", ""), nivel=it["nivel"])
for it in ld("datos_banderas200.json"):
    poner(it["id"], nombre=it["pais"], alias=it["alias_pais"], dato=it.get("curiosidad", ""), nivel=it["nivel"])
    if it.get("atribucion"): items[it["id"]]["atribucion"] = it["atribucion"]
for f in ("datos_fisica566.json", "datos_espana371.json"):
    for it in ld(f):
        poner(it["id"], nombre=it["nombre"], alias=it["alias"], dato=it.get("curiosidad", ""), nivel=it["nivel"], subtipo=it["subtipo"], pregunta=it["pregunta"],
              titulo=it.get("pregunta_corta"))
# Estados de EE. UU. (nuevos)
EXTRA_ALIAS_CAP = {"us-mn": ["Saint Paul", "St. Paul"]}  # nombre en inglés de San Pablo (Minnesota)
for k, it in enumerate(ld("datos_estados50.json")):
    c = caps(it["capitales"])
    for x in c:
        x["alias"] = x["alias"] + [a for a in EXTRA_ALIAS_CAP.get(it["id"], []) if a not in x["alias"]]
    items[it["id"]] = dict(id=it["id"], tipo="estado", subtipo="estado_capital", nombre=it["estado"], alias=it["alias_estado"], nivel=1, extra=False,
                          orden=[k], dato=it.get("curiosidad", ""), pregunta=it["pregunta"], titulo="¿ESTADO y CAPITAL?", imagenes="cercana+contexto",
                          postal=it.get("postal"), capitales=c)
# Ciudades del mundo (nuevas)
for k, it in enumerate(ld("datos_ciudades40.json")):
    items[it["id"]] = dict(id=it["id"], tipo="ciudad", subtipo="ciudad", nombre=it["nombre"], alias=it.get("alias", []), nivel=1, extra=False,
                          orden=[k], dato=it.get("curiosidad", ""), pregunta=it["pregunta"], titulo="¿Qué CIUDAD es?", imagenes="una",
                          pais=it.get("pais"), pais_id=it.get("pais_id"), fuente_dato=it.get("curiosidad_fuente"))
lista = list(items.values())
cuerpo = json.dumps(lista, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
out = dict(formato="geomundo-catalogo", version=2, hash=hashlib.sha256(cuerpo.encode()).hexdigest(), items=lista)
json.dump(out, open(os.path.join(APP, "data", "catalogo.json"), "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
cuar = sorted(i["id"] for f in ("datos.json", "datos_fisica566.json", "datos_espana371.json", "datos_ciudades40.json") for i in ld(f) if i.get("en_cuarentena"))
json.dump(dict(nota="Ítems excluidos de las sesiones hasta validar su imagen.", ids=cuar), open(os.path.join(APP, "data", "cuarentena.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
from collections import Counter
print("ítems", len(lista), dict(Counter(i["tipo"] for i in lista)), "cambios", cambios, "cuarentena", len(cuar))
