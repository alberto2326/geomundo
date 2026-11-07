// Lógica de la app sin DOM: sesiones, corrección, progreso local y copias (exportar / importar). Probada en Node con un almacén en memoria.
import { crearMotor } from "./comparar.js";
import { crearSRS, estadoNuevo, C } from "./srs.js";
import { fechaMadrid, isoMadrid, esFecha, sha256Hex, clonar } from "./util.js";
import { evaluar, actualizar, CRITERIO_VERSION, porId as medallaPorId } from "./logros.js";

export const APP_VERSION = "1.4.0-beta";
export const FORMATO = "geomundo-progreso";
export const VERSION_FORMATO = 1;
const CONTADOR_ORIGEN = 75; // la última sesión del sistema original fue ses-0075
const MODOS = new Set(["nuevo", "repaso", "practica"]);
const RESULTADOS = new Set(["correcta", "incorrecta", "parcial", "casi", "vacia"]);

export function jsonEstable(o) {
  if (Array.isArray(o)) return "[" + o.map(jsonEstable).join(",") + "]";
  if (o && typeof o === "object") return "{" + Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + jsonEstable(o[k])).join(",") + "}";
  return JSON.stringify(o);
}
export async function sumaControl(obj) { const { checksum, ...resto } = obj; return "sha256:" + (await sha256Hex(jsonEstable(resto))); }

