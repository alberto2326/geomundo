"""Genera data/vecinos.json: para cada país del catálogo, su zona y los países con los que limita.
Fuente: mledoze/countries (ODbL 1.0), campos subregion, borders y landlocked.
Uso: python3 tools/construir_vecinos.py RUTA/countries.json"""
import json, sys
ZONA = {"Caribbean": "el Caribe", "Eastern Africa": "África oriental", "Western Asia": "Oriente Próximo", "Western Africa": "África occidental",
  "Northern Europe": "el norte de Europa", "South America": "Sudamérica", "South-Eastern Asia": "el Sudeste Asiático", "Middle Africa": "África central",
  "Southern Europe": "el sur de Europa", "Polynesia": "la Polinesia", "Southern Asia": "el sur de Asia", "Southeast Europe": "el sudeste de Europa",
  "Western Europe": "Europa occidental", "Eastern Asia": "Asia oriental", "Central America": "Centroamérica", "North America": "Norteamérica",
  "Northern Africa": "el norte de África", "Micronesia": "la Micronesia", "Central Europe": "Europa central", "Australia and New Zealand": "Oceanía",
  "Southern Africa": "el sur de África", "Melanesia": "la Melanesia", "Central Asia": "Asia central", "Eastern Europe": "Europa del Este"}
C = json.load(open(sys.argv[1]))
by2 = {c["cca2"].lower(): c for c in C}; by3 = {c["cca3"]: c for c in C}
cat = json.load(open("data/catalogo.json"))["items"]
pais = {i["iso"]: i for i in cat if i["tipo"] == "pais"}
out = {}
for iso, it in pais.items():
    c = by2[iso]
    vec = sorted((pais[by3[b]["cca2"].lower()]["id"] for b in c.get("borders", []) if b in by3 and by3[b]["cca2"].lower() in pais),
                 key=lambda i: next(x["nombre"] for x in cat if x["id"] == i))
    out[it["id"]] = {"zona": ZONA.get(c.get("subregion", ""), ""), "vecinos": vec, "interior": bool(c.get("landlocked"))}
json.dump({"fuente": "mledoze/countries (ODbL 1.0)", "paises": out}, open("data/vecinos.json", "w"), ensure_ascii=False, separators=(",", ":"))
print(len(out), "países;", sum(1 for v in out.values() if not v["vecinos"]), "sin vecinos en el catálogo;", sum(1 for v in out.values() if not v["zona"]), "sin zona")
