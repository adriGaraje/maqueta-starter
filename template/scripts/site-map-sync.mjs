#!/usr/bin/env node
// =============================================================================
//  site-map-sync — compara el diseño real de Figma con el mapa del sitio del repo.
//
//  Contesta a la pregunta del ritual de la mañana: ¿qué ha terminado diseño desde
//  ayer? Barre el archivo Handoff, mira qué páginas tienen diseño y qué módulos
//  monta cada una, y lo cruza contra `src/stories/placeholders/site-map.js`.
//
//  Lo que devuelve, en tres montones:
//    readyForDev   nodos marcados `READY_FOR_DEV` en Figma. Es lo que diseño
//                  entrega formalmente, y de aquí salen las tareas de Jira.
//    disenoNuevo   páginas que ANTES no tenían diseño y ahora sí, o que han
//                  pasado de solo escritorio a escritorio y móvil.
//    modulosNuevos módulos que aparecen en el diseño y no están en el catálogo
//                  del mapa. Son piezas por maquetar que nadie ha registrado.
//
//  ⚠️ NO escribe nada. Ni en el repo, ni en Jira. Devuelve el diff y ya; quien
//  decide es el ritual (y, para lo que toca a Jira, lo pactado en la skill).
//
//  Uso:
//    node scripts/site-map-sync.mjs           # informe legible
//    node scripts/site-map-sync.mjs --json    # para que lo consuma la skill
//
//  Códigos de salida: 0 sin novedades · 1 hay novedades · 2 error de uso o de red.
// =============================================================================
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MAPA = resolve(REPO, 'src/stories/placeholders/site-map.js')

const asJson = process.argv.includes('--json')

// --- config (mismo patrón que figma-ready-scan) ------------------------------
function loadEnv() {
  const env = { ...process.env }
  try {
    for (const linea of readFileSync(resolve(REPO, '.env'), 'utf8').split('\n')) {
      const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/i)
      if (m) env[m[1]] ??= m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* sin .env: se usa el entorno */
  }
  return env
}

const env = loadEnv()
const TOKEN = env.FIGMA_TOKEN
const FILE_KEY = env.FIGMA_FILE_KEY

if (!TOKEN || !FILE_KEY) {
  console.error('✗ Faltan FIGMA_TOKEN o FIGMA_FILE_KEY. Copia .env.example a .env y rellénalo.')
  process.exit(2)
}

