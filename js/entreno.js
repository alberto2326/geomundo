// Entrenamiento: preguntas de 4 opciones para lo que cuesta. No toca la repetición espaciada.
// Las opciones «trampa» son los sitios con los que más se confunde: vecinos y países de la misma zona.

const GRUPO = (zona) => (/África/.test(zona) || /norte de África|sur de África/.test(zona) ? "África"
  : /Europa|europa/.test(zona) ? "Europa" : /Asia|Asiático|Oriente/.test(zona) ? "Asia"
  : /América|Caribe|Sudamérica|Centroamérica|Norteamérica/.test(zona) ? "América" : "Oceanía");

/** Zonas de países, agrupadas por continente: [{grupo, zonas:[{zona, ids}]}] */
export function zonas(items, vecinos) {
  const porZona = new Map();
  for (const it of items) if (it.tipo === "pais" && vecinos[it.id]?.zona) {
    const z = vecinos[it.id].zona; if (!porZona.has(z)) porZona.set(z, []); porZona.get(z).push(it.id);
  }
  const grupos = new Map();
  for (const [zona, ids] of porZona) { const g = GRUPO(zona); if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push({ zona, ids }); }
  const orden = ["África", "América", "Asia", "Europa", "Oceanía"];
  return orden.filter((g) => grupos.has(g)).map((g) => ({ grupo: g, zonas: grupos.get(g).sort((a, b) => a.zona.localeCompare(b.zona, "es")) }));
}

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

/** Lo que más te cuesta, según tu historial: fallos recientes, poco acierto y lo que aún no se ha asentado. */
export function dificiles(estado, P, excluir = new Set(), n = 10) {
  const out = [];
  for (const [id, r] of Object.entries(estado?.items ?? {})) {
    if (!P.has(id) || excluir.has(id)) continue;
    const h = r.historial ?? []; if (!h.length) continue;
    const ult = h.slice(-6), fallos = ult.filter((x) => !x[1]).length, acierto = h.filter((x) => x[1]).length / h.length;
    if (!fallos || (acierto >= 0.75 && (r.reps ?? 0) >= 2)) continue;
    out.push([fallos * 2 + ((r.reps ?? 0) === 0 ? 2 : 0) + (1 - acierto) * 3 + (h[h.length - 1][1] ? 0 : 1), id]);
  }
  return out.sort((a, b) => b[0] - a[0] || (a[1] < b[1] ? -1 : 1)).slice(0, n).map((x) => x[1]);
}

/** Ronda de una zona: países (mapa) o sus banderas. */
export function rondaZona(zona, modo, items, vecinos, excluir, rng, n = 10) {
  const ids = items.filter((it) => it.tipo === "pais" && vecinos[it.id]?.zona === zona).map((it) => (modo === "bandera" ? "ba-" + it.iso : it.id));
  return rng.shuffle(ids.filter((id) => !excluir.has(id) && items.some((x) => x.id === id))).slice(0, n);
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
