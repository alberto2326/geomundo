import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { opciones, rondaEntreno, nuevaRonda, responderRonda } from "../js/entreno.js";
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
test("entreno: primero lo que está a medio aprender (lo más rebelde antes), luego lo próximo nuevo en orden", async () => {
  const config = JSON.parse(fs.readFileSync(new URL("../data/config.json", import.meta.url), "utf8"));
  const app = await crearApp({ catalogo: { items }, almacen: almacenMemoria(), config, ahora: () => new Date("2026-11-26T09:00:00Z") });
  await app.empezarDeCero();
  // usuario nuevo: todo sale de lo próximo, en el orden de las sesiones
  const prox = app.proximosNuevos(); assert.ok(prox.length >= 10);
  const r0 = rondaEntreno({ estado: app.estado(), P, activos: app.tipos, excluir: app.excluidos(), proximos: prox, rng: crearAzar("a") });
  assert.equal(r0.length, 10); assert.deepEqual([...r0].sort(), [...prox.slice(0, 10)].sort());
  assert.ok(prox.slice(0, 10).some((i) => i.startsWith("pc-")) && prox.slice(0, 10).some((i) => i.startsWith("ba-"))); // intercalados
  // con 3 a medio aprender (uno rebelde) y uno asentado: entran los 3, el asentado no, y se completa con próximos
  const st = app.estado();
  st.items["pc-ne"] = { reps: 0, historial: [["d1", 0], ["d2", 0]] };
  st.items["pc-ml"] = { reps: 1, historial: [["d1", 0], ["d2", 1]] };
  st.items["pc-td"] = { reps: 0, historial: [["d1", 0]] };
  st.items["pc-fr"] = { reps: 4, historial: [["d1", 1], ["d2", 1]] };
  const r = rondaEntreno({ estado: st, P, activos: app.tipos, excluir: app.excluidos(), proximos: app.proximosNuevos(), rng: crearAzar("b") });
  assert.equal(r.length, 10); for (const i of ["pc-ne", "pc-ml", "pc-td"]) assert.ok(r.includes(i)); assert.ok(!r.includes("pc-fr"));
  // con más de 10 a medio aprender, salen primero los que más fallas
  const pais = items.filter((x) => x.tipo === "pais").slice(0, 30);
  for (const it of pais) st.items[it.id] ??= { reps: 1, historial: [["d1", 1]] };
  const r2 = rondaEntreno({ estado: st, P, activos: app.tipos, excluir: app.excluidos(), proximos: [], rng: crearAzar("c") });
  assert.ok(r2.includes("pc-ne") && r2.includes("pc-td"));
});
test("entreno: lo fallado vuelve al final (como mucho dos veces)", () => {
  const r = nuevaRonda(["a", "b"]);
  responderRonda(r, "a", false); responderRonda(r, "b", true);
  assert.deepEqual(r.cola, ["a", "b", "a"]);
  responderRonda(r, "a", false); responderRonda(r, "a", false); const f = responderRonda(r, "a", false);
  assert.equal(f.fin, true); assert.equal(r.primera.a, false); assert.equal(r.primera.b, true);
});
