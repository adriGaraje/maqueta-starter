// Lo que sale del panel «Code» es lo que se pega en el CMS. Tiene que ser
// el snippet y nada más.
//
// Por el camino se cuelan tres cosas que son NUESTRAS y no del snippet:
//
//  1. La caja donde monta la story. Muchas hacen `createElement('div')` + innerHTML
//     y devuelven la caja, así que el marcado sale envuelto en un `<div>` que no
//     existe en el partial.
//  2. Los envoltorios de previsualización: el degradado bajo la cabecera, el
//     simulador del contenedor de <sitio-del-cliente>. Estos son peores, porque llevan
//     estilos EN LÍNEA — un `max-width:1350px` pegado al marcado no hay forma de
//     corregirlo después desde la hoja de estilos. Se marcan con `data-starterslug-preview`.
//  3. Los comentarios del partial: medidas, nodos de Figma y preguntas abiertas.
//     Todos menos las marcas «INICIO/FIN SNIPPET» de las páginas, que son para el cliente.
//     Docs ya los filtra (`snippet-code.js`); este panel no los filtraba. Y los
//     `sinComentario` de los `datos-*.js` van sin la bandera `g`, así que solo
//     quitan el de cabecera: los de en medio del marcado llegaban enteros.
//
// Se hace con DOMParser y no a base de expresiones regulares porque desenvolver
// el elemento de fuera es una operación de árbol: con regex se rompe en cuanto
// hay un `</div>` anidado, que es siempre.
//
// Es idempotente a propósito. Se aplica en dos sitios —el panel y
// `docs.source.transform`— y pasar dos veces no puede estropear nada.

const esCajaDeMontaje = (el) => el.tagName === 'DIV' && el.attributes.length === 0

// El único hijo que cuenta. Un salto de línea entre etiquetas no es contenido.
const unicoHijo = (nodo) => {
  const hijos = [...nodo.childNodes].filter(
    (n) => n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim())
  )
  return hijos.length === 1 && hijos[0].nodeType === 1 ? hijos[0] : null
}

const desenvuelve = (el) => {
  const padre = el.parentNode
  while (el.firstChild) padre.insertBefore(el.firstChild, el)
  padre.removeChild(el)
}

// Al quitar un envoltorio, lo de dentro se queda con su sangría. Y donde había un
// comentario queda un hueco.
const asienta = (html) => {
  const lineas = html.replace(/[ \t]+$/gm, '').split('\n')
  const sangrias = lineas.filter((l) => l.trim()).map((l) => l.match(/^[ \t]*/)[0].length)
  const menor = sangrias.length ? Math.min(...sangrias) : 0

  return lineas
    .map((l) => l.slice(menor))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const limpiaFuente = (fuente) => {
  if (!fuente) return ''

  // Fuera del navegador no hay árbol que recorrer. Antes que devolver algo a
  // medias, devuelve lo que le dieron.
  if (typeof DOMParser === 'undefined') return fuente

  const doc = new DOMParser().parseFromString(fuente, 'text/html')
  const cuerpo = doc.body

  const paseo = doc.createTreeWalker(cuerpo, NodeFilter.SHOW_COMMENT)
  const comentarios = []
  while (paseo.nextNode()) comentarios.push(paseo.currentNode)

  comentarios.forEach((c) => {
    // LA ÚNICA EXCEPCIÓN: las marcas de snippet de las páginas. Las pidió el cliente para
    // ver dónde empieza y acaba cada pieza al copiar una página entera, así que son
    // de ellos y no nuestras. Ver `src/pages/marca-snippets.js`.
    if (/^\s*(INICIO|FIN) SNIPPET /.test(c.data)) return

    // Con el comentario se va el salto y la sangría que lo preceden. Si no, donde
    // estaba queda una línea en blanco, y una línea en blanco al principio de un
    // bloque se lee como un descuido de quien lo escribió.
    const antes = c.previousSibling
    if (
      antes &&
      antes.nodeType === 3 &&
      !antes.textContent.trim() &&
      antes.textContent.includes('\n')
    ) {
      antes.parentNode.removeChild(antes)
    }
    c.parentNode.removeChild(c)
  })

  // Estén donde estén: `sobreHero` envuelve por fuera, pero nada impide que un
  // día alguien marque algo por dentro.
  cuerpo.querySelectorAll('[data-starterslug-preview]').forEach(desenvuelve)

  // La caja de montaje, solo si es la raíz, es un `div` pelado y envuelve a UNA
  // pieza. Si envuelve a varias es una story de comparación —tres tamaños de
  // botón, dos estados— y ahí el envoltorio SÍ es parte de lo que se enseña.
  let raiz = unicoHijo(cuerpo)
  while (raiz && esCajaDeMontaje(raiz) && unicoHijo(raiz)) {
    desenvuelve(raiz)
    raiz = unicoHijo(cuerpo)
  }

  return asienta(cuerpo.innerHTML)
}
