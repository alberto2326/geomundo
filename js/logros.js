// Gamificación: rachas y medallas. Todo se calcula a partir del progreso (state + sesiones), así que funciona también con progreso importado.
import { difDias, sumarDias } from "./util.js";

export const NIVELES = ["bronce", "plata", "oro"];
export const NOMBRE_NIVEL = { bronce: "Bronce", plata: "Plata", oro: "Oro" };
// Colecciones: solo cuentan los ítems que la repetición espaciada da por APRENDIDOS (próximo repaso a 21 días o más).
// Bronce = todos aprendidos · Plata = todos con repaso a 60+ días · Oro = todos dominados (repaso al máximo, 120 días).
export const DIAS_NIVEL = { bronce: 21, plata: 60, oro: 120 };
export const CRITERIO_VERSION = 2;
const CRITERIO = Object.fromEntries(Object.entries(DIAS_NIVEL).map(([n, d]) => [n, (r) => (r?.intervalo ?? 0) >= d]));
export const EXPLICA_NIVEL = { bronce: "todos aprendidos (repaso a 21 días o más)", plata: "todos bien asentados (repaso a 60 días o más)", oro: "todos dominados (repaso a 120 días, el máximo)" };

const CONT = {
  europa: "ad al at ba be bg by ch cy cz de dk ee es fi fr gb gr hr hu ie is it li lt lu lv mc md me mk mt nl no pl pt ro rs ru se si sk sm ua xk va gi",
  asia: "ae af am az bd bh bn bt cn ge id il in iq ir jo jp kg kh kp kr kw kz la lb lk mm mn mv my np om ph pk qa sa sg sy th tj tl tm tr tw uz vn ye ps",
  africa: "ao bf bi bj bw cd cf cg ci cm cv dj dz eg er et ga gh gm gn gq gw ke km lr ls ly ma mg ml mr mu mw mz na ne ng rw sc sd sl sn so ss st sz td tg tn tz ug za zm zw",
  norteamerica: "ag bb bs bz ca cr cu dm do gd gt hn ht jm kn lc mx ni pa sv tt us vc gl pr",
  sudamerica: "ar bo br cl co ec gy pe py sr uy ve",
  oceania: "au fj fm ki mh nr nz pg pw sb to tv vu ws",
};
export const CONTINENTE = Object.fromEntries(Object.entries(CONT).flatMap(([c, l]) => l.split(" ").map((iso) => [iso, c])));
const S = (l) => new Set(l.split(" "));
const CARIBE = S("ag bb bs cu dm do gd ht jm kn lc tt vc pr");
const CENTRO = S("bz cr gt hn ni pa sv");
const MICRO = S("ad li lu mc mt sm va");
const STAN = S("af kz kg pk tj tm uz");
const UE = S("at be bg cy cz de dk ee es fi fr gr hr hu ie it lt lu lv mt nl pl pt ro se si sk");
const HISPANO = S("es mx gt hn sv ni cr pa cu do co ve ec pe bo py cl ar uy gq");
const LUSO = S("pt br ao mz cv gw st tl");
const SIN_MAR = S("af ad am at az by bt bo bw bf bi cf td cz sz et hu kz kg la ls li lu mw ml md mn np ne mk py rw sm rs sk ss ch tj tm ug uz zm zw xk va");
const PACIFICO = S("fj fm ki mh nr pw sb to tv vu ws");

