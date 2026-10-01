// Hooks del backend: escribirlos y resolverlos, en la sintaxis del destino.
// ---------------------------------------------------------------------------
// El destino del HTML es `config.repo.handoff` (django, twig, liquid, nunjucks,
// blade, handlebars, php o html) y su sintaxis está en `hooks-perfiles.js`.
// Nada fuera de estos dos ficheros debería saber si un hook se escribe
// `{{ item.title }}`, `{{ $item->title }}` o `<?= $item->title ?>`.
//
//   ESCRIBIR   var('item.title') · bucle('item.features', 'feature', cuerpo) · si('item.tag', cuerpo)
//   RESOLVER   pinta(plantilla, datos) — el partial `?raw` con datos de ejemplo, para la story
//              bloqueSi / bloqueFor     — para el pintor que quiere decidir bloque a bloque
//
// LA LECCIÓN, dos veces la misma. Los partials se resolvían a mano en cada pintor
// y, cuando uno ganaba un condicional, se actualizaba UNO de los cuatro: los otros
// publicaban el hook crudo al DOM (144 hooks en una Home, las cards de 445 a 830
// de alto). Por eso esto no limpia nada a ciegas: un hook sin dato LANZA con su
// nombre, y `exigeResuelto` revienta si al final queda texto de plantilla.

import config from '../../../docs/starterslug-harness/config.json'
import { PERFILES, clavePerfil } from './hooks-perfiles.js'

export { PERFILES } from './hooks-perfiles.js'

export const CLAVE = clavePerfil(config?.repo?.handoff)
export const PERFIL = PERFILES[CLAVE]

// ── escribir ────────────────────────────────────────────────────────────────

// `var` es palabra reservada como nombre de constante, no como nombre exportado.
const variable = (nombre) => (PERFIL.sinHooks ? '' : PERFIL.var(nombre))
export { variable as var, variable }
export const bucle = (coleccion, item, cuerpo) =>
  PERFIL.sinHooks ? cuerpo : PERFIL.bucle(coleccion, item, cuerpo)
export const si = (cond, cuerpo, sino) => (PERFIL.sinHooks ? cuerpo : PERFIL.si(cond, cuerpo, sino))

// ── utilidades de siempre ───────────────────────────────────────────────────

// El comentario de cabecera documenta los hooks, así que lleva un gemelo de cada
// uno: se quitan TODOS, que además no viajan al código que se pega en el CMS.
export const sinComentarios = (s) => s.replace(/<!--[\s\S]*?-->\s*/g, '')

// El valor va con función: un `$&` en un titular lo leería `replace` como referencia.
export const mete = (html, hook, valor) => html.replace(hook, () => valor ?? '')

// El include de un partial, en la sintaxis del perfil. Por regex y no por cadena:
// Prettier reparte los tags por las líneas como le cabe.
export const incluye = (html, partial, contenido) =>
  PERFIL.sinHooks ? html : html.replace(PERFIL.incluye(partial), () => contenido)

// Si una línea del comentario de cabecera empieza por un hook del perfil.
export const esHook = (s) => {
  if (PERFIL.sinHooks) return false
  const re = new RegExp(PERFIL.crudo.source, PERFIL.crudo.flags.replace('g', ''))
  return re.exec(s.trim())?.index === 0
}

// ── el analizador ───────────────────────────────────────────────────────────
// Un árbol con los bloques ANIDADOS bien cerrados: un `if` dentro de un `for`
// se resuelve con el ítem del bucle, no con lo de fuera.

const ORDEN = ['bucle', 'finBucle', 'si', 'sino', 'finSi', 'var']

// Los comentarios HTML son texto: la cabecera documenta los hooks y trae aperturas
// sin su cierre (`{% if item.tag %} → …`), que no son bloques.
const COMENTARIO = /<!--[\s\S]*?-->/g

function siguiente(src, desde) {
  let mejor = null
  COMENTARIO.lastIndex = desde
  const c = COMENTARIO.exec(src)
  for (const tipo of ORDEN) {
    const re = PERFIL.tokens[tipo]
    re.lastIndex = desde
    const m = re.exec(src)
    if (m && (!mejor || m.index < mejor.m.index)) mejor = { tipo, m }
  }
  return c && mejor && c.index < mejor.m.index ? { tipo: 'comentario', m: c } : mejor
}

