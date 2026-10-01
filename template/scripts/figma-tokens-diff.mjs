#!/usr/bin/env node
// =============================================================================
//  figma-tokens-diff — comprueba que los tokens del repo siguen siendo los de Figma.
//
//  Lo ejecuta el ritual de arranque de la skill starterslug-flow (M1) todas las mañanas.
//
//  Compara DOS cosas, que no son la misma:
//    1. Figma  ↔  el SCSS del repo   → lo que se ve en Storybook está desalineado.
//       Es la comprobación que importa: el snapshot puede estar tan viejo como el SCSS.
//    2. Figma  ↔  el snapshot        → qué ha tocado diseño desde el último sync.
//
//  Uso:
//    node scripts/figma-tokens-diff.mjs <fresh.json> [--snapshot <path>] [--write-snapshot]
//
//  <fresh.json> es el vuelco de Figma que trae el agente por MCP: un objeto plano
//  nombre-de-style → valor, tal cual lo devuelve `get_variable_defs`, con los
//  resultados de varios nodos fundidos en uno:
//
//    { "Primarios/Beyond blue": "#0050FF",
//      "Desktop/H1": "Font(family: \"On Air\", style: Regular, size: 56, ...)" }
//
//  También traga el formato viejo del snapshot ({colorStyles, textStyles}).
//
//  ⚠️ El vuelco se hace nodo a nodo, así que solo prueba PRESENCIA: un style que no
//  aparezca puede ser que nadie lo use en los nodos barridos, no que lo hayan
//  borrado. Por eso este script NUNCA reporta bajas. Los tokens del repo que Figma
//  no confirme se listan aparte, como «sin comprobar».
//
//  Salida:
//    0 · alineado
//    1 · hay valores que NO coinciden — Storybook pinta otra cosa que Figma. Arréglalo.
//    2 · error de uso (falta el vuelco)
//    3 · sin desajustes, pero Figma tiene styles que el repo no adopta. Es una
//        decisión, no un fallo: se saca en el parte y se pregunta.
// =============================================================================
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TOKENS = resolve(REPO, 'src/styles/settings/_tokens.scss')
const TIPO = resolve(REPO, 'src/styles/settings/_typography.scss')

const argv = process.argv.slice(2)
const arg = (name) => {
  const i = argv.indexOf(name)
  return i === -1 ? null : argv[i + 1]
}
const snapshotPath =
  arg('--snapshot') ?? resolve(REPO, 'docs/starterslug-harness/figma-tokens.snapshot.json')
const escribirSnapshot = argv.includes('--write-snapshot')
const freshPath = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--snapshot')

if (!freshPath) {
  console.error(`✗ Falta el vuelco de Figma.

  node scripts/figma-tokens-diff.mjs <fresh.json> [--snapshot <path>] [--write-snapshot]

  El vuelco lo trae el agente por MCP (get_variable_defs sobre los nodos de
  docs/starterslug-harness/config.json → figma.files.handoff.nodos). Ver docs/design-tokens.md.`)
  process.exit(2)
}

// ── Normalización del vuelco ────────────────────────────────────────────────

const redondea = (n, d = 3) => Number(Number(n).toFixed(d))

const PESOS = { light: 300, regular: 400, bold: 700 }

// "Font(family: "On Air", style: Bold, size: 16, weight: 700, lineHeight: 0.89…, letterSpacing: 0)"
function parseFont(v) {
  const num = (k) => {
    const m = v.match(new RegExp(`${k}:\\s*(-?[\\d.]+)`))
    return m ? redondea(m[1]) : null
  }
  return {
    size: num('size'),
    weight: num('weight'),
    lineHeight: num('lineHeight'),
    // Figma da el tracking en % del tamaño; el repo lo guarda en em.
    letterSpacing: num('letterSpacing'),
  }
}

function normalizar(raw) {
  const colores = {}
  const textos = {}

  // Formato viejo del snapshot.
  if (raw.colorStyles || raw.textStyles) {
    for (const [k, v] of Object.entries(raw.colorStyles ?? {})) colores[k] = v.toUpperCase()
    for (const [k, v] of Object.entries(raw.textStyles ?? {})) {
      if (typeof v === 'string') textos[k] = parseFont(v)
      // Formato del snapshot de julio: lineHeightPct / letterSpacingPct / style.
      else if ('lineHeightPct' in v)
        textos[k] = {
          size: v.size,
          weight: PESOS[String(v.style).toLowerCase()] ?? null,
          lineHeight: redondea(v.lineHeightPct / 100),
          letterSpacing: v.letterSpacingPct,
        }
      else textos[k] = v
    }
    return { colores, textos }
  }

  for (const [nombre, valor] of Object.entries(raw)) {
    if (typeof valor !== 'string') continue
    if (valor.startsWith('#')) colores[nombre] = valor.toUpperCase()
    else if (valor.startsWith('Font(')) textos[nombre] = parseFont(valor)
  }
  return { colores, textos }
}

