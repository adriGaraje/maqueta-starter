#!/usr/bin/env node
// =============================================================================
//  servidor del asistente — node:http, sin dependencias.
//
//  GET  /                          el asistente (index.html, app.js, estilos.css)
//  GET  /api/defecto               la carpeta por defecto para un slug (../<slug>)
//  GET  /api/yo                    { alias, email, nombre } de esta máquina (usuario y git config)
//  GET  /api/comprobar-destino     ?ruta= → { existe, vacia, absoluta }
//  POST /api/generar               JSON de respuestas → { id }; lanza scripts/generar.mjs
//  GET  /api/progreso/:id          { estado: en-curso|ok|error, lineas, resultado }
//  POST /api/probar/:servicio      figma|jira|github|firebase → { estado, mensaje, … }
//  POST /api/firebase/crear-sitio  { proyecto, sitio } → crea el sitio de Hosting
//
//  Las pruebas salen de aquí, nunca del navegador, y los tokens solo viven en
//  memoria durante la petición: no se escribe nada en disco hasta Finalizar.
//
//  Uso: npm run starter [-- --no-open] [--port 4747] [--diagnostico]
//  (`--puerto` sigue valiendo como sinónimo de `--port`.)
// =============================================================================
import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir, userInfo } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  crearSitio,
  probarFigma,
  probarFirebase,
  probarGithub,
  probarJira,
} from '../scripts/lib/conexiones.mjs'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = resolve(AQUI, '..')

// Lanzado con `npx github:…`, el starter vive en la caché de npm (~/.npm/_npx/<hash>/).
// Cuando el proyecto ya está generado y comprobado, esa copia sobra: se borra sola
// y el servidor se apaga. Con `npm run starter` desde un clon, no se toca nada.
const EN_CACHE_NPX = /[\\/]_npx[\\/]/.test(RAIZ)
const limpiaCacheNpx = (t) => {
  if (!EN_CACHE_NPX) return
  const carpeta = RAIZ.replace(/([\\/]_npx[\\/][^\\/]+).*$/, '$1')
  t.lineas.push(
    `✔ Herramienta borrada de la caché de npx (${carpeta}); el servidor se apaga en 10 s.`
  )
  setTimeout(() => {
    try {
      rmSync(carpeta, { recursive: true, force: true })
    } catch {}
    process.exit(0)
  }, 10000)
}
const argv = process.argv.slice(2)
const iP = argv.findIndex((a) => a === '--port' || a === '--puerto')
const PUERTO = Number(iP >= 0 ? argv[iP + 1] : process.env.PORT) || 4747
const SOLO_DIAGNOSTICO = argv.includes('--diagnostico')
const NO_ABRIR = argv.includes('--no-open')

// --- autodiagnóstico ---------------------------------------------------------
// Un arranque que no dice nada es indistinguible de uno que no ha arrancado:
// todo lo que importa para saber qué pasa sale en consola antes de escuchar.
const caja = (titulo, lineas) => {
  const ancho = Math.max(titulo.length + 2, ...lineas.map((l) => l.length)) + 2
  const borde = '─'.repeat(ancho)
  console.log(`┌${borde}┐`)
  console.log(`│ ${titulo.padEnd(ancho - 1)}│`)
  console.log(`├${borde}┤`)
  for (const l of lineas) console.log(`│ ${l.padEnd(ancho - 1)}│`)
  console.log(`└${borde}┘`)
}

const versionNpm = () => {
  // Lanzado con npx, npm deja su versión en el user agent; si no, se pregunta.
  const ua = process.env.npm_config_user_agent?.match(/npm\/([\d.]+)/)
  if (ua) return ua[1]
  const r = spawnSync('npm', ['--version'], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
  })
  return r.status === 0 ? r.stdout.trim() : null
}

