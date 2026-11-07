// Pruebas de aceptación (§9 y §14 del manual) que no necesitan navegador. Ejecutar:  node --test tests/
// La semilla real (state.json) no está en el repositorio: se pasa con GEOMUNDO_STATE=/ruta/state.json; sin ella esas pruebas se saltan.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { crearMotor } from "../js/comparar.js";
import { crearSRS, sm2, estadoNuevo } from "../js/srs.js";
import { crearApp, VERSION_FORMATO } from "../js/logica.js";
import { almacenMemoria } from "../js/almacen.js";

const catalogo = JSON.parse(fs.readFileSync(new URL("../data/catalogo.json", import.meta.url), "utf8"));
const cuarentena = JSON.parse(fs.readFileSync(new URL("../data/cuarentena.json", import.meta.url), "utf8")).ids;
const motor = crearMotor(catalogo.items), srs = crearSRS(catalogo.items, motor);
const STATE = process.env.GEOMUNDO_STATE;
const semilla = STATE ? fs.readFileSync(STATE, "utf8") : null;
const conSemilla = { skip: !semilla && "sin GEOMUNDO_STATE" };
const reloj = (iso) => () => new Date(iso);

test("§9.2 catálogo: 1332 ids únicos, 195/200/566/371", () => {
  const ids = new Set(catalogo.items.map((i) => i.id));
  assert.equal(ids.size, 1332);
  const n = (t) => catalogo.items.filter((i) => i.tipo === t).length;
  assert.deepEqual([n("pais"), n("bandera"), n("fisico"), n("espana")], [195, 200, 566, 371]);
});

test("§9.4 dictado", () => {
  const c = (id, r) => motor.comparar(motor.porId.get(id), r);
  assert.equal(c("pc-ke", "Quenia, Nairobi")[0], "ok");
  const [r1, i1] = c("pc-ke", "Kenia"); assert.equal(r1, "parcial"); assert.equal(i1.partes.pais, "ok");
  assert.equal(c("pc-ke", "Kenia, Mombasa")[0], "parcial");
  assert.equal(c("pc-ne", "Nigeria")[0], "mal");
  assert.equal(c("pc-cg", "Congo")[0], "casi");
  assert.equal(c("pc-bo", "Bolivia, La Paz")[0], "ok");
  assert.equal(c("pc-bo", "Bolivia, Sucre")[0], "ok");
  assert.equal(c("fi-rio-nilo-azul", "Nilo")[0], "mal");
  assert.equal(c("pc-ke", "ni idea")[0], "vacia");
  assert.equal(c("pc-tz", "Tanzania, Dodoma")[0], "ok");
  assert.equal(c("pc-tz", "Tanzania, Dar es Salaam")[0], "parcial");
});

test("§9.3 SM-2", () => {
  const r = sm2({ ef: 2.5, reps: 0, intervalo: 0 }, true, "2026-11-07", true);
  assert.equal(r.intervalo, 4); assert.equal(r.vence, "2026-11-11");
  sm2(r, false, "2026-11-11", false); assert.equal(r.intervalo, 1); assert.equal(r.ef, 2.4); assert.equal(r.lapsos, 1);
  sm2(r, true, "2026-11-12", false); assert.equal(r.intervalo, 2);
  sm2(r, true, "2026-11-14", false); assert.equal(r.intervalo, 6);
  sm2(r, true, "2026-11-20", false); assert.equal(r.intervalo, Math.round(6 * 2.45));
});

test("§9.5 sesión: 10 preguntas, mezcla 4/2/3/1, sin tipos seguidos, sin cuarentena", () => {
  const st = estadoNuevo();
  for (let k = 0; k < 20; k++) {
    const ses = srs.crearSesion(st, "2026-11-07", k + 1, new Set(cuarentena));
    assert.equal(ses.preguntas.length, 10);
    const n = (t) => ses.preguntas.filter((q) => q.tipo === t).length;
    assert.deepEqual([n("pais"), n("bandera"), n("fisico"), n("espana")], [4, 2, 3, 1]);
    for (let j = 0; j + 1 < 10; j++) assert.notEqual(ses.preguntas[j].tipo, ses.preguntas[j + 1].tipo);
    for (const q of ses.preguntas) assert.ok(!cuarentena.includes(q.id));
  }
});

test("§9.1 / §14.9 importar state.json → 107 vistos, 5 consolidados, 76 %", conSemilla, async () => {
  const app = await crearApp({ catalogo, almacen: almacenMemoria(), cuarentena, ahora: reloj("2026-11-07T10:00:00Z") });
  const a = await app.analizarImportacion(semilla);
  assert.ok(a.ok, a.errores.join());
  await app.aplicarImportacion(a.datos);
  const e = app.estadisticas();
  assert.equal(e.vistos, 107); assert.equal(e.consolidados, 5); assert.equal(e.acierto_total, 76); assert.equal(e.repasos_pendientes_hoy, 80);
  assert.deepEqual([e.por_tipo.pais.vistos, e.por_tipo.bandera.vistos, e.por_tipo.fisico.vistos, e.por_tipo.espana.vistos], [40, 24, 31, 12]);
});

