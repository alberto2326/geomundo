// Repetición espaciada, niveles, selección de sesiones, corrección y estadísticas (nucleo.py, cola.py, corregir.py, progreso.py).
import { sumarDias, difDias, pyRound, round3, crearAzar, clonar } from "./util.js";
import { respuestaTexto, capitalesTexto } from "./comparar.js";

export const C = {
  SESION_N: 10, MEZCLA: { pais: 4, bandera: 2, fisico: 3, espana: 1 }, INTERVALO_MAX: 120, APRENDIDA_DIAS: 21, CONSOLIDADA_REPS: 2,
  UMBRAL_NIVEL: 0.7, TOPE_UMBRAL: { pais: 24, bandera: null, fisico: 30, espana: 40, estado: null, ciudad: null }, POOL_MAX: { pais: 40, bandera: 25, fisico: 45, espana: 25, estado: 20, ciudad: 15 },
  RELLENO_PREF: ["fisico", "pais", "espana", "bandera", "estado", "ciudad"], TIPOS: ["pais", "bandera", "fisico", "espana", "estado", "ciudad"],
};
export const NOMBRE_TIPO = { pais: "País y capital", bandera: "Bandera", fisico: "Geografía física", espana: "España", estado: "Estado de EE. UU.", ciudad: "Ciudad del mundo" };

export const estadoNuevo = () => ({ version: 1, creado: null, items: {}, dias_activos: [] });

export function sm2(rec, ok, fecha, primera) {
  let ef = rec.ef ?? 2.5, reps = rec.reps ?? 0, inter = rec.intervalo ?? 0;
  if (ok) {
    reps += 1;
    if (reps === 1) inter = primera ? 4 : 2;
    else if (reps === 2) inter = 6;
    else inter = Math.max(inter + 1, pyRound(inter * ef));
    ef = Math.min(2.8, primera || reps >= 3 ? ef + 0.1 : ef + 0.05);
    inter = Math.min(inter, C.INTERVALO_MAX);
  } else {
    reps = 0; inter = 1; ef = Math.max(1.3, ef - 0.2);
    rec.fallos = (rec.fallos ?? 0) + 1;
    rec.lapsos = (rec.lapsos ?? 0) + (primera ? 0 : 1);
  }
  Object.assign(rec, { ef: round3(ef), reps, intervalo: inter, vence: sumarDias(fecha, inter), ultimo: fecha });
  rec.vistas = (rec.vistas ?? 0) + 1;
  if (ok) rec.aciertos = (rec.aciertos ?? 0) + 1;
  (rec.historial ??= []).push([fecha, ok ? 1 : 0]);
  return rec;
}

const cmpOrden = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) { const x = a[i] ?? -Infinity, y = b[i] ?? -Infinity; if (x !== y) return x < y ? -1 : 1; } return 0; };

