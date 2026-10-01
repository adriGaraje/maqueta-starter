#!/usr/bin/env node
// =============================================================================
//  generar — la fábrica. Copia `template/` a un destino nuevo, sustituye los
//  marcadores, quita los grupos no elegidos y escribe la configuración con las
//  respuestas del asistente (o de un JSON a mano).
//
//  Uso: npm run generar -- --respuestas respuestas.json
//
//  Una línea por paso en stdout (✔ / ✖ / …) y, como ÚLTIMA línea, el resultado
//  en JSON: { ok, destino, saltados, pendientes, avisos }. El servidor del
//  asistente lee esa última línea; no imprimas nada detrás.
// =============================================================================
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PLANTILLA = join(RAIZ, 'template')
const HOY = new Date().toISOString().slice(0, 10)
const GRUPOS = ['figma', 'jira', 'entrega', 'django', 'auth']
const PASOS = ['proyecto', 'figma', 'atlassian', 'github', 'equipo', 'auth', 'grupos']

// Qué ficheros y scripts de package.json son de cada grupo. Lo que no está aquí es base.
const FICHEROS = {
  figma: [
    /^scripts\/figma-ready-scan\.mjs$/,
    /^scripts\/figma-tokens-diff\.mjs$/,
    /^scripts\/site-map-sync\.mjs$/,
  ],
  jira: [/^scripts\/jira-mirror\.mjs$/, /^tasks\//],
  entrega: [
    /^scripts\/(build-entrega|entrega-check|estado-entrega|deploy)\.mjs$/,
    /^firebase\.json$/,
    /^\.firebaserc$/,
    /^public\/entrega\//,
  ],
  django: [/^scripts\/hooks-check\.mjs$/],
  auth: [/^auth\//],
}
const SCRIPTS = {
  figma: ['tokens:diff', 'figma:ready', 'sitemap:sync'],
  jira: ['tasks:mirror'],
  entrega: [
    'build:entrega',
    'estado:entrega',
    'prestorybook',
    'prebuild-storybook',
    'deploy',
    'deploy:pre',
    'check:entrega',
  ],
  django: ['check:hooks'],
  auth: [],
}

// ── salida ───────────────────────────────────────────────────────────────────

const avisos = []
const ok = (m) => console.log(`✔ ${m}`)
const va = (m) => console.log(`… ${m}`)
const mal = (m) => console.log(`✖ ${m}`)
const aviso = (m) => {
  avisos.push(m)
  console.log(`! ${m}`)
}
function termina(resultado) {
  console.log(JSON.stringify(resultado))
  process.exit(resultado.ok ? 0 : 1)
}
function aborta(m, destino = null) {
  mal(m)
  termina({ ok: false, destino, error: m, saltados: [], pendientes: [], avisos })
}

// ── respuestas ───────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)
const iR = argv.indexOf('--respuestas')
if (iR < 0 || !argv[iR + 1]) aborta('Uso: npm run generar -- --respuestas <respuestas.json>')
let R
try {
  R = JSON.parse(readFileSync(resolve(argv[iR + 1]), 'utf8'))
} catch (e) {
  aborta(`No se puede leer ${argv[iR + 1]}: ${e.message}`)
}

const saltados = (R.saltados ?? []).filter((p) => PASOS.includes(p))
const de = (paso) => (saltados.includes(paso) ? {} : (R[paso] ?? {}))
// Texto respondido o null: lo vacío cuenta como no respondido.
const v = (x) => (typeof x === 'string' ? x.trim() || null : (x ?? null))

const P = de('proyecto')
const nombre = v(P.nombre)
const slug = v(P.slug)
if (!nombre) aborta('Falta el nombre del proyecto: es lo único que no se puede saltar.')
if (!slug || !/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(slug))
  aborta(`Slug no válido («${slug ?? ''}»): kebab-case, empieza por letra (p. ej. «acme-web»).`)

const destino = resolve(RAIZ, v(P.destino) ?? `../${slug}`)
if (v(P.destino) && !isAbsolute(P.destino.trim()))
  aviso(`El destino no era absoluto; se resuelve respecto al starter: ${destino}`)
if (destino === RAIZ || destino.startsWith(RAIZ + '/template'))
  aborta('El destino no puede ser el starter ni su plantilla.', destino)
if (existsSync(destino) && readdirSync(destino).length)
  aborta(`El destino ya existe y no está vacío: ${destino}. Elige otra carpeta o vacíala.`, destino)

const F = de('figma')
const A = de('atlassian')
const G = de('github')
const AU = de('auth')
const equipo = saltados.includes('equipo')
  ? []
  : (R.equipo ?? []).filter((p) => v(p.nombre) || v(p.email))

// fileKey: vale una URL de Figma entera.
const fileKey = (() => {
  const x = v(F.fileKey)
  if (!x) return null
  const m = x.match(/figma\.com\/(?:design|file|proto)\/([A-Za-z0-9]+)/)
  return m ? m[1] : x
})()
const projectKey = v(A.projectKey)?.toUpperCase() ?? null
const firebase = AU.firebase ?? {}
const proyectoHosting = v(AU.proyectoHosting) ?? v(firebase.projectId)
const sitioEntrega = v(AU.sitioEntrega) ?? `storybook-${slug}`
const sitioPre = v(AU.sitioPre) ?? `storybook-${slug}-pre`

// Grupos: lo pedido, con coherencia. Sin Firebase no hay puerta ni entrega.
let grupos = saltados.includes('grupos')
  ? [...GRUPOS]
  : (R.grupos ?? GRUPOS).filter((g) => GRUPOS.includes(g))
if (!proyectoHosting && grupos.includes('entrega'))
  aviso('Grupo «entrega» sin proyecto de Firebase: viaja, pero `.firebaserc` queda en TODO.')
if (grupos.includes('auth') && (saltados.includes('auth') || AU.activar === false)) {
  grupos = grupos.filter((g) => g !== 'auth')
  aviso('Puerta de acceso desactivada o saltada: se quita el grupo «auth».')
}
if (grupos.includes('auth') && !v(firebase.apiKey))
  aviso('Grupo «auth» sin claves web de Firebase: `auth/firebase-config.js` queda en TODO.')
const fuera = GRUPOS.filter((g) => !grupos.includes(g))
const comprobar = R.comprobar !== false

// ── marcadores ───────────────────────────────────────────────────────────────

const MAYUS = slug.toUpperCase().replace(/-/g, '_')
const PASCAL = slug.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase())
// `STARTERSLUG_` es prefijo de entorno; `STARTERSLUG` suelto es la clave de Jira.
const sustituir = (t) =>
  t
    .replace(/STARTERSLUG_/g, `${MAYUS}_`)
    .replace(/STARTERSLUG/g, projectKey ?? MAYUS)
    .replace(/Starterslug/g, PASCAL)
    // Pegado a un identificador (`__starterslugX`) el guion rompería el JS: va con `_`.
    .replace(/(?<=[A-Za-z0-9_$])starterslug|starterslug(?=[A-Za-z0-9_$])/g, slug.replace(/-/g, '_'))
    .replace(/starterslug/g, slug)
    .replace(/STARTERNOMBRE/g, nombre)
    .replace(/Starternombre/g, nombre)
const esTexto = (buf) => !buf.subarray(0, 8000).includes(0)
const deGrupoFuera = (rel) => fuera.some((g) => FICHEROS[g].some((re) => re.test(rel)))

// ── 1 · copia ────────────────────────────────────────────────────────────────

const listar = (dir) =>
  readdirSync(dir).flatMap((e) => {
    const r = join(dir, e)
    return statSync(r).isDirectory() ? listar(r) : [r]
  })

let copiados = 0
try {
  mkdirSync(destino, { recursive: true })
  for (const abs of listar(PLANTILLA)) {
    const rel = relative(PLANTILLA, abs)
    if (deGrupoFuera(rel)) continue
    const buf = readFileSync(abs)
    const destRel = sustituir(rel)
    mkdirSync(dirname(join(destino, destRel)), { recursive: true })
    writeFileSync(join(destino, destRel), esTexto(buf) ? sustituir(buf.toString('utf8')) : buf)
    copiados++
  }
  // Lo que pone el starter encima de la plantilla: la prueba de conexiones.
  for (const [origen, dest] of [
    ['extras/scripts/conexiones-check.mjs', 'scripts/conexiones-check.mjs'],
    ['scripts/lib/conexiones.mjs', 'scripts/lib/conexiones.mjs'],
  ]) {
    mkdirSync(dirname(join(destino, dest)), { recursive: true })
    writeFileSync(join(destino, dest), readFileSync(join(RAIZ, origen)))
    copiados++
  }
  ok(
    `Plantilla copiada: ${copiados} ficheros · grupos: base${grupos.map((g) => `, ${g}`).join('')}`
  )
} catch (e) {
  aborta(`Copia de la plantilla: ${e.message}`, destino)
}

// ── 2 · configuración ────────────────────────────────────────────────────────

const ruta = (rel) => join(destino, rel)
const leeJson = (rel) => JSON.parse(readFileSync(ruta(rel), 'utf8'))
const escribe = (rel, t) => {
  mkdirSync(dirname(ruta(rel)), { recursive: true })
  writeFileSync(ruta(rel), t)
}
const escribeJson = (rel, o) => escribe(rel, JSON.stringify(o, null, 2) + '\n')
const enJs = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
// Cambia `clave: '…'` en un módulo de config sin tocar el resto (comentarios incluidos).
const ponJs = (t, clave, valor) =>
  valor == null ? t : t.replace(new RegExp(`(\\b${clave}: )'[^']*'`), `$1'${enJs(valor)}'`)

function paso(nombrePaso, fn) {
  try {
    fn()
    ok(nombrePaso)
  } catch (e) {
    aborta(`${nombrePaso}: ${e.message}`, destino)
  }
}

paso('package.json con los scripts de los grupos elegidos', () => {
  const o = leeJson('package.json')
  for (const g of fuera) for (const k of SCRIPTS[g]) delete o.scripts[k]
  o.scripts['check:conexiones'] = 'node scripts/conexiones-check.mjs'
  if (v(P.descripcion)) o.description = `${nombre} — ${v(P.descripcion)}`
  escribeJson('package.json', o)
})

paso(`docs/${slug}-harness/config.json`, () => {
  const rel = `docs/${slug}-harness/config.json`
  const c = leeJson(rel)
  const pon = (obj, k, x) => {
    if (x != null) obj[k] = x
  }
  pon(
    c.atlassian,
    'site',
    v(A.site)
      ?.replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
  )
  pon(c.atlassian, 'cloudId', v(A.cloudId))
  pon(c.atlassian.jira, 'projectKey', projectKey)
  pon(c.atlassian.jira, 'projectName', v(A.projectName))
  if (v(A.boardId)) c.atlassian.jira.boardId = Number(A.boardId) || A.boardId
  pon(c.atlassian.confluence, 'spaceKey', v(A.confluenceSpaceKey))
  pon(c.atlassian.confluence, 'spaceName', v(A.confluenceSpaceName))
  if (fileKey) {
    const id = `${slug}-handoff`
    const nombreArchivo = v(F.nombreArchivo) ?? 'Handoff'
    c.figma.files = {
      [id]: {
        fileKey,
        name: nombreArchivo,
        url: `https://www.figma.com/design/${fileKey}/${encodeURIComponent(nombreArchivo)}`,
        scanned: true,
        nodos: {},
      },
    }
    c.figma.primaryFile = id
  }
  pon(c.figma, 'org', v(F.org))
  pon(c.repo, 'remote', v(G.remote))
  pon(c.repo, 'handoff', v(P.cms))
  pon(c.project, 'liveSiteHost', v(P.webEnVivo))
  if (v(P.descripcion)) c.project.description = v(P.descripcion)

  const integracion = v(G.integracion) ?? c.git.integrationBranch
  const release = v(G.release) ?? c.git.releaseBranch
  c.git.integrationBranch = integracion
  c.git.releaseBranch = release
  pon(c.git, 'branchPattern', v(G.patronRama))
  if (projectKey)
    for (const k of ['branchPattern', 'commitPattern', 'prTitlePattern'])
      c.git[k] = c.git[k].replace(/<KEY>/g, projectKey)

  if (proyectoHosting) {
    const url = (s) => `https://${s}.web.app`
    c.deploy.firebaseProject = proyectoHosting
    c.deploy.site = sitioEntrega
    c.deploy.url = url(sitioEntrega)
    Object.assign(c.deploy.targets.entrega, {
      site: sitioEntrega,
      url: url(sitioEntrega),
      rama: release,
    })
    Object.assign(c.deploy.targets.pre, { site: sitioPre, url: url(sitioPre), rama: integracion })
  }
  // Un proyecto nuevo no tiene sitio retirado.
  c.deploy.sitioRetirado = null

  c.team = equipo.map((p, i) => ({
    alias: v(p.alias) ?? v(p.nombre).toLowerCase().split(/\s+/)[0],
    displayName: v(p.nombre) ?? v(p.alias),
    email: v(p.email),
    jiraAccountId: v(p.jiraAccountId),
    githubUser: v(p.github),
    activo: true,
    isDefaultUser: i === 0,
  }))

  const vp = F.viewports ?? {}
  if (Number(vp.mobile)) c.viewports.mobile = Number(vp.mobile)
  if (Number(vp.desktop)) c.viewports.desktop = Number(vp.desktop)

  // Los id de estado y transición son de cada Jira: los de la plantilla no valen
  // aquí. Se descubren en el onboarding (discover / transiciones de una issue).
  for (const s of c.stateMachine.states) {
    s.jiraStatusId = null
    s.transitionId = null
  }
  c.updated = HOY
  escribeJson(rel, c)
})

paso('.env (tokens: nunca en config.json)', () => {
  const env = {
    FIGMA_TOKEN: v(F.token) ?? '',
    FIGMA_FILE_KEY: fileKey ?? '',
    ATLASSIAN_EMAIL: v(A.email) ?? '',
    ATLASSIAN_API_TOKEN: v(A.token) ?? '',
    // jira-mirror lee estos dos: mismos valores.
    JIRA_EMAIL: v(A.email) ?? '',
    JIRA_API_TOKEN: v(A.token) ?? '',
  }
  let ejemplo = readFileSync(ruta('.env.example'), 'utf8')
  ejemplo += `
# Atlassian (npm run check:conexiones; jira-mirror usa JIRA_* con los mismos valores).
# id.atlassian.com → Security → Create API token. El MCP de Claude Code se autoriza aparte (/mcp).
ATLASSIAN_EMAIL=""
ATLASSIAN_API_TOKEN=""
`
  if (G.mcp) {
    ejemplo += `
# GitHub (MCP de .mcp.json). Claude Code NO lee este fichero: el token tiene que
# estar exportado en el shell que lanza \`claude\` (export GITHUB_TOKEN=…).
GITHUB_TOKEN=""
`
    env.GITHUB_TOKEN = v(G.token) ?? ''
  }
  escribe('.env.example', ejemplo)
  let t = ejemplo
  for (const [k, x] of Object.entries(env))
    t = t.replace(new RegExp(`^${k}=.*$`, 'm'), `${k}="${x.replace(/"/g, '\\"')}"`)
  escribe('.env', t)
})

paso('.claude/settings.json (plugins según grupos)', () => {
  const s = leeJson('.claude/settings.json')
  const plugins = {}
  if (grupos.includes('jira')) plugins['atlassian@claude-plugins-official'] = true
  if (grupos.includes('figma')) plugins['figma@claude-plugins-official'] = true
  if (Object.keys(plugins).length) s.enabledPlugins = plugins
  else delete s.enabledPlugins
  escribeJson('.claude/settings.json', s)
})

if (G.mcp)
  paso('.mcp.json (servidor MCP de GitHub)', () =>
    escribeJson('.mcp.json', {
      mcpServers: {
        github: {
          type: 'http',
          url: 'https://api.githubcopilot.com/mcp/',
          headers: { Authorization: 'Bearer ${GITHUB_TOKEN}' },
        },
      },
    })
  )

if (grupos.includes('auth'))
  paso('auth/ (puerta de acceso)', () => {
    const L = AU.login ?? {}
    let t = readFileSync(ruta('auth/auth-config.js'), 'utf8')
    t = ponJs(t, 'brand', v(L.brand) ?? nombre)
    for (const k of ['subtitle', 'poweredBy', 'accent', 'ink', 'surface'])
      t = ponJs(t, k, typeof L[k] === 'string' ? L[k].trim() : null)
    escribe('auth/auth-config.js', t)
    let f = readFileSync(ruta('auth/firebase-config.js'), 'utf8')
    const pid = v(firebase.projectId)
    const fb = {
      apiKey: v(firebase.apiKey),
      authDomain: v(firebase.authDomain) ?? (pid && `${pid}.firebaseapp.com`),
      projectId: pid,
      storageBucket: v(firebase.storageBucket) ?? (pid && `${pid}.firebasestorage.app`),
      messagingSenderId: v(firebase.messagingSenderId),
      appId: v(firebase.appId),
    }
    for (const [k, x] of Object.entries(fb)) f = ponJs(f, k, x)
    escribe('auth/firebase-config.js', f)
  })

if (grupos.includes('entrega') && proyectoHosting)
  paso('.firebaserc (proyecto y sitios entrega / pre)', () =>
    escribeJson('.firebaserc', {
      projects: { default: proyectoHosting },
      targets: { [proyectoHosting]: { hosting: { entrega: [sitioEntrega], pre: [sitioPre] } } },
    })
  )

if (grupos.includes('jira') && fileKey)
  paso('scripts/jira-mirror.mjs apunta al Figma de handoff', () => {
    const t = readFileSync(ruta('scripts/jira-mirror.mjs'), 'utf8')
    const url = `https://www.figma.com/design/${fileKey}/${encodeURIComponent(v(F.nombreArchivo) ?? 'Handoff')}`
    escribe(
      'scripts/jira-mirror.mjs',
      t.replace(/const FIGMA = 'TODO'.*$/m, `const FIGMA = '${url}'`)
    )
  })

paso('README.md', () => {
  let t = readFileSync(ruta('README.md'), 'utf8')
  t = t.replace(
    /Generada con `npm run harness:export[^`]*`\nel \d{4}-\d\d-\d\d\./,
    `Generada con maqueta-starter el ${HOY}.`
  )
  if (v(P.descripcion)) t = t.replace(/^(# .*\n)/, `$1\n> ${v(P.descripcion)}\n`)
  t = t.replace(
    /(si tocas una story suspendida; `check:plays` para los `play` en rojo\.)/,
    '$1\n`npm run check:conexiones` prueba Figma, Jira, GitHub y Firebase con `config.json` y `.env`.'
  )
  for (const g of fuera) t = t.replace(new RegExp(`^- \`${g}\` — .*\\n`, 'm'), '')
  if (!grupos.length) t = t.replace(/\n## Grupos\n[\s\S]*$/, '\n')
  escribe('README.md', t)
})

