// Corrección por dictado: traducción fiel de nucleo.py / espana/nucleo_es.py (comparar, comparar_pais, Idx.resolver, decidir).
import { ratio, tokenSortRatio, pyRound } from "./util.js";

const sinParentesis = (s) => String(s).replace(/\(.*?\)/g, "");
const comprime = (s) => s.replace(/\s+/g, " ").trim();
const rep = (s, a, b) => s.split(a).join(b);
const unicos = (l) => [...new Set(l)];
const ordenIds = (l) => [...l].sort();

export function norm(s) {
  s = String(s).toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");
  s = rep(rep(s, "&", " y "), "ñ", "n");
  return comprime(s.replace(/[^a-z0-9 ]/g, " "));
}
export function fon(s) {
  s = norm(s);
  for (const [a, b] of [["ph", "f"], ["qu", "k"], ["ch", "ç"], ["ll", "i"], ["ce", "se"], ["ci", "si"], ["ge", "je"], ["gi", "ji"], ["sh", "ç"]]) s = rep(s, a, b);
  s = rep(rep(rep(rep(rep(rep(rep(rep(s, "c", "k"), "z", "s"), "v", "b"), "w", "u"), "y", "i"), "h", ""), "x", "ks"), "ç", "ch");
  s = s.replace(/(.)\1+/g, "$1");
  return comprime(s);
}
const RELLENO = ["creo que es", "creo que sera", "yo diria que es", "yo diria que", "diria que es", "me suena que es", "me parece que es", "parece que es", "podria ser", "sera", "seria",
  "es la bandera de", "la bandera de", "bandera de", "es el pais de", "el pais es", "el pais", "pais", "es la de", "la de", "es de", "es", "pues", "bueno", "a ver", "eh", "um", "mmm", "vale", "yo creo que es", "yo creo que", "creo que", "seria el", "seria la", "es el", "es la", "sera el", "sera la"];
const RELLENO_ORD = [...RELLENO].sort((a, b) => b.length - a.length);
const ARTICULOS = new Set(["el", "la", "los", "las", "un", "una", "de", "del"]);
const VACIAS = new Set(["no se", "nose", "ns", "no lo se", "pass", "paso", "ni idea", "no idea", "no recuerdo", "no me acuerdo", "no tengo ni idea", "ni puta idea"]);

export function limpiar(resp) {
  let r = norm(resp), cambio = true;
  while (cambio) {
    cambio = false;
    for (const f of RELLENO_ORD) {
      if (r === f) return "";
      if (r.startsWith(f + " ")) { r = r.slice(f.length + 1); cambio = true; break; }
    }
  }
  const w = r.split(" ").filter(Boolean);
  while (w.length > 1 && ARTICULOS.has(w[0])) w.shift();
  return w.join(" ");
}
export function esVacia(resp) { const r = norm(resp); return !r || VACIAS.has(r); }

function baseVariantes(t) {
  const n = norm(sinParentesis(t));
  const m = n.replace(/^(el|la|los|las|republica de|reino de|republica|reino)\s+/, "");
  return unicos([n, m]).filter(Boolean);
}

