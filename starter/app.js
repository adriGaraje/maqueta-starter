// Asistente de pasos. Sin frameworks: el estado es un objeto con la forma de
// `respuestas.ejemplo.json`, y cada paso pinta sus campos a partir de él.

const CLAVE = 'maqueta-starter:borrador'
const GRUPOS = [
  ['figma', 'Figma', 'tokens:diff, figma:ready, sitemap:sync y el plugin de Figma'],
  ['jira', 'Jira', 'tasks/ como espejo del tablero, tasks:mirror y el plugin de Atlassian'],
  ['entrega', 'Entrega', 'globales, Release Notes, deploy a Firebase Hosting (pre y entrega)'],
  ['django', 'Django', 'check:hooks: que no se pierda ningún hook del backend'],
  ['auth', 'Puerta de acceso', 'login con Firebase Auth delante del Storybook publicado'],
]

const inicial = () => ({
  proyecto: { nombre: '', slug: '', destino: '', descripcion: '', cms: '', webEnVivo: '' },
  figma: {
    fileKey: '',
    nombreArchivo: '',
    org: '',
    token: '',
    viewports: { mobile: 390, desktop: 1440 },
  },
  atlassian: {
    site: '',
    cloudId: '',
    projectKey: '',
    projectName: '',
    boardId: '',
    email: '',
    token: '',
    confluenceSpaceKey: '',
    confluenceSpaceName: '',
  },
  github: {
    remote: '',
    integracion: 'develop',
    release: 'main',
    patronRama: '<type>/<KEY>-###-<slug>',
    mcp: false,
    token: '',
  },
  equipo: [{ nombre: '', alias: '', email: '', jiraAccountId: '', github: '' }],
  auth: {
    activar: true,
    firebase: {
      apiKey: '',
      authDomain: '',
      projectId: '',
      storageBucket: '',
      messagingSenderId: '',
      appId: '',
    },
    proyectoHosting: '',
    sitioEntrega: '',
    sitioPre: '',
    login: {
      brand: '',
      subtitle: 'Acceso privado',
      poweredBy: '',
      accent: '#2563eb',
      ink: '#111827',
      surface: '#f3f4f6',
    },
  },
  grupos: GRUPOS.map(([g]) => g),
  comprobar: true,
  saltados: [],
  _paso: 0,
  _slugTocado: false,
  _destinoTocado: false,
})

let S = cargar()
let defectoDestino = ''

function cargar() {
  try {
    const b = JSON.parse(localStorage.getItem(CLAVE))
    if (b && b.proyecto) return { ...inicial(), ...b }
  } catch {}
  return inicial()
}
function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(S))
  } catch {}
}

// ── utilidades ───────────────────────────────────────────────────────────────

const $ = (s) => document.querySelector(s)
const get = (ruta) => ruta.split('.').reduce((o, k) => o?.[k], S)
function set(ruta, valor) {
  const k = ruta.split('.')
  const ult = k.pop()
  k.reduce((o, x) => (o[x] ??= {}), S)[ult] = valor
  guardar()
}
const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
const aSlug = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^[0-9-]+/, '')
const SLUG_OK = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/
const hayFirebase = () =>
  !S.saltados.includes('auth') && Boolean(S.auth.proyectoHosting || S.auth.firebase.projectId)
const hayClaves = () =>
  !S.saltados.includes('auth') && S.auth.activar && Boolean(S.auth.firebase.apiKey)

async function api(ruta, opciones) {
  const r = await fetch(ruta, opciones)
  return r.json()
}
async function pideDefecto() {
  if (!S.proyecto.slug) return
  try {
    defectoDestino = (await api(`/api/defecto?slug=${encodeURIComponent(S.proyecto.slug)}`)).destino
    const aviso = document.getElementById('aviso-destino')
    if (aviso) {
      aviso.hidden = false
      document.getElementById('aviso-destino-ruta').textContent =
        (S._destinoTocado && S.proyecto.destino) || defectoDestino
    }
    if (!S._destinoTocado) {
      set('proyecto.destino', defectoDestino)
      const i = document.getElementById('f-proyecto.destino')
      if (i) i.value = defectoDestino
    }
  } catch {}
}

// ── definición de pasos ──────────────────────────────────────────────────────

