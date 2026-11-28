import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { opciones, colaEntreno, nuevaRonda, responderRonda } from "../js/entreno.js";
import { crearApp } from "../js/logica.js";
import { almacenMemoria } from "../js/almacen.js";
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
test("entreno: cola con todo lo de medio aprender, de más a menos fallado; lo acertado hoy al final; si no hay, lo próximo", async () => {
  const config = JSON.parse(fs.readFileSync(new URL("../data/config.json", import.meta.url), "utf8"));
  const app = await crearApp({ catalogo: { items }, almacen: almacenMemoria(), config, ahora: () => new Date("2026-11-28T09:00:00Z") });
  await app.empezarDeCero();
  const base = { P, activos: app.tipos, excluir: app.excluidos() };
  assert.deepEqual(colaEntreno({ ...base, estado: app.estado(), proximos: app.proximosNuevos() }), []); // nada a medio aprender
  const prox = colaEntreno({ ...base, estado: app.estado(), proximos: app.proximosNuevos(), modo: "proximos" });
  assert.equal(prox.length, 20); assert.deepEqual(prox, app.proximosNuevos().slice(0, 20));
  const st = app.estado();
  st.items["pc-ne"] = { reps: 0, historial: [["d1", 0], ["d2", 0], ["d3", 0]] };
  st.items["pc-ml"] = { reps: 1, historial: [["d1", 0], ["d2", 1]] };
  st.items["pc-td"] = { reps: 0, historial: [["d1", 0]] };
  st.items["pc-ke"] = { reps: 1, historial: [["d1", 1]] };
  st.items["pc-fr"] = { reps: 4, historial: [["d1", 1], ["d2", 1]] };
  const c = colaEntreno({ ...base, estado: st });
  assert.deepEqual(c, ["pc-ne", "pc-td", "pc-ml", "pc-ke"]); // todo lo de medio aprender, sin lo asentado, del más fallado al menos
  assert.deepEqual(colaEntreno({ ...base, estado: st, acertadosHoy: new Set(["pc-ne"]) }), ["pc-td", "pc-ml", "pc-ke", "pc-ne"]);
});
test("entreno: lo fallado vuelve unas preguntas después (como mucho dos veces)", () => {
  const r = nuevaRonda(["a", "b", "c", "d", "e", "f"]);
  responderRonda(r, "a", false);
  assert.deepEqual(r.cola, ["a", "b", "c", "d", "e", "a", "f"]);
  responderRonda(r, "b", true); responderRonda(r, "c", true); responderRonda(r, "d", true); responderRonda(r, "e", true);
  responderRonda(r, "a", false); assert.equal(r.cola.filter((x) => x === "a").length, 3);
  assert.equal(r.primera.a, false); assert.equal(r.primera.b, true);
});
