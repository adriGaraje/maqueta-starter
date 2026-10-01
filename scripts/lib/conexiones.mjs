// =============================================================================
//  conexiones — pruebas de credenciales contra Figma, Jira, GitHub y Firebase.
//
//  Lo usan el servidor del asistente (botones «Probar conexión») y, copiado tal
//  cual, el `npm run check:conexiones` del repo generado. Sin dependencias: el
//  `fetch` de Node 20 y `npx firebase-tools` para Firebase.
//
//  Ninguna función lanza: todas devuelven
//    { servicio, estado: 'ok' | 'error' | 'omitido', mensaje, ...extra }
//  y el mensaje dice el motivo en una línea, nunca una traza.
// =============================================================================
import { spawn } from 'node:child_process'

const ok = (servicio, mensaje, extra = {}) => ({ servicio, estado: 'ok', mensaje, ...extra })
const mal = (servicio, mensaje, extra = {}) => ({ servicio, estado: 'error', mensaje, ...extra })
const omite = (servicio, mensaje) => ({ servicio, estado: 'omitido', mensaje })
const hay = (x) => typeof x === 'string' && x.trim() !== '' && !/^TODO\b/.test(x.trim())

async function pide(url, headers = {}) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })
    let cuerpo = null
    try {
      cuerpo = await r.json()
    } catch {}
    return { status: r.status, cuerpo }
  } catch (e) {
    const causa = e.cause?.code ?? e.name ?? e.message
    const host = new URL(url).host
    return {
      status: 0,
      red:
        causa === 'TimeoutError'
          ? `${host} no responde en 15 s`
          : causa === 'ENOTFOUND'
            ? `no se encuentra ${host} (¿el site está bien escrito? ¿hay red?)`
            : `sin conexión con ${host} (${causa})`,
    }
  }
}

// ── Figma ────────────────────────────────────────────────────────────────────

export const extraeFileKey = (x) =>
  hay(x) ? (x.match(/figma\.com\/(?:design|file|proto)\/([A-Za-z0-9]+)/)?.[1] ?? x.trim()) : null

export async function probarFigma({ fileKey, token } = {}) {
  const S = 'Figma'
  const key = extraeFileKey(fileKey)
  if (!key) return omite(S, 'sin fileKey del archivo de handoff')
  if (!hay(token)) return omite(S, 'sin FIGMA_TOKEN')
  const r = await pide(`https://api.figma.com/v1/files/${key}?depth=1`, { 'X-Figma-Token': token })
  if (r.red) return mal(S, r.red)
  if (r.status === 200) {
    const paginas = r.cuerpo?.document?.children?.length ?? 0
    return ok(S, `«${r.cuerpo?.name}» · ${paginas} página${paginas === 1 ? '' : 's'}`, {
      nombre: r.cuerpo?.name,
      paginas,
    })
  }
  if (r.status === 403) return mal(S, 'el token no es válido o no tiene acceso a ese archivo (403)')
  if (r.status === 404) return mal(S, `no existe el archivo ${key}, o el token no lo ve (404)`)
  if (r.status === 429)
    return mal(S, 'Figma limita las peticiones ahora mismo (429): prueba en un minuto')
  return mal(
    S,
    `respuesta inesperada de Figma (${r.status}${r.cuerpo?.err ? `: ${r.cuerpo.err}` : ''})`
  )
}

// ── Jira ─────────────────────────────────────────────────────────────────────

export async function probarJira({ site, email, token, projectKey } = {}) {
  const S = 'Jira'
  if (!hay(site)) return omite(S, 'sin site de Atlassian')
  if (!hay(email) || !hay(token))
    return omite(
      S,
      'sin email + API token de Atlassian: el MCP de Claude Code se autoriza aparte con /mcp'
    )
  const host = site
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
  const auth = {
    Authorization: `Basic ${Buffer.from(`${email.trim()}:${token.trim()}`).toString('base64')}`,
    Accept: 'application/json',
  }
  const yo = await pide(`https://${host}/rest/api/3/myself`, auth)
  if (yo.red) return mal(S, yo.red)
  if (yo.status === 401) return mal(S, 'el email o el API token de Atlassian no son válidos (401)')
  if (yo.status === 403) return mal(S, 'el token no tiene permiso en este site (403)')
  if (yo.status !== 200) return mal(S, `respuesta inesperada de ${host} (${yo.status})`)
  const quien = yo.cuerpo?.displayName ?? email
  const cuenta = { accountId: yo.cuerpo?.accountId, displayName: yo.cuerpo?.displayName }
  if (!hay(projectKey))
    return ok(S, `conectado como ${quien} · sin clave de proyecto que comprobar`, cuenta)
  const p = await pide(
    `https://${host}/rest/api/3/project/${encodeURIComponent(projectKey.trim())}`,
    auth
  )
  if (p.red) return mal(S, p.red)
  if (p.status === 200)
    return ok(S, `${quien} · proyecto ${p.cuerpo?.key} «${p.cuerpo?.name}»`, {
      ...cuenta,
      proyecto: p.cuerpo?.name,
    })
  if (p.status === 404)
    return mal(
      S,
      `conectado como ${quien}, pero no existe el proyecto ${projectKey} o no lo ves (404)`
    )
  return mal(S, `conectado como ${quien}; el proyecto respondió ${p.status}`)
}

