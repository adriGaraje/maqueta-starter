#!/usr/bin/env node
// =============================================================================
//  pixel-shot — captura stories de Storybook con Chrome por DevTools Protocol.
//
//  Es el paso 4 del pipeline de starterslug-flow: la verificación visual contra Figma.
//
//  Uso:
//    STARTERSLUG_STORYBOOK_TODO=1 npx storybook build -o <dir>     ← con las WIP dentro
//    node scripts/pixel-shot.mjs <dir> <destino> <id>:<ancho>x<alto>[@<scrollY>] [...]
//
//  Ejemplo:
//    node scripts/pixel-shot.mjs .sb docs/.../shots snippets-hero--brand:1440x975
//
//  El <id> es el de la URL de la story (`?id=`): título en kebab + `--` + export.
//
//  ── QUÉ CAMBIÓ EN una tarea anterior, Y POR QUÉ ESTO YA NO ES UNA CARRERA ───────────────
//  Antes se pedía la captura con `--screenshot` + `--virtual-time-budget`, y esa
//  pareja no permite decir «captura AHORA, que ya he esperado»: la captura cae
//  cuando se agota el presupuesto, haya cerrado el decodificado de las imágenes o
//  no. Como nuestro marcado lleva `decoding="async"` —que autoriza expresamente a
//  Chrome a dibujar sin esperar al decodificado— por ahí se colaba un hueco liso
//  del color del fondo. De 6 capturas negras de 11 se bajó a 2 de 12, y
//  ahí se quedó: quedaba una carrera y no había forma de cerrarla desde fuera.
//
//  Ahora Chrome se conduce por CDP. La espera se hace DENTRO de la página como
//  una promesa —montada · imágenes DEL CUADRO completas y decodificadas · fuentes ·
//  dos fotogramas— y `Page.captureScreenshot` se pide DESPUÉS de que resuelva.
//  El orden deja de depender del reloj.
//
//  ── Y SE ACABÓ EL IFRAME (L-008) ───────────────────────────────────────────
//  Chrome headless no baja de ~500 px de VENTANA: con `--window-size=390` maqueta
//  a 500 y luego recorta, así que las capturas de móvil salían mintiendo en
//  silencio. Se esquivaba metiendo la story en un iframe del tamaño pedido.
//  `Emulation.setDeviceMetricsOverride` fija un viewport REAL de cualquier ancho,
//  así que el iframe sobra. Medido al montar esto: sin emular `innerWidth` da
//  504; emulando a 390 da 390 y la media query de `xs` resuelve.
//  Importa más allá de la captura: el iframe era también lo que dejaba sin foco a
//  los `play` que dependen de él (L-063).
//
//  ── TRES SALIDAS, COMO ANTES ───────────────────────────────────────────────
//  0 la captura es buena · 1 salió coja · 2 no se pudo comprobar. Una captura a
//  la que le falta una imagen no se distingue a ojo de una pieza con un hueco de
//  verdad, así que jamás se devuelve en silencio.
// =============================================================================
import { createServer } from 'node:http'
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync, mkdirSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'

import { abreChrome } from './lib/cdp.mjs'

const [dir, destino, ...trabajos] = process.argv.slice(2)

if (!dir || !destino || !trabajos.length) {
  console.error(
    'Uso: node scripts/pixel-shot.mjs <dir> <destino> <id>:<ancho>x<alto>[@<scrollY>] [...]'
  )
  process.exit(2)
}

const RAIZ = resolve(dir)
if (!existsSync(join(RAIZ, 'iframe.html'))) {
  console.error(`No encuentro ${join(RAIZ, 'iframe.html')}. Construye antes el Storybook.`)
  process.exit(2)
}
mkdirSync(destino, { recursive: true })

// ⚠️ LO QUE NO ESTÁ AQUÍ SE SIRVE COMO `application/octet-stream`, Y ESO ROMPE
// CAPTURAS SIN AVISAR. Faltaba `.webp`, que es el formato de 21 assets de la
// build y de los ocho de `alliance-hero`: Chrome tenía que adivinar el formato,
// y lo adivinaba a veces.
const TIPOS = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

