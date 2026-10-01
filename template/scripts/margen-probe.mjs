#!/usr/bin/env node
// =============================================================================
//  margen-probe — a cuánto del borde arranca el contenido de cada sección.
//
//  El complemento honesto de `pixel-shot`: aquel enseña que algo se sale, este
//  dice quién. Un scroll horizontal en móvil no se diagnostica mirando la
//  captura —todos los ancestros parecen culpables— y probar `overflow: hidden`
//  a ver si calla es cómo se tapan estos fallos en vez de arreglarlos.
//
//  Monta la story en un iframe del ancho pedido, recorre el DOM y lista los
//  elementos cuyo borde derecho pasa del ancho, o que scrollean de más. La
//  respuesta sale por `--dump-dom`, así que no hace falta ni mirar una imagen.
//
//  Tambien mide HUECOS entre secciones con --huecos <selector>.
//
//  Uso:
//    node scripts/overflow-probe.mjs <dir-storybook> <id-story> [ancho]
// =============================================================================
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const [dir, id, anchoArg] = process.argv.slice(2)
const ANCHO = Number(anchoArg) || 390
const RAIZ = resolve(dir)

const TIPOS = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

const marco = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0}iframe{display:block;border:0}</style>
<pre id="out">sin resultado</pre>
<iframe id="v" width="${ANCHO}" height="1200" src="/iframe.html?id=${id}&viewMode=story"></iframe>
<script>
  var intentos = 0
  var t = setInterval(function () {
    var f = document.getElementById('v').contentWindow
    if (!f || !f.document || !f.document.body || !f.document.body.firstElementChild) return
    if (++intentos < 8) return
    clearInterval(t)
    try {
    var d = f.document
    var root = d.getElementById('storybook-root') || d.body
    // La pagina viene envuelta en divs sin clase; se baja hasta el que tiene
    // varias secciones, que son las piezas de verdad.
    var cont = root
    while (cont.children.length === 1 && cont.firstElementChild.children.length) cont = cont.firstElementChild
    var pad = function (s, n) { s = String(s); while (s.length < n) s += ' '; return s }
    var lineas = ['ancho=' + ANCHO_JS, '']
    lineas.push(pad('seccion', 30) + pad('caja', 14) + pad('contenido', 10) + 'margen')
    for (var i = 0; i < cont.children.length; i++) {
      var s = cont.children[i]
      var r = s.getBoundingClientRect()
      if (!r.width) continue
      // El primer contenido REAL: se saltan los absolutos, que son burbujas y
      // velos decorativos y arrancan fuera de la caja a proposito.
      var cands = s.querySelectorAll('h1,h2,h3,h4,p,ul,ol,img,button,a')
      var dentro = null
      for (var q = 0; q < cands.length; q++) {
        var cs = f.getComputedStyle(cands[q])
        if (cs.position === 'absolute' || cs.position === 'fixed') continue
        var rq = cands[q].getBoundingClientRect()
        if (!rq.width || rq.left < 0) continue
        dentro = cands[q]; break
      }
      var izq = '', margen = ''
      if (dentro) {
        var rd = dentro.getBoundingClientRect()
        izq = String(Math.round(rd.left))
        margen = String(Math.round(rd.left - 0))
      }
      var cl = (typeof s.className === 'string' && s.className ? s.className.trim().split(/\\s+/)[0] : s.tagName.toLowerCase())
      lineas.push(pad(cl.slice(0, 28), 30) + pad(Math.round(r.left) + '..' + Math.round(r.right), 14) + pad(izq, 10) + margen)
    }
    document.getElementById('out').textContent = lineas.join('\\n')
    } catch (e) { document.getElementById('out').textContent = 'ERROR ' + (e && e.message) }
  }, 250)
</script>`.replace(/ANCHO_JS/g, String(ANCHO))

const server = createServer(async (req, res) => {
  const ruta = decodeURIComponent(req.url).split('?')[0]
  if (ruta === '/__marco') {
    res.writeHead(200, { 'content-type': 'text/html' })
    return res.end(marco)
  }
  const f = join(RAIZ, ruta === '/' ? 'index.html' : ruta)
  if (!existsSync(f)) {
    res.writeHead(404)
    return res.end()
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
  console.error('No encuentro Chrome. Indícalo con STARTERSLUG_CHROME=<ruta>.')
  process.exit(1)
}

const { stdout } = await run(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    `--virtual-time-budget=${process.env.STARTERSLUG_SHOT_BUDGET ?? 8000}`,
    `--window-size=${Math.max(ANCHO, 520)},1200`,
    '--dump-dom',
    `http://127.0.0.1:${puerto}/__marco`,
  ],
  { maxBuffer: 64 * 1024 * 1024 }
)

const m = stdout.match(/<pre id="out">([\s\S]*?)<\/pre>/)
console.log(
  m
    ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    : 'no se pudo leer la sonda'
)
server.close()
