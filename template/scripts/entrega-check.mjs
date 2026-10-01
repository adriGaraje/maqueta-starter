#!/usr/bin/env node
// =============================================================================
//  entrega-check — ¿lo que se copia del Storybook funciona al pegarlo?
//
//  Coge lo que pinta una story, lo pega en una página en blanco con SOLO
//  `starterslug-global.css` + el CSS de ese snippet, y comprueba que sale idéntico:
//  misma geometría, mismos colores, mismos espacios. Es el criterio de
//  aceptación de una tarea anterior, ejecutable.
//
//  Compara medidas y estilos calculados, NO píxeles: un diff de píxeles dice
//  «hay 300 distintos» y no dice cuál ni por qué. Aquí, cuando falla, dice
//  exactamente qué elemento y qué propiedad.
//
//  Ya ha cazado dos fallos que no se veían de ninguna otra forma:
//   · un BOM en medio del CSS global que se comía la primera regla de Bootstrap
//     (todo lo pegado heredaba negro en vez de #212529);
//   · el CSS de un snippet que no arrastraba el de las piezas que compone, así
//     que el CTA del footer salía con el aspecto por defecto de Bootstrap.
//
//  Uso:
//    STARTERSLUG_STORYBOOK_TODO=1 npx storybook build -o <dir>
//    node scripts/entrega-check.mjs <dir> <storyId>=<snippet.css> [...]
//
//  ⚠️ El envoltorio del Storybook mide distinto que una página desnuda, así que
//  la página en blanco se monta con el MISMO ancho disponible que tenía la
//  story. Sin eso salen 50 «diferencias» que son solo 32 px de padding.
// =============================================================================
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const RAIZ = resolve(process.argv[2])
const BLANCO = resolve('.starterslug-blank')
const CASOS = process.argv.slice(3).map((s) => s.split('='))

const TIPOS = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.avif': 'image/avif',
}

// La sonda mide el árbol visible y lo deja en un <script type="starterslug/medidas">.
// Se lee por esa etiqueta y NO por marcadores dentro del texto: con marcadores,
// el regex casaba con el propio código de la sonda y las dos páginas devolvían
// lo mismo — un verde falso que decía «idéntico» sin haber medido nada.
const SONDA = [
  '<script>',
  "window.addEventListener('load', function () {",
  '  setTimeout(function () {',
  "    var raiz = document.getElementById('starterslug-medir') || document.getElementById('storybook-root') || document.body",
  '    var out = []',
  "    out.push('ANCHO-RAIZ|' + Math.round(raiz.getBoundingClientRect().width))",
  "    var nodos = raiz.querySelectorAll('*')",
  '    for (var i = 0; i < nodos.length && i < 300; i++) {',
  '      var n = nodos[i], r = n.getBoundingClientRect(), c = getComputedStyle(n)',
  '      if (r.width === 0 && r.height === 0) continue',
  '      var cls = n.className',
  "      if (cls && typeof cls !== 'string') cls = cls.baseVal || ''",
  "      out.push([n.tagName, cls || '', Math.round(r.width), Math.round(r.height),",
  '        c.fontSize, c.fontWeight, c.color, c.backgroundColor, c.padding,',
  '        c.borderRadius, c.display, c.flexDirection, c.gap, c.margin,',
  "        c.borderWidth, c.textAlign].join('|'))",
  '    }',
  "    var s = document.createElement('script')",
  "    s.type = 'starterslug/medidas'",
  "    s.textContent = out.join('\\n')",
  '    document.body.appendChild(s)',
  '  }, 800)',
  '})',
  '</script>',
].join('\n')

const srv = createServer(async (req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0])
  if (u.startsWith('/__blank/')) {
    res.writeHead(200, { 'content-type': 'text/html' })
    return res.end(await readFile(join(BLANCO, u.slice(9))))
  }
  const f = join(RAIZ, u === '/' ? '/index.html' : u)
  if (!existsSync(f)) {
    res.writeHead(404)
    return res.end('')
  }
  let cuerpo = await readFile(f)
  if (extname(f) === '.html')
    cuerpo = Buffer.from(cuerpo.toString().replace('</body>', SONDA + '</body>'))
  res.writeHead(200, { 'content-type': TIPOS[extname(f)] || 'application/octet-stream' })
  res.end(cuerpo)
})

