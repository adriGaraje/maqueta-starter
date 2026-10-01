#!/usr/bin/env node
// =============================================================================
//  pixel-measure — mide una pieza dentro de un PNG y da su caja en píxeles.
//
//  El complemento de `pixel-shot`. Ese captura; este dice cuánto mide lo
//  capturado. Hasta ahora el paso 4 del pipeline dependía de mirar la captura
//  al lado del Figma, y a ojo no se distingue un icono de 18×12 de uno de
//  15×10 — que es exactamente el diff que se le escapó a una tarea anterior durante días.
//
//  Funciona sobre CUALQUIER PNG, así que sirve igual para la captura del
//  Storybook y para la exportada del Figma: se mide lo mismo en los dos y se
//  comparan números, no impresiones.
//
//  Decodifica el PNG con el `zlib` de Node, sin dependencias: meter una
//  librería de imagen entera para leer una caja no compensa.
//
//  Uso:
//    node scripts/pixel-measure.mjs <png> <color> [opciones]
//
//    <color>            hex (#0050FF), o `claro` / `oscuro`
//    --dentro <color>   busca primero esta pieza y mide la otra DENTRO de ella
//    --inset N          encoge N px la región por cada lado
//    --region x,y,w,h   limita la búsqueda a un rectángulo
//    --tol N            tolerancia de color por canal (0-255, por defecto 48)
//    --mapa             imprime un mapa ASCII de lo que ha casado
//    --json             salida en JSON, para encadenar
//
//  Ejemplo — el burger dentro de su círculo blanco, que es como se mide de
//  verdad un icono: la posición absoluta cambia con el encuadre, el offset
//  dentro de su contenedor no.
//
//    node scripts/pixel-measure.mjs shot.png '#0050FF' --dentro claro --inset 10
//
//  El --inset ahí no es opcional: --dentro devuelve una caja RECTANGULAR y el
//  botón es un círculo, así que las cuatro esquinas de la caja son fondo. Si el
//  fondo se parece al icono —y aquí los dos son azules— entran en la medida y
//  la inflan de 14×10 a 35×56 sin avisar. Encoge hasta que el contenedor quede
//  limpio; con --mapa se ve de un vistazo si aún se cuela.
//
//  ⚠️ DOS TRAMPAS MÁS, las dos vistas en una tarea anterior:
//
//  1. El antialias se queda fuera del umbral, así que la caja sale ~1 px más
//     pequeña que la nominal: un glifo de 15×10 se mide como 14×10. No es un
//     diff — mide también la referencia de Figma y compara las dos medidas,
//     nunca una medida contra el número del diseño.
//  2. Las capturas de `pixel-shot` son de 520 px de ancho como mínimo, con
//     relleno blanco a la derecha (Chrome headless no baja de ahí, ver L-008).
//     Buscar «lo blanco de la derecha» encuentra el relleno, no la pieza. Usa
//     --region, o --dentro, que acota solo.
//  3. Compara CAJAS, no el recuento de píxeles. Chrome y el rasterizador de
//     Figma reparten el antialias distinto, así que un trazo de grosor
//     fraccionario da recuentos muy distintos —28 frente a 56 en el burger—
//     con la misma caja de 14×10. La caja es la señal; el recuento, ruido.
// =============================================================================
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

