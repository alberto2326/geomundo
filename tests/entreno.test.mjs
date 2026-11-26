import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { zonas, opciones, dificiles, rondaZona, nuevaRonda, responderRonda } from "../js/entreno.js";
import { crearAzar } from "../js/util.js";
const items = JSON.parse(fs.readFileSync(new URL("../data/catalogo.json", import.meta.url), "utf8")).items;
const vecinos = JSON.parse(fs.readFileSync(new URL("../data/vecinos.json", import.meta.url), "utf8")).paises;
const P = new Map(items.map((i) => [i.id, i]));

test("entreno: las opciones trampa de Níger son vecinos suyos", () => {
  for (let k = 0; k < 20; k++) {
    const o = opciones(P.get("pc-ne"), items, vecinos, P, crearAzar("x" + k));
    assert.equal(o.length, 4); assert.ok(o.includes("Níger")); assert.equal(new Set(o).size, 4);
    const vec = vecinos["pc-ne"].vecinos.map((i) => P.get(i).nombre);
    for (const n of o) if (n !== "Níger") assert.ok(vec.includes(n), n);
  }
});
test("entreno: isla sin vecinos → países de su zona o su continente; bandera usa su país; resto, mismo subtipo", () => {
  const o = opciones(P.get("pc-to"), items, vecinos, P, crearAzar("t"));
  assert.equal(o.length, 4); assert.ok(o.includes("Tonga"));
  const b = opciones(P.get("ba-ml"), items, vecinos, P, crearAzar("b")); assert.ok(b.includes("Malí")); assert.equal(b.length, 4);
  const r = P.get("fi-rio-amazonas"), f = opciones(r, items, vecinos, P, crearAzar("f"));
  assert.equal(f.length, 4); for (const n of f) assert.equal(items.find((x) => x.nombre === n && x.tipo === "fisico")?.subtipo, "rio");
});
test("entreno: zonas por continente y ronda de una zona", () => {
  const z = zonas(items, vecinos); assert.deepEqual(z.map((g) => g.grupo), ["África", "América", "Asia", "Europa", "Oceanía"]);
  const occ = z[0].zonas.find((x) => x.zona === "África occidental"); assert.ok(occ.ids.includes("pc-ne"));
  const r = rondaZona("África occidental", "pais", items, vecinos, new Set(), crearAzar("z")); assert.equal(r.length, 10);
  assert.ok(r.every((id) => vecinos[id].zona === "África occidental"));
  const rb = rondaZona("África occidental", "bandera", items, vecinos, new Set(), crearAzar("z")); assert.ok(rb.every((id) => id.startsWith("ba-")));
});
test("entreno: «mis difíciles» prioriza lo fallado y deja fuera lo asentado", () => {
  const estado = { items: {
    "pc-ne": { reps: 0, historial: [["d1", 0], ["d2", 0], ["d3", 0]] },
    "pc-ml": { reps: 1, historial: [["d1", 0], ["d2", 1]] },
    "pc-fr": { reps: 4, historial: [["d1", 1], ["d2", 1], ["d3", 1]] },
    "pc-es": { reps: 3, historial: [["d1", 0], ["d2", 1], ["d3", 1], ["d4", 1], ["d5", 1]] } } };
  assert.deepEqual(dificiles(estado, P), ["pc-ne", "pc-ml"]);
});
test("entreno: lo fallado vuelve al final (como mucho dos veces)", () => {
  const r = nuevaRonda(["a", "b"]);
  responderRonda(r, "a", false); responderRonda(r, "b", true);
  assert.deepEqual(r.cola, ["a", "b", "a"]);
  responderRonda(r, "a", false); responderRonda(r, "a", false); const f = responderRonda(r, "a", false);
  assert.equal(f.fin, true); assert.equal(r.primera.a, false); assert.equal(r.primera.b, true);
});