const campo = (ruta, label, extra = {}) => ({ ruta, label, ...extra })

const PASOS = [
  {
    id: 'proyecto',
    titulo: 'Proyecto',
    intro:
      'Lo único obligatorio es el nombre. El slug sale de él y da nombre a la skill, al agente y a las carpetas.',
    obligatorio: true,
    campos: [
      campo('proyecto.nombre', 'Nombre', { placeholder: 'Acme', requerido: true }),
      campo('proyecto.slug', 'Slug', {
        placeholder: 'acme',
        ayuda: 'kebab-case: minúsculas, números y guiones. Se propone a partir del nombre.',
      }),
      campo('proyecto.destino', 'Carpeta destino', {
        placeholder: '/ruta/absoluta/acme',
        ayuda: 'Ruta absoluta. Por defecto, junto al starter. Tiene que no existir o estar vacía.',
      }),
      campo('proyecto.descripcion', 'Descripción', {
        placeholder: 'Maqueta de la nueva web de Acme.',
      }),
      campo('proyecto.cms', 'CMS / hand-off', {
        placeholder: 'Django, WordPress, ninguno…',
        ayuda: 'Dónde acaban las piezas. Si es Django, el grupo «django» se marca solo.',
      }),
      campo('proyecto.webEnVivo', 'Web en producción (host)', { placeholder: 'www.acme.com' }),
    ],
  },
  {
    id: 'figma',
    titulo: 'Figma',
    prueba: 'figma',
    intro: 'El archivo de handoff es la fuente de verdad de color, tipografía y medidas.',
    campos: [
      campo('figma.fileKey', 'fileKey o URL del archivo de handoff', {
        placeholder: 'https://www.figma.com/design/AbCd…/Handoff',
        ayuda: 'Si pegas la URL, se extrae el fileKey.',
      }),
      campo('figma.nombreArchivo', 'Nombre del archivo', { placeholder: 'Handoff' }),
      campo('figma.org', 'Equipo u organización en Figma', { placeholder: 'Acme' }),
      campo('figma.token', 'FIGMA_TOKEN', {
        tipo: 'password',
        ayuda:
          'Va a .env, nunca a config.json. Scopes: file_content:read, file_dev_resources:read.',
      }),
      campo('figma.viewports.mobile', 'Ancho móvil (px)', { tipo: 'number', mitad: true }),
      campo('figma.viewports.desktop', 'Ancho escritorio (px)', { tipo: 'number', mitad: true }),
    ],
  },
  {
    id: 'atlassian',
    titulo: 'Jira / Atlassian',
    prueba: 'jira',
    intro:
      'El tablero donde viven las tareas. El cloudId lo da getAccessibleAtlassianResources en Claude Code.',
    campos: [
      campo('atlassian.site', 'Site', { placeholder: 'acme.atlassian.net' }),
      campo('atlassian.cloudId', 'cloudId', { placeholder: '00000000-0000-…' }),
      campo('atlassian.projectKey', 'Clave del proyecto', { placeholder: 'ACME', mitad: true }),
      campo('atlassian.boardId', 'boardId', { placeholder: '1', mitad: true }),
      campo('atlassian.projectName', 'Nombre del proyecto', { placeholder: 'Acme Web' }),
      campo('atlassian.email', 'Email de Atlassian', {
        mitad: true,
        ayuda: 'Para .env (ATLASSIAN_EMAIL) y la prueba de conexión.',
      }),
      campo('atlassian.token', 'API token de Atlassian', {
        tipo: 'password',
        mitad: true,
        ayuda:
          'id.atlassian.com → Security → API tokens. Opcional: el MCP se autoriza aparte con /mcp.',
      }),
      campo('atlassian.confluenceSpaceKey', 'Espacio de Confluence (clave, opcional)', {
        mitad: true,
      }),
      campo('atlassian.confluenceSpaceName', 'Espacio de Confluence (nombre)', { mitad: true }),
    ],
  },
  {
    id: 'github',
    titulo: 'GitHub',
    prueba: 'github',
    intro:
      'El remote se añade como origin; las ramas alimentan el flujo de git del harness y el deploy.',
    campos: [
      campo('github.remote', 'URL del remote', { placeholder: 'git@github.com:acme/acme-web.git' }),
      campo('github.integracion', 'Rama de integración', { mitad: true }),
      campo('github.release', 'Rama de release', { mitad: true }),
      campo('github.patronRama', 'Patrón de rama', {
        ayuda: '<KEY> se sustituye por la clave de Jira.',
      }),
      campo('github.mcp', 'Añadir el servidor MCP de GitHub (.mcp.json)', { tipo: 'checkbox' }),
      campo('github.token', 'GITHUB_TOKEN', {
        tipo: 'password',
        siCampo: 'github.mcp',
        ayuda: 'Va a .env. Claude Code lo lee del entorno: expórtalo en el shell que lanza claude.',
      }),
    ],
  },
  {
    id: 'equipo',
    titulo: 'Equipo',
    intro:
      'La primera fila es el usuario por defecto. El hook de arranque te reconoce por tu git config user.email.',
    pinta: pintaEquipo,
  },
  {
    id: 'auth',
    titulo: 'Firebase y puerta',
    prueba: 'firebase',
    intro:
      'Firebase Hosting publica el Storybook por rama: integración → sitio pre, release → sitio de entrega. Firebase Auth pone un login delante. firebase-tools se usa por npx: haz `npx firebase login` una vez en esta máquina.',
    alEntrar: () => {
      const slug = S.proyecto.slug || 'slug'
      if (!S.auth.sitioEntrega) S.auth.sitioEntrega = `storybook-${slug}`
      if (!S.auth.sitioPre) S.auth.sitioPre = `storybook-${slug}-pre`
    },
    campos: [
      campo('auth.proyectoHosting', 'Proyecto de Firebase (hosting)', {
        placeholder: 'acme-storybook',
      }),
      campo('auth.sitioEntrega', 'Sitio de entrega', {
        placeholderFn: () => `storybook-${S.proyecto.slug || 'slug'}`,
        mitad: true,
      }),
      campo('auth.sitioPre', 'Sitio de pre', {
        placeholderFn: () => `storybook-${S.proyecto.slug || 'slug'}-pre`,
        mitad: true,
      }),
      campo('auth.activar', 'Activar la puerta de acceso (login con Firebase Auth)', {
        tipo: 'checkbox',
      }),
      {
        seccion: 'Claves web (Configuración del proyecto → Tus apps → SDK web)',
        siCampo: 'auth.activar',
      },
      ...['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'].map(
        (k) => campo(`auth.firebase.${k}`, k, { mitad: true, siCampo: 'auth.activar' })
      ),
      { seccion: 'Aspecto del login', siCampo: 'auth.activar' },
      campo('auth.login.brand', 'Nombre', {
        placeholderFn: () => S.proyecto.nombre,
        mitad: true,
        siCampo: 'auth.activar',
      }),
      campo('auth.login.subtitle', 'Subtítulo', { mitad: true, siCampo: 'auth.activar' }),
      campo('auth.login.poweredBy', '«Powered by»', { siCampo: 'auth.activar' }),
      campo('auth.login.accent', 'Acento', {
        tipo: 'color',
        tercio: true,
        siCampo: 'auth.activar',
      }),
      campo('auth.login.ink', 'Tinta', { tipo: 'color', tercio: true, siCampo: 'auth.activar' }),
      campo('auth.login.surface', 'Fondo', {
        tipo: 'color',
        tercio: true,
        siCampo: 'auth.activar',
      }),
    ],
  },
  {
    id: 'grupos',
    titulo: 'Qué llevar',
    intro:
      'La base (Storybook, ITCSS, skill, Ojo, hooks, gates, lecciones) va siempre. El resto, a elegir.',
    pinta: pintaGrupos,
  },
  {
    id: 'resumen',
    titulo: 'Resumen',
    intro: 'Repasa y genera. Lo saltado queda como TODO en el repo.',
    pinta: pintaResumen,
    final: true,
  },
]

