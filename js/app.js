// Interfaz. Toda la lógica está en logica.js / srs.js / comparar.js.
import { crearApp, APP_VERSION } from "./logica.js";
import { abrirIndexedDB } from "./almacen.js";
import { NOMBRE_TIPO, C } from "./srs.js";
import { horaMadrid, difDias, sumarDias } from "./util.js";
import { pantallaMedallas, celebrar } from "./medallas_ui.js";
import { MEDALLAS } from "./logros.js";

const $ = (s) => document.querySelector(s);
const vista = $("#vista");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fechaCorta = (iso, hoy) => { const d = difDias(iso, hoy); return d === 0 ? "hoy" : d === 1 ? "mañana" : new Date(iso + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }); };
const fechaLarga = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const MODO = { nuevo: "nuevo", repaso: "repaso", practica: "práctica extra" };
let app, imagenes = null, persistente = null, ultimaRetro = null;


// ---------- arranque ----------
async function iniciar() {
  try {
    const [catalogo, cuarentena, indice, config] = await Promise.all([
      fetch("data/catalogo.json").then((r) => r.json()),
      fetch("data/cuarentena.json").then((r) => r.json()).then((x) => x.ids).catch(() => []),
      fetch("img/indice.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("data/config.json").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    imagenes = indice?.items && Object.keys(indice.items).length ? indice.items : null;
    const almacen = await abrirIndexedDB();
    app = await crearApp({ catalogo, almacen, cuarentena, imagenes, config });
  } catch (e) {
    vista.innerHTML = `<div class="error"><b>No se pudo abrir la app.</b><br>${esc(e.message)}<br><br>Si usas navegación privada, el navegador puede bloquear el almacenamiento local.</div>`;
    return;
  }
  if (navigator.storage?.persist) { try { persistente = (await navigator.storage.persisted()) || (await navigator.storage.persist()); } catch { persistente = false; } }
  if ("serviceWorker" in navigator) registrarSW();
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-ir]"); if (b) { e.preventDefault(); ir(b.dataset.ir); } });
  $("#zoom").addEventListener("click", () => ($("#zoom").hidden = true));
  ir(app.tieneProgreso() ? "inicio" : "bienvenida");
}
function registrarSW() {
  navigator.serviceWorker.register("sw.js").then((reg) => {
    reg.addEventListener("updatefound", () => {
      const w = reg.installing;
      w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) avisar("Hay una versión nueva de la app.", "Actualizar", () => { w.postMessage("activar"); }); });
    });
  }).catch(() => {});
  let recargado = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!recargado) { recargado = true; location.reload(); } });
}
function avisar(texto, boton, accion, ms = 0) {
  const a = $("#aviso");
  a.innerHTML = esc(texto) + (boton ? ` <button>${esc(boton)}</button>` : "");
  a.hidden = false;
  if (boton) a.querySelector("button").onclick = () => { a.hidden = true; accion(); };
  clearTimeout(avisar.t); if (ms) avisar.t = setTimeout(() => (a.hidden = true), ms);
}
function ir(pantalla, ...args) {
  if (!app.tieneProgreso() && !["bienvenida", "progreso"].includes(pantalla)) pantalla = "bienvenida";
  ({ inicio, bienvenida, pregunta, correccion, hoja, resumen, estadisticas, progreso, medallas: () => pantallaMedallas(app, vista) })[pantalla](...args);
  window.scrollTo(0, 0); vista.focus({ preventScroll: true });
}

// ---------- bienvenida (sin progreso) ----------
function bienvenida() {
  vista.innerHTML = `
    <h1>Bienvenido</h1>
    <p>Esta app guarda tu progreso <b>solo en este navegador</b>. Para seguir donde lo dejaste, carga tu progreso: el <code>state.json</code> del sistema anterior o una copia descargada desde la app.</p>
    <button class="btn prim" data-ir="progreso">Cargar mi progreso</button>
    <button class="btn" id="cero">Empezar de cero</button>
    <p class="suave">Empezar de cero no borra nada que tengas en otro sitio, pero aquí empezarías sin historial.</p>`;
  $("#cero").onclick = async () => { if (confirm("¿Empezar sin progreso previo? Lo podrás sustituir más tarde cargando una copia.")) { await app.empezarDeCero(); ir("inicio"); } };
}

