#!/usr/bin/env node
/**
 * Regenera el mirror local de Jira: tasks/STARTERSLUG-<n>-<slug>.md + tasks/backlog.md
 *
 * La descripción completa de cada tarea vive en Jira y NO se duplica aquí: el .md
 * guarda lo que hace falta para trabajar en paralelo sin pisarse (quién la tiene,
 * qué ficheros toca, de qué depende) y enlaza a Jira para el resto.
 *
 * ── De dónde sale cada dato ────────────────────────────────────────────────
 *   Jira manda:  título · estado · asignada.        (nunca se escriben a mano)
 *   El repo manda: nodo de Figma · captura · dependencias · ficheros · rama.
 *                  Jira no conoce nada de esto, por eso vive en la tabla LOCAL.
 *
 * ── Uso ────────────────────────────────────────────────────────────────────
 *   node scripts/jira-mirror.mjs --board <dump.json>
 *       Con un vuelco del tablero. Es la vía normal: la skill starterslug-flow lo genera
 *       por MCP, igual que figma-tokens-diff consume el vuelco de Figma.
 *
 *   node scripts/jira-mirror.mjs
 *       Sin --board, lo pide él mismo por REST si hay JIRA_EMAIL y
 *       JIRA_API_TOKEN en el entorno (ver .env.example).
 *
 *   node scripts/jira-mirror.mjs --sin-estado
 *       Regenera solo lo local y deja las columnas de estado marcadas como
 *       «sin comprobar». Válvula de escape para trabajar sin red.
 *
 * Sin ninguna de las tres, SALE CON ERROR. Antes escribía 'Por hacer' y
 * 'sin asignar' como literales, así que cada ejecución devolvía el tablero al
 * día cero y el fichero que decía «espejo de Jira» era el que borraba el estado.
 *
 * ── Qué puede borrar ───────────────────────────────────────────────────────
 *   SOLO las fichas que llevan su propio sello (ver SELLO) y ya no salen en la
 *   tabla local. Una ficha escrita a mano no lo lleva, así que no se toca nunca.
 *
 *   Antes se guiaba por «no está en la tabla», que no distingue una ficha
 *   caducada de una escrita a mano: el 25-08 había diez a mano —una tarea anterior y una tarea anterior a
 *   Una tarea anterior— que una sola ejecución habría destruido, en silencio y con exit 0.
 *   Ahora todo borrado se imprime, aunque sea de cero.
 */

import { writeFileSync, readdirSync, unlinkSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Sitio y proyecto salen de config.json → atlassian.
const CONFIG = JSON.parse(readFileSync('docs/starterslug-harness/config.json', 'utf8'))
const SITE = `https://${CONFIG.atlassian?.site ?? 'TODO.atlassian.net'}`
const JIRA = `${SITE}/browse`
const FIGMA = 'TODO' // URL del archivo de Figma de handoff
const DIR = 'tasks'
const KEY = CONFIG.atlassian?.jira?.projectKey ?? 'TODO'
const JQL = `project = ${KEY} ORDER BY key ASC`
const SIN_DATO = '— sin comprobar'

// Sello que este script pone en cada ficha que escribe, y la ÚNICA señal por la
// que decide después qué puede borrar. Sin él, el borrado se guiaba por «no está
// en la tabla local», que no distingue una ficha caducada de una escrita a mano:
// el 25-08 había diez a mano que una ejecución habría
// destruido. Una ficha sin sello no se toca nunca, aunque sobre.
const SELLO = '<!-- generado por scripts/jira-mirror.mjs · no editar a mano -->'

// Claves del tablero que NO llevan ficha local y no hace falta avisar de ellas:
// los epics son contenedores, no trabajo. Todo lo demás que esté en el tablero y
// no tenga ficha SÍ se avisa. Antes esto era un rango cableado `n >= 6 && n <= 48`
// que llevaba desde una tarea anterior sin avisar de nada — es decir, callado durante casi
// cuarenta tareas. Un filtro que hay que ampliar a mano se queda viejo solo.
const SIN_FICHA_A_PROPOSITO = new Set([]) // p. ej. las claves de los epics

// Un epic por entregable. La capa (átomo/molécula/módulo) va en etiquetas.
const ENTREGABLE = { key: 'TODO', name: 'Entregable 1' }

const CAPAS = {
  fundaciones: { etiqueta: 'atomo', nombre: 'Átomo' },
  componentes: { etiqueta: 'molecula', nombre: 'Molécula' },
  modulos: { etiqueta: 'modulo', nombre: 'Módulo' },
}

// Estados del tablero que significan «no la cojas». Se casan por nombre porque
// los ids de transición cambian si alguien toca el workflow.
const ESTADOS_CERRADOS = new Set(['Listo'])
const ESTADOS_BLOQUEO = new Set(['Bloqueado'])

// Metadatos que Jira NO tiene. El título de aquí es solo el de respaldo: si el
// tablero responde, gana el suyo (en una tarea anterior el enunciado se corrigió en Jira y
// esta tabla se quedó con el viejo durante semanas).
// Los nodos son del archivo de handoff (FIGMA, arriba). El de móvil es '—' cuando
// la pieza es un set con variante Device y por tanto vale el mismo nodo.
// key · slug · título de respaldo · capa · rama · nodo Figma · captura · depende de · ficheros · nodo móvil
//
// El `prettier-ignore` de abajo es deliberado: esto es una TABLA, una fila por tarea,
// alineada con la cabecera de aquí arriba. Prettier la partiría en diez líneas por fila
// y las 45 tareas pasarían de leerse de un vistazo a ocupar quinientas líneas. Aquí el
// formato compacto ES la información, no un descuido que el gate deba corregir.
// prettier-ignore
const T = [
  // Una fila por tarea, con la cabecera de arriba. Ejemplo:
  // ['KEY-6','icono-check','Icono check','fundaciones','feat','1-2','01-hero.png','—','src/components/icon-check/*','—'],
]

// ── Lectura del tablero ──────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const arg = (name) => {
  const i = argv.indexOf(name)
  return i === -1 ? null : argv[i + 1]
}
const boardPath = arg('--board')
const sinEstado = argv.includes('--sin-estado')