// ── 3 · formato ──────────────────────────────────────────────────────────────

// El slug cambia el largo de las líneas, y Prettier las reparte de otra forma:
// sin esto, el `format:check` del repo nuevo sale rojo de fábrica. Se usa el
// Prettier del starter con la config del destino.
const PRETTIER = join(RAIZ, 'node_modules/prettier/bin/prettier.cjs')
if (existsSync(PRETTIER)) {
  const glob = leeJson('package.json').scripts.format?.match(/"([^"]+)"/)?.[1]
  const r = glob
    ? spawnSync(process.execPath, [PRETTIER, '--write', '--log-level', 'warn', glob], {
        cwd: destino,
        encoding: 'utf8',
      })
    : { status: 0 }
  if (r.status === 0) ok('Formato con Prettier (lo que mira format:check)')
  else aviso(`Prettier no pudo formatear: ${(r.stderr || '').trim().split('\n')[0]}`)
} else
  aviso('Sin node_modules en el starter: el repo nuevo no se formatea (haz `npm run format` allí).')

// ── 4 · git ──────────────────────────────────────────────────────────────────

const GIT = process.env.GIT || 'git'
// Autoría de los commits si esta máquina no tiene user.email: la primera persona del equipo.
const quien = []
function git(...args) {
  const r = spawnSync(GIT, args, { cwd: destino, encoding: 'utf8' })
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || `git ${args[0]}`).trim())
  return r.stdout.trim()
}
paso('git init + primer commit «Arranque desde maqueta-starter»', () => {
  git('init', '-q', '-b', v(G.release) ?? 'main')
  const yo = spawnSync(GIT, ['config', 'user.email'], { cwd: destino, encoding: 'utf8' })
  if (yo.status !== 0 || !yo.stdout.trim()) {
    const p = equipo[0]
    quien.push('-c', `user.name=${v(p?.nombre) ?? 'maqueta-starter'}`)
    quien.push('-c', `user.email=${v(p?.email) ?? 'maqueta-starter@localhost'}`)
  }
  git('add', '-A')
  git(...quien, 'commit', '-q', '--no-verify', '-m', 'Arranque desde maqueta-starter')
  if (v(G.remote)) git('remote', 'add', 'origin', v(G.remote))
})

