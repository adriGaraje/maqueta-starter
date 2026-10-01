// Gate de `play` en rojo.
// ---------------------------------------------------------------------------
// EL FALLO. Un `play` que revienta no se ve en ningún sitio: la entrega apaga el
// panel de `interactions` y en local hay que abrir la story concreta y
// mirar. Así, `snippets-tariff-module--default` estuvo semanas sin comprobar nada
// y `pages-fibra-y-móvil--default` llevaba tiempo en rojo sin que nadie
// se enterase. Un test roto y un test apagado se parecen desde fuera.
//
// QUÉ MIDE. Monta TODAS las stories de una build con los `play` encendidos y
// escucha el canal de Storybook. Si alguno lanza, lo dice con su mensaje.
//
//   STARTERSLUG_STORYBOOK_TODO=1 npx storybook build -o storybook-local
//   npm run check:plays
//
// SE MIDE SOBRE LA BUILD LOCAL, NO SOBRE LA DE ENTREGA. En la de entrega los
// `play` no corren, así que ahí este gate saldría verde SIEMPRE y no
// mediría nada. Por eso no basta con contar cuántos lanzaron: se cuenta también
// **cuántos corrieron**, y si no corrió ninguno se sale con 2. «Ninguno falla» y
// «ninguno se ejecutó» no son lo mismo, y es justo la confusión que costó una tarea anterior.
//
// ⚠️ CADA STORY SE MIDE A SU ANCHO DECLARADO, Y ESO NO ES UN DETALLE. La primera
// versión de esta sonda cargaba todo a 1280 y daba por rotas tres stories que
// declaran `viewport: xs` o `md`: fallaban por el ancho, no por su código. La
// sonda tenía el defecto que venía a medir, que en este proyecto ya va por la
// tercera vez (L-063, L-067). El ancho de cada una se imprime en el informe: un
// verde sin decir a qué ancho se midió no se puede comprobar.
//
// ⚠️ LO QUE ESTA SONDA TODAVÍA NO CERTIFICA, Y HAY QUE SABERLO ANTES DE USARLA
// COMO GATE. Las dos stories de `basics-tabs` dependen del teclado, y su veredicto
// es INTERMITENTE: medido sobre seis pasadas del barrido completo, en UNA salió
// roja una de las dos —`--nested` la vez que pasó, `--primary` en una medición
// anterior— y en las otras cinco pasaron. Una de cada seis.
//
// El foco emulado y el Chrome por story bajaron mucho la tasa pero no la cerraron.
// Mientras siga así, esto es un DIAGNÓSTICO, no un gate: un check que grita en
// falso una vez de cada seis se acaba ignorando, y entonces tampoco avisa de lo
// que sí es verdad. Las otras cinco rojas salen en las seis pasadas y esas sí
// están firmes.
//
// Se escribe aquí porque dos pasadas limpias me hicieron dar esto por estable y
// no lo era: una racha no es un arreglo (L-065).
//
// Chrome se conduce por DevTools Protocol (`lib/cdp.mjs`), que es lo único que
// fija un viewport real por debajo de ~500 px — `--window-size=375` no baja de
// ahí y maqueta a 504 (L-008). El enganche al canal va en
// `Page.addScriptToEvaluateOnNewDocument`, que corre ANTES que cualquier script
// de la página: suscribirse después es no ver el evento y cantarlo verde.

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

import { abreChrome } from './lib/cdp.mjs'

const arg = (n, def) => {
  const i = process.argv.indexOf(`--${n}`)
  return i > -1 ? process.argv[i + 1] : def
}

const DIR = resolve(arg('dir', 'storybook-local'))
// Cuánto se le da a la story para montar Y ejecutar su `play`. Un `play` con
// `waitFor` puede tardar: el de `tariff-module` espera al init del módulo.
const ESPERA = Number(arg('espera', 8000))
const SOLO = arg('id', '')
// El ancho de las stories que NO declaran viewport. 1440 es el del handoff.
const ANCHO = Number(arg('ancho', 1440))
const ALTO = Number(arg('alto', 900))

// Mismo mapa que `.storybook/preview.js`. Si allí se añade uno, aquí también.
const VIEWPORTS = {
  xs: [375, 780],
  sm: [576, 780],
  md: [768, 1024],
  lg: [992, 800],
  xl: [1200, 900],
  xxl: [1400, 900],
}

if (!existsSync(join(DIR, 'index.json'))) {
  console.error(
    `No encuentro ${join(DIR, 'index.json')}.\n` +
      'Construye antes la build LOCAL (con los `play` encendidos):\n' +
      '  STARTERSLUG_STORYBOOK_TODO=1 npx storybook build -o storybook-local'
  )
  process.exit(2)
}