const pc = (f) => (it) => it.tipo === "pais" && f(it.iso);
const ba = (f) => (it) => it.tipo === "bandera" && f(it.iso);
const fi = (...subs) => (it) => it.tipo === "fisico" && subs.includes(it.subtipo);
const es = (...subs) => (it) => it.tipo === "espana" && subs.includes(it.subtipo);
const enCont = (c) => (iso) => CONTINENTE[iso] === c;
const enSet = (l) => { const x = S(l); return (iso) => x.has(iso); };
const ids = (...l) => { const x = new Set(l); return (it) => x.has(it.id); };
const prov = (...l) => ids(...l.map((p) => "es-provincia-" + p));
const nrm = (t) => String(t).toLowerCase().normalize("NFD").replace(/\p{Mn}/gu, "").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();
// Estados de EE. UU.: aún no están en el catálogo. Se reconocen por nombre (o alias) en cuanto entren; hasta entonces la medalla queda oculta.
const esEstadoUS = (it) => !["pais", "bandera", "fisico", "espana"].includes(it.tipo) || /estado/.test(it.subtipo ?? "");
const estadosUS = (l) => { const x = new Set(l.split(",").map(nrm)); return (it) => esEstadoUS(it) && [it.nombre, ...(it.alias ?? [])].some((n) => x.has(nrm(n))); };
const UNION = "Maine,Nuevo Hampshire,New Hampshire,Vermont,Massachusetts,Rhode Island,Connecticut,Nueva York,New York,Nueva Jersey,New Jersey,Pensilvania,Pennsylvania,Ohio,Indiana,Illinois,Míchigan,Michigan,Wisconsin,Minnesota,Iowa,California,Oregón,Oregon,Kansas,Virginia Occidental,West Virginia,Nevada,Delaware,Maryland,Kentucky,Misuri,Missouri";
const CONFEDERACION = "Carolina del Sur,South Carolina,Misisipi,Mississippi,Florida,Alabama,Georgia,Luisiana,Louisiana,Texas,Virginia,Arkansas,Carolina del Norte,North Carolina,Tennessee";