// ---------- inicio ----------
function inicio() {
  const e = app.estadisticas(), hoy = app.hoy(), ses = app.sesion(), pend = app.preguntaPendiente();
  const hechaHoy = ses && !pend && ses.fecha === hoy;
  // Plan del día: repasos que vencen hoy (tipos activos) y sesiones aproximadas para hacerlos
  const ex = app.excluidos(), man = sumarDias(hoy, 1);
  let debidos = 0, manana = 0;
  for (const [id, r] of Object.entries(app.estado()?.items ?? {})) {
    if (!app.P.has(id) || ex.has(id)) continue;
    if ((r.vence ?? "9999") <= hoy) debidos++; else if (r.vence === man) manana++;
  }
  let sesNec = 0; for (let d = debidos, N = C.SESION_N; d > 0; sesNec++) d -= d <= 3 * N ? Math.ceil(0.6 * N) : N - 1;
  const hechasHoy = (app.datos.logros?.sesiones ?? []).filter((x) => x.fecha === hoy).length;
  const plan = `<p class="plan">${hechasHoy ? `<span>Hoy llevas <b>${hechasHoy}</b> sesi${hechasHoy === 1 ? "ón" : "ones"}</span>` : ""}${debidos
      ? `<span>Te ${debidos === 1 ? "toca <b>1 repaso</b>" : `tocan <b>${debidos} repasos</b>`} · ${sesNec === 1 ? "1 sesión" : `unas ${sesNec} sesiones`}</span>`
      : `<span>✅ Repasos de hoy al día${hechasHoy ? "" : ""}</span>`}<span class="suave">Mañana: ${manana}</span></p>`;
  let estadoDia;
  if (pend) estadoDia = `<p>Tienes la sesión <b>${esc(ses.sesion)}</b> a medias: vas por la <b>${pend.n}/${ses.preguntas.length}</b>.</p><button class="btn prim" id="empezar">Continuar sesión</button>`;
  else if (hechaHoy) estadoDia = `<p>${debidos ? "Aún te quedan repasos de hoy." : "Has hecho los repasos de hoy. Otra sesión te trae países nuevos y práctica."}</p><button class="btn ${debidos ? "prim" : ""}" id="empezar">Otra sesión de ${C.SESION_N}</button>`;
  else if (horaMadrid() >= 7) estadoDia = `<p>Tu sesión de hoy está lista: ${C.SESION_N} preguntas${e.repasos_pendientes_hoy ? `, con repasos pendientes primero` : ""}.</p><button class="btn prim" id="empezar">Empezar sesión</button>`;
  else estadoDia = `<p>La sesión de hoy estará lista a las 07:00. Si quieres, puedes empezarla ya.</p><button class="btn prim" id="empezar">Empezar ahora</button>`;
  const ult = app.datos.meta?.ultima_exportacion, diasSinCopia = ult ? difDias(hoy, ult.slice(0, 10)) : null;
  const avisoCopia = diasSinCopia === null || diasSinCopia >= 7
    ? `<div class="banda">💾 Tu progreso solo vive en este navegador. ${ult ? `Tu última copia es de hace ${diasSinCopia} días.` : "Aún no has descargado ninguna copia."} <a href="#" data-ir="progreso">Descargar copia</a></div>` : "";
  const avisoPersist = persistente === false ? `<div class="banda">El navegador no garantiza conservar los datos. Instala la app en la pantalla de inicio y descarga copias a menudo.</div>` : "";
  const beta = app.config?.modo === "beta" ? `<div class="banda beta">🧪 <b>${esc(app.config.nombre)}</b>: de momento solo salen países y capitales. Tu progreso del resto se guarda para cuando lleguen.</div>` : "";
  const sinImg = !imagenes ? `<div class="banda">🖼️ Aún no hay imágenes cargadas: las preguntas mostrarán «imagen no disponible».</div>` : "";
  const { racha, medallas: med } = app.medallas(), gan = app.ganadas();
  const proxR = MEDALLAS.find((m) => m.tipo === "racha" && m.n > racha.actual);
  const nGan = MEDALLAS.filter((m) => !med[m.id].oculta && (gan[m.id] || med[m.id].nivel)).length, nTot = MEDALLAS.filter((m) => !med[m.id].oculta).length;
  const bloqueRacha = `<button class="tarjeta racha pulsable" data-ir="medallas">
      <div class="llama ${racha.hoyHecho ? "" : "apagada"}">🔥<b>${racha.actual}</b></div>
      <div class="izq"><p><b>${racha.actual ? `Racha de ${racha.actual} día${racha.actual === 1 ? "" : "s"}` : "Empieza una racha hoy"}</b>${racha.hoyHecho ? " ✓" : ""}</p>
      <p class="suave">${racha.hoyHecho ? "Hoy ya cuenta." : racha.actual ? "Contesta al menos una pregunta hoy para no perderla." : "Cada día que uses la app suma."}${proxR ? ` Próxima medalla: ${proxR.n} días.` : ""}</p>
      <p class="suave">🏅 ${nGan} de ${nTot} medallas · ver vitrina ›</p></div></button>`;
  vista.innerHTML = `
    <h1>${esc(fechaLarga(hoy).replace(/^./, (c) => c.toUpperCase()))}</h1>
    ${beta}${avisoCopia}${avisoPersist}${sinImg}
    <div class="tarjeta">${plan}${estadoDia}</div>
    ${bloqueRacha}
    <div class="cifras">
      <div class="cifra"><b>${e.repasos_pendientes_hoy}</b><span>repasos hoy</span></div>
      <div class="cifra"><b>${racha.max}</b><span>récord de racha</span></div>
      <div class="cifra"><b>${e.acierto_7_dias ?? "–"}${e.acierto_7_dias != null ? "%" : ""}</b><span>acierto 7 días</span></div>
    </div>
    <div class="tarjeta">
      <p><b>${e.vistos}</b> de ${e.total} vistos · <b>${e.consolidados}</b> consolidados · <b>${e.aprendidos}</b> aprendidos</p>
      <div class="barra-prog"><i style="width:${(100 * e.vistos / e.total).toFixed(1)}%"></i></div>
      <button class="btn" data-ir="estadisticas">Ver estadísticas</button>
    </div>
    ${pend ? `<button class="btn peligro" id="abandonar">Descartar la sesión a medias</button>` : ""}
    <p class="suave">Versión ${APP_VERSION} · funciona sin conexión.</p>`;
  $("#empezar").onclick = empezar;

  app.verMedallas().then(celebrar);
  if ($("#abandonar")) $("#abandonar").onclick = async () => {
    if (confirm("¿Descartar esta sesión? Lo que ya corregiste se queda; las preguntas sin contestar volverán a salir más adelante.")) { await app.abandonarSesion(); ir("inicio"); }
  };
}
async function empezar() {
  const r = await app.sesionActual();
  if (!r.sesion) { avisar("Por ahora no hay preguntas suficientes para otra sesión completa: el ritmo de nuevas está frenado. ¡Por hoy has terminado!", null, null, 6000); return; }
  ir("pregunta");
}