// Y si aun así aparece una extensión que no conocemos, se dice. Es barato y
// convierte el próximo caso en una línea de consola en vez de en una tarde.
const desconocidas = new Set()

const server = createServer(async (req, res) => {
  const ruta = decodeURIComponent(req.url.split('?')[0])
  const fichero = join(RAIZ, ruta === '/' ? '/index.html' : ruta)
  if (!fichero.startsWith(RAIZ) || !existsSync(fichero)) {
    res.writeHead(404)
    return res.end('no')
  }
  const ext = extname(fichero)
  if (!TIPOS[ext] && ext) desconocidas.add(ext)
  res.writeHead(200, { 'content-type': TIPOS[ext] ?? 'application/octet-stream' })
  res.end(await readFile(fichero))
})

const puerto = await new Promise((ok) =>
  server.listen(0, '127.0.0.1', () => ok(server.address().port))
)

// Tope REAL, no virtual: ya no hay `--virtual-time-budget` que haga saltar el
// reloj. Ese tope real es lo que permite acotar el `decode()` por imagen: con
// tiempo virtual un `setTimeout` por imagen vencía al instante y daba por
// decodificada una que solo se había rendido. Aquí no puede pasar.
const ESPERA = Number(process.env.STARTERSLUG_SHOT_BUDGET ?? 20000)