// ── render ───────────────────────────────────────────────────────────────────

function pintaPasos() {
  $('#lista-pasos').innerHTML = PASOS.map((p, i) => {
    const estado = S.saltados.includes(p.id)
      ? 'saltado'
      : i < S._paso
        ? 'hecho'
        : i === S._paso
          ? 'actual'
          : ''
    return `<li class="pasos__item pasos__item--${estado || 'pendiente'}">
      <button type="button" data-ir="${i}" ${i === S._paso ? 'aria-current="step"' : ''}>
        <span class="pasos__num">${i + 1}</span> ${esc(p.titulo)}
        ${estado === 'saltado' ? '<span class="pasos__marca">saltado</span>' : ''}
      </button></li>`
  }).join('')
}

function pintaCampo(c) {
  if (c.siCampo && !get(c.siCampo)) return ''
  if (c.seccion) return `<h3 class="seccion">${esc(c.seccion)}</h3>`
  const id = `f-${c.ruta}`
  const val = get(c.ruta)
  const ancho = c.mitad ? ' campo--mitad' : c.tercio ? ' campo--tercio' : ''
  const ayuda = c.ayuda
    ? `<small id="${id}-ayuda" class="campo__ayuda">${esc(c.ayuda)}</small>`
    : ''
  const describe = c.ayuda ? ` aria-describedby="${id}-ayuda"` : ''
  if (c.tipo === 'checkbox')
    return `<div class="campo campo--check"><label><input type="checkbox" id="${id}" data-ruta="${c.ruta}" ${val ? 'checked' : ''}${describe}> ${esc(c.label)}</label>${ayuda}</div>`
  const ph = c.placeholderFn ? c.placeholderFn() : c.placeholder
  return `<div class="campo${ancho}">
    <label for="${id}">${esc(c.label)}${c.requerido ? ' <span aria-hidden="true">*</span>' : ''}</label>
    <input id="${id}" data-ruta="${c.ruta}" type="${c.tipo || 'text'}" value="${esc(val)}"
      ${ph ? `placeholder="${esc(ph)}"` : ''} ${c.requerido ? 'required' : ''}${describe}
      ${c.tipo === 'password' ? 'autocomplete="new-password"' : ''} spellcheck="false">
    ${ayuda}<small class="campo__error" id="${id}-error" hidden></small></div>`
}