// --- PNG → píxeles -----------------------------------------------------------
// Solo 8 bits sin entrelazar, que es lo que sacan Chrome y Figma. Cualquier
// otra cosa falla en voz alta en vez de devolver medidas sin sentido.
function leerPng(ruta) {
  const b = readFileSync(ruta)
  if (b.readUInt32BE(0) !== 0x89504e47) throw new Error(`${ruta} no es un PNG`)

  let p = 8
  let ancho, alto, bits, tipoColor, entrelazado
  const idat = []
  while (p < b.length) {
    const len = b.readUInt32BE(p)
    const tipo = b.toString('ascii', p + 4, p + 8)
    const datos = b.subarray(p + 8, p + 8 + len)
    if (tipo === 'IHDR') {
      ancho = datos.readUInt32BE(0)
      alto = datos.readUInt32BE(4)
      bits = datos[8]
      tipoColor = datos[9]
      entrelazado = datos[12]
    } else if (tipo === 'IDAT') idat.push(datos)
    else if (tipo === 'IEND') break
    p += 12 + len
  }

  if (bits !== 8) throw new Error(`${ruta}: PNG de ${bits} bits, solo se admiten 8`)
  if (entrelazado !== 0) throw new Error(`${ruta}: PNG entrelazado, no admitido`)
  const canales = { 0: 1, 2: 3, 4: 2, 6: 4 }[tipoColor]
  if (!canales) throw new Error(`${ruta}: colorType ${tipoColor} no admitido`)

  // Deshace el filtro por línea (spec PNG §9). El byte de filtro va delante de
  // cada scanline y se apoya en el píxel de la izquierda y en el de arriba.
  const crudo = inflateSync(Buffer.concat(idat))
  const paso = ancho * canales
  const px = Buffer.alloc(alto * paso)
  let q = 0
  for (let y = 0; y < alto; y++) {
    const filtro = crudo[q++]
    const linea = crudo.subarray(q, q + paso)
    q += paso
    const act = px.subarray(y * paso, (y + 1) * paso)
    const ant = y > 0 ? px.subarray((y - 1) * paso, y * paso) : null
    for (let i = 0; i < paso; i++) {
      const izq = i >= canales ? act[i - canales] : 0
      const arr = ant ? ant[i] : 0
      const diag = ant && i >= canales ? ant[i - canales] : 0
      let v = linea[i]
      if (filtro === 1) v += izq
      else if (filtro === 2) v += arr
      else if (filtro === 3) v += (izq + arr) >> 1
      else if (filtro === 4) {
        const est = izq + arr - diag
        const a = Math.abs(est - izq)
        const b2 = Math.abs(est - arr)
        const c = Math.abs(est - diag)
        v += a <= b2 && a <= c ? izq : b2 <= c ? arr : diag
      }
      act[i] = v & 0xff
    }
  }
  return { ancho, alto, canales, px }
}

// --- Selectores de color -----------------------------------------------------
function selector(spec, tol) {
  if (spec === 'claro') return (r, g, b) => r > 200 && g > 200 && b > 200
  if (spec === 'oscuro') return (r, g, b) => r < 60 && g < 60 && b < 60
  const m = /^#?([0-9a-f]{6})$/i.exec(spec)
  if (!m) throw new Error(`Color no reconocido: «${spec}». Usa un hex, "claro" u "oscuro".`)
  const n = parseInt(m[1], 16)
  const [R, G, B] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return (r, g, b) => Math.abs(r - R) <= tol && Math.abs(g - G) <= tol && Math.abs(b - B) <= tol
}

// --- Caja de lo que casa -----------------------------------------------------
function medir(img, casa, region, mapa) {
  const { x: rx, y: ry, w: rw, h: rh } = region
  let minX = Infinity
  let minY = Infinity
  let maxX = -1
  let maxY = -1
  let n = 0
  const filas = []
  for (let y = ry; y < ry + rh; y++) {
    let fila = ''
    for (let x = rx; x < rx + rw; x++) {
      const i = (y * img.ancho + x) * img.canales
      const hit = casa(img.px[i], img.px[i + 1], img.px[i + 2])
      if (mapa) fila += hit ? '#' : '.'
      if (hit) {
        n++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    if (mapa) filas.push(fila)
  }
  if (!n) return { caja: null, filas }
  return { caja: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, px: n }, filas }
}

// --- CLI ---------------------------------------------------------------------
const argv = process.argv.slice(2)
const CON_VALOR = new Set(['--dentro', '--region', '--tol', '--inset'])

const bandera = (nombre) => argv.includes(nombre)
const valor = (nombre) => {
  const i = argv.indexOf(nombre)
  return i === -1 ? null : argv[i + 1]
}

// Los posicionales son lo que queda tras quitar las banderas y el valor que
// arrastra cada una. Hacerlo en una pasada evita el lío de que un valor de
// bandera se cuele como posicional (y al revés).
const posicionales = []
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a.startsWith('--')) {
    if (CON_VALOR.has(a)) i++
    continue
  }
  posicionales.push(a)
}