class Idx {
  constructor(entradas, amb = [], variantes = null, sinChoques = false) {
    this.k = new Map();
    this.amb = new Set(amb.map(fon));
    // sinChoques: una variante abreviada («la paz» de «Ciudad de la Paz») no se añade si es el nombre completo de OTRA entidad (La Paz, Bolivia)
    const completos = new Map();
    if (sinChoques) for (const [txt, i] of entradas) { const kk = fon(norm(sinParentesis(txt))); if (kk) { if (!completos.has(kk)) completos.set(kk, new Set()); completos.get(kk).add(i); } }
    for (const [txt, i] of entradas) {
      for (const v of variantes ? variantes(txt) : baseVariantes(txt)) {
        const kk = fon(v);
        if (!kk) continue;
        if (sinChoques && completos.has(kk) && !completos.get(kk).has(i)) continue;
        if (!this.k.has(kk)) this.k.set(kk, new Set());
        this.k.get(kk).add(i);
      }
    }
  }
  resolver(resp, variantes = null) {
    const idx = this.k;
    if (esVacia(resp)) return { estado: "vacia", ids: [], puntuacion: 0 };
    const txt = limpiar(resp), r = norm(resp);
    const cands = [txt, r, ...(variantes ? variantes(txt) : [])];
    for (const cand of cands) {
      const kk = fon(cand);
      if (idx.has(kk)) {
        const ids = ordenIds(idx.get(kk));
        return { estado: this.amb.has(kk) && ids.length > 1 ? "ambigua" : "exacta", ids, puntuacion: 100, via: "exacta" };
      }
    }
    const w = r.split(" ").filter(Boolean), usado = w.map(() => false), halladas = [];
    for (let n = Math.min(6, w.length); n >= 1; n--) {
      for (let s = 0; s <= w.length - n; s++) {
        if (usado.slice(s, s + n).some(Boolean)) continue;
        const kk = fon(w.slice(s, s + n).join(" "));
        if (idx.has(kk) && !(n === 1 && kk.length < 3)) {
          halladas.push([kk, ordenIds(idx.get(kk))]);
          for (let j = s; j < s + n; j++) usado[j] = true;
        }
      }
    }
    if (halladas.length) {
      const distintas = new Set(halladas.map((h) => h[1].join("|")));
      if (distintas.size > 1) return { estado: "multiple", ids: ordenIds(new Set(halladas.flatMap((h) => h[1]))), puntuacion: 100, via: "frase" };
      const [kk, ids] = halladas[0];
      return { estado: this.amb.has(kk) && ids.length > 1 ? "ambigua" : "exacta", ids, puntuacion: 100, via: "frase" };
    }
    const kt = fon(txt), mejores = new Map();
    if (kt.length >= 4) {
      for (const [kk, ids] of idx) {
        if (kk.length < 5) continue;
        const sc = Math.max(ratio(kt, kk), tokenSortRatio(kt, kk));
        for (const i of ids) mejores.set(i, Math.max(mejores.get(i) || 0, sc));
      }
    }
    if (mejores.size) {
      const orden = [...mejores.entries()].sort((a, b) => b[1] - a[1]);
      const [i1, s1] = orden[0], s2 = orden.length > 1 ? orden[1][1] : 0;
      if (s1 >= 78) return { estado: "difusa", ids: [i1], puntuacion: s1, segunda: s2 };
    }
    return { estado: "nada", ids: [], puntuacion: mejores.size ? Math.max(...mejores.values()) : 0 };
  }
}

function decidir(r, i) {
  const e = r.estado;
  if (e === "vacia") return ["vacia", { nota: "sin respuesta" }];
  if (e === "exacta") return r.ids.length === 1 && r.ids[0] === i ? ["ok", { puntuacion: 100 }] : ["mal", { interpretada: r.ids[0], nota: "es otra cosa" }];
  if (e === "ambigua") return r.ids.includes(i) ? ["casi", { nota: "respuesta ambigua: hay que concretar cuál" }] : ["mal", { interpretada: r.ids[0], nota: "es otra cosa" }];
  if (e === "multiple") return ["mal", { nota: "respondió varias cosas a la vez" }];
  if (e === "difusa") {
    const o = r.ids[0], sc = r.puntuacion, margen = sc - (r.segunda || 0);
    if (o === i) {
      if (sc >= 85 && margen >= 3) return ["ok", { puntuacion: pyRound(sc) }];
      return ["casi", { puntuacion: pyRound(sc), nota: "muy parecido pero no seguro" }];
    }
    return ["mal", { interpretada: sc >= 85 ? o : null, puntuacion: pyRound(sc), nota: "se parece a otra cosa" }];
  }
  return ["mal", { nota: "no coincide con nada conocido" }];
}

// ---- capitales y física ----
const claveCap = (s) => norm(sinParentesis(s));
function varsCap(t) { const n = claveCap(t); return unicos([n, n.replace(/^(ciudad de|la ciudad de|ciudad|el|la|los|las)\s+/, "")]).filter(Boolean); }
const PREF_FIS = ["rios", "rio", "montes", "monte", "monts", "mont", "mar de", "mar", "golfo de", "golfo", "bahia de", "bahia", "lago", "laguna", "desierto de", "desierto", "isla de", "islas", "isla", "archipielago de", "archipielago",
  "peninsula de", "peninsula", "cordillera de", "cordillera", "cordilleras", "sierra", "sistema", "meseta de", "meseta", "altiplano de", "altiplano", "altiplanicie", "llanura de", "llanura", "llanos", "cuenca de", "cuenca", "region de", "region",
  "oceano", "estrecho de", "estrecho", "canal de", "canal", "istmo de", "istmo", "delta de", "delta", "macizo", "cabo de", "cabo", "pico", "volcan", "montana", "montanas", "tierras altas de", "depresion", "gran", "grandes", "gran lago"];
