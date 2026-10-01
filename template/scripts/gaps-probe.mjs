#!/usr/bin/env node
// =============================================================================
//  gaps-probe — mide el hueco vertical entre las secciones de una story.
//
//  Hermano de `overflow-probe`: aquel dice quién se sale a lo ancho, este dice
//  cuánto aire hay entre módulos. Un espaciado de más no rompe nada y no lo mira
//  ningún gate, así que solo se ve mirando la página entera — y a ojo no se
//  distingue un hueco de 80 de uno de 150.
//
//  Uso:
//    node scripts/gaps-probe.mjs <dir-storybook> <id-story> [ancho] [selector]
//
//  El selector por defecto coge los hijos directos de `main`, que es como se
//  componen las páginas del repo.
// =============================================================================
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const [dir, id, anchoArg, selArg] = process.argv.slice(2)
const ANCHO = Number(anchoArg) || 390
const SEL = selArg || 'main > *'
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
<iframe id="v" width="${ANCHO}" height="900" src="/iframe.html?id=${id}&viewMode=story"></iframe>
<script>
  var intentos = 0
  var t = setInterval(function () {
    var f = document.getElementById('v').contentWindow
    if (!f || !f.document || !f.document.body || !f.document.body.firstElementChild) return
    if (++intentos < 10) return
    clearInterval(t)
    var d = f.document
    var nodos = [].slice.call(d.querySelectorAll(SEL_JS))
    if (!nodos.length) nodos = [].slice.call(d.querySelectorAll('#storybook-root > div > *'))
    var lineas = ['selector: ' + SEL_JS, 'secciones: ' + nodos.length, '']
    var prev = null, prevPb = 0
    nodos.forEach(function (el) {
      var r = el.getBoundingClientRect()
      var top = r.top + f.scrollY, bot = r.bottom + f.scrollY
      var hueco = prev === null ? null : Math.round(top - prev)
      var nombre = el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/)[0] : '')
      var cs = f.getComputedStyle(el)
      var pt = parseFloat(cs.paddingTop) || 0
      var pb = parseFloat(cs.paddingBottom) || 0
      // Un modulo con fondo pinta su padding; uno transparente lo regala al hueco.
      var pinta = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none'
      var visible = hueco === null ? null : Math.round(hueco + (pinta ? 0 : pt) + prevPb)
      lineas.push(
        (hueco === null ? '   —  ' : String(hueco).padStart(4) + ' caja') +
        (visible === null ? '        ' : ' /' + String(visible).padStart(4) + ' visible') +
        '   ' + nombre + '   alto=' + Math.round(r.height) +
        '  pad=' + Math.round(pt) + '/' + Math.round(pb) + (pinta ? '  [con fondo]' : '')
      )
      prev = bot
      prevPb = pinta ? 0 : pb
    })
    document.getElementById('out').textContent = lineas.join('\\n')
  }, 150)
<\/script>`.replace(/SEL_JS/g, JSON.stringify(SEL))

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
    `--window-size=${Math.max(ANCHO, 520)},900`,
    '--dump-dom',
    `http://127.0.0.1:${puerto}/__marco`,
  ],
  { maxBuffer: 64 * 1024 * 1024 }
)

const m = stdout.match(/<pre id="out">([\s\S]*?)<\/pre>/)
console.log(
  m ? m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : 'no se pudo leer'
)
server.close()
