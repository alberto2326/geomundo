# Geografía del Mundo · app personal

Entrenador diario de geografía en español: país + capital, banderas, geografía física del mundo y España, con repetición espaciada (SM-2). Es una web estática que **funciona sin IA, sin servidor y sin cuenta**, y se puede instalar en el móvil como app (PWA) para usarla sin conexión.

## Cómo funciona
- **Sesiones de 10 preguntas**: 4 de país + capital, 2 de banderas, 3 de física y 1 de España, barajadas y sin dos del mismo tipo seguidas. Primero van los repasos vencidos.
- **Corrección por dictado** (`js/comparar.js`): es una traducción fiel de `nucleo.py`, con su normalización, clave fonética, identificación de la entidad, umbrales 85/78 y margen 3, ambigüedad de «Congo» y «Corea» y país + capital con resultado parcial. Da lo mismo que el código original en 14 246 respuestas: las 130 reales y 14 116 sintéticas.
- **SM-2, niveles y cupos** (`js/srs.js`): usan las constantes del manual. Al reproducir los 130 eventos originales se obtiene exactamente el `state.json`.
- **Sesión del día**: la app no puede despertarse sola. A partir de las 07:00 (hora de Madrid) la pantalla de inicio la ofrece como lista, aunque se puede empezar antes. Una sesión a medias se conserva y se retoma siempre, aunque cierres el navegador.
- **Reevaluar**: si el dictado se equivoca, se deshace la corrección anterior (se restaura el registro previo) y se puntúa la respuesta nueva. Nunca regala aciertos.

## Responder por voz
- **Hoja de 10**, el modo por defecto: las diez preguntas salen en una sola pantalla.
  - Pulsas el micro una vez y dices las respuestas seguidas, con una pausa entre una y otra. Cada pausa rellena la siguiente caja.
  - Puedes decir el número delante («tres, Francia, París») para ir a una pregunta concreta.
  - Al pulsar «Corregir» salen las diez correcciones.
  - Lo dictado se guarda aunque cierres la app.
- **De una en una**: se activa desmarcando la opción en el inicio.
- El reconocimiento de voz lo hace el navegador (en Chrome, Google), así que necesita conexión. La corrección siempre es local.

## Rachas y medallas (`js/logros.js`)
- **Racha**: cada día con al menos una respuesta suma un día. Hay medallas a los 3, 7, 14, 30, 50, 100, 200, 365, 500 y 1000 días, y se guarda tu récord.
- **Colecciones**: países por continente y por grupos (UE, «-stán», microestados, sin mar, hispanohablantes…), banderas, cada tipo de geografía física y de geografía de España, y medallas curiosas («Homo sovieticus», «Yugonostálgico», «Guinea, Guinea, Guinea y… Guinea», «Ancha es Castilla»…).
  - Solo se ganan cuando la repetición espaciada da por **aprendidos** todos sus ítems.
  - **Bronce**: todos con repaso a 21 días o más. **Plata**: a 60 días. **Oro**: a 120 días, el máximo.
- **Estados Unidos** («Billy Yank» para la Unión, «Johnny Reb» para la Confederación y «Ruta 66» para los 50 estados): están preparadas y aparecerán cuando el catálogo incluya los estados.
- **Hitos**: primera sesión, 10/10, quince plenos, remontada, madrugador, búho, fin de semana, respuestas, catálogo visto y sesiones.
- Una medalla ganada no se pierde. Las medallas se guardan con el progreso y van en la copia descargada.

## Progreso
- Se guarda **solo en este navegador**, en IndexedDB. Cada corrección se escribe en una sola transacción: o se guarda todo o no cambia nada. No se sube a GitHub ni a ningún otro sitio.
- **Descargar progreso** genera un JSON versionado (`formato: geomundo-progreso`, `version_formato: 1`, suma de control SHA-256). Lleva el estado SM-2, el historial de correcciones, las estadísticas, las preferencias y la sesión en curso.
- **Cargar o recuperar progreso** admite esa copia o el `state.json` original. El proceso es: validar → vista previa → confirmar → copia automática previa → sustitución atómica. Tras cargar se puede **deshacer**. Los ficheros corruptos o de una versión futura se rechazan sin tocar nada. Los ids desconocidos se conservan aparte.
- **Riesgo de pérdida**: borrar los datos del navegador, la navegación privada o cambiar de móvil borran el progreso local. Por eso la app avisa si llevas 7 días sin descargar una copia. Instalada en la pantalla de inicio, pide almacenamiento persistente.
- **Varios dispositivos**: no se sincronizan. Descarga la copia en uno y cárgala en el otro.

## Beta actual: solo países y capitales
`data/config.json` limita las sesiones a 10 preguntas de país + capital (`"tipos": ["pais"]`). Las estadísticas y las medallas muestran solo lo activo. El progreso de los demás tipos se conserva. Para volver a la mezcla completa, borra `tipos` y `mezcla` de ese fichero (o el fichero entero).

Las imágenes de la beta (195 países × pregunta, contexto y solución) se importaron con:
```
python3 -I tools/importar_beta.py datos.json CARPETA_IMG
```
Este script comprueba el SHA-256 de cada imagen y la convierte a WebP sin pérdida (89 MB → 36 MB).

## Imágenes
`img/indice.json` dice qué imagen corresponde a cada pregunta: `q` es la de la pregunta, `c` la de contexto y `a` la solución. Los nombres de los ficheros son hashes, para que no delaten la respuesta. Para añadir las imágenes:

```
python3 -I tools/importar_imagenes.py CARPETA_CON_IMAGENES [--webp]
```

El script espera `<id>.png`, `<id>_contexto.png` y `<id>_solucion.png`. Cuando ya hay imágenes, los ítems que no tienen la suya no salen en las sesiones. Los ítems en cuarentena (`data/cuarentena.json`) tampoco salen nunca. Mientras no haya imágenes, cada hueco muestra «imagen no disponible» y no se inventa ningún mapa.

## Publicar en GitHub Pages (gratis)
1. Crea un repositorio **público** y sube estos ficheros. Con el plan gratuito, Pages solo funciona con repositorios públicos.
2. Ve a *Settings → Pages → Build and deployment*, elige *Deploy from a branch* y selecciona `main` y la carpeta `/ (root)`.
3. Abre `https://TU-USUARIO.github.io/NOMBRE-REPO/` en el móvil, instala la app con «Añadir a pantalla de inicio» y carga tu `state.json`.

**Avisos**:
- La web es pública para cualquiera que tenga la URL, y el catálogo con las respuestas va dentro.
- No subas tu progreso ni tu `state.json` al repositorio, ni ningún secreto.
- Cuando cambies cualquier fichero, sube `VERSION` en `sw.js` para que los móviles descarguen la versión nueva.

## Desarrollo
- `python3 -I tools/construir_catalogo.py catalogo.json preguntas_1332.json cuarentena_interna.json` regenera `data/`.
- `node --test tests/*.test.mjs` ejecuta las pruebas de aceptación (§9 y §14 del manual) y la comparación con el código de referencia.
- `GEOMUNDO_STATE=/ruta/state.json node --test tests/*.test.mjs` añade las pruebas que usan tu progreso real. Ese fichero se queda fuera del repositorio.

No tiene dependencias ni paso de compilación: es HTML, CSS y JavaScript estándar.