test("§9.12 los vencidos salen primero como repaso", conSemilla, async () => {
  const app = await crearApp({ catalogo, almacen: almacenMemoria(), cuarentena, ahora: reloj("2026-11-08T07:00:00Z") });
  const a = await app.analizarImportacion(semilla); await app.aplicarImportacion(a.datos);
  const { sesion } = await app.sesionActual();
  assert.ok(sesion.preguntas.filter((q) => q.modo === "repaso").length >= 6);
  assert.equal(sesion.sesion, "ses-0076");
});

async function appConSesion(almacen = almacenMemoria(), cuando = "2026-11-08T08:00:00Z") {
  const app = await crearApp({ catalogo, almacen, cuarentena, ahora: reloj(cuando) });
  if (semilla) { const a = await app.analizarImportacion(semilla); await app.aplicarImportacion(a.datos); } else await app.empezarDeCero();
  await app.sesionActual();
  return app;
}
const resp = (app, n) => { const it = app.P.get(app.sesion().preguntas[n - 1].id); return it.tipo === "pais" ? `${it.nombre}, ${it.capitales[0].nombre}` : it.nombre; };

test("§9.8 / §14.1 pedir sesión dos veces sin terminar → la misma; reabrir → sigue en 4/10", async () => {
  const alm = almacenMemoria();
  let app = await appConSesion(alm);
  const id = app.sesion().sesion;
  for (const n of [1, 2, 3]) await app.responder(n, resp(app, n));
  assert.equal((await app.sesionActual()).sesion.sesion, id);
  app = await crearApp({ catalogo, almacen: alm, cuarentena, ahora: reloj("2026-11-08T09:00:00Z") }); // «cerrar y volver a abrir»
  assert.equal(app.preguntaPendiente().n, 4);
  assert.equal((await app.sesionActual()).sesion.sesion, id);
});

test("§9.9 / §14.10 corregir dos veces cuenta una; reevaluar restaura «antes»", async () => {
  const app = await appConSesion();
  const q = app.sesion().preguntas[0], antes = structuredClone(app.estado().items[q.id] ?? null);
  await app.responder(1, "ni idea");
  const vistas = app.estado().items[q.id].vistas;
  assert.equal((await app.responder(1, "otra cosa")).estado, "ya_corregida");
  assert.equal(app.estado().items[q.id].vistas, vistas);
  await app.responder(1, resp(app, 1), { reevaluar: true });
  const ahora = app.estado().items[q.id];
  assert.equal(ahora.vistas, (antes?.vistas ?? 0) + 1);
  assert.equal(app.sesion().preguntas[0].resultado, "correcta");
  await app.responder(1, "no lo sé", { reevaluar: true }); // reevaluar no regala aciertos
  assert.equal(app.sesion().preguntas[0].resultado, "vacia");
  assert.equal(app.estado().items[q.id].vistas, (antes?.vistas ?? 0) + 1);
});

test("§14.2 / §14.3 / §14.11 exportar, borrar, importar → idéntico y reanuda sin duplicar", async () => {
  const app = await appConSesion();
  for (const n of [1, 2, 3]) await app.responder(n, resp(app, n));
  const ex = await app.exportar();
  for (const k of ["formato", "version_formato", "estado", "historial_eventos", "estadisticas", "preferencias", "sesion_en_curso", "checksum"]) assert.ok(k in ex.objeto, k);
  assert.equal(ex.objeto.sesion_en_curso.indice_pendiente, 4);
  const b = await crearApp({ catalogo, almacen: almacenMemoria(), cuarentena, ahora: reloj("2026-11-08T10:00:00Z") }); // otro dispositivo / datos borrados
  const a = await b.analizarImportacion(ex.texto);
  assert.ok(a.ok, a.errores.join());
  assert.equal(a.vista_previa.actual, null);
  await b.aplicarImportacion(a.datos);
  assert.deepEqual(b.estado(), app.estado());
  assert.deepEqual(b.estadisticas(), app.estadisticas());
  assert.equal(b.preguntaPendiente().n, 4);
  assert.equal((await b.responder(2, "lo que sea")).estado, "ya_corregida");
});

