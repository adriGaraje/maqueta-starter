#!/usr/bin/env node
// Captura una pagina HTML suelta —no una story— para poder compararla.
// La usa `build-landing.mjs` para verificar que el entregable renderiza lo mismo
// que la pieza de Storybook. Espera a fuentes e imagenes, como `pixel-shot`.
//
//   node scripts/lib/shot-suelto.mjs <dir> <destino.png> <ancho> <alto>
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { abreChrome } from './cdp.mjs'

const [RAIZ, DESTINO, ANCHO, ALTO] = [
  process.argv[2],
  process.argv[3],
  +process.argv[4],
  +process.argv[5],
]
const TIPOS = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}
const srv = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(req.url.split('?')[0])
    if (p.endsWith('/')) p += 'index.html'
    const b = await readFile(join(RAIZ, p))
    res.writeHead(200, { 'Content-Type': TIPOS[extname(p)] ?? 'application/octet-stream' })
    res.end(b)
  } catch {
    res.writeHead(404)
    res.end()
  }
})
await new Promise((r) => srv.listen(0, r))
const { sesion, cierra } = await abreChrome({ ancho: ANCHO, alto: ALTO })
await sesion.envia('Page.enable')
await sesion.envia('Runtime.enable')
await sesion.envia('Emulation.setDeviceMetricsOverride', {
  width: ANCHO,
  height: ALTO,
  deviceScaleFactor: 1,
  mobile: false,
})
await sesion.envia('Page.navigate', { url: `http://localhost:${srv.address().port}/` })
await sesion.envia('Runtime.evaluate', {
  expression: `new Promise(r => {
     // ⚠️ LA ESPERA ESTÁ ACOTADA, y hace falta: una imagen \`loading="lazy"\` dentro
     // de un subárbol oculto NO SE CARGA NUNCA —no entra en el viewport— así que su
     // \`decode()\` no resuelve jamás y esto se quedaba colgado hasta el timeout de
     // 60 s del CDP, sin captura y sin decir por qué. Lo destapó el entregable
     // bilingüe de «Busco piso», que lleva el idioma que no se ve en \`hidden\`.
     //   ---
     // Tres segundos por imagen es de sobra para una que SÍ va a cargar, y la que
     // no, no debe frenar la captura: si no se va a ver, no sale en la foto.
     const conTope = (p) => Promise.race([p, new Promise(ok => setTimeout(ok, 3000))])
     const listo = () => Promise.all([
       conTope(document.fonts.ready),
       ...[...document.images].map(i => i.complete ? 0 : conTope(i.decode().catch(()=>0))),
     ]).then(() => requestAnimationFrame(() => requestAnimationFrame(r)))
     document.readyState === 'complete' ? listo() : addEventListener('load', listo)
   })`,
  awaitPromise: true,
})
const s = await sesion.envia('Page.captureScreenshot', { format: 'png' })
await writeFile(DESTINO, Buffer.from(s.data, 'base64'))
console.log('✓', DESTINO)
cierra()
srv.close()