const PREF_FIS_ORD = [...PREF_FIS].sort((a, b) => b.length - a.length).map((p) => p.split(" "));
function quitaPrefs(n) {
  let w = n.split(" ").filter(Boolean);
  for (let k = 0; k < 3; k++) {
    let cambio = false;
    for (const pw of PREF_FIS_ORD) {
      if (w.length > pw.length && pw.every((x, j) => w[j] === x)) { w = w.slice(pw.length); cambio = true; break; }
    }
    while (w.length > 1 && ARTICULOS.has(w[0])) { w.shift(); cambio = true; }
    if (!cambio) break;
  }
  return w.join(" ");
}
function varsFis(t) {
  const n = norm(sinParentesis(t));
  return unicos([n, quitaPrefs(n), n.replace(/^(el|la|los|las|del|de la|de los|de las)\s+/, "")]).filter(Boolean);
}

// ---- España (espana/nucleo_es.py) ----
const ES_ARTIC = new Set(["el", "la", "los", "las", "un", "una", "de", "del", "en", "al"]);
const PREF_GEN = ["provincia de", "provincia", "comunidad autonoma de", "comunidad autonoma", "comunidad de", "comunidad", "ciudad autonoma de", "ciudad autonoma", "ciudad de", "ciudad",
  "rio", "riu", "isla de", "islas", "isla", "archipielago de", "archipielago", "cabo de", "cabo", "cap de", "cap", "punta de", "punta", "pico de", "pico", "monte", "sierra de", "sierra", "cordillera de", "cordillera", "sistema", "sistemas",
  "embalse de", "embalse", "pantano de", "pantano", "laguna de", "laguna", "lago de", "lago", "parque nacional de", "parque nacional", "macizo de", "macizo", "montes de", "montes", "serrania de", "serrania"];
const PREF_GEN_ORD = [...PREF_GEN].sort((a, b) => b.length - a.length);
const PREF_SOLO = new Set(["provincia", "comunidad", "ciudad", "rio", "pico", "cabo", "isla", "lago", "cordillera", "relieve"]);
function esNorm(s) {
  s = String(s).toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");
  return comprime(s.replace(/[^a-z0-9ñ ]/g, " "));
}
function esStripArt(s) { const w = s.split(" ").filter(Boolean); while (w.length > 1 && ES_ARTIC.has(w[0])) w.shift(); return w.join(" "); }
function esStripPref(s) {
  s = esStripArt(s);
  for (const p of PREF_GEN_ORD) if (s.startsWith(p + " ") && s.length > p.length + 1) { s = s.slice(p.length + 1); break; }
  return esStripArt(s);
}
function esVariantes(it) {
  const out = new Set();
  for (const b of [it.nombre, ...(it.alias || [])]) {
    const n = esNorm(b); out.add(esStripArt(n));
    if (PREF_SOLO.has(it.subtipo)) out.add(esStripPref(n));
  }
  return [...out].filter(Boolean);
}
const ES_VACIAS = new Set(["no se", "nose", "ns", "no lo se", "pass", "paso", "ni idea", "no idea"]);
function esComparar(it, resp) {
  const r = esNorm(resp);
  if (!r || ES_VACIAS.has(r)) return ["vacia", 0];
  const cands = esVariantes(it), cr = new Set([esStripArt(r)]);
  if (PREF_SOLO.has(it.subtipo)) cr.add(esStripPref(r));
  let best = 0;
  for (const a of cr) for (const c of cands) {
    if (a === c) return ["ok", 100];
    let sim = Math.max(ratio(a, c), tokenSortRatio(a, c));
    if (c.length <= 4) sim = Math.min(sim, 70);
    best = Math.max(best, sim);
  }
  if (best >= 88) return ["ok", best];
  if (best >= 78) return ["casi", best];
  return ["mal", best];
}

