// Gate de hooks crudos en el DOM, en la sintaxis del perfil de hand-off
// (`config.repo.handoff`; la tabla, en src/stories/lib/hooks-perfiles.js).
// ---------------------------------------------------------------------------
// EL FALLO, dos veces el mismo. Los partials se resuelven a mano en varios
// pintores distintos, y cuando un partial gana un `{% if %}` hay que acordarse de
// todos. No se consiguió:
//
//   metió un condicional en `tabs.html` y actualizó uno de los cuatro
//     pintores. Los otros tres publicaban `{% if tabs.controls %}…` al DOM.
//   metió tres bloques en `tariff-card.html` y actualizó uno de los
//     cuatro. `pages-home--default` salió con 144 hooks crudos en su marcado y
//     las cards de 445 a 830 de alto; `snippets-fibre-hero--default`, con 36.
//
// La segunda vez había un aviso escrito al lado del código que lo explicaba. Un
// aviso no es un gate: esto sí. Mira **el DOM publicado** de TODAS las stories de
// la build y falla si alguna enseña texto de plantilla.
//
//   npm run check:hooks
//   node scripts/hooks-check.mjs --dir storybook-static --jobs 6
//
// QUÉ MIRA, Y QUÉ NO. El `innerHTML` de `#storybook-root` — texto y atributos, que
// los dos cuentan: `data-fibre="{{ card.fibre }}"` no se ve y aun así deja el
// filtro de velocidad sin nada que leer. Los COMENTARIOS HTML se descartan antes
// de buscar: el comentario de cabecera de cada partial documenta sus hooks, así
// que contiene un gemelo de cada uno, y un pintor que no lo quite ensucia la
// entrega pero no rompe el render. Eso es otra conversación, no esta.
//
// NO PUEDE DAR VERDE SIN HABER MIRADO. Una story que no monta no es un aprobado,
// es un fallo del chequeo: se cuenta aparte y se sale con 2. Y el verde dice
// SIEMPRE cuántas stories ha recorrido — un verde sin ese número no se distingue
// de no haber medido, que es la lección de la sonda de los `play`.
//
// Cada story se carga como página de primer nivel y la lectura se hace DENTRO de
// la página: el servidor engancha un script al final de `iframe.html` que escribe
// el resultado en un `<pre>`, y Chrome lo devuelve con `--dump-dom`. Mismo patrón
// que `scripts/play-probe.mjs` y `scripts/pixel-shot.mjs`.

import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { PERFILES, clavePerfil } from '../src/stories/lib/hooks-perfiles.js'

const run = promisify(execFile)

const CONFIG = JSON.parse(readFileSync('docs/starterslug-harness/config.json', 'utf8'))
const CLAVE = clavePerfil(CONFIG.repo?.handoff)
const PERFIL = PERFILES[CLAVE]

// HTML estático: no hay hooks, así que no hay nada crudo que buscar. Se dice, no se calla.
if (PERFIL.sinHooks) {
  console.log(
    `Gate de hooks: saltado. El destino es «${PERFIL.label}» (config.repo.handoff = ${CLAVE}),\n` +
      'sin hooks del backend: el HTML se entrega con el texto literal.'
  )
  process.exit(0)
}

const arg = (n, def) => {
  const i = process.argv.indexOf(`--${n}`)
  return i > -1 ? process.argv[i + 1] : def
}

const DIR = resolve(arg('dir', 'storybook-static'))
// Cuánto se le da a la story para montar. Se sondea hasta que `#storybook-root`
// tenga hijos: no se lee un DOM a medio pintar.
const ESPERA = Number(arg('espera', 4000))
const JOBS = Math.max(1, Number(arg('jobs', 6)))
const SOLO = arg('id', '')

if (!existsSync(join(DIR, 'index.json'))) {
  console.error(`No encuentro ${join(DIR, 'index.json')}. Construye antes: npm run build-storybook`)
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

const TIPOS = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
}

// La sonda, en la página. Espera a que la story haya montado DE VERDAD antes de
// leer: `#storybook-root` con hijos. Si no monta, lo dice — no devuelve «limpio».
const SONDA = `<pre id="sonda-out"></pre>
<script>
(() => {
  const limite = Date.now() + ${ESPERA}
  const HOOK = new RegExp(${JSON.stringify(PERFIL.crudo.source).replace(/</g, '\\u003c')}, 'g')
  const escribe = (r) => { document.getElementById('sonda-out').textContent = JSON.stringify(r) }
  const mira = () => {
    const raiz = document.querySelector('#storybook-root')
    if (!raiz || !raiz.children.length) {
      if (Date.now() < limite) return setTimeout(mira, 50)
      return escribe({ error: 'la story no montó: #storybook-root sigue vacío' })
    }
    try {
      // \`<!--?\` no es un comentario nuestro: es un \`<?php … ?>\` que el navegador comentó.
      const sinComentarios = raiz.innerHTML.replace(/<!--(?!\\?)[\\s\\S]*?-->/g, '')
      const hooks = sinComentarios.match(HOOK) || []
      const cuenta = {}
      for (const h of hooks) cuenta[h.replace(/\\s+/g, ' ').trim()] = (cuenta[h.replace(/\\s+/g, ' ').trim()] || 0) + 1
      escribe({ total: hooks.length, cuenta })
    } catch (e) { escribe({ error: String(e && e.message ? e.message : e) }) }
  }
  mira()
})()
</script>`