export async function crearApp({ catalogo, almacen, cuarentena = [], imagenes = null, config = null, ahora = () => new Date() }) {
  const items = catalogo.items;
  const motor = crearMotor(items), srs = crearSRS(items, motor), P = motor.porId;
  const hoy = () => fechaMadrid(ahora());
  const tipos = config?.tipos?.length ? config.tipos : C.TIPOS, mezcla = config?.mezcla ?? C.MEZCLA;
  let d = await almacen.leer();
  d.estado ??= null; d.eventos ??= []; d.prefs ??= {}; d.meta ??= { contador: 0 }; d.desconocidos ??= { items: {} }; d.logros ??= { ganadas: {}, sesiones: [], por_ver: [] };

  // Ítems que no deben salir: cuarentena y, si ya hay imágenes, los que no tengan las suyas.
  function excluidos() {
    const ex = new Set(cuarentena);
    for (const it of items) if (!tipos.includes(it.tipo)) ex.add(it.id);
    if (imagenes && Object.keys(imagenes).length) for (const it of items) if (!imagenes[it.id]?.q) ex.add(it.id);
    return ex;
  }
  async function guardar(claves) { await almacen.escribir(Object.fromEntries(claves.map((k) => [k, d[k]]))); }
  /** Recalcula medallas; devuelve el objeto logros nuevo y las medallas recién ganadas. */
  function calcularLogros(estado, logros) {
    if (logros.criterio !== CRITERIO_VERSION) { // criterio nuevo: las colecciones exigen ítems aprendidos; se retiran las ganadas con el criterio anterior
      const g = Object.fromEntries(Object.entries(logros.ganadas ?? {}).filter(([id]) => !(medallaPorId[id]?.grupo || id === "h-remontada")));
      logros = { ...logros, ganadas: g, criterio: CRITERIO_VERSION };
    }
    const ev = evaluar({ items, estado, sesiones: logros.sesiones ?? [], excluir: excluidos(), hoy: hoy() });
    const { ganadas, nuevas } = actualizar(logros.ganadas, ev, hoy());
    return { logros: { ...logros, ganadas, por_ver: [...(logros.por_ver ?? []), ...nuevas] }, nuevas, evaluacion: ev };
  }
  const pendiente = (ses) => (ses ? ses.preguntas.find((q) => !q.corregida) ?? null : null);

  if (d.estado) { const c = calcularLogros(d.estado, d.logros); if (c.nuevas.length || d.logros.criterio !== CRITERIO_VERSION) { d.logros = c.logros; await guardar(["logros"]); } }

  const api = {
    motor, srs, items, P, hoy,
    get datos() { return d; },
    tieneProgreso: () => !!d.estado,
    estado: () => d.estado,
    sesion: () => d.sesion ?? null,
    sesionPendiente: () => (pendiente(d.sesion) ? d.sesion : null),
    preguntaPendiente: () => pendiente(d.sesion),
    estadisticas: () => srs.estadisticas(d.estado ?? estadoNuevo(), hoy(), tipos),
    excluidos,

    async empezarDeCero() { d.estado = estadoNuevo(); await guardar(["estado"]); },

    /** Devuelve la sesión pendiente (idempotente) o crea una nueva. */
    async sesionActual() {
      if (pendiente(d.sesion)) return { sesion: d.sesion, nueva: false };
      if (!d.estado) throw new Error("No hay progreso cargado");
      const numero = (d.meta.contador ?? 0) + 1;
      const ses = srs.crearSesion(clonar(d.estado), hoy(), numero, excluidos(), mezcla);
      if (!ses) return { sesion: null, nueva: false, sinItems: true };
      d.sesion = ses; d.meta = { ...d.meta, contador: numero };
      await guardar(["sesion", "meta"]);
      return { sesion: ses, nueva: true };
    },
    /** Corrige la pregunta n de la sesión actual (o la reevalúa). Escribe estado + sesión + historial en una sola transacción. */
    async responder(n, resp, { reevaluar = false } = {}) {
      if (!d.sesion) throw new Error("No hay sesión");
      const st = clonar(d.estado), ses = clonar(d.sesion);
      const r = srs.corregir(st, ses, n, resp, hoy(), { reevaluar });
      if (r.estado !== "corregida") return r;
      r.evento.hora = isoMadrid(ahora());
      const eventos = [...d.eventos, r.evento];
      let logros = clonar(d.logros);
      if (!pendiente(ses)) { // sesión terminada (o reevaluada después de terminar)
        const aciertos = ses.preguntas.filter((q) => q.resultado === "correcta").length, i = logros.sesiones.findIndex((x) => x.sesion === ses.sesion);
        if (i < 0) logros.sesiones.push({ sesion: ses.sesion, fecha: ses.fecha, aciertos, total: ses.preguntas.length, hora_fin: r.evento.hora });
        else logros.sesiones[i] = { ...logros.sesiones[i], aciertos };
      }
      const c = calcularLogros(st, logros); logros = c.logros;
      await almacen.escribir({ estado: st, sesion: ses, eventos, logros });
      d.estado = st; d.sesion = ses; d.eventos = eventos; d.logros = logros;
      r.nuevas = c.nuevas;
      return r;
    },
    medallas: () => evaluar({ items, estado: d.estado, sesiones: d.logros.sesiones, excluir: excluidos(), hoy: hoy() }),
    tipos, config,
    ganadas: () => d.logros.ganadas,
    async verMedallas() { const v = d.logros.por_ver ?? []; if (v.length) { d.logros = { ...d.logros, por_ver: [] }; await guardar(["logros"]); } return v; },
    async guardarBorradores(b) { if (!d.sesion) return; d.sesion = { ...d.sesion, borradores: b }; await guardar(["sesion"]); },
    async abandonarSesion() { d.sesion = undefined; await guardar(["sesion"]); },
    async guardarPrefs(p) { d.prefs = { ...d.prefs, ...p }; await guardar(["prefs"]); },
    async anotarExportacion() { d.meta = { ...d.meta, ultima_exportacion: isoMadrid(ahora()) }; await guardar(["meta"]); },

    // ---------- exportar ----------
    async exportar() {
      const ses = d.sesion ? { ...clonar(d.sesion), indice_pendiente: pendiente(d.sesion)?.n ?? null } : null;
      const o = {
        formato: FORMATO, version_formato: VERSION_FORMATO, app_version: APP_VERSION,
        version_catalogo: { version: catalogo.version, hash: catalogo.hash }, exportado_en: isoMadrid(ahora()),
        estado: clonar(d.estado ?? estadoNuevo()), historial_eventos: clonar(d.eventos), estadisticas: api.estadisticas(),
        preferencias: clonar(d.prefs), sesion_en_curso: ses, contador_sesiones: d.meta.contador ?? 0, desconocidos: clonar(d.desconocidos), logros: clonar(d.logros),
      };
      o.checksum = await sumaControl(o);
      const fecha = o.exportado_en.slice(0, 16).replace("T", "-").replace(":", "");
      return { nombre: `geomundo-progreso-${fecha}.json`, texto: JSON.stringify(o, null, 1), objeto: o };
    },

    // ---------- importar (paso 1: validar y previsualizar, sin tocar nada) ----------
    async analizarImportacion(texto) {
      const errores = [], avisos = [];
      let o;
      try { o = JSON.parse(texto); } catch { return { ok: false, errores: ["El fichero no es un JSON válido (¿está incompleto o dañado?)."], avisos }; }
      if (!o || typeof o !== "object" || Array.isArray(o)) return { ok: false, errores: ["El fichero no tiene el formato esperado."], avisos };
      let estado, eventos = [], prefs = {}, sesion = null, contador = null, desconocidos = { items: {} }, origen, logros = null;
      if (o.formato === FORMATO) {
        const v = o.version_formato;
        if (!Number.isInteger(v) || v < 1) return { ok: false, errores: ["Falta la versión del formato o no es válida."], avisos };
        if (v > VERSION_FORMATO) return { ok: false, errores: [`Este fichero es de una versión más nueva de la app (formato ${v}; esta app entiende hasta el ${VERSION_FORMATO}). Actualiza la app y vuelve a intentarlo. No se ha cambiado nada.`], avisos };
        if (o.checksum) { if ((await sumaControl(o)) !== o.checksum) return { ok: false, errores: ["La suma de control no coincide: el fichero se ha modificado o está dañado. No se ha cambiado nada."], avisos }; }
        else avisos.push("El fichero no trae suma de control; no se puede comprobar que esté íntegro.");
        if (o.version_catalogo?.hash && o.version_catalogo.hash !== catalogo.hash) avisos.push("El fichero se exportó con otra versión del catálogo; se importa igualmente.");
        estado = o.estado; eventos = o.historial_eventos ?? []; prefs = o.preferencias ?? {}; sesion = o.sesion_en_curso ?? null; contador = o.contador_sesiones ?? null;
        desconocidos = o.desconocidos ?? { items: {} }; origen = "copia de la app";
        if (o.logros && typeof o.logros === "object" && typeof o.logros.ganadas === "object" && Array.isArray(o.logros.sesiones ?? [])) logros = o.logros;
        else if (o.logros) avisos.push("Las medallas del fichero no tienen un formato válido; se recalcularán a partir del progreso.");
      } else if (o.items && typeof o.items === "object" && "dias_activos" in o) {
        estado = o; origen = "state.json del sistema original"; contador = CONTADOR_ORIGEN;
      } else return { ok: false, errores: ["No reconozco el fichero: no es una copia de Geografía del Mundo ni un state.json."], avisos };

      // estado
      if (!estado || typeof estado.items !== "object" || Array.isArray(estado.items)) return { ok: false, errores: ["El progreso no tiene la lista de ítems."], avisos };
      const limpio = { version: 1, creado: estado.creado ?? null, items: {}, dias_activos: [] };
      if (limpio.creado !== null && !esFecha(limpio.creado)) errores.push(`Fecha de creación no válida: ${limpio.creado}`);
      for (const f of estado.dias_activos ?? []) { if (esFecha(f)) limpio.dias_activos.push(f); else errores.push(`Día activo no válido: ${f}`); }
      const nuevosDesc = { ...(desconocidos.items ?? {}) };
      for (const [id, r] of Object.entries(estado.items)) {
        const e = validarRegistro(r);
        if (e) { errores.push(`${id}: ${e}`); continue; }
        if (!P.has(id)) { nuevosDesc[id] = r; continue; }
        limpio.items[id] = clonar(r);
      }
      const nDesc = Object.keys(nuevosDesc).length - Object.keys(desconocidos.items ?? {}).length;
      if (nDesc > 0) avisos.push(`${nDesc} ítem(s) no existen en el catálogo actual: se guardan aparte (no se pierden) y vuelven a salir en la próxima copia.`);
      // historial
      if (!Array.isArray(eventos)) errores.push("El historial de eventos no es una lista.");
      // sesión
      if (sesion) {
        const e = validarSesion(sesion, P);
        if (e) { avisos.push(`La sesión en curso no se puede reanudar (${e}); se descarta y sus preguntas sin corregir volverán a salir.`); sesion = null; }
        else { const s2 = clonar(sesion); delete s2.indice_pendiente; sesion = s2; }
      }
      if (errores.length) return { ok: false, errores: errores.slice(0, 8).concat(errores.length > 8 ? [`… y ${errores.length - 8} error(es) más.`] : []), avisos };
      const datos = { estado: limpio, eventos: Array.isArray(eventos) ? eventos : [], prefs, sesion, contador, desconocidos: { items: nuevosDesc }, logros: { ganadas: {}, sesiones: [], ...(logros ?? {}), por_ver: [] } };
      const nuevo = srs.estadisticas(limpio, hoy(), tipos), actual = d.estado ? api.estadisticas() : null;
      const pend = sesion ? sesion.preguntas.find((q) => !q.corregida) : null;
      return {
        ok: true, errores, avisos, datos, origen,
        vista_previa: {
          exportado_en: o.exportado_en ?? null, origen,
          fichero: { vistos: nuevo.vistos, intentos: nuevo.intentos, acierto: nuevo.acierto_total, consolidados: nuevo.consolidados, sesion: sesion ? `${sesion.sesion} (${pend ? `sigue en la ${pend.n}/${sesion.preguntas.length}` : "terminada"})` : null },
          actual: actual ? { vistos: actual.vistos, intentos: actual.intentos, acierto: actual.acierto_total, consolidados: actual.consolidados, sesion: d.sesion ? d.sesion.sesion : null } : null,
        },
      };
    },
    // ---------- importar (paso 2: tras confirmar) ----------
    async aplicarImportacion(datos) {
      let copia = null;
      if (d.estado) {
        const ex = await api.exportar();
        copia = await almacen.guardarCopia({ creada: isoMadrid(ahora()), motivo: "antes de importar", texto: ex.texto, nombre: ex.nombre });
      }
      const nuevo = {
        estado: datos.estado, sesion: datos.sesion ?? undefined, eventos: datos.eventos, prefs: datos.prefs ?? {},
        desconocidos: datos.desconocidos, meta: { ...d.meta, contador: Math.max(d.meta.contador ?? 0, datos.contador ?? 0), ultima_importacion: isoMadrid(ahora()), copia_previa: copia },
        logros: calcularLogros(datos.estado, datos.logros ?? { ganadas: {}, sesiones: [] }).logros,
      };
      await almacen.escribir(nuevo); // atómico: si falla, lo anterior queda intacto
      d = { ...d, ...nuevo };
      return { copia };
    },
    async deshacerImportacion() {
      const id = d.meta.copia_previa;
      if (!id) return { ok: false, motivo: "No hay ninguna importación que deshacer." };
      const c = await almacen.leerCopia(id);
      if (!c) return { ok: false, motivo: "La copia previa ya no existe." };
      const a = await api.analizarImportacion(c.texto);
      if (!a.ok) return { ok: false, motivo: a.errores.join(" ") };
      const nuevo = { estado: a.datos.estado, sesion: a.datos.sesion ?? undefined, eventos: a.datos.eventos, prefs: a.datos.prefs, desconocidos: a.datos.desconocidos, meta: { ...d.meta, contador: Math.max(d.meta.contador ?? 0, a.datos.contador ?? 0), copia_previa: null }, logros: { ...a.datos.logros, por_ver: [] } };
      await almacen.escribir(nuevo); d = { ...d, ...nuevo };
      return { ok: true };
    },
    listarCopias: () => almacen.listarCopias(),
    leerCopia: (id) => almacen.leerCopia(id),
  };
  return api;
}