// ---- motor ----
const AMBIGUOS_PAIS = { congo: ["cg", "cd"], corea: ["kr", "kp"] };
const CONECT = new Set(["y", "e", "es", "son", "con", "que", "su", "la", "el", "los", "las", "capital", "capitales", "de", "del", "seria", "sera", "ciudad", "pais"]);
const REC_INI = new Set(["y", "e", "es", "son", "que", "con", "la", "el", "su", "seria", "sera"]);
const REC_FIN = new Set(["y", "e", "es", "son", "que", "con", "la", "el", "su", "de", "del", "capital", "capitales"]);
function recorta(w) { w = [...w]; while (w.length && REC_INI.has(w[0])) w.shift(); while (w.length && REC_FIN.has(w[w.length - 1])) w.pop(); return w.join(" "); }
function partir(resp) {
  const t = norm(resp);
  let m = t.match(/^(.*?)(?:^|\s)(?:es\s+)?(?:la\s+)?capital\s+(?:de\s+|del\s+)(.*)$/);
  if (m && m[1].trim() && m[2].trim()) return [[m[2].trim(), m[1].trim()]];
  m = t.match(/^(.*?)(?:^|\s)(?:y\s+)?(?:(?:su|la|cuya)\s+)?capitales?(?:\s+(?:es|son|seria|sera))?\s+(.*)$/);
  if (m && m[2].trim()) return [[m[1].trim() || null, m[2].trim()]];
  const w = t.split(" ").filter(Boolean), sal = [[t, null], [null, t]];
  for (let k = 1; k < w.length; k++) { const a = recorta(w.slice(0, k)), b = recorta(w.slice(k)); if (a && b) sal.push([a, b], [b, a]); }
  return sal;
}
function sc(r) {
  const e = r.estado;
  if (e === "exacta" || e === "ambigua") return (e === "exacta" ? 100 : 90) - (r.via === "frase" ? 5 : 0);
  if (e === "difusa") return r.puntuacion - 5;
  if (e === "multiple") return 40;
  return 0;
}

