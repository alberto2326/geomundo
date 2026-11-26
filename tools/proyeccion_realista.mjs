// Proyección: cuándo se llega a N aprendidos jugando S sesiones al día con el progreso real.
// Uso: node tools/proyeccion.mjs PROGRESO.json SESIONES_DIA "AAAA-MM-DDTHH:MM:SSZ"
import fs from "node:fs";
import { crearApp } from "../js/logica.js";
import { almacenMemoria } from "../js/almacen.js";
const catalogo = JSON.parse(fs.readFileSync("../data/catalogo.json", "utf8")), config = JSON.parse(fs.readFileSync("../data/config.json", "utf8"));
const indice = JSON.parse(fs.readFileSync("../img/indice.json", "utf8")).items;
let ahora = new Date(process.argv[4]);
const app = await crearApp({ catalogo, almacen: almacenMemoria(), config, imagenes: indice, ahora: () => ahora });
const a = await app.analizarImportacion(fs.readFileSync(process.argv[2], "utf8")); await app.aplicarImportacion(a.datos);
const S = Number(process.argv[3]); let r = 7; const rnd = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
const metas = [100, 250, 500, 750, 1000], hechas = {}; let ok = 0, tot = 0;
for (let d = 0; d < 1100; d++) {
  for (let s = 0; s < S; s++) {
    const { sesion } = await app.sesionActual(); if (!sesion) break;
    for (const q of sesion.preguntas) {
      const it = app.P.get(q.id), rec = app.estado().items[q.id];
      // Modelo calibrado con tu historial: primer intento según tipo y nivel; repasos más difíciles cuanto más difícil el sitio
      const PRI = { bandera: [1, .87, .82, .6, .45], pais: [.8, .32, .24, .2], fisico: [.46, .35, .28, .22], espana: [.92, .75, .6], estado: [.15], ciudad: [.42] };
      const p1 = (PRI[it.tipo] ?? [.5])[Math.min(it.nivel, (PRI[it.tipo] ?? [.5]).length) - 1];
      const base = p1 > .6 ? .8 : p1 > .3 ? .64 : .5;
      const p = !rec ? p1 : Math.min(0.96, base + 0.07 * (rec.reps ?? 0)); const bien = rnd() < p; ok += bien; tot++;
      await app.responder(q.n, bien ? (it.capitales ? `${it.nombre}, ${it.capitales[0].nombre}` : it.nombre) : "no lo sé");
    }
  }
  const e = app.estadisticas();
  for (const m of metas) if (!hechas[m] && e.aprendidos >= m) { hechas[m] = app.hoy(); console.log(S, m, hechas[m], Math.round(100 * ok / tot) + "%"); }
  if (hechas[1000]) break;
  ahora = new Date(ahora.getTime() + 86400000);
}
console.log(JSON.stringify({ sesionesDia: S, acierto: Math.round(100 * ok / tot), ...hechas }));