// ── 5 · comprobación ─────────────────────────────────────────────────────────

function npm(args, etiqueta) {
  va(`${etiqueta}…`)
  return new Promise((fin) => {
    const hijo = spawn('npm', args, { cwd: destino, shell: process.platform === 'win32' })
    let cola = ''
    const guarda = (d) => (cola = (cola + d).slice(-4000))
    hijo.stdout.on('data', guarda)
    hijo.stderr.on('data', guarda)
    hijo.on('close', (code) => {
      if (code === 0) ok(etiqueta)
      else {
        mal(`${etiqueta} (código ${code})`)
        cola
          .trim()
          .split('\n')
          .slice(-8)
          .forEach((l) => console.log(`    ${l}`))
      }
      fin(code === 0)
    })
  })
}

let comprobado = true
if (comprobar) {
  comprobado =
    (await npm(['install', '--no-audit', '--no-fund'], 'npm install')) &&
    (() => {
      // El lockfile entra en el commit de arranque: el primer clon instala lo mismo.
      try {
        git('add', 'package-lock.json')
        git(...quien, 'commit', '-q', '--amend', '--no-edit', '--no-verify')
        ok('package-lock.json al commit de arranque')
      } catch (e) {
        aviso(`package-lock.json no entró en el commit: ${e.message.split('\n')[0]}`)
      }
      return true
    })() &&
    (await npm(['run', 'build-storybook'], 'npm run build-storybook')) &&
    (await npm(['run', 'check:stories'], 'npm run check:stories'))
  if (comprobado && grupos.includes('auth')) {
    const puerta = ['storybook-static/guard.js', 'storybook-static/login/index.html']
    const faltan = puerta.filter((f) => !existsSync(ruta(f)))
    if (faltan.length) {
      mal(`La puerta no viaja en la build: falta ${faltan.join(', ')}`)
      comprobado = false
    } else ok('La puerta viaja en la build (guard.js + login/)')
  }
}

