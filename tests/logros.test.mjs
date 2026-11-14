import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { rachas, evaluar, actualizar, MEDALLAS, CONTINENTE } from "../js/logros.js";
import { crearApp } from "../js/logica.js";
import { almacenMemoria } from "../js/almacen.js";

const catalogo = JSON.parse(fs.readFileSync(new URL("../data/catalogo.json", import.meta.url), "utf8"));
const items = catalogo.items;

test("rachas: actual, máxima y día perdido", () => {
  assert.deepEqual(rachas(["2026-11-03", "2026-11-04", "2026-11-05"], "2026-11-06"), { actual: 3, max: 3, hoyHecho: false });
  assert.equal(rachas(["2026-11-03", "2026-11-04", "2026-11-05"], "2026-11-07").actual, 0);
  assert.equal(rachas(["2026-11-01", "2026-11-02", "2026-11-04"], "2026-11-04").max, 2);
});

test("todos los países y banderas tienen continente; ids de medalla únicos", () => {
  for (const it of items) if (it.iso) assert.ok(CONTINENTE[it.iso], it.id);
  assert.equal(new Set(MEDALLAS.map((m) => m.id)).size, MEDALLAS.length);
});

test("medalla de grupo: bronce, plata, oro y no se pierde al fallar", () => {
  const oceanos = items.filter((i) => i.subtipo === "oceano").map((i) => i.id);
  const st = { items: {}, dias_activos: [] };
  for (const id of oceanos) st.items[id] = { ef: 2.6, reps: 1, intervalo: 4 };
  assert.equal(evaluar({ items, estado: st, hoy: "2026-11-07" }).medallas["fi-oceano"].nivel, null); // acertados, pero aún no aprendidos
  for (const id of oceanos) st.items[id] = { ef: 2.6, reps: 3, intervalo: 22 };
  let e = evaluar({ items, estado: st, hoy: "2026-11-07" });
  assert.equal(e.medallas["fi-oceano"].nivel, "bronce");
  let { ganadas, nuevas } = actualizar({}, e, "2026-11-07");
  assert.ok(nuevas.some((n) => n.id === "fi-oceano"));
  for (const id of oceanos) st.items[id] = { ef: 2.7, reps: 6, intervalo: 120 };
  ({ ganadas, nuevas } = actualizar(ganadas, evaluar({ items, estado: st, hoy: "2026-12-30" }), "2026-12-30"));
  assert.equal(ganadas["fi-oceano"].nivel, "oro");
  st.items[oceanos[0]] = { ef: 2.5, reps: 0, intervalo: 1 }; // un fallo
  ({ ganadas, nuevas } = actualizar(ganadas, evaluar({ items, estado: st, hoy: "2026-12-31" }), "2026-12-31"));
  assert.equal(ganadas["fi-oceano"].nivel, "oro"); assert.equal(nuevas.length, 0);
});

test("terminar una sesión da el primer sello; 10/10 da «Pleno»; se exporta e importa", async () => {
  const app = await crearApp({ catalogo, almacen: almacenMemoria(), ahora: () => new Date("2026-11-08T06:30:00Z") });
  await app.empezarDeCero(); await app.sesionActual();
  let nuevas = [];
  for (const q of app.sesion().preguntas) {
    const it = app.P.get(q.id);
    const r = await app.responder(q.n, it.tipo === "pais" ? `${it.nombre}, ${it.capitales[0].nombre}` : it.nombre);
    nuevas = nuevas.concat(r.nuevas.map((x) => x.id));
  }
  for (const id of ["h-primera", "h-pleno", "h-madrugador"]) assert.ok(nuevas.includes(id), id);
  const ex = await app.exportar();
  const b = await crearApp({ catalogo, almacen: almacenMemoria(), ahora: () => new Date("2026-11-08T10:00:00Z") });
  const a = await b.analizarImportacion(ex.texto); assert.ok(a.ok);
  await b.aplicarImportacion(a.datos);
  assert.deepEqual(b.ganadas(), app.ganadas());
});

test("medallas: Homo sovieticus 15; Unión 25, Confederación 11, Ruta 66 50; Cosmopolita 40; ninguna vacía", () => {
  const e = evaluar({ items, estado: { items: {}, dias_activos: [] }, hoy: "2026-11-07" });
  assert.equal(e.medallas["cu-sovietico"].total, 15);
  assert.equal(e.medallas["us-union"].total, 25);
  assert.equal(e.medallas["us-confederacion"].total, 11);
  assert.equal(e.medallas["us-todos"].total, 50);
  assert.equal(e.medallas["ci-todas"].total, 40);
  for (const m of MEDALLAS) if (m.grupo) assert.ok(!e.medallas[m.id].oculta, m.id);
});

test("estados de EE. UU.: Georgia el estado cuenta para la Confederación, Georgia el país no", () => {
  const fake = [...items.filter((i) => i.tipo !== "estado"), { id: "us-ga", tipo: "estado", subtipo: "estado_capital", nombre: "Georgia", alias: [] }, { id: "us-oh", tipo: "estado", subtipo: "estado_capital", nombre: "Ohio", alias: [] }];
  const e = evaluar({ items: fake, estado: { items: {}, dias_activos: [] }, hoy: "2026-11-07" });
  assert.equal(e.medallas["us-confederacion"].total, 1);
  assert.equal(e.medallas["us-union"].total, 1);
  assert.equal(e.medallas["us-todos"].total, 2);
});
