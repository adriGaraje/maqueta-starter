#!/usr/bin/env node
// =============================================================================
//  estado-entrega — qué es nuevo, qué se ha tocado y qué está en curso
//
//  Calcula, para CADA pieza del Storybook, en qué situación llega a la entrega
//  que se está preparando. Alimenta dos cosas que no pueden discrepar:
//
//    · el icono delante de cada pieza en la barra lateral (manager.jsx)
//    · la página «Release Notes» que lo explica (release-notes.mdx)
//
//  Se genera, NO se escribe a mano. Es a propósito: este repo ya tiene tres
//  espejos que envejecieron solos —modules.json, tasks/backlog.md y el mapa del
//  sitio— y la lección L-004 dice justo esto, que un espejo que no lee la fuente
//  es peor que no tener espejo. La fuente aquí es git.
//
//  ─── de dónde sale cada estado ────────────────────────────────────────────
//
//    nuevo       la pieza no existía en la entrega anterior
//    modificado  existía y alguno de sus ficheros ha cambiado desde entonces
//    estable     existía y no se ha tocado
//    en-curso    story con tags: ['WIP'] — se publica, pero no está cerrada
//
//  Los tres primeros son HECHOS DEL PASADO y salen de `git diff`. El cuarto es
//  una DECLARACIÓN sobre el futuro y sale de la etiqueta de la story, que es
//  donde ya vivía. Son dos ejes distintos y se informan por separado: una pieza
//  puede ser «nueva y en curso» a la vez, y eso es exactamente lo que le pasa
//  hoy a media entrega.
//
//  ─── qué ficheros «son» una pieza ─────────────────────────────────────────
//
//  Una pieza sola en su carpeta (el caso normal, 22 de 29) se lleva la carpeta
//  entera: así cuentan también su `datos-*.js`, sus parciales y sus assets.
//
//  Tres carpetas alojan varias piezas —`modules/tariffs`, `components/tariff-card`
//  y `stories`—. Ahí una pieza se lleva los ficheros que empiezan por su nombre
//  (`tariff-panel.*`), más los ficheros de la carpeta que no son de ninguna pieza
//  concreta (`datos-paneles.js`), que son de todas.
//
//  Excepción: bajo `src/stories/` esos ficheros compartidos NO se reparten. Son
//  la fontanería del propio Storybook (`snippet-code.js`, `lib/`, `placeholders/`)
//  y tocarlos marcaría las cuatro piezas de la carpeta como modificadas sin que
//  haya cambiado nada de lo que el cliente ve.
//
//  ⚠️ Lo que esto NO mide, y conviene decirlo (L-038: un informe vale lo que
//  cubre): una pieza que compone otra no se marca modificada cuando cambia la
//  que compone. El footer usa `.btn-pill`, que vive en el CSS global; si cambia
//  el botón, el footer se ve distinto y aquí sale «estable». La composición la
//  conoce `build-entrega.mjs`, no git.
//
//  Uso:
//    node scripts/estado-entrega.mjs            → escribe public/entrega/estado.json
//    node scripts/estado-entrega.mjs --print    → además lo resume por pantalla
// =============================================================================
import { readdirSync, readFileSync, writeFileSync, statSync, mkdirSync, existsSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(RAIZ, 'src')
const SALIDA = join(RAIZ, 'public', 'entrega', 'estado.json')

const git = (...args) => {
  try {
    return execFileSync('git', args, {
      cwd: RAIZ,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return null
  }
}

const listar = (dir) =>
  readdirSync(dir).flatMap((e) => {
    const ruta = join(dir, e)
    return statSync(ruta).isDirectory() ? listar(ruta) : [ruta]
  })

const posix = (f) => relative(RAIZ, f).replace(/\\/g, '/')

// El id que Storybook da a una pieza a partir de su título. Es la llave con la que
// `renderLabel` casa cada fila de la barra lateral, porque las filas NO llevan el
// título completo: el árbol lo parte en grupos y la fila solo sabe su tramo.
//
// Es una reimplementación del `sanitize` de @storybook/csf, que no está expuesto
// como paquete. Verificado contra las 96 entradas del `index.json` de la última
// build: coinciden todas. Si Storybook cambiara el algoritmo, los iconos
// desaparecerían en silencio — por eso `npm run estado:entrega -- --verificar`
// lo vuelve a contrastar contra el índice cuando hay una build a mano.
const sanitize = (s) =>
  s
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')

// ── 1 · el ancla: la entrega anterior ────────────────────────────────────────
//
// Los tags se llaman `entrega/AAAA-MM-DD`, así que ordenan solos por nombre y no
// hace falta preguntar por fechas. Se coge el más reciente que sea ANTECESOR del
// commit actual: un tag de una entrega posterior (o de otra rama) no sirve de
// referencia para lo que se está construyendo ahora.
function entregaAnterior() {
  const tags = (git('tag', '--list', 'entrega/*') ?? '')
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .sort()
    .reverse()

  const cabeza = git('rev-parse', 'HEAD')

  for (const tag of tags) {
    // UNA ENTREGA NO PUEDE SER SU PROPIA REFERENCIA. Si el tag apunta al commit
    // que se está construyendo, compararse con él da 0 nuevas y 0 modificadas:
    // TODO sale «estable» y la barra lateral se queda sin un solo icono.
    //
    // Pasó el 27-08 y no fue teórico. `deploy.mjs` crea el tag DESPUÉS de
    // construir, así que la primera publicación va bien; el fallo aparece al
    // republicar el mismo día, cuando el tag ya está donde estás. Se perdieron
    // los iconos en pro y lo vio alguien del equipo, no ningún gate.
    if (git('rev-parse', `${tag}^{commit}`) === cabeza) continue

    const esAncestro = (() => {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', tag, 'HEAD'], {
          cwd: RAIZ,
          stdio: 'ignore',
        })
        return true
      } catch {
        return false
      }
    })()
    if (esAncestro) {
      return { tag, fecha: tag.replace('entrega/', ''), sha: git('rev-parse', '--short', tag) }
    }
  }
  return null
}

