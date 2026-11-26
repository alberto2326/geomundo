// Entrenamiento: preguntas de 4 opciones para lo que cuesta. No toca la repetición espaciada.
// Las opciones «trampa» son los sitios con los que más se confunde: vecinos y países de la misma zona.

const GRUPO = (zona) => (/África/.test(zona) || /norte de África|sur de África/.test(zona) ? "África"
  : /Europa|europa/.test(zona) ? "Europa" : /Asia|Asiático|Oriente/.test(zona) ? "Asia"
  : /América|Caribe|Sudamérica|Centroamérica|Norteamérica/.test(zona) ? "América" : "Oceanía");

const paisDe = (it) => (it.tipo === "pais" ? it.id : it.tipo === "bandera" ? "pc-" + it.iso : null);

/** Cuatro opciones (nombres) para un ítem, con la correcta incluida y barajadas. */
export function opciones(it, items, vecinos, P, rng) {
  const elegidas = [], usados = new Set([it.nombre]);
  const meter = (nombre) => { if (nombre && !usados.has(nombre) && elegidas.length < 3) { usados.add(nombre); elegidas.push(nombre); } };
  const pid = paisDe(it);
  if (pid && vecinos[pid]) {
    const v = vecinos[pid], nombre = (id) => P.get(id)?.nombre;
    for (const id of rng.shuffle([...v.vecinos])) meter(nombre(id));
    const misma = items.filter((x) => x.tipo === "pais" && x.id !== pid && vecinos[x.id]?.zona === v.zona);
    for (const x of rng.shuffle(misma)) meter(x.nombre);
    const grupo = GRUPO(v.zona), cerca = items.filter((x) => x.tipo === "pais" && x.id !== pid && vecinos[x.id] && GRUPO(vecinos[x.id].zona) === grupo);
    for (const x of rng.shuffle(cerca)) meter(x.nombre);
  } else {
    const mismo = items.filter((x) => x.tipo === it.tipo && x.id !== it.id && x.subtipo === it.subtipo);
    const cerca = mismo.filter((x) => Math.abs(x.nivel - it.nivel) <= 1);
    for (const x of rng.shuffle(cerca)) meter(x.nombre);
    for (const x of rng.shuffle(mismo)) meter(x.nombre);
    for (const x of rng.shuffle(items.filter((x) => x.tipo === it.tipo && x.id !== it.id))) meter(x.nombre);
  }
  return rng.shuffle([it.nombre, ...elegidas]);
}

/** Estado de una ronda: cola de ids; lo fallado vuelve al final hasta acertarlo. */
export function nuevaRonda(ids) { return { cola: [...ids], total: ids.length, idx: 0, primera: {}, repeticiones: {} }; }
/** Anota la respuesta. Un fallo vuelve al final de la ronda (como mucho dos veces por sitio, para no hacerla eterna). */
export function responderRonda(ronda, id, ok) {
  if (!(id in ronda.primera)) ronda.primera[id] = ok;
  ronda.idx++;
  if (!ok && (ronda.repeticiones[id] ?? 0) < 2) { ronda.repeticiones[id] = (ronda.repeticiones[id] ?? 0) + 1; ronda.cola.push(id); }
  return { fin: ronda.idx >= ronda.cola.length };
}

/** Ronda de entrenamiento sin elegir nada:
 *  1) lo que tienes a medio aprender (sin acertar o acertado una sola vez), lo que más se resiste primero;
 *  2) si no llega, los próximos sitios nuevos en el orden en que te irán saliendo (te adelantas);
 *  3) si aún falta, repaso de lo ya asentado. */
export function rondaEntreno({ estado, P, activos, excluir, proximos, rng, n = 10 }) {
  const items = Object.entries(estado?.items ?? {}).filter(([id]) => P.has(id) && activos.includes(P.get(id).tipo) && !excluir.has(id));
  const urgencia = ([, r]) => { const h = r.historial ?? [], ult = h.slice(-6), fallos = ult.filter((x) => !x[1]).length;
    return ((r.reps ?? 0) === 0 ? 3 : 0) + fallos * 2 + (h.length && !h[h.length - 1][1] ? 1 : 0) + rng.random() * 1.5; };
  const medio = items.filter(([, r]) => (r.reps ?? 0) < 2).map((x) => [urgencia(x), x[0]]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  const out = medio.slice(0, n);
  for (const id of proximos) { if (out.length >= n) break; if (!out.includes(id)) out.push(id); }
  if (out.length < n) for (const [id] of rng.shuffle(items.filter(([id, r]) => (r.reps ?? 0) >= 2 && !out.includes(id)))) { if (out.length >= n) break; out.push(id); }
  return rng.shuffle(out);
}