test("§14.4 importar sobre datos distintos → copia previa y deshacer", async () => {
  const app = await appConSesion();
  await app.responder(1, resp(app, 1));
  const antes = structuredClone(app.estado());
  const otra = await crearApp({ catalogo, almacen: almacenMemoria(), cuarentena, ahora: reloj("2026-11-08T10:00:00Z") });
  await otra.empezarDeCero();
  const a = await app.analizarImportacion((await otra.exportar()).texto);
  const { copia } = await app.aplicarImportacion(a.datos);
  assert.ok(copia);
  assert.equal(Object.keys(app.estado().items).length, 0);
  assert.ok((await app.deshacerImportacion()).ok);
  assert.deepEqual(app.estado(), antes);
});

test("§14.5 JSON corrupto o truncado → rechazado, sin cambios", async () => {
  const app = await appConSesion();
  const antes = structuredClone(app.estado());
  const t = (await app.exportar()).texto;
  assert.equal((await app.analizarImportacion(t.slice(0, t.length / 2))).ok, false);
  const m = JSON.parse(t); m.estado.dias_activos.push("2026-11-09");
  assert.equal((await app.analizarImportacion(JSON.stringify(m))).ok, false); // suma de control
  const m2 = JSON.parse(t); delete m2.checksum; m2.estado.items["pc-es"] = { ef: 9, reps: 1, intervalo: 4 };
  assert.equal((await app.analizarImportacion(JSON.stringify(m2))).ok, false); // valores fuera de rango
  assert.deepEqual(app.estado(), antes);
});

test("§14.6 versión futura → rechazada con mensaje claro", async () => {
  const app = await appConSesion();
  const m = JSON.parse((await app.exportar()).texto); m.version_formato = VERSION_FORMATO + 1; delete m.checksum;
  const a = await app.analizarImportacion(JSON.stringify(m));
  assert.equal(a.ok, false); assert.match(a.errores[0], /versión más nueva/);
});

test("§14.7 id desconocido → aviso y se conserva aparte", async () => {
  const app = await appConSesion();
  const m = JSON.parse((await app.exportar()).texto); delete m.checksum;
  m.estado.items["fi-xyz-inventado"] = { ef: 2.5, reps: 1, intervalo: 4, vence: "2026-11-12", ultimo: "2026-11-08", vistas: 1, aciertos: 1, historial: [["2026-11-08", 1]] };
  const a = await app.analizarImportacion(JSON.stringify(m));
  assert.ok(a.ok); assert.ok(a.avisos.some((x) => /no existen en el catálogo/.test(x)));
  await app.aplicarImportacion(a.datos);
  assert.ok((await app.exportar()).objeto.desconocidos.items["fi-xyz-inventado"]);
});

test("§14.8 cancelar en la vista previa → no cambia nada", async () => {
  const app = await appConSesion();
  const antes = structuredClone(app.datos);
  const otra = await crearApp({ catalogo, almacen: almacenMemoria(), cuarentena }); await otra.empezarDeCero();
  await app.analizarImportacion((await otra.exportar()).texto); // analizar sin aplicar = cancelar
  assert.deepEqual(app.datos, antes);
});

test("escritura atómica: si falla a mitad, no cambia nada", async () => {
  const alm = almacenMemoria(); const app = await appConSesion(alm);
  const antes = await alm.leer();
  alm.fallarEn = "eventos";
  await assert.rejects(app.responder(1, resp(app, 1)));
  alm.fallarEn = null;
  assert.deepEqual(await alm.leer(), antes);
});

test("beta: solo países y capitales (10 por sesión) y estadísticas solo de países", conSemilla, async () => {
  const config = JSON.parse(fs.readFileSync(new URL("../data/config.json", import.meta.url), "utf8"));
  const indice = JSON.parse(fs.readFileSync(new URL("../img/indice.json", import.meta.url), "utf8")).items;
  const app = await crearApp({ catalogo, almacen: almacenMemoria(), cuarentena, imagenes: indice, config, ahora: reloj("2026-11-08T07:00:00Z") });
  const a = await app.analizarImportacion(semilla); await app.aplicarImportacion(a.datos);
  const e = app.estadisticas();
  assert.equal(e.total, 195); assert.equal(e.vistos, 40); assert.equal(e.por_tipo.pais.acierto, 83);
  assert.deepEqual(Object.keys(e.por_tipo), ["pais"]);
  for (let k = 0; k < 5; k++) {
    const { sesion } = await app.sesionActual();
    assert.equal(sesion.preguntas.length, 10);
    for (const q of sesion.preguntas) { assert.equal(q.tipo, "pais"); assert.ok(indice[q.id]?.q && indice[q.id]?.c); }
    for (const q of sesion.preguntas) await app.responder(q.n, "no sé");
  }
  assert.ok(Object.keys(app.estado().items).some((i) => i.startsWith("fi-"))); // el progreso de lo demás se conserva
  const m = app.medallas().medallas;
  assert.ok(m["fi-mar"].oculta && m["es-todo"].oculta && !m["pc-europa"].oculta && !m["cu-sovietico"].oculta);
});