// ---------- pregunta ----------
function imgsHTML(it, solucion = false) {
  const im = imagenes?.[it.id];
  if (solucion) return im?.a ? `<div class="imgs"><figure><img src="${esc(im.a)}" alt="Mapa con la respuesta" loading="lazy"><figcaption>Solución</figcaption></figure></div>` : "";
  const dos = it.imagenes === "cercana+contexto";
  const caja = (src, cap) => src ? `<figure><img src="${esc(src)}" alt="${cap}" decoding="async"><figcaption>${cap}</figcaption></figure>`
    : `<figure><div class="sinimg">Imagen no disponible todavía<br>(${cap.toLowerCase()})</div></figure>`;
  if (it.tipo === "bandera") return `<div class="imgs">${caja(im?.q, "Bandera")}</div>`;
  return `<div class="imgs ${dos ? "dos" : ""}">${caja(im?.q, dos ? "Vista cercana" : "Mapa")}${dos ? caja(im?.c, "Vista de contexto") : ""}</div>`;
}
function puntos(ses, actual) { return `<div class="puntos">${ses.preguntas.map((q) => `<i class="${q.corregida ? "h" : ""} ${q.n === actual ? "a" : ""}"></i>`).join("")}</div>`; }
function pregunta() {
  const ses = app.sesion(), q = app.preguntaPendiente();
  if (!q) return ir("hoja");
  const it = app.P.get(q.id), tot = ses.preguntas.length;
  vista.innerHTML = `
    <div class="cabeza"><span class="num">${q.n}/${tot}</span><span class="etiqueta">${esc(NOMBRE_TIPO[it.tipo])}${q.modo === "repaso" ? " · repaso" : ""}</span></div>
    ${puntos(ses, q.n)}
    <p class="pregunta">${esc(it.tipo === "pais" ? "¿Qué país está marcado en rojo y cuál es su capital?" : it.pregunta)}</p>
    ${imgsHTML(it)}
    <form class="respuesta" id="f" autocomplete="off">
      <input id="r" type="text" enterkeyhint="send" autocomplete="off" autocorrect="off" autocapitalize="sentences" spellcheck="false"
        placeholder="${it.tipo === "pais" ? "País y capital: «Kenia, Nairobi»" : "Tu respuesta"}" aria-label="Tu respuesta">
      <button class="btn prim" type="submit">${q.n < tot ? "Siguiente" : "Terminar y corregir"}</button>
    </form>
    <button class="btn" id="nose">No lo sé</button>
    <p class="suave">Las correcciones salen al final, cuando respondas las ${tot}.</p>`;
  zoomImgs();
  let enviando = false;
  const enviar = async (txt) => {
    if (enviando) return; enviando = true;
    vista.querySelectorAll("button").forEach((b) => (b.disabled = true));
    try { await app.responder(q.n, txt); ultimaRetro = null; ir("pregunta"); }
    catch (e) { enviando = false; avisar("No se pudo guardar la respuesta: " + e.message, null, null, 8000); vista.querySelectorAll("button").forEach((b) => (b.disabled = false)); }
  };
  $("#f").onsubmit = (e) => { e.preventDefault(); const v = $("#r").value.trim(); if (!v) { $("#r").focus(); return; } enviar(v); };
  $("#nose").onclick = () => enviar("no lo sé");
  setTimeout(() => $("#r")?.focus(), 50);
}

