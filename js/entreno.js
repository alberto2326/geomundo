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

/** Cola del entrenamiento continuo.
 *  modo "medio": todo lo que tienes a medio aprender (sin acertar o acertado una vez), de lo que más fallas a lo que menos;
 *  lo que ya acertaste HOY en el entrenamiento va al final, para que no salgan siempre los mismos.
 *  modo "proximos": los próximos sitios nuevos, en el orden en que irán saliendo en las sesiones. */
export function colaEntreno({ estado, P, activos, excluir, proximos = [], acertadosHoy = new Set(), modo = "medio", n = 20 }) {
  if (modo === "proximos") return proximos.slice(0, n);
  const items = Object.entries(estado?.items ?? {}).filter(([id, r]) => P.has(id) && activos.includes(P.get(id).tipo) && !excluir.has(id) && (r.reps ?? 0) < 2);
  const dificultad = ([id, r]) => { const h = r.historial ?? [], fallos = h.slice(-6).filter((x) => !x[1]).length, acierto = h.length ? h.filter((x) => x[1]).length / h.length : 0;
    return fallos * 2 + ((r.reps ?? 0) === 0 ? 3 : 0) + (1 - acierto) * 2 + (h.length && !h[h.length - 1][1] ? 1 : 0); };
  return items.map((x) => [acertadosHoy.has(x[0]) ? 1 : 0, -dificultad(x), x[0]])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : 1)).map((x) => x[2]);
}

/** Estado del entrenamiento: cola de ids y lo respondido. */
export function nuevaRonda(ids) { return { cola: [...ids], idx: 0, primera: {}, repeticiones: {} }; }
/** Anota la respuesta. Un fallo vuelve unas preguntas más tarde (como mucho dos veces por sitio). */
export function responderRonda(ronda, id, ok, hueco = 4) {
  if (!(id in ronda.primera)) ronda.primera[id] = ok;
  ronda.idx++;
  if (!ok && (ronda.repeticiones[id] ?? 0) < 2) {
    ronda.repeticiones[id] = (ronda.repeticiones[id] ?? 0) + 1;
    ronda.cola.splice(Math.min(ronda.cola.length, ronda.idx + hueco), 0, id);
  }
  return { fin: ronda.idx >= ronda.cola.length };
}
