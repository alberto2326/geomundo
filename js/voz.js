// Reconocimiento de voz del navegador (Web Speech API). En Chrome el audio lo transcribe Google; la corrección sigue siendo local.
const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
export const vozDisponible = () => !!SR;

/** Escucha una frase. Llama a onParcial(texto) mientras hablas y a onFinal(texto) al terminar; onError(codigo) si falla. */
export function escuchar({ onParcial = () => {}, onFinal = () => {}, onError = () => {}, onFin = () => {} } = {}) {
  if (!SR) { onError("no-soportado"); return { parar() {} }; }
  const rec = new SR();
  rec.lang = "es-ES"; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  let final = "", terminado = false;
  rec.onresult = (e) => {
    let txt = "";
    for (let i = 0; i < e.results.length; i++) { txt += e.results[i][0].transcript; if (e.results[i].isFinal) final = txt; }
    onParcial(txt);
  };
  rec.onerror = (e) => { terminado = true; onError(e.error || "error"); };
  rec.onend = () => { onFin(); if (!terminado) { terminado = true; final.trim() ? onFinal(final.trim()) : onError("no-speech"); } };
  try { rec.start(); } catch (e) { terminado = true; onError("no-iniciado"); }
  return { parar() { try { rec.stop(); } catch {} }, abortar() { terminado = true; try { rec.abort(); } catch {} } };
}

export const MENSAJE_ERROR = {
  "not-allowed": "El navegador no deja usar el micrófono. Revisa el permiso del micrófono para esta web.",
  "service-not-allowed": "El reconocimiento de voz no está disponible en este navegador.",
  "no-speech": "No te he oído. Pulsa el micro y vuelve a intentarlo.",
  "audio-capture": "No encuentro el micrófono.",
  network: "Sin conexión: el reconocimiento de voz necesita internet. Puedes usar el dictado del teclado.",
  "no-soportado": "Este navegador no tiene reconocimiento de voz. Usa el dictado del teclado.",
};

/** Dictado continuo: cada frase (separada por una pausa) llega a onSegmento(texto). Se reinicia solo si el navegador corta. */
export function dictadoContinuo({ onSegmento = () => {}, onParcial = () => {}, onError = () => {}, onEstado = () => {} } = {}) {
  if (!SR) { onError("no-soportado"); return { parar() {}, activo: () => false }; }
  let activo = true, rec = null, fallos = 0;
  const arrancar = () => {
    rec = new SR(); rec.lang = "es-ES"; rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
    let hecho = 0;
    rec.onresult = (e) => {
      fallos = 0; let parcial = "";
      for (let i = hecho; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim();
        if (e.results[i].isFinal) { hecho = i + 1; if (t) onSegmento(t); } else parcial += t + " ";
      }
      onParcial(parcial.trim());
    };
    rec.onerror = (e) => { if (["not-allowed", "service-not-allowed", "audio-capture", "network"].includes(e.error)) { activo = false; onError(e.error); } else fallos++; };
    rec.onend = () => { if (activo && fallos < 5) setTimeout(() => { try { arrancar(); } catch { activo = false; onEstado(false); } }, 150); else { activo = false; onEstado(false); } };
    try { rec.start(); onEstado(true); } catch { activo = false; onEstado(false); onError("no-iniciado"); }
  };
  arrancar();
  return { parar() { activo = false; try { rec?.stop(); } catch {} onEstado(false); }, abortar() { activo = false; try { rec?.abort(); } catch {} }, activo: () => activo };
}

const NUM = { uno: 1, una: 1, primera: 1, dos: 2, segunda: 2, tres: 3, tercera: 3, cuatro: 4, cuarta: 4, cinco: 5, quinta: 5, seis: 6, sexta: 6, siete: 7, septima: 7, ocho: 8, octava: 8, nueve: 9, novena: 9, diez: 10, decima: 10 };
/** «3: Francia, París», «pregunta tres Francia París», «la cinco no sé» → {n, texto}; si no empieza por número → {n: null, texto}. */
export function partirNumero(seg, max = 10) {
  const t = seg.trim(), base = t.toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "");
  const m = base.match(/^(?:(?:la\s+)?(?:pregunta|numero)\s+|la\s+)?(\d{1,2}|[a-z]+)\b[\s,.:;-]*(.*)$/);
  if (m) { const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM[m[1]]; if (n >= 1 && n <= max && m[2].trim()) return { n, texto: t.slice(t.length - m[2].length).trim() }; }
  return { n: null, texto: t };
}
