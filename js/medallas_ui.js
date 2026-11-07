// Vitrina de medallas, medallas en SVG y celebración al ganarlas.
import { MEDALLAS, CATEGORIAS, NIVELES, NOMBRE_NIVEL, EXPLICA_NIVEL, porId } from "./logros.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const METAL = {
  bronce: ["#ffd9b8", "#c77d42", "#7a4520", "#5c3214"], plata: ["#ffffff", "#c9d0d6", "#7f8a94", "#5b646c"],
  oro: ["#fff6c2", "#f5c630", "#b8860b", "#7d5a00"], nada: ["#eceeed", "#c8ccca", "#9aa09c", "#7d827f"],
};
const CINTA = { curiosas: ["#db2777", "#fde047"], eeuu: ["#1e3a8a", "#ef4444"], racha: ["#e4572e", "#f3a712"], mundo: ["#1d4ed8", "#60a5fa"], banderas: ["#b91c1c", "#fbbf24"], fisica: ["#0e7490", "#5eead4"], espana: ["#b91c1c", "#facc15"], hitos: ["#6d28d9", "#c4b5fd"] };
let uid = 0;

export function medallaSVG(m, nivel, tam = 84) {
  const k = ++uid, [c1, c2, c3, c4] = METAL[nivel ?? "nada"], [r1, r2] = CINTA[m.cat] ?? CINTA.hitos, off = !nivel;
  const estrellas = nivel ? NIVELES.indexOf(nivel) + 1 : 0;
  return `<svg class="medalla ${off ? "off" : ""}" width="${tam}" height="${tam * 1.2}" viewBox="0 0 100 120" role="img" aria-label="${esc(m.nombre)}${nivel ? " · " + NOMBRE_NIVEL[nivel] : " · bloqueada"}">
    <defs><radialGradient id="g${k}" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="${c1}"/><stop offset=".45" stop-color="${c2}"/><stop offset="1" stop-color="${c3}"/></radialGradient>
    <linearGradient id="b${k}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c3}"/><stop offset="1" stop-color="${c4}"/></linearGradient></defs>
    <path d="M30 2 L46 2 L56 44 L40 50 Z" fill="${off ? "#b9bdbb" : r1}"/><path d="M70 2 L54 2 L44 44 L60 50 Z" fill="${off ? "#d3d6d4" : r2}"/>
    <path d="M30 2 L46 2 L48 10 L32 10 Z M70 2 L54 2 L52 10 L68 10 Z" fill="rgba(0,0,0,.12)"/>
    <circle cx="50" cy="76" r="38" fill="url(#b${k})"/>
    <circle cx="50" cy="76" r="34" fill="url(#g${k})"/>
    <circle cx="50" cy="76" r="27" fill="none" stroke="${c3}" stroke-opacity=".55" stroke-width="1.5" stroke-dasharray="2 3"/>
    <ellipse cx="38" cy="60" rx="14" ry="7" fill="#fff" opacity="${off ? 0.15 : 0.35}" transform="rotate(-30 38 60)"/>
    <text x="50" y="87" text-anchor="middle" font-size="30" class="emo">${m.emoji}</text>
    ${off ? `<circle cx="78" cy="104" r="11" fill="#7d827f"/><text x="78" y="109" text-anchor="middle" font-size="12">🔒</text>` : ""}
    ${estrellas > 1 ? `<text x="50" y="118" text-anchor="middle" font-size="11" fill="${c3}">${"★".repeat(estrellas)}</text>` : ""}
  </svg>`;
}

function textoProgreso(m, e) {
  if (e.oculta) return "";
  if (m.tipo === "racha") return e.nivel ? "¡Conseguida!" : `${e.progreso}/${e.meta} días`;
  if (m.tipo === "evento") return e.nivel ? "¡Conseguida!" : "Por conseguir";
  if (m.tipo === "contador") {
    const f = (v) => (e.pct ? Math.round(v * 100) + " %" : v);
    return e.siguiente ? `${f(e.progreso)} de ${f(e.meta)} · ${NOMBRE_NIVEL[e.siguiente].toLowerCase()}` : `${NOMBRE_NIVEL[e.nivel]} ✓`;
  }
  return e.siguiente ? `${e.progreso}/${e.meta} ${e.siguiente === "bronce" ? "aprendidos" : "para " + NOMBRE_NIVEL[e.siguiente].toLowerCase()}` : "Oro ✓";
}

