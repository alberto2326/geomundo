// Auditoría: simula 90 días de juego con el progreso real y comprueba las reglas del motor en cada sesión.
// Uso: node tools/auditoria.mjs MI-PROGRESO.json [sesiones_por_día]
import fs from "node:fs";
import { crearApp } from "../js/logica.js";
import { almacenMemoria } from "../js/almacen.js";
import { sumarDias, difDias } from "../js/util.js";
const catalogo = JSON.parse(fs.readFileSync("../data/catalogo.json", "utf8"));
const config = JSON.parse(fs.readFileSync("../data/config.json", "utf8"));
const indice = JSON.parse(fs.readFileSync("../img/indice.json", "utf8")).items;
let ahora = new Date("2026-11-20T08:00:00Z");
const app = await crearApp({ catalogo, almacen: almacenMemoria(), config, imagenes: indice, ahora: () => ahora });
const a = await app.analizarImportacion(fs.readFileSync(process.argv[2], "utf8")); await app.aplicarImportacion(a.datos);
let r = 11; const rnd = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
const P = app.P, F = {}; const fallo = (k, msg) => { (F[k] ??= []).push(msg); };
const M = { sesiones: 0, preguntas: 0, practicaConVencidos: 0, practica: 0, repaso: 0, nuevo: 0, tiposSeguidos: 0, maxAtraso: 0, sinSesion: 0 };
const sesPorDia = Number(process.argv[3] ?? 4);
for (let d = 0; d < 90; d++) {
  const hoy = app.hoy(); const vistosHoy = new Set();
  for (let s = 0; s < sesPorDia; s++) {
    const st0 = structuredClone(app.estado());
    const vencidosAntes = Object.entries(st0.items).filter(([i, x]) => P.has(i) && !app.excluidos().has(i) && x.vence <= hoy);
    const { sesion } = await app.sesionActual();
    if (!sesion) { M.sinSesion++; break; }
    M.sesiones++;
    const qs = sesion.preguntas;
    if (qs.length !== app.preguntasSesion()) fallo("tamaño", `${hoy} ${qs.length}`);
    if (new Set(qs.map((q) => q.id)).size !== qs.length) fallo("duplicado en sesión", hoy);
    for (let j = 0; j + 1 < qs.length; j++) if (qs[j].tipo === qs[j + 1].tipo) M.tiposSeguidos++;
    const nuevos = qs.filter((q) => q.modo === "nuevo").length;
    const aprendiendo = app.srs.enAprendizajeTotal(st0, app.tipos);
    if (nuevos > Math.max(0, config.max_aprendiendo - aprendiendo)) fallo("tope superado", `${hoy} ${aprendiendo}+${nuevos}`);
    for (const q of qs) {
      M[q.modo]++; M.preguntas++;
      if (vistosHoy.has(q.id)) fallo("repetido el mismo día", `${hoy} ${q.id}`);
      vistosHoy.add(q.id);
      const rec = st0.items[q.id];
      if (q.modo === "repaso" && !(rec && rec.vence <= hoy)) fallo("repaso no vencido", q.id);
      if (q.modo === "nuevo" && rec) fallo("nuevo ya visto", q.id);
      if (q.modo === "practica") {
        if (!rec || rec.vence <= hoy) fallo("práctica mal clasificada", q.id);
        // ¿quedaban repasos vencidos sin incluir en esta sesión?
        const fuera = vencidosAntes.filter(([i]) => !qs.some((x) => x.id === i)).length;
        if (fuera > 0) M.practicaConVencidos++;
      }
      if (!indice[q.id]?.q) fallo("sin imagen", q.id);
      if (rec && rec.vence < hoy) M.maxAtraso = Math.max(M.maxAtraso, difDias(hoy, rec.vence));
    }
    for (const q of qs) {
      const it = P.get(q.id), rec = app.estado().items[q.id];
      const p = !rec ? 0.55 : Math.min(0.95, 0.72 + 0.07 * (rec.reps ?? 0));
      const ok = rnd() < p;
      const antes = structuredClone(rec ?? null);
      const res = await app.responder(q.n, ok ? (it.capitales ? `${it.nombre}, ${it.capitales[0].nombre}` : it.nombre) : "no lo sé");
      if ((res.q.resultado === "correcta") !== ok) fallo("corrección inesperada", `${q.id} ${res.q.resultado}`);
      const des = app.estado().items[q.id];
      if (q.modo === "practica" && ok && antes && (des.vence !== antes.vence || des.reps !== antes.reps)) fallo("práctica acertada movió el calendario", q.id);
      if (!ok && des.vence !== sumarDias(hoy, 1)) fallo("fallo no vuelve mañana", q.id);
    }
  }
  ahora = new Date(ahora.getTime() + 86400000);
}
// Reevaluar: restaura «antes»
{ const { sesion } = await app.sesionActual(); const q = sesion.preguntas[0]; const antes = structuredClone(app.estado().items[q.id] ?? null);
  await app.responder(1, "no lo sé"); await app.responder(1, "no lo sé", { reevaluar: true });
  const d = app.estado().items[q.id]; if ((antes?.vistas ?? 0) + 1 !== d.vistas) fallo("reevaluar duplica", q.id); }
console.log(JSON.stringify(M));
console.log("práctica con repasos vencidos pendientes en otras partes:", Math.round(100 * M.practicaConVencidos / Math.max(1, M.practica)) + "% de la práctica");
for (const [k, v] of Object.entries(F)) console.log("FALLO", k, v.length, v.slice(0, 4).join(" | "));
if (!Object.keys(F).length) console.log("sin fallos de reglas");
const e = app.estadisticas(); console.log("tras 90 días:", e.vistos, "vistos,", e.aprendidos, "aprendidos,", e.repasos_pendientes_hoy, "pendientes");
