// Story de ejemplo del patrón: el partial de verdad (`?raw`, con sus hooks Django
// intactos) + DATOS de ejemplo + `pinta()` que rellena los hooks + un `play` que
// comprueba lo que se ve. Cópiala junto con la carpeta y renómbrala.
import { expect, within } from 'storybook/test'
import html from './_template.html?raw'
import { sinComentarios, mete, exigeResuelto } from '../../stories/lib/django.js'

// Datos de ejemplo: los que el backend pondrá en `{{ item.* }}`.
const DATOS = {
  title: 'Titular de ejemplo',
  text: 'Entradilla de ejemplo para ver la pieza con contenido.',
}

// Desestructurar campo a campo: Storybook llama al render con `{}`, no con `undefined`.
const pinta = ({ title = DATOS.title, text = DATOS.text } = {}) => {
  let salida = sinComentarios(html)
  salida = mete(salida, '{{ item.title }}', title)
  salida = mete(salida, '{{ item.text }}', text)
  return exigeResuelto(salida, '_template.html')
}

export default {
  title: 'Basics/Template',
  tags: ['WIP'],
  render: (args) => pinta(args),
  args: { ...DATOS },
  argTypes: {
    title: { name: 'Title', control: 'text', description: 'Titular de la pieza.' },
    text: { name: 'Text', control: 'text', description: 'Entradilla.' },
  },
}

export const Default = {
  play: async ({ canvasElement }) => {
    const lienzo = within(canvasElement)
    await expect(lienzo.getByText(DATOS.title)).toBeInTheDocument()
  },
}
