// Story de ejemplo del patrón: el partial de verdad (`?raw`, con sus hooks
// intactos en la sintaxis del perfil de hand-off) + DATOS de ejemplo + `pinta()`,
// que los resuelve, + un `play` que comprueba lo que se ve. Cópiala junto con la
// carpeta y renómbrala.
import { expect, within } from 'storybook/test'
import html from './_template.html?raw'
import { pinta } from '../../stories/lib/hooks.js'
import { DATOS } from './datos-template.js'

// Desestructurar campo a campo: Storybook llama al render con `{}`, no con `undefined`.
const render = ({ title = DATOS.item.title, text = DATOS.item.text, tag = DATOS.item.tag } = {}) =>
  pinta(html, { item: { ...DATOS.item, title, text, tag } }, '_template.html')

export default {
  title: 'Basics/Template',
  tags: ['WIP'],
  render,
  args: { title: DATOS.item.title, text: DATOS.item.text, tag: DATOS.item.tag },
  argTypes: {
    title: { name: 'Title', control: 'text', description: 'Titular de la pieza.' },
    text: { name: 'Text', control: 'text', description: 'Entradilla.' },
    tag: { name: 'Tag', control: 'text', description: 'Etiqueta; vacía, no se pinta.' },
  },
}

export const Default = {
  play: async ({ canvasElement }) => {
    const lienzo = within(canvasElement)
    await expect(lienzo.getByText(DATOS.item.title)).toBeInTheDocument()
    await expect(lienzo.getByText(DATOS.item.features[1].label)).toBeInTheDocument()
  },
}