// ── GitHub ───────────────────────────────────────────────────────────────────

export function repoDeRemote(remote) {
  if (!hay(remote)) return null
  const m = remote.trim().match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/)
  return m ? { owner: m[1], repo: m[2] } : null
}

const cabGithub = (token) => ({
  Accept: 'application/vnd.github+json',
  'User-Agent': 'maqueta-starter',
  ...(hay(token) ? { Authorization: `Bearer ${token.trim()}` } : {}),
})

// Modo «crear»: valida el token, lista dónde se puede crear (el usuario y sus
// organizaciones) y avisa si el nombre ya está cogido en ese sitio.
export async function probarGithubCrear({ token, owner, nombre } = {}) {
  const S = 'GitHub'
  if (!hay(token)) return omite(S, 'sin token de GitHub: hace falta para crear el repo')
  const cab = cabGithub(token)
  const yo = await pide('https://api.github.com/user', cab)
  if (yo.red) return mal(S, yo.red)
  if (yo.status === 401)
    return mal(S, 'el token de GitHub no es válido o ha caducado (401 Bad credentials)')
  if (yo.status !== 200) return mal(S, `respuesta inesperada de GitHub (${yo.status})`)
  const login = yo.cuerpo?.login
  const usuario = login
  const orgs = await pide('https://api.github.com/user/orgs?per_page=100', cab)
  const cuentas = [
    { login, tipo: 'usuario' },
    ...(orgs.status === 200 && Array.isArray(orgs.cuerpo)
      ? orgs.cuerpo.map((o) => ({ login: o.login, tipo: 'organización' }))
      : []),
  ]
  const n = cuentas.length - 1
  const base = `conectado como ${login} · ${n} organizaci${n === 1 ? 'ón' : 'ones'}${orgs.status === 200 ? '' : ' (el token no puede listarlas: falta read:org)'}`
  const donde = hay(owner) ? owner.trim() : login
  if (!hay(nombre)) return ok(S, `${base} · sin nombre de repo que comprobar`, { cuentas, usuario })
  const r = await pide(`https://api.github.com/repos/${donde}/${nombre.trim()}`, cab)
  if (r.status === 200)
    return mal(
      S,
      `${base}, pero ya existe ${donde}/${nombre.trim()}: cambia el nombre o elige «Ya existe»`,
      { cuentas, usuario }
    )
  if (r.status === 404)
    return ok(S, `${base} · ${donde}/${nombre.trim()} está libre`, { cuentas, usuario })
  return ok(S, `${base} · no se pudo comprobar ${donde}/${nombre.trim()} (${r.status})`, {
    cuentas,
    usuario,
  })
}

export async function probarGithub({ modo, remote, token, owner, nombre } = {}) {
  const S = 'GitHub'
  if (modo === 'crear') return probarGithubCrear({ token, owner, nombre })
  if (!hay(remote)) return omite(S, 'sin URL del remote')
  const rr = repoDeRemote(remote)
  if (!rr)
    return mal(S, `«${remote}» no parece un remote de github.com (git@github.com:org/repo.git)`)
  const cab = cabGithub(token)
  const r = await pide(`https://api.github.com/repos/${rr.owner}/${rr.repo}`, cab)
  if (r.red) return mal(S, r.red)
  if (r.status === 200) {
    const p = r.cuerpo?.permissions
    const permisos = p
      ? p.admin
        ? 'admin'
        : p.push
          ? 'escritura'
          : p.pull
            ? 'solo lectura'
            : 'sin permisos'
      : 'sin token: permisos desconocidos'
    const yo = hay(token) ? await pide('https://api.github.com/user', cab) : null
    return ok(
      S,
      `${rr.owner}/${rr.repo} · rama por defecto ${r.cuerpo?.default_branch} · ${permisos}`,
      {
        ramaPorDefecto: r.cuerpo?.default_branch,
        permisos,
        usuario: yo?.status === 200 ? yo.cuerpo?.login : undefined,
      }
    )
  }
  if (r.status === 401)
    return mal(S, 'el token de GitHub no es válido o ha caducado (401 Bad credentials)')
  if (r.status === 404)
    return mal(
      S,
      `no existe ${rr.owner}/${rr.repo} o ${hay(token) ? 'el token no tiene acceso' : 'es privado y falta el token'} (404)`
    )
  if (r.status === 403)
    return mal(
      S,
      `GitHub rechaza la petición (403${r.cuerpo?.message ? `: ${r.cuerpo.message}` : ''})`
    )
  return mal(S, `respuesta inesperada de GitHub (${r.status})`)
}