// ---- catálogo de medallas ----
export const MEDALLAS = [
  // Rachas (días seguidos usando la app)
  ...[[3, "Calentando motores", "🔥"], [7, "Semana redonda", "📅"], [14, "Quincena imparable", "⚡"], [30, "Un mes de mapas", "🗓️"], [50, "Medio centenar", "🎖️"],
    [100, "Centenario", "💯"], [200, "Doscientos amaneceres", "🌄"], [365, "La vuelta al Sol", "☀️"], [500, "Quinientos", "🏛️"], [1000, "Leyenda", "👑"]]
    .map(([n, nombre, emoji]) => ({ id: `racha-${n}`, cat: "racha", tipo: "racha", n, nombre, emoji, desc: `${n} días seguidos usando la app`, nivelFijo: n >= 200 ? "oro" : n >= 30 ? "plata" : "bronce" })),

  // Mundo: países y capitales
  { id: "pc-europa", cat: "mundo", nombre: "Interraíl completo", emoji: "🚆", desc: "Todos los países de Europa con su capital", grupo: pc(enCont("europa")) },
  { id: "pc-asia", cat: "mundo", nombre: "Ruta de la Seda", emoji: "🐫", desc: "Todos los países de Asia con su capital", grupo: pc(enCont("asia")) },
  { id: "pc-africa", cat: "mundo", nombre: "Safari total", emoji: "🦁", desc: "Todos los países de África con su capital", grupo: pc(enCont("africa")) },
  { id: "pc-norteamerica", cat: "mundo", nombre: "Del Yukón a Panamá", emoji: "🦅", desc: "Norteamérica, Centroamérica y el Caribe, con capitales", grupo: pc(enCont("norteamerica")) },
  { id: "pc-sudamerica", cat: "mundo", nombre: "Cóndor de los Andes", emoji: "🦙", desc: "Todos los países de Sudamérica con su capital", grupo: pc(enCont("sudamerica")) },
  { id: "pc-oceania", cat: "mundo", nombre: "Brújula austral", emoji: "🦘", desc: "Todos los países de Oceanía con su capital", grupo: pc(enCont("oceania")) },
  { id: "pc-caribe", cat: "mundo", nombre: "Corsario caribeño", emoji: "🏴‍☠️", desc: "Todos los países del Caribe con su capital", grupo: pc((i) => CARIBE.has(i)) },
  { id: "pc-centro", cat: "mundo", nombre: "Puente entre océanos", emoji: "🌉", desc: "Los siete países de Centroamérica", grupo: pc((i) => CENTRO.has(i)) },
  { id: "pc-micro", cat: "mundo", nombre: "Pequeños gigantes", emoji: "🔍", desc: "Los microestados de Europa", grupo: pc((i) => MICRO.has(i)) },
  { id: "pc-stan", cat: "mundo", nombre: "Stán por stán", emoji: "🏔️", desc: "Todos los países acabados en «-stán»", grupo: pc((i) => STAN.has(i)) },
  { id: "pc-ue15", cat: "mundo", nombre: "Europa de los Quince", emoji: "📼", desc: "Edición vintage: la UE de 1995 a 2004, con pesetas, francos y el Reino Unido dentro", grupo: pc(enSet("at be de dk es fi fr gb gr ie it lu nl pt se")) },
  { id: "pc-ue", cat: "mundo", nombre: "Eurodiputado", emoji: "🇪🇺", desc: "Los 27 países de la Unión Europea actual, con su capital", grupo: pc((i) => UE.has(i)) },
  { id: "pc-hispano", cat: "mundo", nombre: "Ñ por el mundo", emoji: "🗣️", desc: "Los países con el español como lengua oficial", grupo: pc((i) => HISPANO.has(i)) },
  { id: "pc-luso", cat: "mundo", nombre: "Saudade", emoji: "🎸", desc: "Los países de lengua portuguesa", grupo: pc((i) => LUSO.has(i)) },
  { id: "pc-sinmar", cat: "mundo", nombre: "Ni una gota de mar", emoji: "🏜️", desc: "Todos los países sin salida al mar", grupo: pc((i) => SIN_MAR.has(i)) },
  { id: "pc-pacifico", cat: "mundo", nombre: "Navegante polinesio", emoji: "🛶", desc: "Las naciones insulares del Pacífico", grupo: pc((i) => PACIFICO.has(i)) },
  { id: "pc-todos", cat: "mundo", nombre: "Ciudadano del mundo", emoji: "🌐", desc: "Los 195 países con su capital", grupo: (it) => it.tipo === "pais" },

  // Banderas
  { id: "ba-europa", cat: "banderas", nombre: "Mástil europeo", emoji: "🎌", desc: "Todas las banderas de Europa", grupo: ba(enCont("europa")) },
  { id: "ba-asia", cat: "banderas", nombre: "Estandarte de Oriente", emoji: "🏮", desc: "Todas las banderas de Asia", grupo: ba(enCont("asia")) },
  { id: "ba-africa", cat: "banderas", nombre: "Tricolor africano", emoji: "🥁", desc: "Todas las banderas de África", grupo: ba(enCont("africa")) },
  { id: "ba-america", cat: "banderas", nombre: "Barras, estrellas y soles", emoji: "⭐", desc: "Todas las banderas de América", grupo: ba((i) => ["norteamerica", "sudamerica"].includes(CONTINENTE[i])) },
  { id: "ba-oceania", cat: "banderas", nombre: "Cruz del Sur", emoji: "✨", desc: "Todas las banderas de Oceanía", grupo: ba(enCont("oceania")) },
  { id: "ba-todas", cat: "banderas", nombre: "Vexilólogo", emoji: "🚩", desc: "Las 200 banderas", grupo: (it) => it.tipo === "bandera" },

  // Geografía física del mundo
  { id: "fi-mar", cat: "fisica", nombre: "Simbad de los mares", emoji: "🌊", desc: "Todos los mares del mundo", grupo: fi("mar") },
  { id: "fi-oceano", cat: "fisica", nombre: "Poseidón", emoji: "🔱", desc: "Los cinco océanos", grupo: fi("oceano") },
  { id: "fi-rio", cat: "fisica", nombre: "Remero incansable", emoji: "🚣", desc: "Todos los ríos del mundo", grupo: fi("rio") },
  { id: "fi-delta", cat: "fisica", nombre: "Donde mueren los ríos", emoji: "🦩", desc: "Todos los deltas", grupo: fi("delta") },
  { id: "fi-lago", cat: "fisica", nombre: "El monstruo del lago", emoji: "🦕", desc: "Todos los lagos", grupo: fi("lago") },
  { id: "fi-cordillera", cat: "fisica", nombre: "Sherpa", emoji: "🧗", desc: "Todas las cordilleras", grupo: fi("cordillera") },
  { id: "fi-pico", cat: "fisica", nombre: "Coleccionista de cumbres", emoji: "🏔️", desc: "Todos los picos y volcanes", grupo: fi("pico") },
  { id: "fi-desierto", cat: "fisica", nombre: "Caravanero", emoji: "🐪", desc: "Todos los desiertos", grupo: fi("desierto") },
  { id: "fi-isla", cat: "fisica", nombre: "Robinson", emoji: "🏝️", desc: "Todas las islas", grupo: fi("isla") },
  { id: "fi-archipielago", cat: "fisica", nombre: "Saltaislas", emoji: "⛵", desc: "Todos los archipiélagos", grupo: fi("archipielago") },
  { id: "fi-golfo", cat: "fisica", nombre: "Golfo de golfos", emoji: "😏", desc: "Todos los golfos y bahías", grupo: fi("golfo") },
  { id: "fi-estrecho", cat: "fisica", nombre: "Guardián del paso", emoji: "⚓", desc: "Todos los estrechos e istmos", grupo: fi("estrecho", "istmo") },
  { id: "fi-peninsula", cat: "fisica", nombre: "Casi una isla", emoji: "🗺️", desc: "Todas las penínsulas", grupo: fi("peninsula") },
  { id: "fi-llano", cat: "fisica", nombre: "Tierra firme", emoji: "🌾", desc: "Mesetas, llanuras, cuencas y regiones naturales", grupo: fi("meseta", "llanura", "cuenca", "region") },
  { id: "fi-todo", cat: "fisica", nombre: "Atlas viviente", emoji: "🌍", desc: "Toda la geografía física del mundo", grupo: (it) => it.tipo === "fisico" },

  // España
  { id: "es-comunidad", cat: "espana", nombre: "Diecisiete y dos más", emoji: "🏛️", desc: "Las comunidades y ciudades autónomas", grupo: es("comunidad") },
  { id: "es-provincia", cat: "espana", nombre: "De Álava a Zaragoza", emoji: "📮", desc: "Las 50 provincias", grupo: es("provincia") },
  { id: "es-ciudad", cat: "espana", nombre: "Callejero", emoji: "🏙️", desc: "Todas las ciudades de España", grupo: es("ciudad") },
  { id: "es-rio", cat: "espana", nombre: "Confederación hidrográfica", emoji: "💧", desc: "Todos los ríos de España", grupo: es("rio") },
  { id: "es-monte", cat: "espana", nombre: "Montañero ibérico", emoji: "🥾", desc: "Sierras, sistemas y picos de España", grupo: es("cordillera", "pico") },
  { id: "es-cabo", cat: "espana", nombre: "Farero", emoji: "🔦", desc: "Todos los cabos y puntas", grupo: es("cabo") },
  { id: "es-costa", cat: "espana", nombre: "Costa a costa", emoji: "🐚", desc: "Mares, golfos, bahías y rías", grupo: es("mar") },
  { id: "es-isla", cat: "espana", nombre: "Isleño", emoji: "🌴", desc: "Todas las islas de España", grupo: es("isla") },
  { id: "es-agua", cat: "espana", nombre: "Pantanero", emoji: "🎣", desc: "Embalses, lagos, lagunas, humedales y el delta", grupo: es("lago") },
  { id: "es-relieve", cat: "espana", nombre: "Meseteño", emoji: "🌻", desc: "La Meseta, sus mitades y las grandes depresiones", grupo: es("relieve") },
  { id: "es-todo", cat: "espana", nombre: "Piel de toro", emoji: "🐂", desc: "Toda la geografía de España", grupo: (it) => it.tipo === "espana" },

  // Curiosas
  { id: "cu-sovietico", cat: "curiosas", nombre: "Homo sovieticus", emoji: "🪆", desc: "Las 15 repúblicas que formaron la Unión Soviética, con su capital", grupo: pc(enSet("am az by ee ge kz kg lv lt md ru tj tm ua uz")) },
  { id: "cu-yugo", cat: "curiosas", nombre: "Yugonostálgico", emoji: "🧩", desc: "Los países que salieron de Yugoslavia, con su capital", grupo: pc(enSet("si hr ba rs me mk xk")) },
  { id: "cu-terciopelo", cat: "curiosas", nombre: "Divorcio de terciopelo", emoji: "💔", desc: "Chequia y Eslovaquia, lo que fue Checoslovaquia", grupo: pc(enSet("cz sk")) },
  { id: "cu-guineas", cat: "curiosas", nombre: "Guinea, Guinea, Guinea y… Guinea", emoji: "🦜", desc: "Las cuatro Guineas del mundo, sin confundirlas", grupo: pc(enSet("gn gw gq pg")) },
  { id: "cu-gemelos", cat: "curiosas", nombre: "No es lo mismo", emoji: "👯", desc: "Los países que todo el mundo confunde: Níger/Nigeria, Eslovaquia/Eslovenia, los Congos, las Coreas…", grupo: pc(enSet("ne ng sk si cg cd kr kp sd ss dm do at au is ie ml mw gm zm")) },
  { id: "cu-dobles", cat: "curiosas", nombre: "Doble o nada", emoji: "🎲", desc: "Los países con más de una capital", grupo: (it) => it.tipo === "pais" && it.capitales.length > 1 },
  { id: "cu-benelux", cat: "curiosas", nombre: "Mejillones con patatas", emoji: "🍟", desc: "El Benelux al completo", grupo: pc(enSet("be nl lu")) },
  { id: "cu-nordicos", cat: "curiosas", nombre: "Hygge", emoji: "🛷", desc: "Los países nórdicos", grupo: pc(enSet("dk no se fi is")) },
  { id: "cu-g7", cat: "curiosas", nombre: "Foto de familia del G7", emoji: "🤝", desc: "Los siete países del G7", grupo: pc(enSet("ca fr de it jp gb us")) },
  { id: "cu-brics", cat: "curiosas", nombre: "Ladrillo a ladrillo", emoji: "🧱", desc: "Los cinco BRICS originales", grupo: pc(enSet("br ru in cn za")) },
  { id: "cu-parecidos", cat: "curiosas", nombre: "Parecidos razonables", emoji: "🔎", desc: "Las banderas casi gemelas: Chad y Rumanía, Indonesia y Mónaco, Irlanda y Costa de Marfil…", grupo: ba(enSet("td ro id mc pl au nz ie ci nl lu co ec ve sn ml")) },
  { id: "cu-ochomiles", cat: "curiosas", nombre: "Zona de la muerte", emoji: "🧊", desc: "Los ochomiles del catálogo", grupo: ids("fi-pic-everest", "fi-pic-k2", "fi-pic-kangchenjunga", "fi-pic-nanga-parbat") },
  { id: "cu-techos", cat: "curiosas", nombre: "El techo de cada continente", emoji: "🧗", desc: "Everest, Aconcagua, Denali, Kilimanjaro, Vinson, Puncak Jaya y Kosciuszko", grupo: ids("fi-pic-everest", "fi-pic-aconcagua", "fi-pic-denali", "fi-pic-kilimanjaro", "fi-pic-vinson", "fi-pic-puncak-jaya", "fi-pic-kosciuszko") },
  { id: "cu-gigantes", cat: "curiosas", nombre: "Gigantes de agua dulce", emoji: "🐊", desc: "Los grandes ríos del planeta", grupo: ids("fi-rio-amazonas", "fi-rio-nilo", "fi-rio-yangtse", "fi-rio-misisipi", "fi-rio-obi", "fi-rio-yenisei", "fi-rio-amarillo", "fi-rio-parana", "fi-rio-congo", "fi-rio-amur", "fi-rio-lena", "fi-rio-mekong") },
  { id: "cu-castilla", cat: "curiosas", nombre: "Ancha es Castilla", emoji: "🏰", desc: "Las nueve provincias de Castilla y León", grupo: prov("avila", "burgos", "leon", "palencia", "salamanca", "segovia", "soria", "valladolid", "zamora") },
  { id: "cu-andalucia", cat: "curiosas", nombre: "Al-Ándalus", emoji: "🕌", desc: "Las ocho provincias andaluzas", grupo: prov("almeria", "cadiz", "cordoba", "granada", "huelva", "jaen", "malaga", "sevilla") },
  { id: "cu-galicia", cat: "curiosas", nombre: "Morriña", emoji: "🌧️", desc: "Las cuatro provincias gallegas", grupo: prov("a-coruna", "lugo", "ourense", "pontevedra") },
  { id: "cu-canarias", cat: "curiosas", nombre: "Islas Afortunadas", emoji: "🌋", desc: "Las ocho islas Canarias habitadas", grupo: (it) => it.tipo === "espana" && it.subtipo === "isla" && ["Tenerife", "Gran Canaria", "Lanzarote", "Fuerteventura", "La Palma", "La Gomera", "El Hierro", "La Graciosa"].includes(it.nombre) },
  { id: "cu-baleares", cat: "curiosas", nombre: "Ensaimada", emoji: "🥐", desc: "Mallorca, Menorca, Ibiza, Formentera y Cabrera", grupo: (it) => it.tipo === "espana" && it.subtipo === "isla" && ["Mallorca", "Menorca", "Ibiza", "Formentera", "Cabrera"].includes(it.nombre) },

  // Estados Unidos (aparecen cuando el catálogo incluya los estados)
  { id: "us-union", cat: "eeuu", nombre: "Billy Yank", emoji: "🔵", desc: "Los estados que lucharon con la Unión en la guerra de Secesión, con su capital", grupo: estadosUS(UNION) },
  { id: "us-confederacion", cat: "eeuu", nombre: "Johnny Reb", emoji: "⚪", desc: "Los 11 estados de la Confederación, con su capital", grupo: estadosUS(CONFEDERACION) },
  { id: "us-todos", cat: "eeuu", nombre: "Ruta 66", emoji: "🛣️", desc: "Los 50 estados con su capital", grupo: (it) => esEstadoUS(it) && it.tipo !== "pais" },

  // Hitos
  { id: "h-primera", cat: "hitos", tipo: "evento", nombre: "Primer sello en el pasaporte", emoji: "🛂", desc: "Termina tu primera sesión", nivelFijo: "bronce" },
  { id: "h-pleno", cat: "hitos", tipo: "evento", nombre: "Pleno", emoji: "🎯", desc: "Una sesión con 10/10", nivelFijo: "plata" },
  { id: "h-pleno15", cat: "hitos", tipo: "evento", nombre: "Pleno al quince", emoji: "🏆", desc: "Quince sesiones perfectas", nivelFijo: "oro" },
  { id: "h-remontada", cat: "hitos", tipo: "evento", nombre: "Remontada", emoji: "💪", desc: "Aprende algo que habías fallado 3 veces o más", nivelFijo: "plata" },
  { id: "h-madrugador", cat: "hitos", tipo: "evento", nombre: "Madrugador", emoji: "🌅", desc: "Termina una sesión antes de las 8:00", nivelFijo: "bronce" },
  { id: "h-buho", cat: "hitos", tipo: "evento", nombre: "Búho geógrafo", emoji: "🦉", desc: "Termina una sesión después de las 23:00", nivelFijo: "bronce" },
  { id: "h-finde", cat: "hitos", tipo: "evento", nombre: "Ni el finde se libra", emoji: "🛋️", desc: "Usa la app un sábado y el domingo siguiente", nivelFijo: "bronce" },
  { id: "h-intentos", cat: "hitos", tipo: "contador", nombre: "Preguntón", emoji: "❓", desc: "Respuestas corregidas", umbrales: { bronce: 100, plata: 1000, oro: 5000 }, medida: "intentos" },
  { id: "h-vistos", cat: "hitos", tipo: "contador", nombre: "Explorador", emoji: "🧭", desc: "Parte del catálogo que ya has visto", umbrales: { bronce: 0.25, plata: 0.5, oro: 1 }, medida: "vistos", pct: true },
  { id: "h-sesiones", cat: "hitos", tipo: "contador", nombre: "Constancia", emoji: "📚", desc: "Sesiones terminadas", umbrales: { bronce: 25, plata: 100, oro: 365 }, medida: "sesiones" },
];
export const CATEGORIAS = { racha: "Rachas", mundo: "Países y capitales", banderas: "Banderas", fisica: "Geografía física", espana: "España", curiosas: "Curiosas", eeuu: "Estados Unidos", hitos: "Hitos" };