export function crearMotor(items) {
  const P = new Map(items.map((i) => [i.id, i]));
  const cache = new Map();
  const nombre = (i) => P.get(i)?.nombre;
  function idxPais(pref) {
    if (!cache.has(pref)) {
      const ent = [];
      for (const it of items) if (it.id.startsWith(pref)) { ent.push([it.nombre, it.id]); for (const a of it.alias || []) ent.push([a, it.id]); }
      for (const [a, isos] of Object.entries(AMBIGUOS_PAIS)) for (const iso of isos) ent.push([a, pref + iso]);
      cache.set(pref, new Idx(ent, Object.keys(AMBIGUOS_PAIS)));
    }
    return cache.get(pref);
  }
  function idxCap(tipo = "pais") {
    const k = "cap-" + tipo;
    if (!cache.has(k)) {
      const ent = [];
      for (const it of items) if (it.tipo === tipo) for (const c of it.capitales) for (const t of new Set([c.nombre, c.clave, ...(c.alias || [])])) ent.push([t, it.id]);
      cache.set(k, new Idx(ent, [], varsCap, true));
    }
    return cache.get(k);
  }
  function idxEstados() {
    if (!cache.has("est")) {
      const ent = [];
      for (const it of items) if (it.tipo === "estado") { ent.push([it.nombre, it.id]); for (const a of it.alias || []) ent.push([a, it.id]); }
      cache.set("est", new Idx(ent));
    }
    return cache.get("est");
  }
  function idxCiudades() {
    if (!cache.has("ciu")) {
      const ent = [];
      for (const it of items) if (it.tipo === "ciudad") { ent.push([it.nombre, it.id]); for (const a of it.alias || []) ent.push([a, it.id]); }
      cache.set("ciu", new Idx(ent, [], varsCap));
    }
    return cache.get("ciu");
  }
  function idxFis(sub) {
    const k = "fis-" + sub;
    if (!cache.has(k)) {
      const ent = [];
      for (const it of items) if (it.tipo === "fisico" && it.subtipo === sub) { ent.push([it.nombre, it.id]); for (const a of it.alias || []) ent.push([a, it.id]); }
      cache.set(k, new Idx(ent, [], varsFis));
    }
    return cache.get(k);
  }
  function sobrante(resp, ids, que) {
    let t = " " + norm(resp) + " ", mejor = "";
    for (const i of ids) {
      const it = P.get(i);
      const nombres = que === "pais" ? [it.nombre, ...(it.alias || [])] : it.capitales.flatMap((c) => [c.nombre, c.clave, ...(c.alias || [])]);
      for (const n of nombres) for (const v of que === "pais" ? baseVariantes(n) : varsCap(n)) if (t.includes(" " + v + " ") && v.length > mejor.length) mejor = v;
    }
    if (!mejor) return null;
    t = t.replace(" " + mejor + " ", " ");
    const w = t.split(" ").filter((x) => x && !CONECT.has(x));
    return w.join(" ") || null;
  }
  function compararPais(it, resp) {
    const ent = it.tipo === "estado" ? (t) => idxEstados().resolver(t) : (t) => idxPais("pc-").resolver(t);
    const cap = (t) => idxCap(it.tipo).resolver(t);
    if (esVacia(resp)) return ["vacia", { nota: "sin respuesta", partes: { pais: null, capital: null } }];
    let mejor = null;
    for (const [tp, tc] of partir(resp)) {
      const rp = tp ? ent(tp) : null, rc = tc ? cap(tc) : null;
      const sp = rp ? sc(rp) : 0, scc = rc ? sc(rc) : 0;
      if (tp && tc && !(sp || scc)) continue;
      let total = sp + scc;
      if (sp && scc) total += 5;
      if (rp && rp.ids.includes(it.id) && (rp.estado === "exacta" || rp.estado === "difusa")) total += 1;
      if (rc && rc.ids.includes(it.id) && (rc.estado === "exacta" || rc.estado === "difusa")) total += 1;
      if (mejor === null || total > mejor[0]) mejor = [total, rp, rc, tp, tc];
    }
    if (mejor === null || mejor[0] <= 0) return ["mal", { nota: "no coincide con ningún país ni capital", partes: { pais: "mal", capital: "mal" }, tu_pais: null, tu_capital: null }];
    let [, rp, rc, tp, tc] = mejor;
    const info = { partes: { pais: null, capital: null }, tu_pais: tp, tu_capital: tc };
    if (rp && rc && rp.estado === "ambigua" && (rc.estado === "exacta" || rc.estado === "difusa")) {
      const inter = rp.ids.filter((x) => rc.ids.includes(x));
      if (new Set(inter).size === 1) rp = { estado: "exacta", ids: [inter[0]], puntuacion: 100, via: "capital" };
    }
    if (rp) {
      const [e, i2] = decidir(rp, it.id); info.partes.pais = e !== "vacia" ? e : "mal";
      if (i2.interpretada) info.interpretada_pais = nombre(i2.interpretada);
      if (e === "casi") info.nota_pais = i2.nota;
    }
    if (rc) {
      const [e, i2] = decidir(rc, it.id); info.partes.capital = e !== "vacia" ? e : "mal";
      if (i2.interpretada) info.interpretada_capital = nombre(i2.interpretada);
      if (e === "casi") info.nota_capital = i2.nota;
    }
    if ((rp === null) !== (rc === null)) {
      const sob = sobrante(resp, (rp || rc).ids, rp ? "pais" : "cap");
      if (sob) { if (rp) { info.partes.capital = "mal"; info.tu_capital = sob; } else { info.partes.pais = "mal"; info.tu_pais = sob; } }
    }
    const p = info.partes.pais, c = info.partes.capital;
    if (p === "ok" && c === "ok") return ["ok", info];
    if (p === "ok" || c === "ok") return ["parcial", info];
    if (p === "casi" || c === "casi") return ["casi", info];
    return ["mal", info];
  }
  function compararBandera(it, resp) {
    const [r, info] = decidir(idxPais("ba-").resolver(resp), it.id);
    if (info.interpretada) info.interpretada_nombre = nombre(info.interpretada);
    return [r, info];
  }
  function compararFisico(it, resp) {
    const [r, info] = decidir(idxFis(it.subtipo).resolver(resp, varsFis), it.id);
    if (info.interpretada) info.interpretada_nombre = nombre(info.interpretada);
    return [r, info];
  }
  function compararCiudad(it, resp) {
    const [r, info] = decidir(idxCiudades().resolver(resp, varsCap), it.id);
    if (info.interpretada) info.interpretada_nombre = nombre(info.interpretada);
    return [r, info];
  }
  function compararEspana(it, resp) {
    const [r, s] = esComparar(it, resp);
    if (r === "mal" || r === "casi") {
      const fr = fon(esStripArt(esNorm(resp)));
      for (const v of esVariantes(it)) if (fon(v) === fr && fr.length >= 3) return ["ok", { puntuacion: 95 }];
    }
    const nota = { casi: "muy parecido pero no seguro", mal: "no coincide", vacia: "sin respuesta" }[r];
    return [r, { puntuacion: pyRound(s), nota }];
  }
  function comparar(it, resp) {
    return { pais: compararPais, estado: compararPais, bandera: compararBandera, fisico: compararFisico, espana: compararEspana, ciudad: compararCiudad }[it.tipo](it, resp);
  }
  return { comparar, porId: P, norm };
}

export function capitalesTexto(it) { return it.capitales.map((c) => c.nombre).join(" / "); }
export function respuestaTexto(it) { return it.capitales ? `${it.nombre} · capital: ${capitalesTexto(it)}` : it.nombre; }