await mkdir(BLANCO, { recursive: true })
await new Promise((r) => srv.listen(0, '127.0.0.1', r))
const P = srv.address().port
const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync)

const cargar = async (url) => {
  const { stdout } = await run(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--virtual-time-budget=9000',
      '--window-size=1280,1200',
      '--dump-dom',
      url,
    ],
    { maxBuffer: 128 * 1024 * 1024 }
  )
  return stdout
}

const medidas = (dom) => {
  const m = dom.match(/<script type="starterslug\/medidas">([\s\S]*?)<\/script>/)
  return m
    ? m[1]
        .split('\n')
        .map((x) => x.trim())
        .filter(Boolean)
    : null
}

// El envoltorio de la story: greedy hasta storybook-docs, que es lo que hay
// DESPUÉS. Perezoso cortaría en el primer </div> de dentro (lección L-010).
const render = (dom) => {
  const m = dom.match(/<div id="storybook-root"[^>]*>([\s\S]*)<div id="storybook-docs"/)
  if (!m) return null
  return m[1].replace(/<\/div>\s*$/, '')
}

let fallos = 0
for (const [id, snippet] of CASOS) {
  const domSb = await cargar(`http://127.0.0.1:${P}/iframe.html?id=${id}&viewMode=story`)
  const mSb = medidas(domSb)
  const html = render(domSb)

  if (!mSb) {
    console.log(`✖ ${id}: la sonda no midió en el Storybook`)
    fallos++
    continue
  }
  if (!html) {
    console.log(`✖ ${id}: no pude extraer el render`)
    fallos++
    continue
  }

  // El Storybook envuelve la story en su propio marco. Para que la comparación
  // mida el CSS y no el envoltorio, la página en blanco se monta con el MISMO
  // ancho disponible que tenía la story.
  const ancho = Number(mSb[0].split('|')[1])
  const cssSnippet = readFileSync(join(RAIZ, 'entrega', 'snippets', snippet), 'utf8')
  const blank = [
    '<!doctype html><html lang="es"><head><meta charset="utf-8">',
    '<link rel="stylesheet" href="/entrega/starterslug-global.css">',
    `<style>${cssSnippet}</style>`,
    `<style>body{margin:0;padding:0}#starterslug-medir{width:${ancho}px}</style>`,
    `</head><body><div id="starterslug-medir">${html}</div>${SONDA}</body></html>`,
  ].join('\n')
  await writeFile(join(BLANCO, `${id}.html`), blank)

  const mBl = medidas(await cargar(`http://127.0.0.1:${P}/__blank/${id}.html`))
  if (!mBl) {
    console.log(`✖ ${id}: la página en blanco no midió nada`)
    fallos++
    continue
  }

  const n = Math.min(mSb.length, mBl.length)
  if (n < 2) {
    console.log(`✖ ${id}: solo ${n} elemento(s) medidos — la comparación no prueba nada`)
    fallos++
    continue
  }

  const difs = []
  for (let i = 0; i < n; i++) {
    if (mSb[i] !== mBl[i]) difs.push(`      storybook: ${mSb[i]}\n      pegado   : ${mBl[i]}`)
  }
  if (mSb.length !== mBl.length)
    difs.push(`      nº de elementos: storybook ${mSb.length}, pegado ${mBl.length}`)

  if (difs.length) {
    fallos++
    console.log(`✖ ${id} · ${difs.length} diferencia(s) sobre ${n} elementos`)
    console.log(difs.slice(0, 5).join('\n'))
  } else {
    console.log(`✔ ${id} · idéntico · ${n} elementos comparados`)
  }
}

srv.close()
process.exit(fallos ? 1 : 0)