// ---------- corrección ----------
const ELOGIOS = ["¡Bien!", "¡Correcto!", "¡Eso es!", "¡Perfecto!", "¡Muy bien!", "¡Exacto!"];
/** Bloque de corrección de la pregunta n (resultado, partes, dato, mapa solución, próximo repaso y reevaluar). */
function bloqueCorreccion(n) {
  const ses = app.sesion(), q = ses.preguntas.find((x) => x.n === n), it = app.P.get(q.id), det = q.detalle ?? {};
  const r = ultimaRetro?.q?.n === n && ultimaRetro.q.respuesta === q.respuesta && ultimaRetro.retro ? ultimaRetro.retro
    : { ...app.srs.retroalimentacion(it, q, { partes: q.partes }, app.hoy()), ...(det.lineas ? { lineas: det.lineas, interpretada: det.interpretada, nota: det.nota } : {}) };
  r.dias = Math.max(0, difDias(q.proxima_revision, app.hoy()));
  const ok = q.resultado === "correcta", medio = q.resultado === "parcial" || q.resultado === "casi";
  const titulo = ok ? ELOGIOS[(n + ses.sesion.length) % ELOGIOS.length]
    : q.resultado === "parcial" ? "A medias (cuenta como fallo)" : q.resultado === "casi" ? "Casi: concreta un poco más" : q.resultado === "vacia" ? "Sin respuesta" : "No era eso";
  return `<div class="resultado ${ok ? "ok" : medio ? "medio" : "mal"}">
      <h2>${ok ? "✅" : medio ? "🟠" : "❌"} ${esc(titulo)}</h2>
      ${!ok ? `<p>Era <b>${esc(r.correcta)}</b>.</p>` : it.tipo === "pais" ? `<p><b>${esc(r.correcta)}</b></p>` : `<p><b>${esc(it.nombre)}</b></p>`}
      ${r.lineas.length ? `<ul class="partes">${r.lineas.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>` : ""}
      ${r.interpretada ? `<p>Lo que dijiste es <b>${esc(r.interpretada)}</b>.</p>` : ""}
      ${q.resultado === "casi" && r.nota ? `<p class="suave">(${esc(r.nota)})</p>` : ""}
      <p class="suave">Tu respuesta: «${esc(q.respuesta)}»</p>
    </div>
    <div class="dato">💡 ${esc(it.dato)}</div>
    ${imgsHTML(it, true)}
    <p class="suave">Próximo repaso: ${esc(fechaLarga(q.proxima_revision))} (${r.dias === 1 ? "mañana" : `en ${r.dias} días`}).</p>
    ${!ok ? `<details><summary>El dictado se equivocó / quiero reevaluar</summary>
      <form class="respuesta reeval" data-n="${n}"><input type="text" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Lo que querías decir"><button class="btn" type="submit">Reevaluar</button></form>
      <p class="suave">Se deshace la corrección anterior y se puntúa la nueva. Solo cuenta como acierto si la nueva respuesta es correcta.</p></details>` : ""}`;
}
function activarReevaluar(trasReevaluar) {
  vista.querySelectorAll("form.reeval").forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault(); const v = f.querySelector("input").value.trim(); if (!v) return;
    const n = Number(f.dataset.n);
    ultimaRetro = await app.responder(n, v, { reevaluar: true }); trasReevaluar(n); celebrar(await app.verMedallas());
  }));
}
function zoomImgs() { vista.querySelectorAll(".imgs img").forEach((img) => (img.onclick = () => { $("#zoom img").src = img.src; $("#zoom").hidden = false; })); }