function pinta() {
  const p = PASOS[S._paso]
  pintaPasos()
  $('#titulo-paso').textContent = `${S._paso + 1}. ${p.titulo}`
  $('#intro-paso').textContent = p.intro
  $('#error-paso').hidden = true
  p.alEntrar?.()
  $('#campos').innerHTML =
    (p.pinta ? p.pinta() : `<div class="rejilla">${p.campos.map(pintaCampo).join('')}</div>`) +
    (p.prueba ? pintaPrueba(p.prueba) : '')
  $('#btn-atras').disabled = S._paso === 0
  $('#btn-saltar').hidden = p.obligatorio || p.final
  $('#btn-siguiente').textContent = p.final ? 'Finalizar' : 'Siguiente'
  if (p.id === 'proyecto') comprobarDestino()
}

// ── pruebas de conexión (las hace el servidor; nada se guarda en disco) ─────

const NOMBRES = { figma: 'Figma', jira: 'Jira', github: 'GitHub', firebase: 'Firebase' }
const pruebas = {}

function datosPrueba(servicio) {
  if (servicio === 'figma') return { fileKey: S.figma.fileKey, token: S.figma.token }
  if (servicio === 'jira')
    return {
      site: S.atlassian.site,
      email: S.atlassian.email,
      token: S.atlassian.token,
      projectKey: S.atlassian.projectKey,
    }
  if (servicio === 'github') return { remote: S.github.remote, token: S.github.token }
  return {
    proyecto: S.auth.proyectoHosting || S.auth.firebase.projectId,
    sitios: [S.auth.sitioEntrega, S.auth.sitioPre],
  }
}

function pintaResultado(servicio) {
  const r = pruebas[servicio]
  if (!r) return ''
  if (r.cargando)
    return `<p class="prueba__res">… probando ${NOMBRES[servicio]}${servicio === 'firebase' ? ' (npx firebase-tools tarda la primera vez)' : ''}</p>`
  const marca = { ok: '✔', error: '✖', omitido: '–' }[r.estado] ?? '✖'
  const crear = (r.faltan ?? [])
    .map(
      (s) =>
        `<button type="button" class="btn btn--sec" data-crear-sitio="${esc(s)}">Crear el sitio ${esc(s)}</button>`
    )
    .join(' ')
  return `<p class="prueba__res prueba__res--${r.estado}"><strong>${marca} ${NOMBRES[servicio]}</strong> · ${esc(r.mensaje)}</p>${crear ? `<p>${crear}</p>` : ''}`
}