function analiza(src, quien) {
  const raiz = { tipo: 'raiz', hijos: [] }
  const pila = [raiz]
  const arriba = () => pila[pila.length - 1]
  const destino = () => {
    const n = arriba()
    return n.tipo === 'si' && n.enSino ? n.sino : n.hijos
  }
  let i = 0
  for (let t = siguiente(src, 0); t; t = siguiente(src, i)) {
    const { tipo, m } = t
    if (m.index > i) destino().push({ tipo: 'texto', texto: src.slice(i, m.index) })
    const g = m.groups ?? {}
    const fin = m.index + m[0].length
    if (tipo === 'comentario') destino().push({ tipo: 'texto', texto: m[0] })
    else if (tipo === 'var') destino().push({ tipo: 'var', expr: g.expr, crudo: m[0] })
    else if (tipo === 'bucle' || tipo === 'si') {
      const nodo =
        tipo === 'bucle'
          ? { tipo, item: g.item ?? 'this', col: PERFIL.ruta(g.col).ruta, hijos: [] }
          : { tipo, cond: g.cond.trim(), hijos: [], sino: [], enSino: false }
      nodo.desde = m.index
      nodo.abre = fin
      destino().push(nodo)
      pila.push(nodo)
    } else if (tipo === 'sino') {
      if (arriba().tipo !== 'si') throw new Error(`${quien}: «${m[0]}» sin su condicional.`)
      arriba().enSino = true
      arriba().cuerpoHasta = m.index
      arriba().sinoDesde = fin
    } else {
      const espera = tipo === 'finBucle' ? 'bucle' : 'si'
      const n = pila.pop()
      if (n.tipo !== espera) throw new Error(`${quien}: «${m[0]}» cierra algo que no está abierto.`)
      n.cierra = m.index
      n.hasta = fin
      n.cuerpoHasta ??= m.index
    }
    i = fin
  }
  if (pila.length > 1)
    throw new Error(`${quien}: un bloque abierto en el carácter ${arriba().desde} no se cierra.`)
  if (i < src.length) destino().push({ tipo: 'texto', texto: src.slice(i) })
  return raiz
}

// Todos los bloques de un tipo, de fuera adentro.
const recorre = (nodo, tipo, fuera = []) => {
  for (const h of [...(nodo.hijos ?? []), ...(nodo.sino ?? [])]) {
    if (h.tipo === tipo) fuera.push(h)
    recorre(h, tipo, fuera)
  }
  return fuera
}

// Condición → { ruta, niega }. Vale `not x`, `!x` y `!$x`.
const leeCond = (cond) => {
  const niega = /^(not\s+|!)/.test(cond)
  return { ruta: PERFIL.ruta(cond.replace(/^(not\s+|!)\s*/, '')).ruta, niega }
}

// ── resolver ────────────────────────────────────────────────────────────────

const busca = (datos, ruta) =>
  ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), datos)

const verdad = (x) => (Array.isArray(x) ? x.length > 0 : Boolean(x))

function render(nodos, datos, quien) {
  return nodos
    .map((n) => {
      if (n.tipo === 'texto') return n.texto
      if (n.tipo === 'var') {
        const { ruta, defecto } = PERFIL.ruta(n.expr)
        const valor = busca(datos, ruta)
        if (valor == null && defecto == null)
          throw new Error(
            `${quien}: el hook ${n.crudo.trim()} no tiene dato. Dale un valor de ejemplo: ` +
              'sin él viajaría al DOM como texto de plantilla.'
          )
        return String(valor ?? defecto)
      }
      if (n.tipo === 'si') {
        const { ruta, niega } = leeCond(n.cond)
        const ok = verdad(busca(datos, ruta)) !== niega
        return render(ok ? n.hijos : n.sino, datos, quien)
      }
      const items = busca(datos, n.col) ?? []
      return items
        .map((it) => render(n.hijos, { ...datos, [n.item]: it, this: it }, quien))
        .join('')
    })
    .join('')
}

// El partial entero contra unos datos con la forma del backend
// (`{ item: { title, features: [...] } }`). Quita los comentarios, resuelve
// bucles, condicionales y variables, y exige que no quede nada.
// Con el perfil `html` devuelve el HTML tal cual (sin comentarios): no hay hooks.
export const pinta = (plantilla, datos = {}, quien = 'el partial') => {
  const html = sinComentarios(plantilla)
  if (PERFIL.sinHooks) return html
  return exigeResuelto(render(analiza(html, quien).hijos, datos, quien), quien)
}

