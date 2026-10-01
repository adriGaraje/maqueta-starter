#!/usr/bin/env node
// Despliegue por rama: la rama decide el destino, no quien teclea.
//   develop → pre  (verificación interna)   ·   main → pro (entrega al cliente)
// Cualquier otra rama solo puede ir a pre, y con --pre explícito.
//
// El árbol tiene que estar limpio y la rama al día con origin: publicar algo que no
// está pusheado es exactamente cómo se genera la deriva entre el sitio y el repo.

import { execFileSync, execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))

// Rama → target de hosting, de `config.json → deploy.targets` (cada target dice su
// rama, su sitio y su url). Sin config, los valores de siempre: develop → pre, main → entrega.
function leeTargets() {
  try {
    const c = JSON.parse(readFileSync(join(RAIZ, 'docs/starterslug-harness/config.json'), 'utf8'))
    return c.deploy?.targets ?? {}
  } catch {
    return {}
  }
}
const T = leeTargets()
const url = (t, porDefecto) => (t?.url && !/TODO/.test(t.url) ? t.url : porDefecto)
const RAMA_PRE = T.pre?.rama ?? 'develop'
const RAMA_ENTREGA = T.entrega?.rama ?? 'main'
const DESTINOS = {
  [RAMA_PRE]: {
    target: T.pre?.hostingTarget ?? 'pre',
    url: url(T.pre, 'https://storybook-starterslug-pre.web.app'),
    label: 'PRE',
  },
  [RAMA_ENTREGA]: {
    target: T.entrega?.hostingTarget ?? 'entrega',
    url: url(T.entrega, 'https://storybook-starterslug.web.app'),
    label: 'PRO · ENTREGA',
  },
}

const PRE = DESTINOS[RAMA_PRE]

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

const abortar = (mensaje) => {
  console.error(`\n  ✖ ${mensaje}\n`)
  process.exit(1)
}

const forzarPre = process.argv.includes('--pre')
const rama = git('rev-parse', '--abbrev-ref', 'HEAD')

// ── Qué destino toca ─────────────────────────────────────────────────────────
let destino = DESTINOS[rama]

if (forzarPre) destino = PRE

if (!destino) {
  abortar(
    `Estás en "${rama}", y solo "${RAMA_PRE}" (→ pre) y "${RAMA_ENTREGA}" (→ pro) publican solas.\n` +
      `    Si quieres ver ESTA rama en pre para verificarla: npm run deploy:pre`
  )
}

if (rama === RAMA_ENTREGA && forzarPre) {
  abortar(`--pre desde ${RAMA_ENTREGA} no tiene sentido: es la entrega. Usa "npm run deploy".`)
}

// ── Que lo que se publica sea lo que hay en origin ───────────────────────────
if (git('status', '--porcelain')) {
  abortar(
    'El árbol tiene cambios sin commitear. Se publicaría tu carpeta, no la rama:\n' +
      '    commitea o guarda en stash antes de desplegar.'
  )
}

let upstream
try {
  upstream = git('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}')
} catch {
  abortar(`La rama "${rama}" no está en origin todavía. Pushéala antes de publicarla.`)
}

execFileSync('git', ['fetch', '--quiet', 'origin', rama], { stdio: 'inherit' })

const local = git('rev-parse', 'HEAD')
const remoto = git('rev-parse', upstream)

if (local !== remoto) {
  const [detras, delante] = git('rev-list', '--left-right', '--count', `${upstream}...HEAD`).split(
    /\s+/
  )
  abortar(
    `"${rama}" y ${upstream} no coinciden (${delante} commit(s) sin pushear, ${detras} sin traer).\n` +
      '    Haz push/pull hasta que coincidan: el sitio debe reflejar lo que ve el equipo.'
  )
}

