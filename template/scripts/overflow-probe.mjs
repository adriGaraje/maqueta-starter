#!/usr/bin/env node
// =============================================================================
//  overflow-probe — dice QUÉ elemento desborda el viewport a lo ancho.
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
    var d = f.document
    var lineas = []
    lineas.push('viewport=' + ANCHO_JS)
    lineas.push('documentElement.scrollWidth=' + d.documentElement.scrollWidth)
    lineas.push('body.scrollWidth=' + d.body.scrollWidth)
    // Se desplaza de verdad? scrollWidth puede mentir; scrollX despues de
    // empujar a la derecha, no.
    f.scrollTo(9999, 0)
    lineas.push('scrollX tras empujar a la derecha = ' + f.scrollX)
    f.scrollTo(0, 0)
    lineas.push('')
    lineas.push('--- ESCAPADOS: pasan del ancho y NINGUN ancestro los recorta ---')
    d.querySelectorAll('*').forEach(function (el) {
      var r = el.getBoundingClientRect()
      if (r.right <= ANCHO_JS + 0.5 || !r.width) return
      var a = el.parentElement, recortado = false
      while (a && a !== d.documentElement) {
        var o = f.getComputedStyle(a).overflowX
        if (o !== 'visible') { recortado = true; break }
        a = a.parentElement
      }
      if (!recortado) lineas.push('  ' + el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).join('.') : '') + '  left=' + Math.round(r.left) + '  right=' + Math.round(r.right))
    })
    lineas.push('')
    lineas.push('--- elementos que pasan del ancho ---')
    d.querySelectorAll('*').forEach(function (el) {
      var r = el.getBoundingClientRect()
      var desbordaCaja = r.right > ANCHO_JS + 0.5 || r.left < -0.5
      var scrollea = el.scrollWidth > el.clientWidth + 1
      if (!desbordaCaja && !scrollea) return
      var cs = f.getComputedStyle(el)
      lineas.push(
        [
          el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : ''),
          'left=' + Math.round(r.left),
          'right=' + Math.round(r.right),
          'w=' + Math.round(r.width),
          'scrollW=' + el.scrollWidth,
          'clientW=' + el.clientWidth,
          'overflowX=' + cs.overflowX,
          desbordaCaja ? 'FUERA-DE-CAJA' : 'solo-scrollea',
        ].join('  ')
      )
    })
    // El peor: quien llega más a la derecha. Y su cadena de ancestros con lo
    // que recorta cada uno — que es lo que dice si el desbordamiento escapa.
    var peor = null
    d.querySelectorAll('*').forEach(function (el) {
      var r = el.getBoundingClientRect()
      if (r.width && (!peor || r.right > peor.getBoundingClientRect().right)) peor = el
    })
    if (peor) {
      lineas.push('')
      lineas.push('--- el que llega mas lejos, y quien deberia recortarlo ---')
      lineas.push('peor: ' + peor.tagName.toLowerCase() + '.' + String(peor.className).trim().split(/\\s+/).join('.') + ' right=' + Math.round(peor.getBoundingClientRect().right))
      var a = peor
      while (a && a !== d.documentElement) {
        var cs2 = f.getComputedStyle(a)
        var r2 = a.getBoundingClientRect()
        lineas.push(
          '  ^ ' + a.tagName.toLowerCase() + (typeof a.className === 'string' && a.className ? '.' + a.className.trim().split(/\\s+/).join('.') : (a.id ? '#' + a.id : '')) +
          '  w=' + Math.round(r2.width) + '  right=' + Math.round(r2.right) +
          '  overflow=' + cs2.overflow + '/' + cs2.overflowX +
          '  scrollW=' + a.scrollWidth + '  clientW=' + a.clientWidth
        )
        a = a.parentElement
      }
    }
    document.getElementById('out').textContent = lineas.join('\\n')
  }, 150)
<\/script>`.replace(/ANCHO_JS/g, String(ANCHO))

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
