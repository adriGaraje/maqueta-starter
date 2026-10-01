// Resolver de hooks Django para los pintores de Storybook.
// ---------------------------------------------------------------------------
// Los partials son la fuente de verdad y se importan en crudo (`?raw`), así que
// alguien tiene que resolver sus `{{ … }}`, `{% if %}`, `{% for %}` e
// `{% include %}` para poder verlos montados. Ese «alguien» estaba copiado en
// cada `datos-*.js`, y esa copia es la avería:
//
//   metió un `{% if %}` en `tabs.html` y actualizó UNO de los cuatro
//     pintores. Los otros tres escupían el hook crudo al DOM.
//   metió tres `{% if %}` en `tariff-card.html` y actualizó UNO de los
//     cuatro. La Home volvió a publicar plantilla a la vista: 144 hooks en el
//     `innerHTML` de `pages-home--default`, las cards de 445 a 830 de alto.
//
// Dos veces el mismo fallo, la segunda con el aviso escrito al lado. Un aviso no
// es un gate. Lo que sigue lo convierte en uno: `resuelveOpcionales` compara los
// `{% if %}` que trae el partial con los que el pintor declara y **revienta** si
// no coinciden, y `exigeResuelto` revienta si al final queda un hook sin resolver.
// Añadir un bloque al partial deja de ser un cambio silencioso: rompe en el acto,
// con el nombre del campo, en el pintor que se quedó atrás.
//
// Lo que NO hace, a propósito: borrar hooks a ciegas. Un `{{ … }}` que nadie
// esperaba tiene que seguir siendo un fallo visible, no algo que se limpia solo.

// El comentario de cabecera documenta los hooks, así que contiene un gemelo de
// cada `{{ … }}` y un `replace` se gastaría ahí (L-022). Se quitan TODOS y no
// solo el primero: los bloques opcionales traen los suyos dentro, y el criterio
// del repo es que los comentarios no viajan al código que se pega en el CMS.
export const sinComentarios = (s) => s.replace(/<!--[\s\S]*?-->\s*/g, '')

// El valor se mete con función y no como cadena: un `$&` o un `$1` escritos en un
// titular los interpretaría `String.replace` como referencias.
export const mete = (html, hook, valor) => html.replace(hook, () => valor ?? '')

const escapa = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// `{% for x in y %}…{% endfor %}` repetido por cada elemento.
export const bucle = (html, declaracion, items, pintaItem) =>
  html.replace(
    new RegExp(`\\{%\\s*for ${escapa(declaracion)}\\s*%\\}([\\s\\S]*?)\\{%\\s*endfor %\\}`),
    (_, cuerpo) => (items ?? []).map((item) => pintaItem(cuerpo, item)).join('')
  )

// `{% include "components/x.html" with … %}`. Va por expresión regular y no por
// cadena literal porque Prettier reparte los tags de Django por las líneas como
// le cabe: un `{% include` y su ruta pueden acabar separados por un salto y
// sangría, y entonces un `replace` de cadena exacta deja de casar sin avisar.
export const incluye = (html, partial, contenido) =>
  html.replace(new RegExp(`\\{%\\s*include\\s+"${escapa(partial)}"[\\s\\S]*?%\\}`), () => contenido)

// Los `{% if campo %}` que trae el partial, en el orden en que aparecen.
export const condicionalesDe = (html) => [
  ...new Set([...html.matchAll(/\{%\s*if\s+([\w.]+)\s*%\}/g)].map((m) => m[1])),
]

// Global a propósito: un mismo `{% if campo %}` puede aparecer en
// dos sitios del partial —el botón (i) y el modal de detalle de `tariff-card`— y
// los dos se encienden o se apagan juntos. Sin la `g` solo se resolvía el
// primero y el segundo llegaba crudo al DOM.
const bloqueSi = (html, campo, pintar) =>
  html.replace(
    new RegExp(`\\{%\\s*if ${escapa(campo)}\\s*%\\}([\\s\\S]*?)\\{%\\s*endif %\\}`, 'g'),
    pintar ? (_, cuerpo) => pintar(cuerpo) : ''
  )

// Resuelve TODOS los bloques opcionales del partial de una vez, contra un mapa
// que el pintor declara campo a campo:
//
//   'card.tag': tag && ((cuerpo) => mete(cuerpo, '{{ card.tag }}', tag))
//
// Un valor falso apaga el bloque; una función lo enciende y pinta su cuerpo.
//
// Y aquí está el gate: si el partial trae un `{% if %}` que el mapa no menciona
// —o el mapa menciona uno que el partial ya no tiene— esto LANZA con el nombre
// del campo. Es lo que impide que un bloque nuevo se cuele sin que su pintor se
// entere, que es como se rompió esto dos veces.
export const resuelveOpcionales = (html, mapa, quien = 'el partial') => {
  const enElPartial = condicionalesDe(html)
  const declarados = Object.keys(mapa)

  const sinDeclarar = enElPartial.filter((c) => !declarados.includes(c))
  if (sinDeclarar.length) {
    throw new Error(
      `${quien}: el partial trae ${sinDeclarar.length} bloque(s) {% if %} que este pintor no ` +
        `declara — ${sinDeclarar.join(', ')}. Declaralos en su mapa; si se dejan sin resolver, ` +
        'el hook sale crudo al DOM.'
    )
  }

  const sobran = declarados.filter((c) => !enElPartial.includes(c))
  if (sobran.length) {
    throw new Error(
      `${quien}: este pintor declara ${sobran.length} bloque(s) {% if %} que el partial ya no ` +
        `tiene — ${sobran.join(', ')}. O se renombraron o se borraron; el mapa se queda mintiendo.`
    )
  }

  return enElPartial.reduce((acc, campo) => {
    const valor = mapa[campo]
    return bloqueSi(acc, campo, valor ? (typeof valor === 'function' ? valor : (c) => c) : null)
  }, html)
}

// El último paso de todo pintor. Si queda un hook sin resolver, LANZA con el hook
// dentro del mensaje en vez de dejarlo llegar al DOM.
//
// No se limpia lo que sobra: borrarlo en silencio convertiría un fallo de datos
// —un campo que nadie alimenta— en una pieza que se pinta a medias sin decirlo.
export const exigeResuelto = (html, quien = 'el partial') => {
  const restos = [...new Set(html.match(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g) ?? [])]
  if (restos.length) {
    throw new Error(
      `${quien}: quedan ${restos.length} hook(s) Django sin resolver — ${restos.join(', ')}. ` +
        'Resuélvelos en el pintor: sin esto viajarían al DOM como texto de plantilla.'
    )
  }
  return html
}