// ── Revisión de lo construido, ANTES de subirlo ──────────────────────────────
//
// Lo que se publica lo ve el cliente, y los fallos que se cuelan aquí no son de
// compilación: la build sale en verde y lo publicado está mal. Todos los que han
// pasado tienen la misma forma —algo que DEJA DE ESTAR sin que nadie lo pida— y
// ninguno lo vio un gate: los vio alguien del equipo abriendo el sitio.
//
// Esta función mira el resultado, no el código. Si algo no cuadra, ABORTA antes
// de subir: una entrega mala no se retira de la vista de quien ya la abrió.
function revisaLaEntrega() {
  const fallos = []
  const leer = (r) => JSON.parse(readFileSync(join(RAIZ, r), 'utf8'))

  // 1 · LOS ICONOS. Si el tag de la entrega apunta al commit que se construye, el
  //     cálculo se compara consigo mismo y todo sale «estable»: la barra lateral
  //     se queda sin un solo icono y no se distingue lo nuevo de lo de siempre.
  //     Pasó el 27-08 republicando el mismo día.
  const estado = leer('public/entrega/estado.json')
  const piezas = estado?.piezas ?? []
  const conMarca = piezas.filter((p) => p.cambio === 'nuevo' || p.cambio === 'modificado').length
  if (piezas.length && conMarca === 0) {
    fallos.push(
      'Ni una pieza sale como nueva o modificada, así que la barra lateral irá SIN ICONOS.\n' +
        `      La referencia usada es ${estado.entregaAnterior?.tag ?? '(ninguna)'}. Si es el commit que ` +
        'estás publicando,\n      la entrega se está comparando consigo misma: mueve o borra ese tag.'
    )
  }

  // 2 · LAS PIEZAS. Una entrega con menos títulos que la anterior significa que
  //     algo dejó de publicarse, y eso siempre es a propósito o es un error — pero
  //     nunca debería pasar sin que quien publica lo sepa.
  const indice = leer('storybook-static/index.json')
  const titulos = new Set(Object.values(indice.entries ?? {}).map((e) => e.title))
  if (titulos.size === 0) fallos.push('La build no tiene ni una entrada.')

  console.log(`    revisión · ${titulos.size} títulos · ${conMarca} con icono de cambio`)

  if (fallos.length) {
    abortar(
      'lo construido no está para publicarse:\n\n    · ' +
        fallos.join('\n    · ') +
        '\n\n    No se ha subido nada.'
    )
  }
}

// ── Construir y publicar ─────────────────────────────────────────────────────
console.log(`\n  ▸ ${destino.label}  ·  rama ${rama}  ·  ${local.slice(0, 7)}`)
console.log(`    ${destino.url}\n`)

// EL DESTINO VIAJA A LA BUILD. Hasta hoy pre y pro se construian identicos y solo
// cambiaba a que sitio se subian; desde el 28-08 no, porque el rotulo «EN CURSO» se
// ve en pre y NO en pro.
// Es la UNICA diferencia entre las dos builds, y conviene que siga siendo la unica:
// si mañana hay dos, pre deja de verificar lo que se entrega.
execSync('npm run build-storybook', {
  stdio: 'inherit',
  env: { ...process.env, STARTERSLUG_DESTINO: destino.target },
})

revisaLaEntrega()

execSync(`npx firebase-tools deploy --only hosting:${destino.target}`, { stdio: 'inherit' })

console.log(`\n  ✔ ${destino.label} publicado desde ${rama}@${local.slice(0, 7)}`)
console.log(`    ${destino.url}\n`)

// ── Marcar la entrega ────────────────────────────────────────────────────────
//
// Solo desde `main`, que es lo único que llega al cliente. El tag es el ancla
// desde la que `scripts/estado-entrega.mjs` calcula qué es nuevo y qué se ha
// modificado en la entrega SIGUIENTE. Sin él no hay desde dónde restar, y la
// página «Release Notes» se queda muda.
//
// Se crea después de publicar y no antes: si el deploy falla, no queda marcada
// una entrega que nadie ha recibido.
//
// No se hace push solo — un tag empujado no se retira de la copia de nadie, y
// eso es del humano. Se deja creado y se dice el comando.
if (rama === RAMA_ENTREGA) {
  const hoy = new Date().toISOString().slice(0, 10)
  const tag = `entrega/${hoy}`
  const yaEsta = git('tag', '--list', tag)

  if (yaEsta) {
    console.log(`  · Ya existe el tag ${tag}; no se toca.`)
    console.log('    Si esta es otra entrega del mismo día, ponle sufijo a mano.\n')
  } else {
    execSync(`git tag -a ${tag} -m "Entrega ${hoy} — publicada en ${destino.url}"`, {
      stdio: 'inherit',
    })
    console.log(`  ✔ Entrega marcada como ${tag}`)
    console.log(`    Empújalo para que lo tenga el equipo:  git push origin ${tag}\n`)
  }
}