async function figma(path) {
  const res = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}${path}`, {
    headers: { 'X-Figma-Token': TOKEN },
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`✗ Figma respondió ${res.status}: ${body.slice(0, 300)}`)
    // Acota antes de culpar al archivo: la misma llamada con otra credencial distingue
    // credencial de archivo. Es la regla que dejó L-029.
    if (res.status === 403) {
      console.error(
        '  Puede ser la CREDENCIAL y no el archivo: prueba la misma llamada con el token de otra persona'
      )
    }
    process.exit(2)
  }
  return res.json()
}

// --- qué es diseño y qué es decorado -----------------------------------------
// Un RECTANGLE a tamaño de página es la captura de la web actual pegada al lado,
// no diseño. Los `Navbar Actual` y `Submenu Actual` son lo mismo en forma de frame:
// referencia de lo que hay hoy. Contarlos como módulos nuevos llenaría el mapa de
// piezas que nadie tiene que maquetar.
const ES_REFERENCIA = /^(image \d+|navbar actual|submenu actual)$/i
// `Bubble BG` es el degradado con burbujas que la ficha de tarifa pone DETRÁS de sus
// módulos (09 Fichas tarifas, 11-09): fondo, no pieza. Va con el módulo que tiene encima.
const ES_FONDO = /^bubble bg$/i
// Contenedores sin significado: envuelven módulos pero no son uno. `Content` es el
// wrapper de la Home, y los `Frame 309` son capas que nadie ha nombrado.
const SIN_NOMBRE = /^(frame|group|rectangle|vector|slice|content|contenido)\s*\d*$/i
const PAGINA_IGNORADA = /^(cover|-+|\s*|🗑️.*|💣.*|componentes|⛵️.*)$/i
// Páginas del Handoff que no son rutas del sitio y cuyo nombre no lo dice. Por
// node-id, que el nombre diseño lo cambia cuando quiere.
const PAGINA_NO_ES_RUTA = new Map([
  ['2948:5359', 'Intro 21 AGO: las diapositivas del checkpoint del 24-08'],
])

const esFrameDeDiseno = (n) =>
  (n.type === 'FRAME' || n.type === 'INSTANCE' || n.type === 'COMPONENT') &&
  !ES_REFERENCIA.test(n.name) &&
  !ES_FONDO.test(n.name)

// Una `SECTION` de Figma es una carpeta: agrupa frames dentro de una página y no es
// diseño por sí misma. Si no se aplana, los frames dejan de colgar del canvas y el
// filtro de arriba devuelve una lista vacía — la página sale como «sin diseñar»
// teniendo la maqueta entera dentro. Recursivo porque una sección puede anidar otra.
const aplanaSecciones = (nodos) =>
  (nodos ?? []).flatMap((n) => (n.type === 'SECTION' ? aplanaSecciones(n.children) : [n]))

// Ancho del frame → dispositivo. El handoff maqueta a 1440 y a 390.
// Móvil es un ancho de teléfono (360–430), no «todo lo que no llega a 1000». Hasta el
// 15-09 bastaba con ser estrecho, y doce frames sueltos de 734×320 en «09 Fichas
// tarifas» dieron por diseñado el móvil de diez fichas que no lo tenían: sus móviles
// seguían en la página provisional War Room. La excepción es el nombre: la landing
// «Busco piso» exporta su móvil a 940 y se llama `landing_mobile__…`.
const ANCHO_MOVIL = { min: 360, max: 430 }
const NOMBRE_MOVIL = /(^|[^a-z])(mob|mobile|movil|móvil)([^a-z]|$)/i
const dispositivoDe = (n) => {
  const w = Math.round(n.absoluteBoundingBox?.width ?? 0)
  if (!w) return null
  if (w >= 1000) return 'desktop'
  if (w >= ANCHO_MOVIL.min && w <= ANCHO_MOVIL.max) return 'movil'
  return NOMBRE_MOVIL.test(n.name) ? 'movil' : null
}

// --- barrido -----------------------------------------------------------------
// UNA sola petición. El archivo son ~13.600 nodos y pedirlo dos veces (depth=2 para
// la estructura y completo para `devStatus`) se pasaba de los dos minutos. Del árbol
// entero sale todo: páginas, frames, los hijos de cada frame y el dev status.
function* walk(node, ruta = []) {
  yield { node, ruta }
  for (const hijo of node.children ?? []) yield* walk(hijo, [...ruta, node.name])
}

const completo = await figma('')
const todos = [...walk(completo.document)]

const paginasFigma = []
const modulosPorFrame = new Map()
// Cualquier nodo → la página de Figma que lo contiene. El mapa guarda a veces el id
// de la página y a veces el de un frame suyo, y así valen los dos.
const paginaDeNodo = new Map()

for (const pagina of completo.document.children ?? []) {
  for (const { node } of walk(pagina)) paginaDeNodo.set(node.id, pagina.id)
  if (PAGINA_IGNORADA.test(pagina.name) || PAGINA_NO_ES_RUTA.has(pagina.id)) continue
  const frames = aplanaSecciones(pagina.children).filter(esFrameDeDiseno)
  paginasFigma.push({
    nombre: pagina.name,
    nodeId: pagina.id,
    frames: frames.map((f) => ({
      nombre: f.name,
      nodeId: f.id,
      dispositivo: dispositivoDe(f),
      alto: Math.round(f.absoluteBoundingBox?.height ?? 0),
      ancho: Math.round(f.absoluteBoundingBox?.width ?? 0),
    })),
  })
  // Los módulos de una página son los hijos directos de su frame de escritorio.
  // Se descartan las capas ocultas: en la Home hay un texto suelto llamado `sed`
  // con `visible: false` que se colaba como si fuese una pieza por maquetar.
  // Y se descartan las capas que no son contenedores: un TEXT o un RECTANGLE nunca
  // es un módulo, por muy nombrado que esté. En las páginas compuestas daba igual
  // —sus hijos son frames e instancias—, pero las que diseño maqueta con capas
  // sueltas metían una frase entera por cada párrafo: 25 «módulos desconocidos» de
  // golpe, y un falso positivo repetido acaba con que nadie lee el parte.
  for (const f of frames) {
    const hijos = (f.children ?? [])
      .filter((c) => c.visible !== false)
      .filter(esFrameDeDiseno)
      .filter((c) => !SIN_NOMBRE.test(c.name))
      .map((c) => c.name)
    modulosPorFrame.set(f.id, [...new Set(hijos)])
  }
}
const conCampo = todos.filter(({ node }) => 'devStatus' in node)
const readyForDev = todos
  .filter(({ node }) => node.devStatus?.type === 'READY_FOR_DEV')
  .map(({ node, ruta }) => ({
    nodeId: node.id,
    nombre: node.name,
    pagina: ruta[1] ?? ruta[0] ?? '—',
    ancho: Math.round(node.absoluteBoundingBox?.width ?? 0),
    alto: Math.round(node.absoluteBoundingBox?.height ?? 0),
    url: `https://www.figma.com/design/${FILE_KEY}/?node-id=${node.id.replace(':', '-')}&m=dev`,
  }))