export function pantallaMedallas(app, vista) {
  const { medallas, racha } = app.medallas(), ganadas = app.ganadas();
  const visibles = MEDALLAS.filter((m) => !medallas[m.id].oculta);
  const nivelDe = (m) => ganadas[m.id]?.nivel ?? medallas[m.id].nivel;
  const total = visibles.length, conseguidas = visibles.filter(nivelDe).length;
  const proxRacha = MEDALLAS.find((m) => m.tipo === "racha" && m.n > racha.actual);
  vista.innerHTML = `
    <h1>Medallas</h1>
    <div class="tarjeta racha">
      <div class="llama">🔥<b>${racha.actual}</b></div>
      <div><p><b>${racha.actual} día${racha.actual === 1 ? "" : "s"} seguido${racha.actual === 1 ? "" : "s"}</b> · récord ${racha.max}</p>
      ${proxRacha ? `<div class="barra-prog"><i style="width:${(100 * racha.actual / proxRacha.n).toFixed(1)}%"></i></div><p class="suave">Próxima: «${esc(proxRacha.nombre)}» a los ${proxRacha.n} días${racha.hoyHecho ? "" : " · hoy aún no has jugado"}</p>` : ""}</div>
    </div>
    <p class="suave">${conseguidas} de ${total} medallas conseguidas. Las de colecciones solo se ganan cuando la repetición espaciada da por aprendidos todos sus sitios: bronce con todos aprendidos (repaso a 21 días o más), plata a 60 días y oro a 120, el máximo. Una medalla ganada no se pierde.</p>
    ${Object.entries(CATEGORIAS).map(([cat, nom]) => {
      const ms = visibles.filter((m) => m.cat === cat);
      return `<h2>${esc(nom)}</h2><div class="vitrina">${ms.map((m) => `<button class="pieza" data-med="${m.id}">${medallaSVG(m, nivelDe(m))}<b>${esc(m.nombre)}</b><span>${esc(textoProgreso(m, medallas[m.id]))}</span></button>`).join("")}</div>`;
    }).join("")}
    <dialog id="detalle" class="detalle"></dialog>`;
  const dlg = vista.querySelector("#detalle");
  vista.querySelectorAll("[data-med]").forEach((b) => (b.onclick = () => {
    const m = porId[b.dataset.med], e = medallas[m.id], g = ganadas[m.id], niv = nivelDe(m);
    const filas = m.grupo ? NIVELES.map((n) => `<li>${niv && NIVELES.indexOf(niv) >= NIVELES.indexOf(n) ? "✅" : "▫️"} <b>${NOMBRE_NIVEL[n]}</b>: ${EXPLICA_NIVEL[n]} <span class="suave">(${e.cuenta[n]}/${e.total})</span></li>`).join("")
      : m.tipo === "contador" ? NIVELES.map((n) => `<li>${niv && NIVELES.indexOf(niv) >= NIVELES.indexOf(n) ? "✅" : "▫️"} <b>${NOMBRE_NIVEL[n]}</b>: ${m.pct ? Math.round(m.umbrales[n] * 100) + " %" : m.umbrales[n]}</li>`).join("") : "";
    dlg.innerHTML = `<div class="centro">${medallaSVG(m, niv, 150)}<h2>${esc(m.nombre)}</h2><p>${esc(m.desc)}</p>
      ${filas ? `<ul class="partes izq">${filas}</ul>` : ""}
      <p class="suave">${g ? `Conseguida el ${esc(g.fecha)}${g.nivel ? " · " + NOMBRE_NIVEL[g.nivel] : ""}` : esc(textoProgreso(m, e))}</p>
      <button class="btn prim" id="cerrar">Cerrar</button></div>`;
    dlg.showModal(); dlg.querySelector("#cerrar").onclick = () => dlg.close();
  }));
}

/** Muestra una celebración con las medallas nuevas. `lista` = [{id, nivel}] */
export function celebrar(lista) {
  if (!lista?.length) return Promise.resolve();
  return new Promise((ok) => {
    const capa = document.createElement("div");
    capa.className = "fiesta";
    const colores = ["#f5c630", "#e4572e", "#1f7a45", "#60a5fa", "#c4b5fd", "#fb7185"];
    const confeti = Array.from({ length: 60 }, (_, i) => `<i style="left:${(i * 37) % 100}%;background:${colores[i % colores.length]};animation-delay:${(i % 12) * 0.08}s;animation-duration:${1.6 + (i % 5) * 0.3}s"></i>`).join("");
    const ms = lista.slice(0, 4).map(({ id, nivel }) => { const m = porId[id]; return m ? `<div class="pieza grande">${medallaSVG(m, nivel, 120)}<b>${esc(m.nombre)}</b><span>${m.grupo || m.tipo === "contador" ? NOMBRE_NIVEL[nivel] + " · " : ""}${esc(m.desc)}</span></div>` : ""; }).join("");
    capa.innerHTML = `<div class="confeti">${confeti}</div><div class="caja"><h2>${lista.length > 1 ? "¡Nuevas medallas!" : "¡Nueva medalla!"}</h2><div class="vitrina-fiesta">${ms}</div>
      ${lista.length > 4 ? `<p class="suave">…y ${lista.length - 4} más en la vitrina.</p>` : ""}<button class="btn prim">¡Genial!</button></div>`;
    document.body.append(capa);
    if (navigator.vibrate) try { navigator.vibrate([30, 40, 60]); } catch {}
    capa.querySelector("button").onclick = () => { capa.remove(); ok(); };
  });
}
