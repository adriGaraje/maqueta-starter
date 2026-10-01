#!/usr/bin/env node
// =============================================================================
//  figma-ready-scan — cola de entrada del harness starterslug-flow (M0 · Ingesta).
//
//  Barre el árbol del archivo de Figma vía REST API buscando nodos marcados
//  como READY_FOR_DEV y los cruza con docs/starterslug-harness/modules.json por node-id.
//  Devuelve los que aún no están registrados: la cola de módulos a maquetar.
//
//  Uso:
//    node scripts/figma-ready-scan.mjs                 # barrido completo
//    node scripts/figma-ready-scan.mjs --node 36:710   # resolver un nodo suelto
//    node scripts/figma-ready-scan.mjs --json          # salida JSON (para el agente)
//
//  Requiere FIGMA_TOKEN y FIGMA_FILE_KEY en .env (ver .env.example).
//
//  ⚠️ ESTADO CONOCIDO (2026-07-21): la REST API de Figma NO devuelve hoy el campo
//  `devStatus` en el árbol del archivo, aunque el diseñador sí marque nodos como
//  "Ready for dev" desde la UI. Verificado empíricamente (0 ocurrencias en 3,2 MB
//  del archivo del proyecto) y reportado por más gente en el foro de Figma:
//  https://forum.figma.com/t/api-and-ready-for-dev/50511
//  El MCP tampoco lo expone (`use_figma` responde «"devStatus" is not a supported API»).
//
//  Por eso este script DISTINGUE dos situaciones que se parecen pero no son lo mismo:
//    (a) la API devuelve el campo y no hay nada marcado  -> cola vacía de verdad
//    (b) la API no devuelve el campo en ningún nodo      -> NO PODEMOS SABERLO
//  Nunca reporta (b) como si fuera (a): un "0 módulos" silencioso haría creer que
//  diseño no ha marcado nada cuando en realidad estamos ciegos.
//
//  Salida: exit 0 = barrido ok · 1 = campo no disponible · 2 = error de config/red.
// =============================================================================
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MODULES = resolve(REPO, 'docs/starterslug-harness/modules.json')

const args = process.argv.slice(2)
const asJson = args.includes('--json')
const soloNodo = args.includes('--node') ? args[args.indexOf('--node') + 1] : null

// --- config -----------------------------------------------------------------
// .env sin dependencias: KEY="value" / KEY=value, ignora comentarios.
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

// --- fetch ------------------------------------------------------------------
async function figma(path) {
  const res = await fetch(`https://api.figma.com/v1/files/${FILE_KEY}${path}`, {
    headers: { 'X-Figma-Token': TOKEN },
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`✗ Figma respondió ${res.status}: ${body.slice(0, 300)}`)
    if (res.status === 403) {
      console.error(
        '  Revisa los scopes del token: hacen falta file_content:read y file_dev_resources:read.'
      )
    }
    process.exit(2)
  }
  return res.json()
}

// --- recorrido --------------------------------------------------------------
// Recorre el árbol acumulando la ruta legible (página > frame > …) de cada nodo.
function* walk(node, ruta = []) {
  yield { node, ruta }
  for (const hijo of node.children ?? []) yield* walk(hijo, [...ruta, node.name])
}

const readModules = () => {
  try {
    return JSON.parse(readFileSync(MODULES, 'utf8'))
  } catch {
    return { modules: [] }
  }
}

// --- main -------------------------------------------------------------------
const doc = soloNodo
  ? (await figma(`/nodes?ids=${encodeURIComponent(soloNodo)}`)).nodes[soloNodo.replace('-', ':')]
      ?.document
  : (await figma('')).document

if (!doc) {
  console.error(`✗ El nodo ${soloNodo} no existe en el archivo.`)
  process.exit(2)
}

const todos = [...walk(doc)]
const conCampo = todos.filter(({ node }) => 'devStatus' in node)
const marcados = conCampo.filter(({ node }) => node.devStatus?.type === 'READY_FOR_DEV')

// Una pieza puede tener MÁS de un nodo: el de escritorio, el de móvil y —en las
// páginas de alianza— uno por marca. Recogerlos todos, no solo `figmaNodeId`:
// mientras se miraba ese único campo, los doce frames de móvil que ya tenían
// ficha salían cada mañana como «nuevos» y proponían tareas duplicadas.
const CAMPOS_NODO = ['figmaNodeId', 'figmaNodeIdMovil', 'figmaSetNodeId']
const registrados = new Set(
  (readModules().modules ?? [])
    .flatMap((m) => [
      ...CAMPOS_NODO.map((c) => m[c]),
      ...Object.values(m.figmaNodosPorMarca ?? {}).flatMap((v) => Object.values(v)),
    ])
    .filter(Boolean)
)
const nuevos = marcados
  .filter(({ node }) => !registrados.has(node.id))
  .map(({ node, ruta }) => ({
    figmaNodeId: node.id,
    name: node.name,
    type: node.type,
    ruta: ruta.slice(1).join(' > '),
    width: Math.round(node.absoluteBoundingBox?.width ?? 0),
    height: Math.round(node.absoluteBoundingBox?.height ?? 0),
    url: `https://www.figma.com/design/${FILE_KEY}/?node-id=${node.id.replace(':', '-')}&m=dev`,
  }))

// El caso (b): ni un solo nodo del árbol trae el campo.
const campoAusente = conCampo.length === 0

if (asJson) {
  console.log(
    JSON.stringify(
      { campoAusente, totalNodos: todos.length, marcados: marcados.length, nuevos },
      null,
      2
    )
  )
  process.exit(campoAusente ? 1 : 0)
}

console.log(`\nArchivo ${FILE_KEY} · ${todos.length} nodos recorridos\n`)

if (campoAusente) {
  console.log('⚠️  La API no ha devuelto el campo `devStatus` en NINGÚN nodo.')
  console.log(
    '    Esto NO significa que diseño no haya marcado nada — significa que no podemos verlo.'
  )
  console.log('    Limitación conocida: https://forum.figma.com/t/api-and-ready-for-dev/50511')
  console.log(
    '    Mientras tanto, alimenta la cola pegando el link del mail de Figma (entrada A).\n'
  )
  process.exit(1)
}

console.log(`✓ Campo disponible · ${marcados.length} nodo(s) marcados READY_FOR_DEV\n`)

if (!nuevos.length) {
  console.log('Sin novedades: todo lo marcado ya está en modules.json.\n')
  process.exit(0)
}

console.log(`${nuevos.length} módulo(s) nuevos en la cola:\n`)
for (const n of nuevos) {
  console.log(`  ${n.name}  [${n.figmaNodeId}]  ${n.width}×${n.height}`)
  console.log(`    ruta: ${n.ruta || '(raíz)'}`)
  console.log(`    ${n.url}\n`)
}