function correccion(n, revision = false) {
  const ses = app.sesion(), q = ses.preguntas.find((x) => x.n === n), it = app.P.get(q.id), tot = ses.preguntas.length;
  const quedan = ses.preguntas.some((x) => !x.corregida);
  vista.innerHTML = `
    <div class="cabeza"><span class="num">${n}/${tot}</span><span class="etiqueta">${esc(NOMBRE_TIPO[it.tipo])}</span></div>
    ${puntos(ses, n)}
    ${bloqueCorreccion(n)}
    <button class="btn prim" id="sig">${revision ? (n < tot ? `Siguiente corrección (${n + 1}/${tot})` : "Ver resumen") : quedan ? "Siguiente" : "Ver resumen"}</button>`;
  zoomImgs();
  $("#sig").onclick = () => (revision ? (n < tot ? ir("correccion", n + 1, true) : ir("resumen")) : ir(quedan ? "pregunta" : "resumen"));
  activarReevaluar((m) => ir("correccion", m, revision));
}

// ---------- hoja: las 10 preguntas en una pantalla, dictado seguido ----------
function hoja(irA = null) {
  const ses = app.sesion();
  if (!ses) return ir("inicio");
  const tot = ses.preguntas.length, pend = ses.preguntas.filter((q) => !q.corregida);
  const bor = { ...(ses.borradores ?? {}) };
  const ac = ses.preguntas.filter((q) => q.resultado === "correcta").length;
  const cabecera = pend.length
    ? `<h1>${esc(ses.sesion)} · ${tot} preguntas</h1><p class="suave">Escribe la respuesta de cada pregunta y pulsa «Corregir» al final.${ses.preguntas.some((q) => app.P.get(q.id).tipo === "pais") ? " En país y capital, di las dos cosas." : ""}</p>`
    : `<h1>${ac}/${tot} aciertos</h1><p>Aquí tienes las ${tot} correcciones. <a href="#" data-ir="resumen">Ver resumen</a></p>`;
  vista.innerHTML = `${cabecera}
    ${ses.preguntas.map((q) => {
      const it = app.P.get(q.id);
      return `<section class="preg tarjeta" id="p${q.n}" data-n="${q.n}">
        <div class="cabeza"><span class="num">${q.n}/${tot}</span><span class="etiqueta">${esc(NOMBRE_TIPO[it.tipo])}${q.modo === "repaso" ? " · repaso" : ""}</span></div>
        ${q.corregida ? "" : `<p class="pregunta corta">${esc(it.tipo === "pais" ? "¿Qué país está marcado y cuál es su capital?" : it.pregunta)}</p>${imgsHTML(it)}`}
        ${q.corregida ? bloqueCorreccion(q.n) : `<input class="caja" id="r${q.n}" data-n="${q.n}" type="text" enterkeyhint="next" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="${it.tipo === "pais" ? "País y capital" : "Tu respuesta"}" value="${esc(bor[q.n] ?? "")}">`}
      </section>`;
    }).join("")}
    ${pend.length ? `<div class="espaciador"></div>
    <div class="dock">
      <div class="oido" id="oido"></div>
      <button class="btn prim" id="corregir">Corregir</button>
    </div>` : `<button class="btn prim" data-ir="resumen">Ver resumen</button>`}`;
  zoomImgs();
  activarReevaluar((n) => hoja(n));
  if (irA) document.getElementById("p" + irA)?.scrollIntoView({ block: "start" });
  if (!pend.length) { app.verMedallas().then(celebrar); return; }

  let tGuardar = null;
  const guardarBor = () => { clearTimeout(tGuardar); tGuardar = setTimeout(() => app.guardarBorradores(bor).catch(() => {}), 400); };
  const cajas = () => [...vista.querySelectorAll("input.caja")];
  cajas().forEach((c) => (c.oninput = () => { bor[c.dataset.n] = c.value; c.classList.toggle("llena", !!c.value.trim()); guardarBor(); }));
  cajas().forEach((c) => { c.classList.toggle("llena", !!c.value.trim()); c.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); const sig = cajas().find((x) => !x.value.trim() && x !== c); sig ? sig.focus() : $("#corregir").focus(); } }; });

  const oido = $("#oido");
  const contar = () => { const n = cajas().filter((c) => c.value.trim()).length; oido.textContent = `${n} de ${pend.length} respondidas`; };
  cajas().forEach((c) => c.addEventListener("input", contar)); contar();
  $("#corregir").onclick = async () => {
    const vacias = cajas().filter((c) => !c.value.trim());
    if (vacias.length && !confirm(`Hay ${vacias.length} sin responder (${vacias.map((c) => c.dataset.n).join(", ")}). ¿Las cuento como «no lo sé»?`)) { vacias[0].focus(); return; }
    $("#corregir").disabled = true;
    try {
      for (const c of cajas()) { const r = await app.responder(Number(c.dataset.n), c.value.trim() || "no lo sé"); ultimaRetro = null; }
      await app.guardarBorradores({});
      hoja(); window.scrollTo(0, 0);
    } catch (e) { $("#corregir").disabled = false; avisar("No se pudo corregir: " + e.message, null, null, 8000); }
  };
}

