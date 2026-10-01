#!/usr/bin/env node
// =============================================================================
//  to-webp — convierte una imagen a WebP con Chrome headless.
//
//  El repo no tiene `sharp` ni `cwebp`, y no merece la pena añadir una
//  dependencia nativa para esto: Chrome ya está instalado —lo usan `pixel-shot`
//  y `pixel-diff`— y su canvas convierte igual de bien.
//
//  Nace con una tarea anterior, al llegar la tercera tanda de assets que hay que meter en el
//  repo: los bitmaps del handoff bajan en JPEG de varios MB y ninguno se puede
//  publicar así. La conversión se hacía a mano cada vez.
//
//  Uso:
//    node scripts/to-webp.mjs <entrada> <salida.webp> <ancho>
//
//  El alto sale solo, manteniendo la proporción. El ancho que se pasa es el de
//  PINTADO POR DOS: en pantallas densas la imagen se ve al doble de sus CSS px.
// =============================================================================

import { readFileSync, writeFileSync, statSync, unlinkSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'

const [entrada, salida, ancho] = process.argv.slice(2)

if (!entrada || !salida || !ancho) {
  console.error('✗ uso: node scripts/to-webp.mjs <entrada> <salida.webp> <ancho>')
  process.exit(2)
}

// La ruta se busca, no se escribe: este script era el ÚNICO de los siete que
// usan Chrome con la ruta de Windows clavada, así que en un Mac no arrancaba.
// Misma lista que `gaps-probe` y compañía, para que haya un solo sitio que
// aprenderse.
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
const CALIDAD = 0.82

const bytes = readFileSync(entrada)
// Se mira la firma del fichero y no la extensión: el MCP de Figma sirve JPEG con
// nombre .png más a menudo de lo que parece, y un data URI con el tipo mal puesto
// no carga.
const mime = bytes.slice(0, 3).toString('hex') === 'ffd8ff' ? 'jpeg' : 'png'

const tmp = join(dirname(salida), '.to-webp-tmp.html')
const html = [
  '<html><body><script>',
  'const i = new Image()',
  'i.onload = () => {',
  `  const w = ${Number(ancho)}, h = Math.round(i.height * w / i.width)`,
  "  const c = document.createElement('canvas')",
  '  c.width = w; c.height = h',
  "  const x = c.getContext('2d')",
  "  x.imageSmoothingQuality = 'high'",
  '  x.drawImage(i, 0, 0, w, h)',
  `  document.title = c.toDataURL('image/webp', ${CALIDAD})`,
  '}',
  `i.src = 'data:image/${mime};base64,${bytes.toString('base64')}'`,
  '</script></body></html>',
].join('\n')

writeFileSync(tmp, html)

try {
  const dom = execFileSync(
    CHROME,
    [
      '--headless',
      '--disable-gpu',
      '--virtual-time-budget=20000',
      '--dump-dom',
      pathToFileURL(tmp).href,
    ],
    { maxBuffer: 1 << 30, encoding: 'utf8' }
  )

  // El resultado viaja en el `title` porque `--dump-dom` es lo único que Chrome
  // headless devuelve por stdout sin montar un servidor.
  const m = dom.match(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/)
  if (!m) {
    console.error('✗ la conversión no devolvió WebP. ¿Cargó la imagen?')
    process.exit(1)
  }

  writeFileSync(salida, Buffer.from(m[1], 'base64'))
} finally {
  try {
    unlinkSync(tmp)
  } catch {
    // El temporal es un detalle: si no se puede borrar, no se para la conversión.
  }
}

const antes = bytes.length
const despues = statSync(salida).size
const kb = (n) => `${Math.round(n / 1024)} kB`
console.log(
  `✓ ${basename(salida)}  ${kb(antes)} → ${kb(despues)}  (−${Math.round((1 - despues / antes) * 100)} %)`
)