// ---- rachas ----
export function rachas(dias, hoy) {
  const d = [...new Set(dias)].sort();
  let max = 0, run = 0, prev = null;
  for (const x of d) { run = prev && difDias(x, prev) === 1 ? run + 1 : 1; max = Math.max(max, run); prev = x; }
  let actual = 0;
  if (d.length && difDias(hoy, d[d.length - 1]) <= 1) { const s = new Set(d); let cur = d[d.length - 1]; while (s.has(cur)) { actual++; cur = sumarDias(cur, -1); } }
  return { actual, max, hoyHecho: d.includes(hoy) };
}

// ---- evaluación ----
/** Calcula el estado de cada medalla. `sesiones` = [{sesion, fecha, aciertos, total, hora_fin}] de las terminadas en la app. */
export function evaluar({ items, estado, sesiones = [], excluir = new Set(), hoy }) {
  const reg = estado?.items ?? {}, out = {};
  const r = rachas(estado?.dias_activos ?? [], hoy);
  const intentos = Object.values(reg).reduce((a, x) => a + (x.historial?.length ?? 0), 0);
  const vistos = Object.keys(reg).length, total = items.length;
  const horas = sesiones.map((s) => s.hora_fin).filter(Boolean).map((h) => Number(h.slice(11, 13)));
  const sabado = (estado?.dias_activos ?? []).some((f) => new Date(f + "T12:00:00Z").getUTCDay() === 6 && (estado.dias_activos).includes(sumarDias(f, 1)));
  const plenos = sesiones.filter((s) => s.total >= 10 && s.aciertos === s.total).length;
  const ev = {
    "h-primera": sesiones.length >= 1, "h-pleno": plenos >= 1, "h-pleno15": plenos >= 15,
    "h-remontada": Object.values(reg).some((x) => (x.fallos ?? 0) >= 3 && (x.intervalo ?? 0) >= DIAS_NIVEL.bronce),
    "h-madrugador": horas.some((h) => h < 8), "h-buho": horas.some((h) => h >= 23), "h-finde": sabado,
  };
  const medidas = { intentos, vistos: vistos / total, sesiones: sesiones.length };
  for (const m of MEDALLAS) {
    if (m.tipo === "racha") out[m.id] = { nivel: r.max >= m.n ? m.nivelFijo : null, progreso: Math.min(r.max, m.n), meta: m.n };
    else if (m.tipo === "evento") out[m.id] = { nivel: ev[m.id] ? m.nivelFijo : null };
    else if (m.tipo === "contador") {
      const v = medidas[m.medida]; let nivel = null, sig = null;
      for (const n of NIVELES) { if (v >= m.umbrales[n]) nivel = n; else { sig = n; break; } }
      out[m.id] = { nivel, progreso: v, meta: sig ? m.umbrales[sig] : m.umbrales.oro, siguiente: sig, pct: !!m.pct };
    } else {
      const g = items.filter((it) => m.grupo(it) && !excluir.has(it.id));
      if (!g.length) { out[m.id] = { oculta: true }; continue; }
      const cuenta = Object.fromEntries(NIVELES.map((n) => [n, g.filter((it) => CRITERIO[n](reg[it.id])).length]));
      let nivel = null; for (const n of NIVELES) if (cuenta[n] === g.length) nivel = n;
      const sig = NIVELES[nivel ? NIVELES.indexOf(nivel) + 1 : 0] ?? null;
      out[m.id] = { nivel, total: g.length, cuenta, siguiente: sig, progreso: sig ? cuenta[sig] : g.length, meta: g.length };
    }
  }
  return { medallas: out, racha: r };
}

const rango = (n) => (n ? NIVELES.indexOf(n) : -1);
/** Junta lo ganado antes (no se pierde nunca) con lo calculado ahora. Devuelve {ganadas, nuevas}. */
export function actualizar(ganadas = {}, evaluacion, fecha) {
  const res = { ...ganadas }, nuevas = [];
  for (const [id, e] of Object.entries(evaluacion.medallas)) {
    if (!e.nivel) continue;
    if (rango(e.nivel) > rango(res[id]?.nivel)) { res[id] = { nivel: e.nivel, fecha, ...(res[id] ? { desde: res[id].fecha } : {}) }; nuevas.push({ id, nivel: e.nivel }); }
  }
  return { ganadas: res, nuevas };
}
export const porId = Object.fromEntries(MEDALLAS.map((m) => [m.id, m]));