export function crearSRS(items, motor) {
  const P = motor.porId;
  const porTipo = Object.fromEntries(C.TIPOS.map((t) => [t, items.filter((i) => i.tipo === t)]));
  const ordenados = Object.fromEntries(C.TIPOS.map((t) => [t, [...porTipo[t]].sort((a, b) => a.nivel - b.nivel || Number(!!a.extra) - Number(!!b.extra) || cmpOrden(a.orden, b.orden))]));
  const claveDup = (it) => {
    let n = motor.norm(it.nombre.replace(/\(.*?\)/g, ""));
    for (const p of ["comunidad de ", "provincia de ", "isla de ", "mar ", "rio "]) if (n.startsWith(p)) n = n.slice(p.length);
    return n;
  };

  function enAprendizaje(st, tipo) {
    let n = 0; for (const [i, r] of Object.entries(st.items)) if (P.has(i) && P.get(i).tipo === tipo && (r.reps ?? 0) < C.CONSOLIDADA_REPS) n++; return n;
  }
  function nivelAbierto(st, tipo, nivel) {
    if (nivel <= 1) return true;
    const prev = porTipo[tipo].filter((i) => i.nivel < nivel && !i.extra);
    const ok = prev.filter((i) => (st.items[i.id]?.reps ?? 0) >= 1).length;
    let need = C.UMBRAL_NIVEL * prev.length;
    if (C.TOPE_UMBRAL[tipo]) need = Math.min(need, C.TOPE_UMBRAL[tipo]);
    return ok >= need;
  }
  function nuevasPermitidas(st, tipo) {
    const cupo = C.POOL_MAX[tipo] - enAprendizaje(st, tipo);
    if (cupo <= 0) return [[], 0];
    const cand = [], abiertos = new Map();
    for (const it of ordenados[tipo]) {
      if (it.id in st.items) continue;
      if (!abiertos.has(it.nivel)) abiertos.set(it.nivel, nivelAbierto(st, tipo, it.nivel));
      if (!abiertos.get(it.nivel)) break;
      cand.push(it);
    }
    return [cand, cupo];
  }
  function elegirNuevos(T, cand, n, st, rng, claves, subsSesion) {
    const out = []; let pool = [...cand];
    while (out.length < n && pool.length) {
      const nivel = Math.min(...pool.map((x) => x.nivel)), c = pool.filter((x) => x.nivel === nivel);
      let it;
      if (T === "fisico" || T === "espana") {
        const porSub = new Map();
        for (const x of c) { if (!porSub.has(x.subtipo)) porSub.set(x.subtipo, []); porSub.get(x.subtipo).push(x); }
        let libres = [...porSub.keys()].filter((s) => !subsSesion.has(s));
        if (!libres.length) libres = [...porSub.keys()];
        const s = rng.choices(libres, libres.map((x) => porSub.get(x).length));
        const lst = [...porSub.get(s)].sort((a, b) => cmpOrden(a.orden, b.orden));
        it = rng.choice(lst.slice(0, 3)); subsSesion.add(s);
      } else {
        const lst = [...c].sort((a, b) => Number(!!a.extra) - Number(!!b.extra) || cmpOrden(a.orden, b.orden));
        it = rng.choice(lst.slice(0, T === "pais" ? 6 : 4));
      }
      out.push(it); claves.add(claveDup(it));
      pool = pool.filter((x) => x.id !== it.id && !claves.has(claveDup(x)));
    }
    return out;
  }
  function ordenar(sel, rng) {
    let mejor = null;
    for (let k = 0; k < 400; k++) {
      const x = rng.shuffle([...sel]);
      let pen = 0;
      for (let j = 0; j + 1 < x.length; j++) { if (x[j][0].tipo === x[j + 1][0].tipo) pen += 1000; if (x[j][0].subtipo === x[j + 1][0].subtipo) pen += 10; }
      if (mejor === null || pen < mejor[0]) mejor = [pen, x];
      if (pen === 0) break;
    }
    return mejor[1];
  }

  /** Elige SESION_N ítems [[item, modo]] o null. `excluir`: ids que no deben salir (cuarentena, sin imagen). */
  function seleccionar(st, hoy, semilla, excluir = new Set(), mezcla = C.MEZCLA) {
    const rng = crearAzar(semilla), reg = st.items;
    const usados = new Set(), claves = new Set(), subs = Object.fromEntries(C.TIPOS.map((t) => [t, new Set()]));
    let sel = [];
    const vale = (i) => P.has(i) && !excluir.has(i);
    function datos(T) {
      const venc = [], fut = [];
      for (const [i, r] of Object.entries(reg)) {
        if (!vale(i) || P.get(i).tipo !== T || r.reservado) continue;
        const v = r.vence ?? "9999";
        if (v <= hoy) venc.push([v, r.ef ?? 2.5, i]); else fut.push([r.ultimo === hoy ? 1 : 0, v, r.ef ?? 2.5, i]);
      }
      const cmp = (a, b) => { for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1; return 0; };
      return [venc.sort(cmp).map((x) => x[2]), fut.sort(cmp).map((x) => x[3])];
    }
    function tomar(T, k) {
      const [venc, fut] = datos(T);
      let [cand, cupo] = nuevasPermitidas(st, T);
      cand = cand.filter((c) => !usados.has(c.id) && !claves.has(claveDup(c)) && !excluir.has(c.id));
      const got = [];
      const add = (it, modo) => { got.push([it, modo]); usados.add(it.id); claves.add(claveDup(it)); subs[T].add(it.subtipo); };
      const maxRev = !cand.length ? k : venc.length <= 3 * k ? Math.ceil(0.6 * k) : Math.max(k - 1, 1);
      for (const i of venc) {
        if (got.filter((g) => g[1] === "repaso").length >= maxRev || got.length >= k) break;
        if (usados.has(i) || claves.has(claveDup(P.get(i)))) continue;
        add(P.get(i), "repaso");
      }
      const nn = Math.min(k - got.length, cupo);
      if (nn > 0) for (const it of elegirNuevos(T, cand, nn, st, rng, claves, subs[T])) { got.push([it, "nuevo"]); usados.add(it.id); }
      for (const i of venc) {
        if (got.length >= k) break;
        if (usados.has(i) || claves.has(claveDup(P.get(i)))) continue;
        add(P.get(i), "repaso");
      }
      for (const i of fut) {
        if (got.length >= k) break;
        if (usados.has(i) || claves.has(claveDup(P.get(i)))) continue;
        add(P.get(i), "practica");
      }
      return got;
    }
    for (const T of C.TIPOS) sel = sel.concat(tomar(T, mezcla[T] ?? 0));
    let guard = 0;
    while (sel.length < C.SESION_N && guard < 20) {
      guard++;
      for (const T of C.RELLENO_PREF) { if (sel.length >= C.SESION_N) break; sel = sel.concat(tomar(T, C.SESION_N - sel.length)); }
    }
    if (sel.length < C.SESION_N) return null;
    return ordenar(sel.slice(0, C.SESION_N), rng);
  }

  function crearSesion(st, hoy, numero, excluir, mezcla) {
    const el = seleccionar(st, hoy, `${hoy}-${numero}`, excluir, mezcla);
    if (!el) return null;
    return {
      sesion: `ses-${String(numero).padStart(4, "0")}`, fecha: hoy, creada_en: new Date().toISOString(),
      preguntas: el.map(([it, modo], j) => ({ n: j + 1, id: it.id, tipo: it.tipo, modo, nivel: it.nivel, corregida: false })),
    };
  }

  /** Corrige la pregunta n. Devuelve {estado, evento, retro}. Muta st y ses. Nunca puntúa dos veces salvo reevaluar. */
  function corregir(st, ses, n, resp, fecha, { reevaluar = false } = {}) {
    const q = ses.preguntas.find((x) => x.n === n);
    if (!q) throw new Error(`No existe la pregunta ${n}`);
    const it = P.get(q.id);
    if (q.corregida && !reevaluar) return { estado: "ya_corregida", q, it };
    if (q.corregida && reevaluar) { if (q.antes === null) delete st.items[q.id]; else st.items[q.id] = clonar(q.antes); }
    const [r, info] = motor.comparar(it, resp);
    const ok = r === "ok", primera = !(q.id in st.items);
    const antes = primera ? null : clonar(st.items[q.id]);
    const rec = (st.items[q.id] ??= { ef: 2.5, reps: 0, intervalo: 0 });
    if (q.modo === "practica" && ok && !primera) {
      rec.vistas = (rec.vistas ?? 0) + 1; rec.aciertos = (rec.aciertos ?? 0) + 1; rec.ultimo = fecha; (rec.historial ??= []).push([fecha, 1]);
    } else sm2(rec, ok, fecha, primera);
    const resultado = { ok: "correcta", casi: "casi", parcial: "parcial", vacia: "vacia" }[r] ?? "incorrecta";
    const reevaluada = !!q.corregida;
    Object.assign(q, { corregida: true, antes, respuesta: resp, resultado, proxima_revision: rec.vence });
    if (it.capitales) q.partes = info.partes;
    if (!st.creado) st.creado = fecha;
    if (!st.dias_activos.includes(fecha)) { st.dias_activos.push(fecha); st.dias_activos.sort(); }
    const evento = { sesion: ses.sesion, n, id: q.id, modo: q.modo, respuesta: resp, resultado, partes: q.partes ?? null, fecha, reevaluada };
    const retro = retroalimentacion(it, q, info, fecha);
    q.detalle = { lineas: retro.lineas, interpretada: retro.interpretada, nota: retro.nota, fecha };
    return { estado: "corregida", q, it, info, evento, retro };
  }

  function retroalimentacion(it, q, info, fecha) {
    const lineas = [];
    if (it.capitales) {
      const p = info.partes || {}, caps = capitalesTexto(it), E = it.tipo === "estado" ? "Estado" : "País";
      if (p.pais === "ok") lineas.push(`${E} ✅ (${it.nombre})`);
      else if (p.pais == null) lineas.push(`${E} ❌ (no lo dijiste; era ${it.nombre})`);
      else if (p.pais === "casi") lineas.push(`${E} 🟡 («${info.tu_pais}» es ambiguo; era ${it.nombre})`);
      else lineas.push(`${E} ❌ (${info.interpretada_pais ? "dijiste " + info.interpretada_pais : "dijiste «" + (info.tu_pais ?? "") + "»"}; era ${it.nombre})`);
      if (p.capital === "ok") lineas.push(`Capital ✅ (${caps})`);
      else if (p.capital == null) lineas.push(`Capital ❌ (no la dijiste; era ${caps})`);
      else if (p.capital === "casi") lineas.push(`Capital 🟡 (muy parecido pero no seguro; era ${caps})`);
      else lineas.push(`Capital ❌ (${info.tu_capital ? "«" + info.tu_capital + "»" : "lo que dijiste"}${info.interpretada_capital ? " es capital de " + info.interpretada_capital : " no es la capital"}; era ${caps})`);
    }
    return {
      resultado: q.resultado, correcta: respuestaTexto(it), dato: it.dato, lineas,
      interpretada: !it.capitales && q.resultado !== "correcta" ? info.interpretada_nombre ?? null : null,
      nota: info.nota ?? null, proxima: q.proxima_revision, dias: Math.max(0, difDias(q.proxima_revision, fecha)),
    };
  }

  function estadisticas(st, hoy, tipos = C.TIPOS) {
    const reg = Object.fromEntries(Object.entries(st.items).filter(([i, r]) => P.has(i) && !r.reservado && tipos.includes(P.get(i).tipo)));
    const R = Object.values(reg);
    const dias = [...new Set(st.dias_activos)].sort();
    let racha = 0;
    if (dias.length) {
      const d = dias[dias.length - 1];
      if (difDias(hoy, d) <= 1) { const s = new Set(dias); let cur = d; while (s.has(cur)) { racha++; cur = sumarDias(cur, -1); } }
    }
    const hist = Object.entries(reg).flatMap(([i, r]) => (r.historial ?? []).map(([f, ok]) => [f, ok, i]));
    const sem = hist.filter((h) => difDias(hoy, h[0]) < 7);
    const pct = (l) => (l.length ? pyRound((100 * l.reduce((a, h) => a + h[1], 0)) / l.length) : null);
    const por_tipo = {};
    for (const T of tipos) {
      const its = porTipo[T], niveles = {};
      for (const n of [...new Set(its.map((i) => i.nivel))].sort((a, b) => a - b)) {
        const L = its.filter((i) => i.nivel === n);
        niveles[n] = { total: L.length, vistos: L.filter((i) => reg[i.id]).length, consolidados: L.filter((i) => (reg[i.id]?.reps ?? 0) >= C.CONSOLIDADA_REPS).length, abierto: nivelAbierto(st, T, n) };
      }
      const h = hist.filter((x) => P.get(x[2]).tipo === T);
      por_tipo[T] = {
        total: its.length, vistos: its.filter((i) => reg[i.id]).length,
        consolidados: its.filter((i) => (reg[i.id]?.reps ?? 0) >= C.CONSOLIDADA_REPS).length,
        aprendidos: its.filter((i) => (reg[i.id]?.intervalo ?? 0) >= C.APRENDIDA_DIAS).length, acierto: pct(h), niveles,
      };
    }
    const deb = Object.entries(reg).filter(([, r]) => (r.fallos ?? 0) > 0).map(([i, r]) => [r.fallos, i])
      .sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? 1 : a[1] > b[1] ? -1 : 0)).slice(0, 6);
    return {
      fecha: hoy, total: tipos.reduce((a, T) => a + porTipo[T].length, 0), vistos: R.length,
      consolidados: R.filter((r) => (r.reps ?? 0) >= C.CONSOLIDADA_REPS).length, aprendidos: R.filter((r) => (r.intervalo ?? 0) >= C.APRENDIDA_DIAS).length,
      repasos_pendientes_hoy: R.filter((r) => (r.vence ?? "9999") <= hoy).length, racha_dias: racha, acierto_7_dias: pct(sem), acierto_total: pct(hist),
      intentos: hist.length, por_tipo, puntos_debiles: deb.map(([f, i]) => ({ id: i, nombre: P.get(i).nombre, tipo: P.get(i).tipo, fallos: f })),
    };
  }

  return { seleccionar, crearSesion, corregir, estadisticas, nivelAbierto, nuevasPermitidas, retroalimentacion };
}