// La espera, como una promesa. Resuelve con el parte de imágenes.
//
// ⚠️ «NINGUNA PENDIENTE» ES CIERTO CUANDO NO HAY NINGUNA. Una guardia que se da
// por satisfecha antes de que la story monte ve cero imágenes, cero pendientes, y
// firma «todas pintadas» sin haber mirado nada. Por eso se exige PRIMERO que la
// story haya pintado, y el parte dice si se quedó esperando: no distinguir «no
// falta ninguna» de «no he mirado» es el fallo que este script tenía.
const guion = (scroll) => `(async () => {
  const hasta = Date.now() + ${ESPERA}
  const duerme = (ms) => new Promise((ok) => setTimeout(ok, ms))
  const nombre = (i) => (i.currentSrc || i.src).split('/').pop()

  let raiz = null
  let montada = false
  while (Date.now() < hasta) {
    raiz = document.querySelector('#storybook-root')
    if (raiz && raiz.children.length) { montada = true; break }
    await duerme(25)
  }
  if (!montada) return { montada: false, agotado: true }

  const y = ${Number(scroll) || 0}
  if (y) {
    // Hay que ESPERAR a que la página tenga altura: desplazar antes de que los
    // módulos hayan pintado recorta el scroll a 0 y la captura sale arriba del
    // todo como si nada hubiera pasado.
    while (Date.now() < hasta && document.documentElement.scrollHeight <= y + innerHeight) {
      await duerme(50)
    }
    scrollTo(0, y)
    dispatchEvent(new Event('scroll'))
    await duerme(150)
  }

  // ⚠️ SOLO SE ESPERA A LO QUE VA A SALIR EN LA CAPTURA, Y NO ES UN ATAJO.
  // Nuestras imágenes llevan \`loading="lazy"\`, y una imagen lazy que el navegador
  // todavía no ha decidido cargar **no resuelve \`decode()\` jamás**: la promesa se
  // queda pendiente para siempre. Medido sobre \`pages-fibra-y-móvil--default\`:
  // 11 de sus 15 imágenes cuelgan, todas fuera del cuadro (y=3081, 5459, 7660) o
  // en \`display:none\`. Esperarlas a todas colgaba el script en cualquier story de
  // página. Antes no se notaba porque \`--virtual-time-budget\` cortaba por lo sano
  // y la captura caía igual — otra cosa que aquel presupuesto tapaba (L-067).
  //
  // Lo que importa para una captura es que esté decodificado **lo que se ve**. Lo
  // de fuera del cuadro no sale en el PNG, así que no se espera, y se dice cuánto
  // se ha saltado para que nadie lea el verde como «las 15 estaban listas».
  const enCuadro = (i) => {
    const r = i.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight
  }

  let agotado = false
  for (;;) {
    if (![...document.images].filter(enCuadro).some((i) => !i.complete)) break
    if (Date.now() >= hasta) { agotado = true; break }
    await duerme(25)
  }

  const todas = [...document.images]
  const imgs = todas.filter(enCuadro)
  const fueraDeCuadro = todas.length - imgs.length
  const rotas = imgs.filter((i) => i.complete && i.naturalWidth === 0)
  const pendientes = imgs.filter((i) => !i.complete)

  // ⚠️ complete NO ES «SE PUEDE PINTAR». decoding=async autoriza a Chrome a
  // dibujar el fotograma SIN esperar al decodificado; si la captura cae en medio,
  // sale un hueco liso del color del fondo. Era el caso del carrusel de Netflix:
  // el parte decía 22 de 22 cargadas y la banda salía negra igual. decode() es lo
  // único que ata el decodificado al momento de la captura — y ahora la captura
  // llega DESPUÉS de esta promesa, no cuando se acaba un presupuesto.
  //
  // El tope es REAL y por eso se puede poner: con tiempo virtual un \`setTimeout\`
  // por imagen vencía al instante y daba por decodificada una que solo se había
  // rendido. Aquí un tope que salta es una incidencia, no un aprobado.
  const sinDecodificar = []
  await Promise.all(
    imgs.map(async (i) => {
      if (!i.decode) return
      const bien = await Promise.race([
        i.decode().then(() => true).catch(() => true),
        duerme(Math.max(0, hasta - Date.now())).then(() => false),
      ])
      if (!bien) sinDecodificar.push(nombre(i))
    })
  )

  // Las fuentes mueven la maqueta igual que las imágenes.
  await document.fonts.ready

  // ── Y HAY QUE ESPERAR A QUE DEJE DE MOVERSE ────────────────────────────────
  // Al conducir por CDP se acabó el \`--virtual-time-budget\`, que adelantaba el
  // reloj y remataba las transiciones al instante. Con tiempo real vuelven a
  // durar lo que duran, así que la captura puede caer EN MEDIO de una.
  // Medido sobre \`alliance-hero--netflix-carousel\`, cuyos pósters se esparcen
  // con \`transform 0.6s\`: sin esta espera, 28 de 30 capturas salían con el
  // abanico a medio abrir. Ninguna estaba coja —todas las imágenes dentro— y aun
  // así 28 enseñaban un estado que el usuario no ve nunca.
  //
  // \`getAnimations()\` incluye las transiciones CSS. Se descartan las infinitas —
  // un fundido en bucle no termina jamás— y se pone tope, porque una promesa que
  // no resuelve aquí sería peor que la carrera que viene a cerrar.
  const enVuelo = document.getAnimations().filter((a) => {
    try {
      return a.effect?.getComputedTiming?.().iterations !== Infinity
    } catch {
      return false
    }
  })
  let animacionesSinCerrar = 0
  if (enVuelo.length) {
    const cerradas = await Promise.race([
      Promise.allSettled(enVuelo.map((a) => a.finished)).then(() => true),
      new Promise((ok) => setTimeout(() => ok(false), Math.max(0, hasta - Date.now()))),
    ])
    if (!cerradas) animacionesSinCerrar = enVuelo.length
  }

  // Dos fotogramas: el primero aplica, el segundo confirma que ya no se mueve.
  await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)))

  return {
    montada: true,
    agotado,
    imagenes: imgs.length,
    fueraDeCuadro,
    sinDecodificar,
    animaciones: enVuelo.length,
    animacionesSinCerrar,
    ancho: innerWidth,
    alto: innerHeight,
    rotas: rotas.map(nombre),
    pendientes: pendientes.map(nombre),
  }
})()`

let incidencias = 0
let sinComprobar = 0

