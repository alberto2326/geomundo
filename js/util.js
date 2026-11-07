// Utilidades sin dependencias: fechas en Europe/Madrid, redondeo como Python, similitud tipo rapidfuzz y azar con semilla.

export const ZONA = "Europe/Madrid";

/** Fecha local de Madrid (AAAA-MM-DD) del instante dado. */
export function fechaMadrid(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
/** Hora local de Madrid (0-23). */
export function horaMadrid(d = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", hourCycle: "h23" }).format(d));
}
/** ISO 8601 con desplazamiento de Madrid, p. ej. 2026-11-07T11:46:00+01:00 */
export function isoMadrid(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(d).map((x) => [x.type, x.value]));
  const local = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const off = Math.round((local - Math.floor(d.getTime() / 1000) * 1000) / 60000);
  const s = off >= 0 ? "+" : "-", a = Math.abs(off);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${s}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")}`;
}
export function sumarDias(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
export function difDias(a, b) { // a - b en días
  const f = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((f(a) - f(b)) / 86400000);
}
export const esFecha = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().slice(0, 10) === s;

/** round() de Python para enteros: mitades al par. */
export function pyRound(x) {
  const f = Math.floor(x), r = x - f;
  if (r > 0.5) return f + 1;
  if (r < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}
export const round3 = (x) => Number(x.toFixed(3));

// ---- similitud (equivale a rapidfuzz.fuzz.ratio / token_sort_ratio sin procesador) ----
function lcs(a, b) {
  if (!a.length || !b.length) return 0;
  let prev = new Array(b.length + 1).fill(0);
  for (let i = 0; i < a.length; i++) {
    const cur = [0];
    for (let j = 1; j <= b.length; j++) cur.push(a[i] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], cur[j - 1]));
    prev = cur;
  }
  return prev[b.length];
}
export function ratio(a, b) {
  const t = a.length + b.length;
  if (t === 0) return 100;
  return (100 * (2 * lcs(a, b))) / t;
}
const ordenaTokens = (s) => s.split(/\s+/).filter(Boolean).sort().join(" ");
export const tokenSortRatio = (a, b) => ratio(ordenaTokens(a), ordenaTokens(b));

// ---- azar reproducible ----
function hash32(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
}
export function crearAzar(semilla) {
  let a = hash32(String(semilla))();
  const random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return {
    random,
    choice: (l) => l[Math.floor(random() * l.length)],
    choices: (l, pesos) => { const tot = pesos.reduce((x, y) => x + y, 0); let r = random() * tot; for (let i = 0; i < l.length; i++) { r -= pesos[i]; if (r < 0) return l[i]; } return l[l.length - 1]; },
    shuffle: (l) => { for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; },
  };
}

export async function sha256Hex(texto) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
export const clonar = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