function pintaPrueba(servicio) {
  return `<div class="prueba"><button type="button" class="btn btn--sec" data-probar="${servicio}">Probar conexión</button>
    <div id="res-${servicio}" aria-live="polite">${pintaResultado(servicio)}</div></div>`
}

function refresca(servicio) {
  const el = document.getElementById(`res-${servicio}`)
  if (el) el.innerHTML = pintaResultado(servicio)
}

async function probar(servicio) {
  pruebas[servicio] = { cargando: true }
  refresca(servicio)
  try {
    pruebas[servicio] = await api(`/api/probar/${servicio}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(datosPrueba(servicio)),
    })
  } catch (e) {
    pruebas[servicio] = {
      estado: 'error',
      mensaje: `sin respuesta del servidor del asistente (${e.message})`,
    }
  }
  refresca(servicio)
}

async function crearSitio(sitio) {
  const proyecto = datosPrueba('firebase').proyecto
  if (!confirm(`¿Crear el sitio de Hosting «${sitio}» en el proyecto «${proyecto}»?`)) return
  pruebas.firebase = { cargando: true }
  refresca('firebase')
  const r = await api('/api/firebase/crear-sitio', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ proyecto, sitio }),
  })
  if (r.estado !== 'ok') {
    pruebas.firebase = r
    return refresca('firebase')
  }
  probar('firebase')
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-probar]')
  if (b) probar(b.dataset.probar)
  const c = e.target.closest('[data-crear-sitio]')
  if (c) crearSitio(c.dataset.crearSitio)
  if (e.target.id === 'btn-probar-todo')
    Object.keys(NOMBRES)
      .filter((sv) => !S.saltados.includes({ jira: 'atlassian', firebase: 'auth' }[sv] ?? sv))
      .forEach(probar)
})

function pintaEquipo() {
  const filas = S.equipo
    .map(
      (m, i) => `<fieldset class="miembro">
      <legend>${i === 0 ? 'Persona 1 · usuario por defecto' : `Persona ${i + 1}`}</legend>
      <div class="rejilla">
        ${[
          ['nombre', 'Nombre', 'Ana Pérez'],
          ['alias', 'Alias', 'ana'],
          ['email', 'Email (git)', 'ana@acme.com'],
          ['jiraAccountId', 'accountId de Jira', '712020:…'],
          ['github', 'Usuario de GitHub', 'ana-gh'],
        ]
          .map(
            ([k, l, ph]) => `<div class="campo campo--mitad"><label for="eq-${i}-${k}">${l}</label>
          <input id="eq-${i}-${k}" data-equipo="${i}" data-clave="${k}" value="${esc(m[k])}" placeholder="${ph}" spellcheck="false"></div>`
          )
          .join('')}
      </div>
      <button type="button" class="enlace" data-quitar="${i}">Quitar a esta persona</button>
    </fieldset>`
    )
    .join('')
  return `${filas}<button type="button" class="btn btn--sec" id="btn-anadir">Añadir persona</button>`
}

function pintaGrupos() {
  if (/django/i.test(S.proyecto.cms) && !S.grupos.includes('django') && !S._djangoVisto) {
    S.grupos.push('django')
    S._djangoVisto = true
  }
  const avisos = []
  if (!hayFirebase()) {
    for (const g of ['entrega', 'auth'])
      if (S.grupos.includes(g)) S.grupos = S.grupos.filter((x) => x !== g)
    avisos.push(
      'Sin proyecto de Firebase, «entrega» y «puerta de acceso» quedan desmarcados. Rellénalo en el paso 6 para activarlos.'
    )
  } else if (!hayClaves() && S.grupos.includes('auth')) {
    S.grupos = S.grupos.filter((x) => x !== 'auth')
    avisos.push('La puerta está desactivada o sin apiKey: «puerta de acceso» se desmarca.')
  }
  if (S.saltados.includes('figma') && S.grupos.includes('figma'))
    avisos.push('Saltaste Figma: el grupo viaja, pero FIGMA_TOKEN y el archivo quedan en TODO.')
  if (S.saltados.includes('atlassian') && S.grupos.includes('jira'))
    avisos.push('Saltaste Jira: el grupo viaja, pero el tablero queda en TODO.')
  guardar()
  const bloqueado = (g) => (g === 'entrega' && !hayFirebase()) || (g === 'auth' && !hayClaves())
  return `<div class="grupos">${GRUPOS.map(
    ([g, l, d]) => `<label class="grupo ${bloqueado(g) ? 'grupo--off' : ''}">
      <input type="checkbox" data-grupo="${g}" ${S.grupos.includes(g) ? 'checked' : ''} ${bloqueado(g) ? 'disabled' : ''}>
      <span><strong>${l}</strong> <code>${g}</code><br><small>${d}</small></span></label>`
  ).join('')}</div>
  ${avisos.map((a) => `<p class="aviso">${esc(a)}</p>`).join('')}
  <div class="campo campo--check"><label><input type="checkbox" data-ruta="comprobar" ${S.comprobar ? 'checked' : ''}>
    Al acabar, <code>npm install</code> + <code>build-storybook</code> + <code>check:stories</code> (unos minutos)</label></div>`
}

function filasResumen(paso) {
  const p = PASOS.find((x) => x.id === paso)
  if (S.saltados.includes(paso))
    return `<tr><th>${esc(p.titulo)}</th><td class="saltado" colspan="2">saltado → TODO</td></tr>`
  if (paso === 'equipo') {
    const gente = S.equipo.filter((m) => m.nombre || m.email)
    return `<tr><th>Equipo</th><td colspan="2">${gente.length ? gente.map((m) => esc(`${m.nombre} <${m.email || '¿email?'}>`)).join('<br>') : '<span class="saltado">nadie → team: []</span>'}</td></tr>`
  }
  if (paso === 'grupos')
    return `<tr><th>Grupos</th><td colspan="2">base${S.grupos.map((g) => `, ${g}`).join('')}${S.comprobar ? ' · con comprobación' : ''}</td></tr>`
  return p.campos
    .filter((c) => c.ruta && (!c.siCampo || get(c.siCampo)))
    .map((c, i) => {
      let v = get(c.ruta)
      if (c.tipo === 'password') v = v ? '••••••' : ''
      if (c.tipo === 'checkbox') v = v ? 'sí' : 'no'
      const vacio = v === '' || v == null
      return `<tr>${i === 0 ? `<th rowspan="${p.campos.filter((x) => x.ruta && (!x.siCampo || get(x.siCampo))).length}">${esc(p.titulo)}</th>` : ''}
        <td>${esc(c.label)}</td><td class="${vacio ? 'saltado' : ''}">${vacio ? 'TODO' : esc(v)}</td></tr>`
    })
    .join('')
}

function pintaResumen() {
  return `<div class="tabla-envoltorio"><table class="resumen">${PASOS.filter((p) => !p.final)
    .map((p) => filasResumen(p.id))
    .join('')}</table></div>
    <p>Se generará en <code>${esc(S.proyecto.destino || defectoDestino)}</code>.</p>
    <div class="prueba"><button type="button" class="btn btn--sec" id="btn-probar-todo">Probar todo</button>
    ${Object.keys(NOMBRES)
      .map((sv) => `<div id="res-${sv}" aria-live="polite">${pintaResultado(sv)}</div>`)
      .join('')}</div>`
}

// ── validación ───────────────────────────────────────────────────────────────

function marcaError(ruta, msg) {
  const e = document.getElementById(`f-${ruta}-error`)
  const i = document.getElementById(`f-${ruta}`)
  if (!e) return
  e.textContent = msg || ''
  e.hidden = !msg
  i?.setAttribute('aria-invalid', msg ? 'true' : 'false')
}

let destinoOk = true
async function comprobarDestino() {
  const ruta = S.proyecto.destino
  if (!ruta) return marcaError('proyecto.destino', '')
  if (!ruta.startsWith('/') && !/^[A-Za-z]:\\/.test(ruta)) {
    destinoOk = false
    return marcaError('proyecto.destino', 'Tiene que ser una ruta absoluta.')
  }
  try {
    const r = await api(`/api/comprobar-destino?ruta=${encodeURIComponent(ruta)}`)
    destinoOk = r.vacia
    marcaError(
      'proyecto.destino',
      r.vacia ? '' : r.fichero ? 'Es un fichero, no una carpeta.' : 'Existe y no está vacía.'
    )
  } catch {
    destinoOk = true
  }
}

function valida() {
  const p = PASOS[S._paso]
  if (p.id !== 'proyecto') return true
  let bien = true
  if (!S.proyecto.nombre.trim()) {
    marcaError('proyecto.nombre', 'El nombre es obligatorio.')
    bien = false
  } else marcaError('proyecto.nombre', '')
  if (!SLUG_OK.test(S.proyecto.slug)) {
    marcaError('proyecto.slug', 'kebab-case y empezando por letra, p. ej. «acme-web».')
    bien = false
  } else marcaError('proyecto.slug', '')
  if (!destinoOk) bien = false
  if (!bien) {
    $('#error-paso').textContent = 'Revisa los campos marcados.'
    $('#error-paso').hidden = false
    document.querySelector('[aria-invalid="true"]')?.focus()
  }
  return bien
}

// ── navegación ───────────────────────────────────────────────────────────────

function ir(i) {
  S._paso = Math.max(0, Math.min(PASOS.length - 1, i))
  guardar()
  pinta()
  $('#panel').focus()
  window.scrollTo({ top: 0 })
}

$('#formulario').addEventListener('submit', async (e) => {
  e.preventDefault()
  const p = PASOS[S._paso]
  if (p.id === 'proyecto') await comprobarDestino()
  if (!valida()) return
  S.saltados = S.saltados.filter((x) => x !== p.id)
  if (p.final) return finalizar()
  ir(S._paso + 1)
})
$('#btn-atras').addEventListener('click', () => ir(S._paso - 1))
$('#btn-saltar').addEventListener('click', () => {
  const p = PASOS[S._paso]
  if (!S.saltados.includes(p.id)) S.saltados.push(p.id)
  ir(S._paso + 1)
})
$('#lista-pasos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-ir]')
  if (b) ir(Number(b.dataset.ir))
})
$('#btn-borrar').addEventListener('click', () => {
  if (!confirm('¿Borrar todas las respuestas y empezar de cero?')) return
  S = inicial()
  guardar()
  ir(0)
})

$('#campos').addEventListener('input', (e) => {
  const t = e.target
  if (t.dataset.equipo) {
    S.equipo[Number(t.dataset.equipo)][t.dataset.clave] = t.value
    return guardar()
  }
  if (!t.dataset.ruta) return
  const ruta = t.dataset.ruta
  if (t.type === 'checkbox') return
  set(ruta, t.type === 'number' ? Number(t.value) || '' : t.value)
  if (ruta === 'proyecto.nombre' && !S._slugTocado) {
    set('proyecto.slug', aSlug(t.value))
    document.getElementById('f-proyecto.slug').value = S.proyecto.slug
    pideDefecto()
  }
  if (ruta === 'proyecto.slug') {
    S._slugTocado = true
    pideDefecto()
  }
  if (ruta === 'proyecto.destino') S._destinoTocado = true
  if (ruta === 'figma.fileKey') {
    const m = t.value.match(/figma\.com\/(?:design|file|proto)\/([A-Za-z0-9]+)\/([^?#]*)/)
    if (m && !S.figma.nombreArchivo) {
      set('figma.nombreArchivo', decodeURIComponent(m[2]).replace(/-/g, ' '))
      document.getElementById('f-figma.nombreArchivo').value = S.figma.nombreArchivo
    }
  }
})
$('#campos').addEventListener('change', (e) => {
  const t = e.target
  if (t.dataset.grupo) {
    S.grupos = t.checked
      ? [...new Set([...S.grupos, t.dataset.grupo])]
      : S.grupos.filter((g) => g !== t.dataset.grupo)
    return guardar()
  }
  if (t.type === 'checkbox' && t.dataset.ruta) {
    set(t.dataset.ruta, t.checked)
    pinta()
    document.querySelector(`[data-ruta="${t.dataset.ruta}"]`)?.focus()
  }
  if (t.dataset.ruta === 'proyecto.destino') comprobarDestino()
})
$('#campos').addEventListener('click', (e) => {
  if (e.target.id === 'btn-anadir') {
    S.equipo.push({ nombre: '', alias: '', email: '', jiraAccountId: '', github: '' })
    guardar()
    pinta()
    document.getElementById(`eq-${S.equipo.length - 1}-nombre`)?.focus()
  }
  const q = e.target.dataset?.quitar
  if (q != null) {
    S.equipo.splice(Number(q), 1)
    if (!S.equipo.length)
      S.equipo.push({ nombre: '', alias: '', email: '', jiraAccountId: '', github: '' })
    guardar()
    pinta()
  }
})

// ── finalizar ────────────────────────────────────────────────────────────────

function respuestas() {
  const r = structuredClone(S)
  for (const k of Object.keys(r)) if (k.startsWith('_')) delete r[k]
  if (!r.proyecto.destino) r.proyecto.destino = defectoDestino
  if (!r.auth.login.brand) r.auth.login.brand = r.proyecto.nombre
  return r
}

async function finalizar() {
  $('#formulario').hidden = true
  $('#progreso').hidden = false
  $('#btn-borrar').disabled = true
  const pre = $('#progreso-lineas')
  pre.textContent = ''
  let id
  try {
    ;({ id } = await api('/api/generar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(respuestas()),
    }))
  } catch (e) {
    pre.textContent = `✖ No se pudo hablar con el servidor: ${e.message}`
    return
  }
  const sondea = async () => {
    const t = await api(`/api/progreso/${id}`)
    pre.textContent = t.lineas.join('\n')
    pre.scrollTop = pre.scrollHeight
    if (t.estado === 'en-curso') return setTimeout(sondea, 1000)
    pintaFinal(t)
  }
  sondea()
}

function pintaFinal(t) {
  const r = t.resultado ?? {}
  const ok = t.estado === 'ok'
  $('#progreso-titulo').textContent = ok ? 'Listo' : 'Algo ha fallado'
  $('#btn-borrar').disabled = false
  const lista = (xs) => `<ul>${xs.map((x) => `<li>${x}</li>`).join('')}</ul>`
  const amano = [
    'Autoriza los MCP en Claude Code con <code>/mcp</code> (Atlassian, Figma' +
      (S.github.mcp ? ', GitHub' : '') +
      ').',
    S.github.mcp &&
      'Exporta <code>GITHUB_TOKEN</code> en el shell que lanza <code>claude</code>: Claude Code no lee <code>.env</code>.',
    r.pendientes?.length &&
      `Rellena los <code>TODO</code> que quedan (${r.pendientes.length}):` +
        lista(r.pendientes.map(esc)),
    r.alTrabajar &&
      `${r.alTrabajar} claves de <code>tokens</code> y <code>pageStandard</code> en config.json se rellenan al maquetar la primera pieza y la primera página.`,
    r.grupos?.includes('entrega') &&
      'Crea el proyecto de Firebase y los dos sitios de Hosting si no existían (<code>npx firebase-tools hosting:sites:create</code>), con <code>npx firebase login</code> hecho una vez.',
    '<code>npm run check:conexiones</code> repite las pruebas de conexión con <code>config.json</code> y <code>.env</code>.',
    r.grupos?.includes('auth') &&
      'Activa Email/Contraseña en Firebase Auth e invita las cuentas que podrán entrar.',
  ].filter(Boolean)
  $('#progreso-final').innerHTML = ok
    ? `<h3>Para empezar</h3>
      <pre class="comandos">cd ${esc(r.destino)}
${S.comprobar ? '' : 'npm install\n'}npm run storybook</pre>
      <p>Abre Claude Code en esa carpeta y saluda («buenos días»): el hook de arranque hace el resto.</p>
      ${r.saltados?.length ? `<h3>Saltado</h3><p>${r.saltados.map(esc).join(', ')} — queda en TODO.</p>` : ''}
      ${r.avisos?.length ? `<h3>Avisos</h3>${lista(r.avisos.map(esc))}` : ''}
      <h3>Queda a mano</h3>${lista(amano)}`
    : `<p class="panel__error">${esc(r.error || 'Mira las líneas de arriba.')}</p>
      <button type="button" class="btn btn--sec" id="btn-volver">Volver al resumen</button>`
  document.getElementById('btn-volver')?.addEventListener('click', () => {
    $('#progreso').hidden = true
    $('#formulario').hidden = false
  })
}

pinta()
if (S.proyecto.slug && !S.proyecto.destino) pideDefecto()