// ── 2 · las piezas y su etiqueta ─────────────────────────────────────────────
//
// Se leen igual que en `.storybook/main.js` —mismo regex, mismo criterio— porque
// las dos lecturas TIENEN que dar lo mismo: una decide qué se publica y la otra
// qué icono lleva. Si divergieran, el Storybook enseñaría una pieza sin estado o
// un estado de una pieza que no está.
function etiquetaDe(lista) {
  if (lista.includes("'suspended'")) return 'suspended'
  if (lista.includes("'production'")) return 'production'
  return 'WIP'
}

function leerPiezas() {
  return listar(SRC)
    .filter((f) => f.endsWith('.stories.js'))
    .map((f) => {
      const src = readFileSync(f, 'utf8')
      const etiqueta = src.match(/tags:\s*\[([^\]]*)\]/)
      // El `(?<![\w$])` no es adorno: sin él, `help_title: '¿Podemos ayudarte?'`
      // de alliance.stories.js casaba antes que el título real y la pieza se
      // indexaba con una cadena de contenido. Cualquier `*_title:` volvería a
      // romperlo.
      // Y no basta con el guardarraíl de arriba: un `title:` PELADO dentro de un
      // objeto de datos también cuela. En `tariffs-mobile.stories.js` un
      // `VENTAJAS = { title: 'Motivos para quedarte…' }` indexaba la página con
      // ese texto en vez de con «Pages/Tarifas Móvil», y eso sale en la barra
      // lateral y en Release Notes. El título de la story es el del
      // `export default`, así que se busca a partir de ahí.
      const iExport = src.indexOf('export default')
      const ambito = iExport === -1 ? src : src.slice(iExport)
      const titulo = ambito.match(/(?<![\w$])title:\s*'([^']+)'/)
      return {
        fichero: f,
        base: basename(f, '.stories.js'),
        carpeta: dirname(f),
        titulo: titulo?.[1] ?? null,
        etiqueta: etiqueta ? etiquetaDe(etiqueta[1]) : null,
      }
    })
    .filter((p) => p.titulo)
}

// ── 3 · qué ficheros vigila cada pieza ───────────────────────────────────────
const CARPETA_FONTANERIA = join(SRC, 'stories')

function ficherosDe(pieza, piezas) {
  const hermanas = piezas.filter((p) => p.carpeta === pieza.carpeta)
  const sola = hermanas.length === 1

  if (sola) return listar(pieza.carpeta).map(posix)

  const bases = new Set(hermanas.map((p) => p.base))
  const enCarpeta = readdirSync(pieza.carpeta)
    .map((e) => join(pieza.carpeta, e))
    .filter((f) => statSync(f).isFile())

  return enCarpeta
    .filter((f) => {
      const b = basename(f).replace(/\.[^.]+$/, '')
      if (b === pieza.base) return true
      // compartido: no es de ninguna pieza concreta, luego es de todas
      const deOtra = [...bases].some((x) => x !== pieza.base && b === x)
      if (deOtra) return false
      return pieza.carpeta !== CARPETA_FONTANERIA
    })
    .map(posix)
}

// ── 4 · el cálculo ───────────────────────────────────────────────────────────
const ancla = entregaAnterior()
const piezas = leerPiezas()

// Un solo `git diff` para todo, y un solo `ls-tree`: 29 piezas × 2 llamadas serían
// 58 procesos y esto corre antes de cada arranque de Storybook.
const tocados = new Set(
  ancla
    ? (git('diff', '--name-only', `${ancla.tag}..HEAD`, '--', 'src') ?? '')
        .split('\n')
        .filter(Boolean)
    : []
)
const existian = new Set(
  ancla
    ? (git('ls-tree', '-r', '--name-only', ancla.tag, 'src') ?? '').split('\n').filter(Boolean)
    : []
)