// ---------- resumen ----------
function resumen() {
  const ses = app.sesion();
  if (!ses) return ir("inicio");
  const ac = ses.preguntas.filter((q) => q.resultado === "correcta").length;
  const ic = { correcta: "✅", parcial: "🟠", casi: "🟡", incorrecta: "❌", vacia: "❌" };
  const nuevos = ses.preguntas.filter((q) => q.modo === "nuevo").length;
  const vuelven = ses.preguntas.filter((q) => q.resultado !== "correcta").length;
  vista.innerHTML = `
    <h1>${ac}/${ses.preguntas.length} aciertos</h1>
    <p>${nuevos ? `${nuevos} pregunta${nuevos > 1 ? "s" : ""} nueva${nuevos > 1 ? "s" : ""}. ` : ""}${vuelven ? `${vuelven === 1 ? "La que fallaste vuelve" : `Las ${vuelven} que fallaste vuelven`} mañana.` : "¡Sin fallos!"}</p>
    <div class="tarjeta"><ul class="lista">${ses.preguntas.map((q) => {
      const it = app.P.get(q.id);
      return `<li><span class="ic">${ic[q.resultado] ?? "·"}</span><span class="tx"><b>${q.n}.</b> ${esc(it.tipo === "pais" ? `${it.nombre} (${it.capitales.map((c) => c.nombre).join(" / ")})` : it.nombre)}<br>
        <span class="suave">${esc(MODO[q.modo])} · vuelve ${q.proxima_revision ? (difDias(q.proxima_revision, app.hoy()) <= 1 ? "" : "el ") + esc(fechaCorta(q.proxima_revision, app.hoy())) : "–"}</span></span>
        ${q.resultado !== "correcta" ? `<button class="btn" style="width:auto;margin:0;padding:6px 10px" data-re="${q.n}">Revisar</button>` : ""}</li>`;
    }).join("")}</ul></div>
    <button class="btn" id="vercorr">Ver las correcciones una a una</button>
    <button class="btn prim" data-ir="inicio">Volver al inicio</button>
    <button class="btn" data-ir="progreso">Descargar copia del progreso</button>`;
  $("#vercorr").onclick = () => { ultimaRetro = null; ir("hoja"); };
  app.verMedallas().then(celebrar);
  vista.querySelectorAll("[data-re]").forEach((b) => (b.onclick = () => { ultimaRetro = null; ir("hoja", Number(b.dataset.re)); }));
}