// --- lo que dice el repo ------------------------------------------------------
const { PAGINAS, MODULOS, HUECOS = [] } = await import(pathToFileURL(MAPA).href)

const norm = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim()

// Se casa por NODE-ID. Hasta el 11-09 se casaba por el nombre exacto de la página, y
// en cuanto diseño puso un emoji delante (`una página`, `una página`) tres páginas
// registradas salieron como «sin registrar». El nombre queda solo de red para cuando
// el nodo ya no existe, y comparado sin emoji, signos ni espacios.
// Varias entradas pueden caer en la misma página de Figma: las fichas de tarifa de
// una familia comparten plantilla.
const porPagina = new Map()
const porNombre = new Map()
const nodosMuertos = []
const apunta = (indice, clave, p) => indice.set(clave, [...(indice.get(clave) ?? []), p])
for (const p of PAGINAS) {
  if (!p.figma) continue
  const paginaId = paginaDeNodo.get(p.figma.nodeId)
  if (paginaId) apunta(porPagina, paginaId, p)
  else {
    nodosMuertos.push({ id: p.id, nodeId: p.figma.nodeId, pagina: p.figma.pagina })
    if (p.figma.pagina) apunta(porNombre, norm(p.figma.pagina), p)
  }
}
const registradasDe = (pf) => porPagina.get(pf.nodeId) ?? porNombre.get(norm(pf.nombre)) ?? []

const disenoDetectado = (frames) => {
  const hayDesktop = frames.some((f) => f.dispositivo === 'desktop')
  const hayMovil = frames.some((f) => f.dispositivo === 'movil')
  if (hayDesktop && hayMovil) return 'completo'
  if (hayDesktop) return 'soloDesktop'
  if (hayMovil) return 'parcial'
  return 'sinDisenar'
}

// El orden importa: de menos a más diseño, para saber si una página ha AVANZADO.
const RANGO = { sinDisenar: 0, parcial: 1, soloDesktop: 2, completo: 3 }

const disenoNuevo = []
for (const pf of paginasFigma) {
  const detectado = disenoDetectado(pf.frames)
  if (detectado === 'sinDisenar') continue
  const registradas = registradasDe(pf)
  if (!registradas.length) {
    disenoNuevo.push({
      paginaFigma: pf.nombre,
      nodeId: pf.nodeId,
      antes: 'sin registrar',
      ahora: detectado,
      motivo: 'La página de Figma no está en el mapa del sitio',
    })
    continue
  }
  for (const registrada of registradas) {
    // `disenoFijado` es un criterio humano que gana al detector. Se puso cuando una
    // página tenía frame de escritorio pero a medias: automáticamente parecía un
    // avance y no lo era. Sin esto, la misma falsa novedad saldría cada mañana.
    if (registrada.disenoFijado) continue
    if (RANGO[detectado] > RANGO[registrada.diseno]) {
      disenoNuevo.push({
        paginaFigma: pf.nombre,
        pagina: registrada.name,
        id: registrada.id,
        nodeId: pf.nodeId,
        antes: registrada.diseno,
        ahora: detectado,
        motivo: 'Figma tiene más diseño del que el mapa registra',
      })
    }
  }
}

// --- módulos que el mapa no conoce -------------------------------------------
// El cruce va por los ALIAS que cada módulo declara en el catálogo, no por parecido
// de palabras. La heurística de «alguna palabra en común» daba `Menu` como módulo
// desconocido cuando el mapa lo tiene desde el principio: se llama «Cabecera».
// Un nombre de capa nuevo que no case con ningún alias es lo que hay que mirar —
// o es una pieza nueva, o le falta el alias, y las dos cosas se arreglan aquí.
const alias = new Set()
for (const modulo of Object.values(MODULOS)) {
  alias.add(norm(modulo.name))
  for (const a of modulo.alias ?? []) alias.add(norm(a))
}

const conocido = (nombreFigma) => alias.has(norm(nombreFigma))

// Los huecos de diseño NO son módulos desconocidos: son frames vacíos donde diseño
// pondrá algo. Van aparte para que no se cuenten como pieza por maquetar, pero se
// siguen listando — un hueco que desaparece del parte es un hueco que se olvida.
const huecos = new Set(HUECOS.map((h) => norm(h.nombre)))
const esHueco = (nombreFigma) => huecos.has(norm(nombreFigma))