if (argv.includes('--help') || argv.includes('-h')) {
  console.log(
    readFileSync(new URL(import.meta.url), 'utf8')
      .split('*/')[0]
      .replace(/^#!.*\n/, '')
  )
  process.exit(0)
}

/**
 * Normaliza cualquiera de las formas en que nos puede llegar el tablero:
 * la respuesta cruda del MCP ({issues:{nodes:[…]}}), la de la REST
 * ({issues:[…]}) o un array pelado. Devuelve key → {summary, status, assignee}.
 */
function normalizar(raw) {
  const nodes = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.issues?.nodes)
      ? raw.issues.nodes
      : Array.isArray(raw?.issues)
        ? raw.issues
        : null
  if (!nodes)
    throw new Error(
      'El vuelco no tiene issues reconocibles (ni array, ni {issues:[…]}, ni {issues:{nodes:[…]}})'
    )

  const out = new Map()
  for (const n of nodes) {
    const f = n.fields ?? n
    out.set(n.key, {
      summary: f.summary ?? null,
      status: f.status?.name ?? null,
      assignee: f.assignee?.displayName ?? null,
    })
  }
  return out
}

async function porRest() {
  const email = process.env.JIRA_EMAIL
  const token = process.env.JIRA_API_TOKEN
  if (!email || !token) return null

  const url = new URL('/rest/api/3/search/jql', SITE)
  url.searchParams.set('jql', JQL)
  url.searchParams.set('fields', 'summary,status,assignee')
  url.searchParams.set('maxResults', '100')

  const res = await fetch(url, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) throw new Error(`Jira respondió ${res.status} ${res.statusText}`)
  return normalizar(await res.json())
}

let board = null
let fuente = ''

// La fuente se nombra por tipo, no por ruta: el vuelco vive en un temporal
// distinto en cada máquina y meterlo en la cabecera ensuciaría el diff de
// backlog.md en cada ejecución.
if (boardPath) {
  board = normalizar(JSON.parse(readFileSync(boardPath, 'utf8')))
  fuente = 'un vuelco del tablero'
} else if (!sinEstado) {
  board = await porRest()
  if (board) fuente = 'la API de Jira'
}

if (!board && !sinEstado) {
  console.error(`✗ No hay datos del tablero, y este script ya no se los inventa.

  Elige una:
    node scripts/jira-mirror.mjs --board <dump.json>   vuelco del tablero (lo genera la skill starterslug-flow por MCP)
    JIRA_EMAIL=… JIRA_API_TOKEN=… node scripts/jira-mirror.mjs
    node scripts/jira-mirror.mjs --sin-estado          regenera lo local y marca el estado como no comprobado
`)
  process.exit(2)
}