const { sesion, cierra } = await abreChrome()
try {
  await sesion.envia('Page.enable')
  await sesion.envia('Runtime.enable')

  for (const trabajo of trabajos) {
    // <id>:<ancho>x<alto>[@<scrollY>]
    const [id, resto] = trabajo.split(':')
    const [medidas, scroll = 0] = (resto ?? '').split('@')
    const [w, h] = (medidas ?? '').split('x').map(Number)
    if (!id || !w || !h) {
      console.error(`✖ no entiendo el trabajo «${trabajo}». Formato: <id>:<ancho>x<alto>[@<y>]`)
      sinComprobar++
      continue
    }
    const salida = resolve(destino, `${id}-${w}x${h}${scroll ? '@' + scroll : ''}.png`)

    // El viewport se fija ANTES de navegar: así las media queries resuelven bien
    // desde el primer render y no hay un reflow a media captura.
    await sesion.envia('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: 1,
      mobile: false,
    })

    const url = `http://127.0.0.1:${puerto}/iframe.html?id=${encodeURIComponent(id)}&viewMode=story`
    await sesion.envia('Page.navigate', { url })

    let parte
    try {
      const r = await sesion.envia(
        'Runtime.evaluate',
        { expression: guion(scroll), awaitPromise: true, returnByValue: true },
        ESPERA + 30000
      )
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text ?? 'la espera lanzó')
      parte = r.result.value
    } catch (e) {
      console.log(`? ${id} ${w}×${h}\n  ⚠️  no se pudo comprobar: ${e.message}`)
      sinComprobar++
      continue
    }

    // La captura, AHORA: la promesa de arriba ya resolvió.
    const shot = await sesion.envia('Page.captureScreenshot', { format: 'png' })
    await writeFile(salida, Buffer.from(shot.data, 'base64'))

    let aviso
    if (!parte?.montada) {
      aviso = '  ⚠️  la story no llegó a montarse: la captura no enseña la pieza'
      incidencias++
    } else if (parte.rotas.length || parte.pendientes.length) {
      const lista = [...parte.rotas, ...parte.pendientes].join(', ')
      aviso = `  ⚠️  ${parte.rotas.length + parte.pendientes.length} de ${parte.imagenes} imágenes sin pintar: ${lista}`
      incidencias++
    } else if (parte.agotado) {
      aviso = `  ⚠️  se agotó la espera con ${parte.imagenes} imágenes: la captura puede ir a medias`
      incidencias++
    } else if (parte.ancho !== w) {
      // El viewport emulado tiene que ser el pedido. Si no lo es, la captura
      // está maquetada a otro ancho y no vale para comparar contra Figma (L-008).
      aviso = `  ⚠️  el viewport salió a ${parte.ancho} y se pidió ${w}: la captura no vale`
      incidencias++
    } else if (parte.sinDecodificar.length) {
      aviso = `  ⚠️  ${parte.sinDecodificar.length} imagen(es) del cuadro sin decodificar: ${parte.sinDecodificar.join(', ')}`
      incidencias++
    } else if (parte.animacionesSinCerrar) {
      aviso = `  ⚠️  ${parte.animacionesSinCerrar} animación(es) seguían corriendo: la pieza puede salir a medio movimiento`
      incidencias++
    } else {
      const anim = parte.animaciones ? ` · ${parte.animaciones} animación(es) cerradas` : ''
      // Lo de fuera del cuadro se dice SIEMPRE que lo haya: un «12 decodificadas»
      // a secas en una página de 15 imágenes se lee como si estuvieran todas.
      const fuera = parte.fueraDeCuadro
        ? ` · ${parte.fueraDeCuadro} fuera del cuadro, sin esperar`
        : ''
      aviso = `  ${parte.imagenes} imágenes decodificadas${fuera}${anim} · viewport ${parte.ancho}×${parte.alto}`
    }
    console.log(`✓ ${id} ${w}×${h} → ${salida}\n${aviso}`)
  }
} finally {
  cierra()
  server.close()
}

if (desconocidas.size) {
  console.log(
    `\n⚠️  Extensiones servidas sin tipo (application/octet-stream): ${[...desconocidas].join(', ')}\n` +
      '    Chrome tiene que adivinar el formato y no siempre acierta. Añádelas a TIPOS.'
  )
}

if (incidencias) {
  console.log(`\n✖ ${incidencias} captura(s) con imágenes sin pintar. No sirven para verificar.`)
  process.exit(1)
}
if (sinComprobar) {
  console.log(
    `\n⚠️  ${sinComprobar} captura(s) no se pudieron comprobar. «Está bien» y «no lo sé» no\n` +
      '    son lo mismo, así que esto no sale con 0.'
  )
  process.exit(2)
}