// Quién escucha en el puerto, para decirlo en vez de soltar un EADDRINUSE.
const quienUsaPuerto = (puerto) => {
  if (process.platform === 'win32') return null
  const r = spawnSync('lsof', ['-nP', `-iTCP:${puerto}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
  const fila = r.stdout?.split('\n')[1]?.trim()
  if (!fila) return null
  const [comando, pid] = fila.split(/\s+/)
  return `${comando} (PID ${pid})`
}

const puertoLibre = (puerto) =>
  new Promise((ok) => {
    const s = createServer()
    s.once('error', () => ok(false))
    s.listen(puerto, '127.0.0.1', () => s.close(() => ok(true)))
  })

const URL_ASISTENTE = `http://localhost:${PUERTO}`

function diagnostico() {
  const node = process.versions.node
  const npm = versionNpm()
  const nodeOk = Number(node.split('.')[0]) >= 20
  const npmOk = npm && Number(npm.split('.')[0]) >= 9
  caja('maqueta-starter · autodiagnóstico', [
    `${nodeOk ? '✔' : '✖'} Node      ${node}${nodeOk ? '' : '  (hace falta ≥ 20)'}`,
    `${npmOk ? '✔' : '✖'} npm       ${npm || 'no encontrado'}${npm && !npmOk ? '  (hace falta ≥ 9)' : ''}`,
    `  Corre desde ${EN_CACHE_NPX ? 'la caché de npx' : 'un clon'}: ${RAIZ}`,
    `  Proyectos en ${process.cwd()}`,
    `  Puerto    ${PUERTO}`,
  ])
  return nodeOk
}

function avisaPuertoOcupado() {
  const quien = quienUsaPuerto(PUERTO)
  caja(`✖ El puerto ${PUERTO} está ocupado`, [
    quien ? `Lo usa: ${quien}` : 'Lo usa otro proceso.',
    quien ? 'Ciérralo, o arranca en otro puerto:' : 'Arranca en otro puerto:',
    `  npx --allow-git=all github:adriGaraje/maqueta-starter --port ${PUERTO + 1}`,
    `  npm run starter -- --port ${PUERTO + 1}   (desde un clon)`,
  ])
}

function abrirNavegador(dir) {
  const abrir =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'
  const falla = (motivo) =>
    caja('✖ No he podido abrir el navegador', [
      `${abrir}: ${motivo}`,
      `Ábrelo tú y entra en ${dir}`,
    ])
  try {
    const hijo = spawn(abrir, [dir], {
      stdio: 'ignore',
      detached: true,
      shell: process.platform === 'win32',
    })
    hijo.on('error', (e) => falla(e.code === 'ENOENT' ? 'no está instalado' : e.message))
    hijo.on('exit', (code) => {
      if (code) falla(`terminó con código ${code}`)
      else console.log(`✔ Navegador abierto en ${dir}`)
    })
    hijo.unref()
  } catch (e) {
    falla(e.message)
  }
}

const ESTATICOS = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/estilos.css': ['estilos.css', 'text/css; charset=utf-8'],
  // La tabla de perfiles de hand-off es la del repo generado: una sola fuente.
  '/perfiles.js': [
    '../template/src/stories/lib/hooks-perfiles.js',
    'text/javascript; charset=utf-8',
  ],
}

// Trabajos en memoria: el asistente es de un solo usuario y vive lo que el proceso.
const trabajos = new Map()

const json = (res, code, o) => {
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(o))
}

function cuerpo(req) {
  return new Promise((ok, mal) => {
    let d = ''
    req.on('data', (c) => {
      d += c
      if (d.length > 1e6) mal(new Error('Cuerpo demasiado grande'))
    })
    req.on('end', () => ok(d))
    req.on('error', mal)
  })
}

// Lo que esta máquina ya sabe de quien la usa: propuestas para el paso «Tú».
function yo() {
  const gitConfig = (k) =>
    spawnSync(process.env.GIT || 'git', ['config', '--get', k], {
      encoding: 'utf8',
    }).stdout?.trim() || ''
  let alias = ''
  try {
    alias = userInfo().username
  } catch {}
  return { alias, email: gitConfig('user.email'), nombre: gitConfig('user.name') }
}

function comprobarDestino(ruta) {
  const absoluta = isAbsolute(ruta)
  const abs = resolve(RAIZ, ruta)
  if (!existsSync(abs)) return { ruta: abs, absoluta, existe: false, vacia: true }
  if (!statSync(abs).isDirectory())
    return { ruta: abs, absoluta, existe: true, vacia: false, fichero: true }
  return { ruta: abs, absoluta, existe: true, vacia: readdirSync(abs).length === 0 }
}

function generar(respuestas) {
  const id = randomUUID().slice(0, 8)
  const dir = join(tmpdir(), 'maqueta-starter')
  mkdirSync(dir, { recursive: true })
  const fichero = join(dir, `respuestas-${id}.json`)
  writeFileSync(fichero, JSON.stringify(respuestas, null, 2))
  const t = { estado: 'en-curso', lineas: [], resultado: null }
  trabajos.set(id, t)
  const hijo = spawn(
    process.execPath,
    [join(RAIZ, 'scripts/generar.mjs'), '--respuestas', fichero],
    {
      cwd: RAIZ,
    }
  )
  let resto = ''
  const linea = (l) => {
    if (!l.trim()) return
    // La última línea del generador es su resultado en JSON.
    if (l.startsWith('{')) {
      try {
        t.resultado = JSON.parse(l)
        return
      } catch {}
    }
    t.lineas.push(l)
  }
  const lee = (d) => {
    resto += d
    const partes = resto.split('\n')
    resto = partes.pop()
    partes.forEach(linea)
  }
  hijo.stdout.on('data', lee)
  hijo.stderr.on('data', lee)
  hijo.on('close', (code) => {
    if (resto) linea(resto)
    t.estado = code === 0 && t.resultado?.ok ? 'ok' : 'error'
    if (t.estado === 'ok') limpiaCacheNpx(t)
  })
  return id
}

const PRUEBAS = {
  figma: (d) => probarFigma(d),
  jira: (d) => probarJira(d),
  github: (d) => probarGithub(d),
  firebase: (d) => probarFirebase(d, RAIZ),
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  try {
    if (req.method === 'GET' && ESTATICOS[url.pathname]) {
      const [f, tipo] = ESTATICOS[url.pathname]
      res.writeHead(200, { 'content-type': tipo, 'cache-control': 'no-store' })
      return res.end(readFileSync(join(AQUI, f)))
    }
    if (req.method === 'GET' && url.pathname === '/api/defecto')
      return json(res, 200, {
        raiz: RAIZ,
        // El proyecto se crea donde el usuario lanzó el starter, nunca dentro del starter.
        destino: resolve(process.cwd(), url.searchParams.get('slug') || ''),
      })
    if (req.method === 'GET' && url.pathname === '/api/yo') return json(res, 200, yo())
    if (req.method === 'GET' && url.pathname === '/api/comprobar-destino') {
      const ruta = url.searchParams.get('ruta')
      if (!ruta) return json(res, 400, { error: 'Falta ?ruta=' })
      return json(res, 200, comprobarDestino(ruta))
    }
    if (req.method === 'POST' && url.pathname === '/api/generar') {
      let r
      try {
        r = JSON.parse(await cuerpo(req))
      } catch {
        return json(res, 400, { error: 'El cuerpo no es JSON válido' })
      }
      return json(res, 202, { id: generar(r) })
    }
    const pr = url.pathname.match(/^\/api\/probar\/(\w+)$/)
    if (req.method === 'POST' && pr) {
      if (!PRUEBAS[pr[1]]) return json(res, 404, { error: `No hay prueba para «${pr[1]}»` })
      const datos = JSON.parse((await cuerpo(req)) || '{}')
      return json(res, 200, await PRUEBAS[pr[1]](datos))
    }
    if (req.method === 'POST' && url.pathname === '/api/firebase/crear-sitio')
      return json(res, 200, await crearSitio(JSON.parse((await cuerpo(req)) || '{}'), RAIZ))
    const m = url.pathname.match(/^\/api\/progreso\/([\w-]+)$/)
    if (req.method === 'GET' && m) {
      const t = trabajos.get(m[1])
      return t ? json(res, 200, t) : json(res, 404, { error: 'No hay ningún trabajo con ese id' })
    }
    json(res, 404, { error: 'No encontrado' })
  } catch (e) {
    json(res, 500, { error: e.message })
  }
})

const nodeOk = diagnostico()
const libre = await puertoLibre(PUERTO)
if (!libre) avisaPuertoOcupado()
else console.log(`✔ Puerto ${PUERTO} libre`)

if (SOLO_DIAGNOSTICO) process.exit(nodeOk && libre ? 0 : 1)
if (!libre) process.exit(1)

servidor.listen(PUERTO, '127.0.0.1', () => {
  caja('Asistente en marcha  (Ctrl+C para salir)', [
    '',
    `   ▶  ${URL_ASISTENTE}`,
    '',
    'Si el navegador no se abre, copia esa dirección en él.',
  ])
  if (!NO_ABRIR) abrirNavegador(URL_ASISTENTE)
})
servidor.on('error', (e) => {
  if (e.code === 'EADDRINUSE') avisaPuertoOcupado()
  else console.error(`✖ ${e.message}`)
  process.exit(1)
})