// ── Avisos de deriva entre la tabla local y el tablero ───────────────────────

const avisos = []
if (board) {
  for (const [key] of T.map((r) => [r[0]])) {
    if (!board.has(key)) avisos.push(`${key} está en la tabla local pero no en el tablero`)
  }
  for (const [key, v] of board) {
    // Solo interesan las tareas del entregable ya desglosado; las de tooling
    // y los epics no tienen ficha local a propósito.
    if (!SIN_FICHA_A_PROPOSITO.has(key) && !T.some((r) => r[0] === key)) {
      avisos.push(`${key} («${v.summary}») está en el tablero pero no tiene ficha local`)
    }
  }
}

// ── Escritura ────────────────────────────────────────────────────────────────

const estadoDe = (key) => (board ? (board.get(key)?.status ?? SIN_DATO) : SIN_DATO)
const asignadaDe = (key) => (board ? (board.get(key)?.assignee ?? 'sin asignar') : SIN_DATO)
const tituloDe = (key, respaldo) => board?.get(key)?.summary ?? respaldo

// Limpia las fichas que ESTE script escribió y que ya no le tocan. La prueba es
// el sello, no la tabla: una ficha sin sello está escrita a mano y se respeta,
// aunque no esté en `T`. Las de numeración local antigua
// documentan trabajo anterior a Jira y tampoco se tocan.
const generadas = new Set(T.map(([key, slug]) => `${key}-${slug}.md`))
const borradas = []
const respetadas = []
for (const f of readdirSync(DIR)) {
  if (
    !new RegExp(`^${KEY}-\\d+-.*\\.md$`).test(f) ||
    new RegExp(`^${KEY}-0\\d\\d-`).test(f) ||
    generadas.has(f)
  )
    continue
  if (readFileSync(join(DIR, f), 'utf8').includes(SELLO)) {
    unlinkSync(join(DIR, f))
    borradas.push(f)
  } else {
    respetadas.push(f)
  }
}

for (const [key, slug, respaldo, epic, type, node, shot, deps, files, movil] of T) {
  const capa = CAPAS[epic]
  const estado = estadoDe(key)
  const title = tituloDe(key, respaldo)
  const nota = ESTADOS_BLOQUEO.has(estado)
    ? ' — no empezar'
    : ESTADOS_CERRADOS.has(estado)
      ? ' — entregada'
      : ''

  const body = `${SELLO}

# ${key} — ${title}

| Campo | Valor |
| --- | --- |
| **Jira** | [${key}](${JIRA}/${key}) — **la descripción completa está ahí** |
| **Entregable** | [${ENTREGABLE.name}](${JIRA}/${ENTREGABLE.key}) |
| **Capa** | ${capa.nombre} (etiqueta \`${capa.etiqueta}\`) |
| **Estado** | ${estado}${nota} |
| **Asignada a** | ${asignadaDe(key)} |
| **Rama** | \`${type}/${key}-${slug}\` |

## Dónde mirar

- **Figma:** [nodo \`${node.replace('-', ':')}\`](${FIGMA}?node-id=${node}&m=dev)
${movil === '—' ? '' : `- **Móvil:** [nodo \`${movil.replace('-', ':')}\`](${FIGMA}?node-id=${movil}&m=dev)\n`}${shot === '—' ? '- **Captura:** no disponible (ver la tarea de Jira)' : `- **Captura:** \`docs/assets/home/${shot}\``}
- **Brief común:** [\`docs/task-brief.md\`](../docs/task-brief.md) — **léelo antes de empezar**

## Ficheros que va a tocar

\`${files}\`

> Antes de coger esta tarea, comprueba en el board que nadie tiene En curso otra que toque
> estos mismos ficheros.

## Depende de

${deps === '—' ? 'Nada.' : deps}

## Terminada cuando

Se cumplen los criterios de aceptación de [${key}](${JIRA}/${key}) y la definición de terminado
de [\`docs/task-brief.md\`](../docs/task-brief.md).
`
  writeFileSync(join(DIR, `${key}-${slug}.md`), body, 'utf8')
}

// backlog.md
// Las filas que este script sabe generar, de la tabla local.
const propias = T.map(
  ([key, slug, respaldo, epic, , , , deps]) =>
    `| [${key}](${JIRA}/${key}) | ${tituloDe(key, respaldo)} | ${CAPAS[epic].nombre} | ${estadoDe(key)} | ${asignadaDe(key)} | ${deps} | [\`${key}-${slug}.md\`](${key}-${slug}.md) |`
)

// Y las que alguien escribió a mano en el backlog anterior. `backlog.md` se
// reescribe entero, así que sin esto una ejecución se llevaba por delante las
// diez filas añadidas a mano aunque sus fichas .md
// sobrevivieran al sello: la mina tenía dos cargas, no una. Se conservan tal
// cual, al final de la tabla y en su orden, hasta que entren en `T`.
const enTabla = new Set(T.map(([key]) => key))
let aMano = []
try {
  aMano = readFileSync(join(DIR, 'backlog.md'), 'utf8')
    .split('\n')
    .filter((l) => {
      // Solo filas de la tabla de TAREAS, que son las que acaban enlazando a su
      // ficha. La tabla de epics de más arriba empieza igual, y colarla aquí la
      // reinyectaba en la de tareas y hacía crecer el fichero en cada ejecución.
      if (!/\.md\)\s*\|\s*$/.test(l)) return false
      const m = l.match(new RegExp(`^\\| \\[(${KEY}-\\d+)\\]\\(`))
      return m && !enTabla.has(m[1])
    })
} catch {
  // No hay backlog previo (primera ejecución). No hay nada que conservar.
}