// ---------- estadísticas ----------
function estadisticas() {
  const e = app.estadisticas();
  vista.innerHTML = `
    <h1>Estadísticas</h1>
    <div class="cifras">
      <div class="cifra"><b>${e.vistos}</b><span>vistos de ${e.total}</span></div>
      <div class="cifra"><b>${e.consolidados}</b><span>consolidados</span></div>
      <div class="cifra"><b>${e.aprendidos}</b><span>aprendidos</span></div>
      <div class="cifra"><b>${e.repasos_pendientes_hoy}</b><span>repasos hoy</span></div>
      <div class="cifra"><b>${e.racha_dias}</b><span>días de racha</span></div>
      <div class="cifra"><b>${e.acierto_total ?? "–"}${e.acierto_total != null ? "%" : ""}</b><span>acierto total</span></div>
    </div>
    <p class="suave">Acierto últimos 7 días: ${e.acierto_7_dias ?? "–"}${e.acierto_7_dias != null ? "%" : ""} · ${e.intentos} intentos. Consolidado = ${C.CONSOLIDADA_REPS} aciertos seguidos; aprendido = repaso a ${C.APRENDIDA_DIAS} días o más.</p>
    ${Object.keys(e.por_tipo).map((T) => { const v = e.por_tipo[T]; return `<div class="tarjeta"><h2>${esc(NOMBRE_TIPO[T])}</h2>
      <p>${v.vistos}/${v.total} vistos · ${v.consolidados} consolidados · ${v.aprendidos} aprendidos · acierto ${v.acierto ?? "–"}${v.acierto != null ? "%" : ""}</p>
      <table><tr><th>Nivel</th><th>Vistos</th><th>Consolidados</th><th></th></tr>
      ${Object.entries(v.niveles).map(([n, x]) => `<tr><td>N${n}</td><td>${x.vistos}/${x.total}</td><td>${x.consolidados}</td><td>${x.abierto ? "" : "🔒"}</td></tr>`).join("")}</table></div>`; }).join("")}
    ${e.puntos_debiles.length ? `<div class="tarjeta"><h2>Puntos débiles</h2><ul class="lista">${e.puntos_debiles.map((p) => `<li><span class="tx">${esc(p.nombre)} <span class="suave">· ${esc(NOMBRE_TIPO[p.tipo])}</span></span><span>${p.fallos} fallos</span></li>`).join("")}</ul></div>` : ""}`;
}