const entero = (x, min = 0, max = Infinity) => Number.isInteger(x) && x >= min && x <= max;
export function validarRegistro(r) {
  if (!r || typeof r !== "object" || Array.isArray(r)) return "registro no válido";
  if (typeof r.ef !== "number" || !(r.ef >= 1.3 - 1e-9 && r.ef <= 2.8 + 1e-9)) return `factor (ef) fuera de rango: ${r.ef}`;
  if (!entero(r.reps)) return `reps no válido: ${r.reps}`;
  if (!entero(r.intervalo, 0, C.INTERVALO_MAX)) return `intervalo fuera de rango: ${r.intervalo}`;
  for (const k of ["vence", "ultimo"]) if (r[k] !== undefined && !esFecha(r[k])) return `${k} no es una fecha AAAA-MM-DD: ${r[k]}`;
  for (const k of ["vistas", "aciertos", "fallos", "lapsos"]) if (r[k] !== undefined && !entero(r[k])) return `${k} no válido: ${r[k]}`;
  if (r.historial !== undefined) {
    if (!Array.isArray(r.historial)) return "historial no es una lista";
    for (const h of r.historial) if (!Array.isArray(h) || !esFecha(h[0]) || (h[1] !== 0 && h[1] !== 1)) return "historial con entradas no válidas";
  }
  return null;
}
function validarSesion(s, P) {
  if (typeof s.sesion !== "string" || !Array.isArray(s.preguntas) || !s.preguntas.length || s.preguntas.length > C.SESION_N) return "estructura no válida";
  const ns = new Set();
  for (const q of s.preguntas) {
    if (!entero(q.n, 1, C.SESION_N) || ns.has(q.n)) return "numeración no válida"; ns.add(q.n);
    if (!P.has(q.id)) return `ítem desconocido ${q.id}`;
    if (!MODOS.has(q.modo)) return "modo no válido";
    if (q.corregida) { if (!RESULTADOS.has(q.resultado)) return "resultado no válido"; if (q.antes !== null && validarRegistro(q.antes)) return "registro previo no válido"; }
  }
  return null;
}