// ── bloque a bloque ─────────────────────────────────────────────────────────

const sustituyeBloques = (html, tipo, encaja, nuevo, quien) => {
  if (PERFIL.sinHooks) return html
  // Solo los de más fuera que encajan: uno de dentro viaja en el cuerpo del de fuera.
  const todos = recorre(analiza(html, quien), tipo).filter(encaja)
  const fuera = todos.filter((b) => !todos.some((o) => o !== b && o.desde < b.desde && b.hasta <= o.hasta))
  return fuera
    .sort((a, b) => b.desde - a.desde)
    .reduce((acc, b) => acc.slice(0, b.desde) + nuevo(b, acc) + acc.slice(b.hasta), html)
}

// Un `si` de ese campo: `pintar(cuerpo)` lo enciende, un valor falso lo apaga
// (y deja su `sino`, si lo tiene). TODOS los de ese campo: un mismo condicional
// puede repetirse en el partial y se encienden o se apagan juntos.
export const bloqueSi = (html, campo, pintar, quien = 'el partial') =>
  sustituyeBloques(
    html,
    'si',
    (b) => leeCond(b.cond).ruta === campo && !leeCond(b.cond).niega,
    (b, src) => {
      if (pintar) return pintar(src.slice(b.abre, b.cuerpoHasta))
      return b.enSino ? src.slice(b.sinoDesde, b.cierra) : ''
    },
    quien
  )

// Un bucle sobre esa colección, repetido por cada ítem: `pintaItem(cuerpo, item)`.
export const bloqueFor = (html, coleccion, items, pintaItem, quien = 'el partial') =>
  sustituyeBloques(
    html,
    'bucle',
    (b) => b.col === coleccion,
    (b, src) => (items ?? []).map((it) => pintaItem(src.slice(b.abre, b.cierra), it)).join(''),
    quien
  )

// Los condicionales que trae el partial, en orden de aparición.
export const condicionalesDe = (html) =>
  PERFIL.sinHooks
    ? []
    : [...new Set(recorre(analiza(html, 'el partial'), 'si').map((b) => leeCond(b.cond).ruta))]

// Resuelve TODOS los condicionales de una vez contra un mapa campo → valor:
//
//   'card.tag': tag && ((cuerpo) => mete(cuerpo, var('card.tag'), tag))
//
// Un valor falso apaga el bloque; una función lo enciende y pinta su cuerpo. Si
// el partial trae un condicional que el mapa no menciona —o al revés— LANZA con
// el nombre del campo: un bloque nuevo no se cuela sin que su pintor se entere.
export const resuelveOpcionales = (html, mapa, quien = 'el partial') => {
  if (PERFIL.sinHooks) return html
  const enElPartial = condicionalesDe(html)
  const declarados = Object.keys(mapa)
  const sinDeclarar = enElPartial.filter((c) => !declarados.includes(c))
  if (sinDeclarar.length)
    throw new Error(
      `${quien}: el partial trae ${sinDeclarar.length} condicional(es) que este pintor no ` +
        `declara — ${sinDeclarar.join(', ')}. Declaralos en su mapa; si no, salen crudos al DOM.`
    )
  const sobran = declarados.filter((c) => !enElPartial.includes(c))
  if (sobran.length)
    throw new Error(
      `${quien}: este pintor declara ${sobran.length} condicional(es) que el partial ya no ` +
        `tiene — ${sobran.join(', ')}. O se renombraron o se borraron; el mapa se queda mintiendo.`
    )
  return enElPartial.reduce((acc, campo) => {
    const v = mapa[campo]
    return bloqueSi(acc, campo, v ? (typeof v === 'function' ? v : (c) => c) : null, quien)
  }, html)
}

// El último paso de todo pintor: si queda un hook sin resolver, LANZA con él
// dentro del mensaje. No se limpia lo que sobra: borrarlo en silencio haría de
// un campo sin alimentar una pieza que se pinta a medias sin decirlo.
export const exigeResuelto = (html, quien = 'el partial') => {
  if (PERFIL.sinHooks) return html
  const restos = [...new Set(html.match(PERFIL.crudo) ?? [])]
  if (restos.length)
    throw new Error(
      `${quien}: quedan ${restos.length} hook(s) ${PERFIL.label} sin resolver — ${restos.join(', ')}. ` +
        'Resuélvelos en el pintor: sin esto viajarían al DOM como texto de plantilla.'
    )
  return html
}