const modulosNuevos = []
const huecosVistos = []
for (const pf of paginasFigma) {
  const frame = pf.frames.find((f) => f.dispositivo === 'desktop')
  if (!frame) continue
  for (const nombre of modulosPorFrame.get(frame.nodeId) ?? []) {
    if (conocido(nombre)) continue
    const destino = esHueco(nombre) ? huecosVistos : modulosNuevos
    const ya = destino.find((m) => m.nombre === nombre)
    if (ya) ya.paginas.push(pf.nombre)
    else destino.push({ nombre, paginas: [pf.nombre] })
  }
}

// --- salida -------------------------------------------------------------------
const resultado = {
  fecha: new Date().toISOString().slice(0, 10),
  campoAusente: conCampo.length === 0,
  totalNodos: todos.length,
  paginasEnFigma: paginasFigma.length,
  readyForDev,
  disenoNuevo,
  modulosNuevos,
  // Huecos de diseño encontrados. Van fuera de `modulosNuevos` a propósito y NO
  // cuentan como novedad: no hay nada que maquetar todavía.
  huecos: huecosVistos,
  // Entradas del mapa cuyo `figma.nodeId` ya no existe en el Handoff. Tampoco cuentan
  // como novedad, pero hay que repuntarlas: un node-id muerto no rompe nada (L-030).
  nodosMuertos,
  // El estado detectado de cada página, para que el ritual pueda escribirlo tal cual.
  detectado: paginasFigma.map((pf) => ({
    paginaFigma: pf.nombre,
    nodeId: pf.nodeId,
    diseno: disenoDetectado(pf.frames),
    frames: pf.frames.map((f) => `${f.nombre} (${f.ancho}×${f.alto})`),
    modulos: modulosPorFrame.get(pf.frames.find((f) => f.dispositivo === 'desktop')?.nodeId) ?? [],
  })),
}

const hayNovedades = readyForDev.length > 0 || disenoNuevo.length > 0 || modulosNuevos.length > 0

if (asJson) {
  console.log(JSON.stringify(resultado, null, 2))
  process.exit(hayNovedades ? 1 : 0)
}

console.log(`\nMapa del sitio · Figma → repo   (${resultado.fecha})`)
console.log(`  ${resultado.paginasEnFigma} páginas en el Handoff · ${resultado.totalNodos} nodos`)

if (resultado.campoAusente) {
  console.log('\n⚠️  Ningún nodo trae `devStatus`: no se puede saber qué ha marcado diseño.')
  console.log('    NO es lo mismo que «no hay nada nuevo». Dilo así en el parte.')
}

console.log(`\nREADY FOR DEV (${readyForDev.length}):`)
for (const r of readyForDev) {
  console.log(`  · ${r.nombre} — ${r.pagina} · ${r.ancho}×${r.alto}`)
  console.log(`    ${r.nodeId}  ${r.url}`)
}
if (!readyForDev.length) console.log('  nada marcado')

console.log(`\nDISEÑO NUEVO (${disenoNuevo.length}):`)
for (const d of disenoNuevo) {
  console.log(`  · ${d.pagina ?? d.paginaFigma}: ${d.antes} → ${d.ahora}`)
  console.log(`    ${d.motivo}`)
}
if (!disenoNuevo.length) console.log('  el mapa está al día')

console.log(`\nMÓDULOS QUE EL MAPA NO CONOCE (${modulosNuevos.length}):`)
for (const m of modulosNuevos) {
  console.log(`  · ${m.nombre} — en ${m.paginas.length}: ${m.paginas.join(', ')}`)
}
if (!modulosNuevos.length) console.log('  ninguno')

// Se listan aunque no sean novedad: un hueco que desaparece del parte es un hueco
// que se olvida. Lo que no hacen es disparar el código de salida.
if (huecosVistos.length) {
  console.log(`\nHUECOS DE DISEÑO (${huecosVistos.length}) — frames vacíos, nada que maquetar:`)
  for (const h of huecosVistos) {
    console.log(`  · ${h.nombre} — en ${h.paginas.length}: ${h.paginas.join(', ')}`)
  }
}

if (nodosMuertos.length) {
  console.log(`\nNODOS DEL MAPA QUE YA NO EXISTEN (${nodosMuertos.length}) — repuntarlos:`)
  for (const n of nodosMuertos) console.log(`  · ${n.id}: ${n.nodeId} («${n.pagina}»)`)
}

console.log(
  hayNovedades
    ? '\n→ Hay novedades. El ritual las registra en el mapa y abre las tareas.\n'
    : '\n→ Sin novedades desde el último barrido.\n'
)
process.exit(hayNovedades ? 1 : 0)