// ── 6 · lo que queda a mano ──────────────────────────────────────────────────

// Solo los huecos de configuración: un `TODO` en prosa o en un nombre de
// variable no es algo que el asistente debiera haber rellenado.
function pendientes() {
  const lista = []
  const recorre = (o, camino) => {
    if (o === 'TODO' || (typeof o === 'string' && /^TODO\b|\bTODO$/.test(o))) lista.push(camino)
    else if (o && typeof o === 'object')
      for (const [k, x] of Object.entries(o)) recorre(x, camino ? `${camino}.${k}` : k)
  }
  recorre(leeJson(`docs/${slug}-harness/config.json`), '')
  const enFichero = (rel, re) => {
    if (!existsSync(ruta(rel))) return
    readFileSync(ruta(rel), 'utf8')
      .split('\n')
      .forEach((l, i) => re.test(l) && lista.push(`${rel}:${i + 1} ${l.trim()}`))
  }
  enFichero('auth/firebase-config.js', /'TODO/)
  enFichero('.firebaserc', /TODO-/)
  enFichero('scripts/jira-mirror.mjs', /^const \w+ = (\{ key: )?'TODO'/)
  const env = readFileSync(ruta('.env'), 'utf8').match(/^\w+=""$/gm) ?? []
  for (const l of env) lista.push(`.env ${l.split('=')[0]} vacío`)
  return lista
}

// `tokens.*` y `pageStandard.*` no son preguntas del asistente: se rellenan al
// maquetar la primera pieza y la primera página. Se cuentan aparte.
// Lo de un grupo que no viaja no es un pendiente: no hay nada que lo use.
const DE_GRUPO = [
  [/^deploy\./, 'entrega'],
  [/^atlassian\.|^\.env (JIRA|ATLASSIAN)_/, 'jira'],
  [/^figma\.|^\.env FIGMA_/, 'figma'],
]
const todos = pendientes().filter(
  (k) => !DE_GRUPO.some(([re, g]) => re.test(k) && fuera.includes(g))
)
const alTrabajar = todos.filter((k) => /^(tokens|pageStandard)\./.test(k))
const resultado = {
  ok: comprobado,
  destino,
  grupos: ['base', ...grupos],
  saltados,
  pendientes: todos.filter((k) => !alTrabajar.includes(k)),
  alTrabajar: alTrabajar.length,
  avisos,
}
if (comprobado) ok(`Repo listo en ${destino}`)
termina(resultado)