// ── Firebase (por npx firebase-tools) ────────────────────────────────────────

function firebaseTools(args, cwd) {
  return new Promise((fin) => {
    let out = ''
    let err = ''
    let hijo
    try {
      hijo = spawn('npx', ['--yes', 'firebase-tools', ...args], {
        cwd,
        shell: process.platform === 'win32',
        env: { ...process.env, CI: '1' },
      })
    } catch (e) {
      return fin({ code: -1, error: e.message })
    }
    const reloj = setTimeout(() => hijo.kill(), 180000)
    hijo.stdout.on('data', (d) => (out += d))
    hijo.stderr.on('data', (d) => (err += d))
    hijo.on('error', (e) => fin({ code: -1, error: e.message }))
    hijo.on('close', (code) => {
      clearTimeout(reloj)
      let json = null
      const i = out.indexOf('{')
      if (i >= 0)
        try {
          json = JSON.parse(out.slice(i))
        } catch {}
      fin({ code, json, out, err })
    })
  })
}

const sinSesion = (t) => /authenticate|firebase login|credentials|not logged in/i.test(t)
const motivo = (r) => {
  const t = `${r.json?.error ?? ''} ${r.err ?? ''} ${r.error ?? ''}`
  if (r.code === -1) return 'no se pudo lanzar npx (¿está Node en el PATH?)'
  if (sinSesion(t))
    return 'no hay sesión de Firebase: ejecuta `npx firebase login` una vez en esta máquina'
  const linea =
    (r.json?.error ?? r.err ?? '')
      .toString()
      .split('\n')
      .find((l) => l.trim()) ?? `código ${r.code}`
  return linea.trim().slice(0, 200)
}

export async function probarFirebase({ proyecto, sitios = [] } = {}, cwd = process.cwd()) {
  const S = 'Firebase'
  if (!hay(proyecto)) return omite(S, 'sin proyecto de Firebase')
  const lista = await firebaseTools(['projects:list', '--json'], cwd)
  if (lista.code !== 0 || lista.json?.status !== 'success') return mal(S, motivo(lista))
  const proyectos = lista.json.result ?? []
  if (!proyectos.some((p) => p.projectId === proyecto.trim()))
    return mal(
      S,
      `tu cuenta no ve el proyecto «${proyecto}» (${proyectos.length} proyectos visibles): créalo en la consola o revisa el id`
    )
  const sl = await firebaseTools(
    ['hosting:sites:list', '--project', proyecto.trim(), '--json'],
    cwd
  )
  if (sl.code !== 0 || sl.json?.status !== 'success')
    return mal(S, `proyecto «${proyecto}» ok, pero los sitios: ${motivo(sl)}`)
  const existentes = (sl.json.result?.sites ?? sl.json.result ?? []).map((s) =>
    String(s.name ?? '')
      .split('/')
      .pop()
  )
  const pedidos = sitios.filter(hay).map((s) => s.trim())
  const faltan = pedidos.filter((s) => !existentes.includes(s))
  if (faltan.length)
    return mal(
      S,
      `proyecto «${proyecto}» ok; faltan los sitios ${faltan.join(', ')} (npx firebase-tools hosting:sites:create <id> --project ${proyecto})`,
      { faltan, existentes }
    )
  return ok(
    S,
    `proyecto «${proyecto}» · sitios ${pedidos.join(', ') || '(ninguno pedido)'} existen`,
    { faltan: [], existentes }
  )
}

export async function crearSitio({ proyecto, sitio } = {}, cwd = process.cwd()) {
  const S = 'Firebase'
  if (!hay(proyecto) || !hay(sitio)) return mal(S, 'faltan el proyecto o el id del sitio')
  if (!/^[a-z0-9][a-z0-9-]{4,61}[a-z0-9]$/.test(sitio.trim()))
    return mal(
      S,
      `«${sitio}» no vale como id de sitio: minúsculas, números y guiones, 6–63 caracteres`
    )
  const r = await firebaseTools(
    [
      'hosting:sites:create',
      sitio.trim(),
      '--project',
      proyecto.trim(),
      '--json',
      '--non-interactive',
    ],
    cwd
  )
  if (r.code === 0 && r.json?.status !== 'error')
    return ok(S, `sitio ${sitio} creado en «${proyecto}»`)
  return mal(S, `no se pudo crear ${sitio}: ${motivo(r)}`)
}

export async function probarTodo(datos, cwd) {
  return Promise.all([
    probarFigma(datos.figma),
    probarJira(datos.jira),
    probarGithub(datos.github),
    probarFirebase(datos.firebase, cwd),
  ])
}