const INDICE = JSON.parse(readFileSync(join(DIR, 'index.json'), 'utf8'))
const STORIES = Object.values(INDICE.entries)
  .filter((e) => e.type === 'story')
  .filter((e) => !SOLO || e.id === SOLO)

if (!STORIES.length) {
  console.error('La build no declara ni una story. No hay nada que comprobar.')
  process.exit(2)
}

// El viewport declarado se lee del FUENTE de la story, no de la build: el índice
// de Storybook no lleva los `globals`. Se casa por fichero + nombre de export —
// Storybook convierte `MobileOpen` en «Mobile Open», así que se comparan sin
// espacios. Lo que no se encuentre se mide al ancho por defecto y se dice.
const declarado = (story) => {
  const ruta = story.importPath?.replace(/^\.\//, '')
  if (!ruta || !existsSync(ruta)) return null
  const src = readFileSync(ruta, 'utf8')
  const re = /export const (\w+)\s*=\s*\{/g
  let m
  while ((m = re.exec(src))) {
    let depth = 0
    let j = src.indexOf('{', m.index)
    const abre = j
    for (; j < src.length; j++) {
      if (src[j] === '{') depth++
      else if (src[j] === '}') {
        depth--
        if (!depth) break
      }
    }
    if (m[1].toLowerCase() !== story.name.replace(/\s/g, '').toLowerCase()) continue
    const cuerpo = src.slice(abre, j + 1)
    const v = cuerpo.match(/viewport:\s*\{\s*value:\s*'(\w+)'/)
    return v ? v[1] : null
  }
  return null
}

const medidaDe = (story) => {
  const v = declarado(story)
  if (v && VIEWPORTS[v]) return { ancho: VIEWPORTS[v][0], alto: VIEWPORTS[v][1], etiqueta: v }
  return { ancho: ANCHO, alto: ALTO, etiqueta: 'por defecto' }
}

const TIPOS = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
}

// La trampa sobre el canal. Corre antes que el preview de Storybook, así que
// llega a tiempo de ver la asignación y suscribirse en ese mismo instante.
const TRAMPA = `(() => {
  var canal = null
  window.__starterslug = { lanzo: null, corrio: false }
  var texto = function (d) {
    if (d == null) return 'sin mensaje'
    if (typeof d === 'string') return d
    if (d.message) return String(d.message)
    if (d.error && d.error.message) return String(d.error.message)
    try { return JSON.stringify(d).slice(0, 500) } catch (e) { return String(d) }
  }
  try {
    Object.defineProperty(window, '__STORYBOOK_ADDONS_CHANNEL__', {
      configurable: true,
      get: function () { return canal },
      set: function (v) {
        canal = v
        try {
          v.on('playFunctionThrewException', function (d) { window.__starterslug.corrio = true; if (!window.__starterslug.lanzo) window.__starterslug.lanzo = texto(d) })
          v.on('unhandledErrorsWhilePlaying', function (d) { window.__starterslug.corrio = true; if (!window.__starterslug.lanzo) window.__starterslug.lanzo = texto(d && d[0]) })
          v.on('storyFinished', function () { window.__starterslug.corrio = true })
          v.on('playFunctionStarted', function () { window.__starterslug.corrio = true })
        } catch (e) {}
      },
    })
  } catch (e) {}
})()`

const LECTURA = `(async () => {
  const duerme = (ms) => new Promise((ok) => setTimeout(ok, ms))
  const hasta = Date.now() + ${ESPERA}
  let monto = false
  while (Date.now() < hasta) {
    const r = document.querySelector('#storybook-root')
    if (r && r.children.length) { monto = true; break }
    await duerme(50)
  }
  if (!monto) return { error: 'la story no montó: #storybook-root sigue vacío' }
  // Se le deja terminar el \`play\`: montar no es haber corrido.
  while (Date.now() < hasta && !window.__starterslug.corrio) await duerme(50)
  await duerme(300)
  return { lanzo: window.__starterslug.lanzo, corrio: window.__starterslug.corrio, ancho: innerWidth }
})()`

const server = createServer(async (req, res) => {
  const ruta = decodeURIComponent(req.url.split('?')[0])
  const f = join(DIR, ruta === '/' ? 'index.html' : ruta)
  if (!f.startsWith(DIR) || !existsSync(f)) {
    res.writeHead(404)
    return res.end('no')
  }
  res.writeHead(200, { 'content-type': TIPOS[extname(f)] ?? 'application/octet-stream' })
  res.end(await readFile(f))
})

const puerto = await new Promise((ok) =>
  server.listen(0, '127.0.0.1', () => ok(server.address().port))
)

const JOBS = Math.max(1, Number(arg('jobs', 4)))

// ⚠️ UN CHROME POR STORY, Y CUESTA TIEMPO A PROPÓSITO. La primera versión
// reutilizaba una sola pestaña para las 118 navegaciones, y `basics-tabs--primary`
// salía roja o verde SEGÚN CON QUIÉN SE MIDIERA: verde suelta, roja en tanda.
// Un caso que cambia de veredicto según sus vecinos no es un fallo del código, es
// la sonda arrastrando estado —foco, globals, animaciones a medias— de una story
// a la siguiente. Aislar cada una lo quita de raíz. Mismo criterio que
// `play-probe.mjs`, que también arranca un Chrome por caso.
const lee = async (story) => {
  const m = medidaDe(story)
  let sesion, cierra
  try {
    ;({ sesion, cierra } = await abreChrome({ ancho: m.ancho, alto: m.alto }))
    await sesion.envia('Page.enable')
    await sesion.envia('Runtime.enable')
    await sesion.envia('Page.addScriptToEvaluateOnNewDocument', { source: TRAMPA })
    await sesion.envia('Emulation.setDeviceMetricsOverride', {
      width: m.ancho,
      height: m.alto,
      deviceScaleFactor: 1,
      mobile: false,
    })
    // Sin esto, `elemento.focus()` no agarra en headless y el `{ArrowRight}` no va
    // a ninguna parte: el `play` falla y no es culpa suya (L-063).
    await sesion.envia('Emulation.setFocusEmulationEnabled', { enabled: true })
    const cargada = sesion.una('Page.loadEventFired', 60000)
    await sesion.envia('Page.navigate', {
      url: `http://127.0.0.1:${puerto}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`,
    })
    await cargada
    const r = await sesion.envia(
      'Runtime.evaluate',
      { expression: LECTURA, awaitPromise: true, returnByValue: true },
      ESPERA + 30000
    )
    return { ...story, ...m, ...(r.result.value ?? {}) }
  } catch (e) {
    return { ...story, ...m, error: String(e?.message ?? e) }
  } finally {
    cierra?.()
  }
}

const resultados = []
const cola = [...STORIES]
try {
  await Promise.all(
    Array.from({ length: Math.min(JOBS, cola.length) }, async () => {
      for (let s = cola.shift(); s; s = cola.shift()) resultados.push(await lee(s))
    })
  )
} finally {
  server.close()
}

const sinLeer = resultados.filter((r) => r.error)
const rojas = resultados.filter((r) => !r.error && r.lanzo)
const corrieron = resultados.filter((r) => !r.error && r.corrio)
const aMedida = resultados.filter((r) => r.etiqueta !== 'por defecto')

console.log(`\nGate de \`play\` en rojo   [build: ${DIR}]`)
console.log(`  stories recorridas: ${resultados.length} de ${STORIES.length} declaradas`)
console.log(`  con \`play\` que se ejecutó: ${corrieron.length} · sin leer: ${sinLeer.length}`)
console.log(
  `  ancho: ${ANCHO} por defecto · ${aMedida.length} a su viewport declarado ` +
    `(${[...new Set(aMedida.map((r) => r.etiqueta))].join(', ') || 'ninguno'})\n`
)

for (const r of rojas.sort((a, b) => a.id.localeCompare(b.id))) {
  console.log(`  ✖ ${r.id}   [${r.ancho}×${r.alto} · ${r.etiqueta}]\n      ${r.lanzo}`)
}
for (const r of sinLeer) console.log(`  ? ${r.id}\n      ${r.error}`)

if (rojas.length) {
  console.log(
    `\n  ✖ ${rojas.length} \`play\` lanzan. Cada uno es un test que dejó de comprobar nada\n` +
      '    en el momento en que empezó a fallar, y no se ve en ninguna parte.'
  )
  process.exit(1)
}

// Un verde sin haber ejecutado ningún `play` es la build de entrega, no un verde.
if (!corrieron.length) {
  console.log(
    '\n  ⚠️  No se ejecutó NI UN `play`. Esto es lo que pasa sobre la build de entrega,\n' +
      '      donde están apagados a propósito. Construye la build local:\n' +
      '        STARTERSLUG_STORYBOOK_TODO=1 npx storybook build -o storybook-local'
  )
  process.exit(2)
}

if (sinLeer.length) {
  console.log(
    `\n  ⚠️  ${sinLeer.length} story(s) no se han podido montar, así que de esas no se sabe nada.\n` +
      '      «Ninguna lanza» y «no he podido comprobarlas» no son lo mismo.'
  )
  process.exit(2)
}

console.log(`  ✔ Ningún \`play\` lanza, y ${corrieron.length} se han ejecutado de verdad.`)
