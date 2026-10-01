// Marcas «INICIO/FIN SNIPPET» alrededor de cada hijo del `<main>` de una página: localizan
// cada pieza al copiar la página entera y son los únicos comentarios que llegan al código
// publicado. SNIPPETS: primera clase de la pieza → su nombre en Storybook.
import { expect } from 'storybook/test'
import { limpiaFuente } from '../../.storybook/limpia-fuente.js'

export const SNIPPETS = {}

const piezasDe = (raiz) => [...(raiz.querySelector('main')?.children ?? [])]
const nombreDe = (pieza) => SNIPPETS[pieza.classList[0]]
const vecino = (nodo, lado) => {
  let n = nodo[lado]
  while (n && n.nodeType === Node.TEXT_NODE && !n.textContent.trim()) n = n[lado]
  return n
}
const esMarca = (nodo, tipo, nombre) =>
  nodo?.nodeType === Node.COMMENT_NODE && nodo.data.trim() === `${tipo} ${nombre}`

export const marcaSnippets = (raiz) => {
  for (const pieza of piezasDe(raiz)) {
    const nombre = nombreDe(pieza)
    if (!nombre || esMarca(vecino(pieza, 'previousSibling'), 'INICIO SNIPPET', nombre)) continue
    pieza.before('\n', document.createComment(` INICIO SNIPPET ${nombre} `), '\n')
    pieza.after('\n', document.createComment(` FIN SNIPPET ${nombre} `), '\n')
  }
  return raiz
}

export const compruebaSnippets = async (canvasElement) => {
  const raiz = canvasElement.querySelector('main')?.parentElement
  await expect(raiz).toBeTruthy()
  const piezas = piezasDe(raiz)
  for (const pieza of piezas) {
    const nombre = nombreDe(pieza)
    await expect(nombre, `«${pieza.classList[0]}» no está en SNIPPETS`).toBeTruthy()
    await expect(esMarca(vecino(pieza, 'previousSibling'), 'INICIO SNIPPET', nombre)).toBe(true)
    await expect(esMarca(vecino(pieza, 'nextSibling'), 'FIN SNIPPET', nombre)).toBe(true)
  }
  const publicado = limpiaFuente(raiz.outerHTML)
  await expect(publicado.match(/<!-- INICIO SNIPPET [^>]+-->/g) ?? []).toHaveLength(piezas.length)
}
