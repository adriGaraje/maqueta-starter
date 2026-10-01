// Lo que se enseña en la pestaña de código de cada snippet.
//
// Los ficheros del repo llevan comentarios y tienen que seguir llevándolos: ahí
// está el porqué de cada medida, de dónde sale del Figma y qué quedó pendiente.
// Eso es documentación NUESTRA. Lo que se publica es otra cosa: quien abre el
// Storybook viene a copiar y pegar, y no tiene por qué leer notas internas ni
// referencias a tareas.
//
// Por eso no se borran del origen — se filtran aquí, al pintarlos.

// `//` solo cuando abre la línea: si no, se come el `//` de cualquier `https://`.
const LINEA = /^[ \t]*\/\/.*$\n?/gm
const BLOQUE = /\/\*[\s\S]*?\*\//g
const HTML = /<!--[\s\S]*?-->/g

// Tres o más saltos seguidos quedan feos donde antes había un comentario largo.
const compacta = (s) =>
  s
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

export const limpia = (codigo, lenguaje = 'html') => {
  let salida = codigo

  if (lenguaje === 'html') salida = salida.replace(HTML, '')
  if (lenguaje === 'css' || lenguaje === 'scss') salida = salida.replace(BLOQUE, '')
  if (lenguaje === 'js') salida = salida.replace(BLOQUE, '').replace(LINEA, '')
  if (lenguaje === 'scss') salida = salida.replace(LINEA, '')

  return compacta(salida)
}