const server = createServer(async (req, res) => {
  const ruta = decodeURIComponent(req.url.split('?')[0])
  const f = join(DIR, ruta === '/' ? 'index.html' : ruta)
  if (!f.startsWith(DIR) || !existsSync(f)) {
    res.writeHead(404)
    return res.end('no')
  }
  if (ruta === '/iframe.html') {
    const html = await readFile(f, 'utf8')
    res.writeHead(200, { 'content-type': 'text/html' })
    return res.end(html.replace('</body>', `${SONDA}</body>`))
  }
  res.writeHead(200, { 'content-type': TIPOS[extname(f)] ?? 'application/octet-stream' })
  res.end(await readFile(f))
})

await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const puerto = server.address().port

const CHROME = [
  process.env.STARTERSLUG_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find((r) => r && existsSync(r))

if (!CHROME) {
  server.close()
  console.error('No encuentro Chrome. Indícalo con STARTERSLUG_CHROME=<ruta>.')
  process.exit(2)
}

const desescapa = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')

const lee = async (story) => {
  try {
    const { stdout } = await run(
      CHROME,
      [
        '--headless=new',
        '--disable-gpu',
        '--hide-scrollbars',
        `--virtual-time-budget=${ESPERA + 10000}`,
        '--window-size=1280,900',
        '--dump-dom',
        `http://127.0.0.1:${puerto}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`,
      ],
      { maxBuffer: 128 * 1024 * 1024 }
    )
    const m = stdout.match(/<pre id="sonda-out">([\s\S]*?)<\/pre>/)
    if (!m || !m[1].trim()) {
      return { ...story, error: 'la sonda no llegó a escribir (¿presupuesto de tiempo?)' }
    }
    return { ...story, ...JSON.parse(desescapa(m[1])) }
  } catch (e) {
    return { ...story, error: String(e?.message ?? e) }
  }
}

// De N en N: 116 stories a un Chrome cada una son minutos si van en fila.
const resultados = []
const cola = [...STORIES]
await Promise.all(
  Array.from({ length: Math.min(JOBS, cola.length) }, async () => {
    for (let s = cola.shift(); s; s = cola.shift()) resultados.push(await lee(s))
  })
)
server.close()

const rotas = resultados.filter((r) => r.error)
const sucias = resultados.filter((r) => !r.error && r.total > 0)
const limpias = resultados.filter((r) => !r.error && r.total === 0)

console.log(`\nGate de hooks ${PERFIL.label}   [build: ${DIR}]`)
console.log(`  stories recorridas: ${resultados.length} de ${STORIES.length} declaradas`)
console.log(`  leídas: ${limpias.length + sucias.length} · sin leer: ${rotas.length}\n`)

for (const r of sucias.sort((a, b) => b.total - a.total)) {
  console.log(`  ✖ ${r.id}   ${r.total} hook(s) crudos en el DOM`)
  for (const [hook, n] of Object.entries(r.cuenta).sort((a, b) => b[1] - a[1])) {
    console.log(`      ${String(n).padStart(3)} × ${desescapa(hook)}`)
  }
}

for (const r of rotas) console.log(`  ? ${r.id}\n      ${r.error}`)

if (sucias.length) {
  const total = sucias.reduce((n, r) => n + r.total, 0)
  console.log(
    `\n  ✖ ${sucias.length} story(s) publican ${total} hook(s) ${PERFIL.label} sin resolver.\n` +
      '    Eso es texto de plantilla a la vista del cliente. El pintor de ese partial se\n' +
      '    quedó atrás: mira quién más lo resuelve antes de arreglar solo el que falla.'
  )
  process.exit(1)
}

// Un verde sin haber leído no es un verde.
if (rotas.length) {
  console.log(
    `\n  ⚠️  ${rotas.length} story(s) no se han podido montar, así que de esas no se sabe nada.\n` +
      '      «Ninguna tiene hooks» y «no he podido comprobarlas» no son lo mismo.'
  )
  process.exit(2)
}

console.log(
  `\n  ✔ Las ${limpias.length} stories de la build montan y ninguna publica un hook ${PERFIL.label} crudo.`
)
process.exit(0)