// ---------- progreso: descargar / cargar ----------
function descargar(nombre, texto) {
  const url = URL.createObjectURL(new Blob([texto], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: nombre });
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function progreso() {
  const copias = app.tieneProgreso() ? await app.listarCopias() : [];
  const meta = app.datos.meta ?? {};
  vista.innerHTML = `
    <h1>Tu progreso</h1>
    <p>Se guarda solo en este navegador: no se sube a ningún sitio ni se sincroniza. Para pasarlo a otro móvil u ordenador, descárgalo aquí y cárgalo allí.</p>
    ${app.tieneProgreso() ? `<button class="btn prim" id="desc">⬇️ Descargar progreso</button>` : ""}
    <label class="btn ${app.tieneProgreso() ? "" : "prim"}">⬆️ Cargar / recuperar progreso<input type="file" id="fich" accept="application/json,.json"></label>
    <div id="previa"></div>
    ${meta.copia_previa ? `<button class="btn" id="deshacer">↩️ Deshacer la última carga</button>` : ""}
    ${copias.length ? `<details class="tarjeta"><summary>Copias automáticas en este dispositivo (${copias.length})</summary><ul class="lista">${copias.map((c) =>
      `<li><span class="tx">${esc(c.creada.slice(0, 16).replace("T", " "))} <span class="suave">· ${esc(c.motivo)}</span></span><button class="btn" style="width:auto;margin:0;padding:6px 10px" data-copia="${c.id}">Descargar</button></li>`).join("")}</ul></details>` : ""}
    <details class="tarjeta"><summary>Importante sobre tus datos</summary>
      <p>• Si borras los datos del navegador, usas navegación privada o cambias de móvil, el progreso de aquí se pierde. Descarga una copia a menudo.</p>
      <p>• Si usas la app en dos dispositivos, los cambios no se juntan solos: carga siempre la copia más reciente en el que vayas a usar.</p>
      <p>• Almacenamiento persistente: ${persistente === true ? "concedido ✅" : persistente === false ? "no concedido (instala la app en la pantalla de inicio)" : "no disponible"}.</p>
      <p>• La web es pública para quien tenga el enlace: el catálogo con las respuestas va en ella. Tu progreso no.</p>
    </details>`;
  if ($("#desc")) $("#desc").onclick = async () => { const ex = await app.exportar(); descargar(ex.nombre, ex.texto); await app.anotarExportacion(); avisar("Copia descargada: " + ex.nombre, null, null, 4000); };
  vista.querySelectorAll("[data-copia]").forEach((b) => (b.onclick = async () => { const c = await app.leerCopia(Number(b.dataset.copia)); descargar(c.nombre.replace(".json", "-copia-previa.json"), c.texto); }));
  if ($("#deshacer")) $("#deshacer").onclick = async () => {
    if (!confirm("¿Volver al progreso que tenías antes de la última carga?")) return;
    const r = await app.deshacerImportacion(); avisar(r.ok ? "Hecho: has vuelto al progreso anterior." : r.motivo, null, null, 5000); if (r.ok) ir("inicio");
  };
  $("#fich").onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    const a = await app.analizarImportacion(await f.text());
    const caja = $("#previa");
    if (!a.ok) { caja.innerHTML = `<div class="error"><b>No se puede cargar «${esc(f.name)}».</b><br>${a.errores.map(esc).join("<br>")}<br>No se ha cambiado nada.</div>`; return; }
    const v = a.vista_previa, fila = (t, x, y) => `<tr><td>${t}</td><td>${esc(x ?? "–")}</td><td>${esc(y ?? "–")}</td></tr>`;
    caja.innerHTML = `<div class="tarjeta"><h2>Vista previa</h2>
      <p class="suave">«${esc(f.name)}» · ${esc(v.origen)}${v.exportado_en ? ` · exportado el ${esc(v.exportado_en.slice(0, 16).replace("T", " "))}` : ""}</p>
      <table><tr><th></th><th>Fichero</th><th>Ahora aquí</th></tr>
      ${fila("Ítems vistos", v.fichero.vistos, v.actual?.vistos)}${fila("Intentos", v.fichero.intentos, v.actual?.intentos)}
      ${fila("Acierto", v.fichero.acierto != null ? v.fichero.acierto + "%" : null, v.actual?.acierto != null ? v.actual.acierto + "%" : null)}
      ${fila("Consolidados", v.fichero.consolidados, v.actual?.consolidados)}${fila("Sesión", v.fichero.sesion, v.actual?.sesion)}</table>
      ${a.avisos.map((x) => `<div class="banda">${esc(x)}</div>`).join("")}
      ${v.actual ? `<p>Se sustituirá lo que tienes ahora. Antes se guarda una copia automática y podrás deshacerlo.</p>` : ""}
      <div class="fila"><button class="btn" id="cancelar">Cancelar</button><button class="btn prim" id="confirmar">Cargar este progreso</button></div></div>`;
    $("#cancelar").onclick = () => (caja.innerHTML = "");
    $("#confirmar").onclick = async () => {
      $("#confirmar").disabled = true;
      try { await app.aplicarImportacion(a.datos); avisar("Progreso cargado.", null, null, 4000); ir("inicio"); }
      catch (err) { caja.innerHTML = `<div class="error">No se pudo guardar: ${esc(err.message)}. Tus datos anteriores siguen intactos.</div>`; }
    };
  };
}

iniciar();