// ── Lo que tiene el repo ────────────────────────────────────────────────────

const expandeHex = (hex) => {
  const h = hex.replace('#', '')
  const largo =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h
  return `#${largo.toUpperCase()}`
}

// $color-primary-beyond-blue: #0050ff; // Figma: Primarios/Beyond blue
function leerColoresDelRepo() {
  const out = {}
  for (const linea of readFileSync(TOKENS, 'utf8').split('\n')) {
    const m = linea.match(/^\$([\w-]+):\s*(#[0-9a-fA-F]{3,8});\s*\/\/\s*Figma:\s*(.+?)\s*$/)
    if (m) out[m[3]] = { variable: `$${m[1]}`, hex: expandeHex(m[2]) }
  }
  return out
}

// // Figma Desktop/H1 · 56/110%
// 'h1': (3.5rem, 1.1, -0.02em, $font-weight-regular),
function leerTipografiaDelRepo() {
  const out = {}
  let ultimoNombre = null
  for (const linea of readFileSync(TIPO, 'utf8').split('\n')) {
    const c = linea.match(/\/\/\s*Figma\s+((?:Desktop|Mobile)\/[^·\n]+?)\s*(?:·|$)/)
    if (c) ultimoNombre = c[1].trim()

    const e = linea.match(/^\s*'([\w-]+)':\s*\(([^)]*)\)/)
    if (!e) continue
    if (ultimoNombre) {
      const [size, lh, ls, peso] = e[2].split(',').map((s) => s.trim())
      out[ultimoNombre] = {
        clave: e[1],
        size: redondea(parseFloat(size) * 16), // rem → px
        lineHeight: redondea(parseFloat(lh)),
        letterSpacing: redondea(parseFloat(ls) * 100), // em → % de Figma
        weight: PESOS[(peso.match(/font-weight-(\w+)/) ?? [])[1]] ?? null,
      }
    }
    ultimoNombre = null
  }
  return out
}

// ── Comparación ─────────────────────────────────────────────────────────────

const fresh = normalizar(JSON.parse(readFileSync(freshPath, 'utf8')))
const repoColores = leerColoresDelRepo()
const repoTextos = leerTipografiaDelRepo()

// Se cuentan aparte a propósito. Un valor que no coincide es un fallo: Storybook
// está pintando otra cosa que Figma. Un style que Figma tiene y el repo no es una
// decisión pendiente (¿lo adoptamos?), y no debe dejar el chequeo en rojo cada
// mañana hasta que alguien la tome.
let desajustes = 0
let novedades = 0

const l = (s = '') => console.log(s)
const bloque = (titulo, filas, contador) => {
  if (!filas.length) return
  if (contador === 'novedad') novedades += filas.length
  else desajustes += filas.length
  l(`\n${titulo} (${filas.length}):`)
  filas.forEach((f) => l(`  ${f}`))
}

l('Chequeo de tokens · Figma → repo')
l(`  vuelco:   ${freshPath}`)
l(`  colores:  ${Object.keys(fresh.colores).length} styles vistos en Figma`)
l(`  textos:   ${Object.keys(fresh.textos).length} styles vistos en Figma`)

// 1 · Colores
const colorCambios = []
const colorNuevos = []
for (const [nombre, hex] of Object.entries(fresh.colores)) {
  const repo = repoColores[nombre]
  if (!repo) colorNuevos.push(`${nombre} = ${hex} — no está en _tokens.scss`)
  else if (repo.hex !== hex)
    colorCambios.push(`${nombre}: repo ${repo.variable} ${repo.hex} → Figma ${hex}`)
}
bloque('COLORES · el repo no coincide con Figma', colorCambios)
bloque('COLORES · en Figma y no en el repo', colorNuevos, 'novedad')

// 2 · Tipografía
const CAMPOS = [
  ['size', 'tamaño', 'px'],
  ['lineHeight', 'interlineado', ''],
  ['letterSpacing', 'tracking', '%'],
  ['weight', 'peso', ''],
]
const tipoCambios = []
const tipoNuevos = []
for (const [nombre, figma] of Object.entries(fresh.textos)) {
  const repo = repoTextos[nombre]
  if (!repo) {
    tipoNuevos.push(
      `${nombre} = ${figma.size}px / ${figma.lineHeight} / ${figma.letterSpacing}% / ${figma.weight} — no está en $type-scale`
    )
    continue
  }
  const difs = CAMPOS.filter(([k]) => figma[k] !== null && repo[k] !== figma[k]).map(
    ([k, etiqueta, unidad]) => `${etiqueta} ${repo[k]}${unidad} → ${figma[k]}${unidad}`
  )
  if (difs.length) tipoCambios.push(`${nombre} ('${repo.clave}'): ${difs.join(' · ')}`)
}
bloque('TIPOGRAFÍA · el repo no coincide con Figma', tipoCambios)
bloque('TIPOGRAFÍA · en Figma y no en $type-scale', tipoNuevos, 'novedad')

// 3 · Qué se ha movido en Figma desde el último sync. Informativo: no suma deriva,
//     porque lo que manda es el desajuste contra el repo, no contra el snapshot.
try {
  const snap = normalizar(JSON.parse(readFileSync(snapshotPath, 'utf8')))
  const movidos = []
  for (const [n, v] of Object.entries(fresh.colores)) {
    if (!snap.colores[n]) movidos.push(`${n}: nuevo desde el último sync`)
    else if (snap.colores[n] !== v) movidos.push(`${n}: ${snap.colores[n]} → ${v}`)
  }
  for (const [n, v] of Object.entries(fresh.textos)) {
    const s = snap.textos[n]
    if (!s) movidos.push(`${n}: nuevo desde el último sync`)
    else if (CAMPOS.some(([k]) => v[k] !== null && s[k] !== v[k]))
      movidos.push(`${n}: ${s.size}px/${s.lineHeight} → ${v.size}px/${v.lineHeight}`)
  }
  if (movidos.length) {
    l(`\nMOVIMIENTO EN FIGMA desde el último sync (${movidos.length}):`)
    movidos.forEach((m) => l(`  ${m}`))
  }
} catch {
  l('\n(sin snapshot con el que comparar: este es el primero)')
}

// 4 · Lo que Figma no ha confirmado. NO es una baja: el barrido va nodo a nodo.
const sinConfirmar = [
  ...Object.keys(repoColores).filter((n) => !(n in fresh.colores)),
  ...Object.keys(repoTextos).filter((n) => !(n in fresh.textos)),
]
if (sinConfirmar.length) {
  l(`\nSIN COMPROBAR — ningún nodo barrido los usa (${sinConfirmar.length}):`)
  l(`  ${sinConfirmar.join(', ')}`)
  l('  No son bajas: para descartarlos haría falta barrer el archivo entero.')
}

if (escribirSnapshot) {
  let source = {}
  try {
    source = JSON.parse(readFileSync(snapshotPath, 'utf8')).source ?? {}
  } catch {
    /* primer snapshot */
  }
  const salida = {
    _comment:
      'Estado de los styles de Figma en el último sync. NO editar a mano: lo regenera el ' +
      'chequeo de arranque de la skill starterslug-flow con --write-snapshot (ver docs/design-tokens.md).',
    source,
    colorStyles: fresh.colores,
    textStyles: fresh.textos,
  }
  writeFileSync(snapshotPath, `${JSON.stringify(salida, null, 2)}\n`, 'utf8')
  l(`\n✔ Snapshot regenerado: ${snapshotPath}`)
}

if (desajustes) {
  l(`\n✖ ${desajustes} valor(es) en los que Storybook NO pinta lo que dice Figma.`)
  l('  Alinea src/styles/settings/_tokens.scss y _typography.scss, pasa green y dilo en el parte.')
  process.exit(1)
}
if (novedades) {
  l(`\n○ Sin desajustes, pero Figma tiene ${novedades} style(s) que el repo no adopta todavía.`)
  l('  No es un fallo, es una decisión: sácalo en el parte de la mañana y pregunta.')
  process.exit(3)
}
l('\n✔ Alineado: lo que pinta Storybook es lo que dice Figma.')
process.exit(0)