if (!argv.length || bandera('--help') || bandera('-h')) {
  console.log(`
pixel-measure — mide una pieza dentro de un PNG y da su caja en píxeles.

  node scripts/pixel-measure.mjs <png> <color> [opciones]

  <color>            hex (#0050FF), o \`claro\` / \`oscuro\`
  --dentro <color>   busca primero esta pieza y mide la otra DENTRO de ella
  --inset N          encoge N px la región por cada lado
  --region x,y,w,h   limita la búsqueda a un rectángulo
  --tol N            tolerancia de color por canal (por defecto 48)
  --mapa             imprime un mapa ASCII de lo que ha casado
  --json             salida en JSON

Mide SIEMPRE también la referencia de Figma y compara las dos medidas: el
antialias deja la caja ~1 px por debajo de la nominal, en las dos por igual.

Con --dentro sobre un contenedor redondo, añade --inset: la caja es
rectangular y sus esquinas son fondo. Comprueba con --mapa.
`)
  process.exit(0)
}

const [ruta, color] = posicionales
if (!ruta || !color) {
  console.error('Faltan argumentos: <png> y <color> son obligatorios. `--help` para el uso.')
  process.exit(2)
}
const tol = Number(valor('--tol') ?? 48)
const comoJson = bandera('--json')
const conMapa = bandera('--mapa')

const img = leerPng(ruta)
let region = { x: 0, y: 0, w: img.ancho, h: img.alto }

const recorte = valor('--region')
if (recorte) {
  const [x, y, w, h] = recorte.split(',').map(Number)
  region = { x, y, w, h }
}

// --dentro: la caja del contenedor pasa a ser la región. Es lo que hace que la
// medida sea estable — el offset dentro del contenedor no depende del encuadre.
let contenedor = null
const dentro = valor('--dentro')
if (dentro) {
  const r = medir(img, selector(dentro, tol), region, false)
  if (!r.caja) {
    console.error(`No se encontró nada de «${dentro}» en la región dada.`)
    process.exit(1)
  }
  contenedor = r.caja
  region = { x: contenedor.x, y: contenedor.y, w: contenedor.w, h: contenedor.h }
}

// El inset va al final, después de --dentro, que es justo para lo que existe:
// descontar las esquinas de la caja de un contenedor redondo.
const inset = Number(valor('--inset') ?? 0)
if (inset) {
  region = {
    x: region.x + inset,
    y: region.y + inset,
    w: region.w - inset * 2,
    h: region.h - inset * 2,
  }
  if (region.w <= 0 || region.h <= 0) {
    console.error(`El --inset de ${inset} se come la región entera.`)
    process.exit(2)
  }
}

const { caja, filas } = medir(img, selector(color, tol), region, conMapa)

if (comoJson) {
  console.log(
    JSON.stringify({ png: ruta, ancho: img.ancho, alto: img.alto, contenedor, caja }, null, 2)
  )
} else {
  console.log(`${ruta} · ${img.ancho}×${img.alto}`)
  if (conMapa) filas.forEach((f) => console.log('  ' + f))
  if (contenedor) {
    console.log(
      `  contenedor «${dentro}»: ${contenedor.w}×${contenedor.h} en (${contenedor.x}, ${contenedor.y})`
    )
  }
  if (!caja) {
    console.log(`  «${color}»: nada dentro de la región`)
  } else {
    let linea = `  «${color}»: ${caja.w}×${caja.h} en (${caja.x}, ${caja.y}), ${caja.px} px`
    if (contenedor) linea += ` · offset (${caja.x - contenedor.x}, ${caja.y - contenedor.y})`
    console.log(linea)
  }
}

process.exit(caja ? 0 : 1)
