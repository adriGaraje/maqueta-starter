// El `_template` del repo generado, escrito en la sintaxis del perfil de hand-off.
//
// Una sola descripción de la pieza, y los escritores de cada perfil
// (`template/src/stories/lib/hooks-perfiles.js`) la pasan a su sintaxis. Con
// `html` no hay hooks: sale con el texto de ejemplo literal, el mismo de
// `datos-template.js`, para que la story lo encuentre.
import { PERFILES } from '../../template/src/stories/lib/hooks-perfiles.js'
import { DATOS } from '../../template/src/components/_template/datos-template.js'

// La apertura de un bloque, para el comentario de mapeo: `{% if item.tag %}`.
const abre = (bloque) => bloque.split('…')[0]

const tabla = (filas) => {
  const ancho = Math.max(...filas.map(([h]) => h.length))
  const ancho2 = Math.max(...filas.map(([, c]) => c.length))
  return filas.map(([h, c, q]) => `    ${h.padEnd(ancho)} → ${c.padEnd(ancho2)}   ${q}`).join('\n')
}

export function htmlTemplate(clave) {
  const p = PERFILES[clave]
  if (!p) throw new Error(`Perfil de hand-off desconocido: ${clave}`)
  const literal = Boolean(p.sinHooks)
  const item = DATOS.item
  const v = (n) => (literal ? n.split('.').reduce((o, k) => o[k], DATOS) : p.var(n))
  const si = (c, cuerpo) => (literal ? cuerpo.trim() : p.si(c, cuerpo))
  const bucle = (col, it, cuerpo) =>
    literal
      ? item.features.map((f) => cuerpo.trim().replace('\u0000', f.label)).join('\n    ')
      : p.bucle(col, it, cuerpo)
  const etiqueta = literal ? '\u0000' : v('feature.label')

  const cabecera = literal
    ? `  Template · copia esta carpeta para empezar una pieza nueva.
  Destino: ${p.label}. Sin hooks: el texto va literal y se cambia en el CMS.`
    : `  Template · copia esta carpeta para empezar una pieza nueva.
  Hooks (${p.label}):
${tabla([
  [v('item.title'), '.component-name__title', 'el titular'],
  [v('item.text'), '.component-name__text', 'la entradilla'],
  [abre(p.si('item.tag', '…')), '.component-name__tag', 'la etiqueta; sin ella no se pinta'],
  [v('item.tag'), '.component-name__tag', 'el texto de la etiqueta'],
  [
    abre(p.bucle('item.features', 'feature', '…')),
    '.component-name__feature',
    'una línea por ventaja',
  ],
  [v('feature.label'), '.component-name__feature', 'el texto de cada ventaja'],
])}`

  return `<!--
${cabecera}
-->
<article class="component-name">
  ${si('item.tag', `\n  <span class="badge badge-primary component-name__tag">${v('item.tag')}</span>\n  `)}
  <h3 class="component-name__title">${v('item.title')}</h3>
  <p class="component-name__text">${v('item.text')}</p>
  <ul class="component-name__features list-unstyled mb-0">
    ${bucle('item.features', 'feature', `\n    <li class="component-name__feature">${etiqueta}</li>\n    `)}
  </ul>
</article>
`
}

// Los marcadores de prosa (CLAUDE.md, el .mdx del _template…): el ejemplo de cada hook.
export function marcadoresHooks(clave) {
  const p = PERFILES[clave]
  if (p.sinHooks)
    return {
      STARTERHANDOFF: p.label,
      STARTERHOOK_VAR: 'texto literal',
      STARTERHOOK_FOR: '—',
      STARTERHOOK_IF: '—',
    }
  return {
    STARTERHANDOFF: `${p.label} (${p.quien})`,
    STARTERHOOK_VAR: p.var('item.title'),
    STARTERHOOK_FOR: p.bucle('items', 'item', '…'),
    STARTERHOOK_IF: p.si('item.tag', '…'),
  }
}

// Los bloques `si:hooks` / `si:html` de los textos: se queda el que toca y se van las marcas.
// En Markdown van como `<!-- si:hooks -->`; en MDX, que no admite comentarios HTML, `{/* si:hooks */}`.
const BLOQUE =
  /^[ \t]*(?:<!--|\{\/\*) si:(hooks|html) (?:-->|\*\/\})[ \t]*\n([\s\S]*?)^[ \t]*(?:<!--|\{\/\*) \/si:\1 (?:-->|\*\/\})[ \t]*\n/gm
export const bloquesPerfil = (texto, clave) =>
  texto.replace(BLOQUE, (_, cual, cuerpo) =>
    (cual === 'html') === Boolean(PERFILES[clave].sinHooks) ? cuerpo : ''
  )
