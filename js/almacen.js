// Almacén local: IndexedDB en el navegador (o memoria en las pruebas). Todo lo que cambia a la vez se escribe en UNA transacción.
const DB = "geomundo", VER = 1, KV = "kv", COPIAS = "copias";
export const CLAVES = ["estado", "sesion", "eventos", "prefs", "desconocidos", "meta", "logros"];

function req(r) { return new Promise((ok, ko) => { r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
function fin(tx) { return new Promise((ok, ko) => { tx.oncomplete = () => ok(); tx.onerror = () => ko(tx.error); tx.onabort = () => ko(tx.error || new Error("transacción abortada")); }); }

export async function abrirIndexedDB(nombre = DB) {
  const r = indexedDB.open(nombre, VER);
  r.onupgradeneeded = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
    if (!db.objectStoreNames.contains(COPIAS)) db.createObjectStore(COPIAS, { keyPath: "id", autoIncrement: true });
  };
  const db = await req(r);
  return {
    async leer() {
      const tx = db.transaction(KV, "readonly"), s = tx.objectStore(KV), out = {};
      for (const k of CLAVES) out[k] = await req(s.get(k));
      return out;
    },
    /** Escribe varias claves de forma atómica: o todas o ninguna. */
    async escribir(cambios) {
      const tx = db.transaction(KV, "readwrite"), s = tx.objectStore(KV);
      for (const [k, v] of Object.entries(cambios)) { if (!CLAVES.includes(k)) throw new Error("clave desconocida " + k); v === undefined ? s.delete(k) : s.put(v, k); }
      await fin(tx);
    },
    async guardarCopia(copia) {
      const tx = db.transaction(COPIAS, "readwrite"), s = tx.objectStore(COPIAS);
      const id = await req(s.add(copia));
      const claves = await req(s.getAllKeys());
      for (const k of claves.slice(0, Math.max(0, claves.length - 10))) s.delete(k); // se guardan las 10 últimas
      await fin(tx); return id;
    },
    async listarCopias() { const tx = db.transaction(COPIAS, "readonly"); return (await req(tx.objectStore(COPIAS).getAll())).reverse(); },
    async leerCopia(id) { const tx = db.transaction(COPIAS, "readonly"); return req(tx.objectStore(COPIAS).get(id)); },
    async borrarTodo() { const tx = db.transaction([KV, COPIAS], "readwrite"); tx.objectStore(KV).clear(); tx.objectStore(COPIAS).clear(); await fin(tx); },
  };
}

/** Almacén en memoria con la misma interfaz (para pruebas). `fallarEn` simula un fallo a mitad de escritura. */
export function almacenMemoria() {
  let kv = {}, copias = [], n = 0;
  const c = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  return {
    fallarEn: null,
    async leer() { return Object.fromEntries(CLAVES.map((k) => [k, c(kv[k])])); },
    async escribir(cambios) {
      const nuevo = { ...kv };
      for (const [k, v] of Object.entries(cambios)) {
        if (this.fallarEn === k) throw new Error("fallo simulado");
        if (v === undefined) delete nuevo[k]; else nuevo[k] = c(v);
      }
      kv = nuevo;
    },
    async guardarCopia(copia) { copias.push({ ...c(copia), id: ++n }); copias = copias.slice(-10); return n; },
    async listarCopias() { return c([...copias].reverse()); },
    async leerCopia(id) { return c(copias.find((x) => x.id === id)); },
    async borrarTodo() { kv = {}; copias = []; },
  };
}