// «Existía» tiene que significar VIAJÓ EN LA ENTREGA ANTERIOR, no «el fichero
// estaba en el árbol». Una story `suspended` no se publica —ni en local ni en la
// entrega—, así que para quien la recibe la pieza NO estaba. Si además ahora se
// levanta la suspensión, es estrictamente una pieza nueva para el cliente, y
// marcarla «modificada» le diría que compare con algo que nunca vio.
//
// Se comprueba leyendo la story EN EL TAG, no la de ahora: lo que importa es cómo
// estaba etiquetada entonces. Solo se consultan las que existían, así que son
// tantas llamadas como piezas ya publicadas y ninguna de más.
const suspendidasEnLaEntrega = new Set(
  ancla
    ? piezas
        .map((p) => posix(p.fichero))
        .filter((f) => existian.has(f))
        .filter((f) => /tags:\s*\[\s*'suspended'\s*\]/.test(git('show', `${ancla.tag}:${f}`) ?? ''))
    : []
)

const resultado = piezas
  .filter((p) => p.etiqueta !== 'suspended') // aparcada por decisión: no sale en ningún sitio
  .map((p) => {
    const ficheros = ficherosDe(p, piezas)
    // «Existía» se decide por la STORY, no por la carpeta: una carpeta puede
    // existir de antes y estrenar pieza (tariff-line vive dentro de tariff-card).
    // Y no basta con que el fichero estuviera: si iba `suspended`, no se publicó
    // y para quien recibe la entrega esa pieza no existía. Ver el bloque de
    // `suspendidasEnLaEntrega`.
    const existia = existian.has(posix(p.fichero)) && !suspendidasEnLaEntrega.has(posix(p.fichero))
    const cambiados = ficheros.filter((f) => tocados.has(f))

    const cambio = !ancla
      ? 'sin-referencia'
      : !existia
        ? 'nuevo'
        : cambiados.length
          ? 'modificado'
          : 'estable'

    return {
      titulo: p.titulo,
      id: sanitize(p.titulo),
      pieza: p.base,
      cambio,
      enCurso: p.etiqueta === 'WIP',
      ficherosTocados: cambiados.length,
      // Se guardan los nombres para que Release Notes pueda enseñar QUÉ cambió y
      // no solo que cambió. Un «modificado» sin detalle obliga a ir a git igual.
      detalle: cambiados.map((f) => f.replace(/^src\//, '')),
    }
  })
  .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'))

const salida = {
  generado: git('log', '-1', '--format=%cI') ?? null,
  commit: git('rev-parse', '--short', 'HEAD'),
  rama: git('rev-parse', '--abbrev-ref', 'HEAD'),
  entregaAnterior: ancla,
  // Lo que hace legible el documento sin recalcular nada en el .mdx.
  resumen: {
    nuevas: resultado.filter((p) => p.cambio === 'nuevo').length,
    modificadas: resultado.filter((p) => p.cambio === 'modificado').length,
    estables: resultado.filter((p) => p.cambio === 'estable').length,
    enCurso: resultado.filter((p) => p.enCurso).length,
    total: resultado.length,
  },
  piezas: resultado,
}

mkdirSync(dirname(SALIDA), { recursive: true })
writeFileSync(SALIDA, JSON.stringify(salida, null, 2) + '\n')

const r = salida.resumen
const ref = ancla
  ? `${ancla.tag} (${ancla.sha})`
  : 'SIN TAG DE ENTREGA — todo sale «sin-referencia»'
console.log(`entrega · estado.json        ${r.total} piezas · ref: ${ref}`)
console.log(
  `           ${r.nuevas} nueva(s) · ${r.modificadas} modificada(s) · ${r.estables} estable(s) · ${r.enCurso} en curso`
)

if (!ancla) {
  console.log('           ⚠ Crea el tag con:  git tag -a entrega/AAAA-MM-DD -m "…"')
}

// Contrasta los ids calculados contra los que Storybook escribió de verdad. Sin
// esto, un cambio en su `sanitize` dejaría la barra lateral sin iconos y nadie se
// enteraría: no hay error, simplemente no casa nada.
if (process.argv.includes('--verificar')) {
  const indice = ['storybook-static/index.json', 'storybook-static-check/index.json']
    .map((f) => join(RAIZ, f))
    .find(existsSync)

  if (!indice) {
    console.log('\n⚠ --verificar necesita una build: `npm run build-storybook` antes.')
    process.exit(0)
  }

  const entradas = Object.values(JSON.parse(readFileSync(indice, 'utf8')).entries)
  const idsReales = new Set(entradas.map((e) => sanitize(e.title)))
  const huerfanos = salida.piezas.filter((p) => !idsReales.has(p.id))

  console.log(`\nverificación · ${indice.replace(RAIZ, '')}`)
  if (huerfanos.length) {
    console.log(`✖ ${huerfanos.length} pieza(s) cuyo id no aparece en el índice:`)
    huerfanos.forEach((p) => console.log(`    ${p.titulo} → ${p.id}`))
    process.exit(1)
  }
  console.log(`✔ las ${salida.piezas.length} piezas casan con el índice`)
}

if (process.argv.includes('--print')) {
  console.log()
  for (const p of salida.piezas) {
    const marca = {
      nuevo: 'NUEVO     ',
      modificado: 'MODIFICADO',
      estable: '          ',
      'sin-referencia': '?         ',
    }[p.cambio]
    console.log(`  ${marca} ${p.enCurso ? 'en curso · ' : '           '}${p.titulo}`)
  }
}