const rows = [...propias, ...aMano].join('\n')

const entregadas = T.filter(([k]) => ESTADOS_CERRADOS.has(estadoDe(k))).length
const cabecera = board
  ? `> **Espejo de Jira**, generado desde ${fuente}. El tablero manda: proyecto **${KEY}** en ${SITE}.
> Título, estado y asignada salen de ahí; el resto de columnas las pone el repo.`
  : `> ⚠️ **Estado sin comprobar.** Regenerado con \`--sin-estado\`: las columnas *Estado* y
> *Asignada* NO reflejan el tablero. Vuelve a generarlo con datos antes de fiarte de ellas.`

writeFileSync(
  join(DIR, 'backlog.md'),
  `# ${KEY} — Tablero de tareas

${cabecera}
>
> Este fichero se regenera con \`node scripts/jira-mirror.mjs --board <dump.json>\` — no lo edites a mano.
>
> Coge la tarea **en Jira** (ponla \`En curso\` y asígnatela) antes de tocar nada, y respeta la
> columna *Depende de*. Reglas: [\`docs/jira-workflow.md\`](../docs/jira-workflow.md).

## Entregables

Trabajamos por entregables, no por sprints. Un epic por entregable:

| Epic | Entregable | Estado |
| --- | --- | --- |
| [${ENTREGABLE.key}](${JIRA}/${ENTREGABLE.key}) | **${ENTREGABLE.name}** | ${board ? `${entregadas} de ${T.length} entregadas` : `las ${T.length} tareas de abajo`} |

## Tareas del Entregable 1

Por capa: los **átomos** primero, porque todo lo demás los usa.

| Clave | Título | Capa | Estado | Asignada | Depende de | Ficha |
| --- | --- | --- | --- | --- | --- | --- |
${rows}
`,
  'utf8'
)

console.log(`Generadas ${T.length} fichas + backlog.md`)
console.log(
  board ? `  estado leído de: ${fuente.replace(/`/g, '')}` : '  ⚠️  SIN estado real (--sin-estado)'
)

// El borrado se dice siempre, aunque sea de cero: era silencioso y ahí estaba el peligro.
console.log(`  borradas ${borradas.length} ficha(s) caducada(s) de este script`)
for (const f of borradas) console.log(`     – ${f}`)
if (respetadas.length) {
  console.log(`  respetadas ${respetadas.length} ficha(s) escrita(s) a mano (sin sello):`)
  for (const f of respetadas) console.log(`     · ${f}`)
  console.log('     Para que las gestione este script, añádelas a la tabla local T.')
}
if (aMano.length) {
  console.log(`  conservadas ${aMano.length} fila(s) del backlog escritas a mano`)
}

if (avisos.length > 12) {
  // Con el rango cableado esta lista salía siempre vacía; sin él son ~45 y una
  // parrafada de cuarenta líneas se ignora igual que el silencio.
  console.log(`  ⚠️  ${avisos.length} avisos de deriva. Los 12 primeros:`)
  for (const a of avisos.slice(0, 12)) console.log(`     ${a}`)
  console.log(`     …y ${avisos.length - 12} más.`)
} else {
  for (const a of avisos) console.log(`  ⚠️  ${a}`)
}
