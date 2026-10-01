import '../src/styles/main.scss'

// SOLO PARA STORYBOOK: el JS de Bootstrap 4 necesita jQuery, que en el sitio real
// pone la página. No entra en el JS global que se entrega.
import 'jquery'
import 'bootstrap'

import { limpiaFuente } from './limpia-fuente.js'
import { loaderBlindaFocus } from './parche-focus.js'

// Lo pone `main.js` según el comando: vacío en local, '1' en la build de entrega.
const ENTREGA = import.meta.env.STORYBOOK_STARTERSLUG_ENTREGA === '1'

const preview = {
  // Blinda el getter de `focus` de Storybook (ver parche-focus.js).
  loaders: [loaderBlindaFocus],

  tags: ['autodocs'],

  parameters: {
    // En la entrega se apagan los paneles que son herramienta nuestra. Controls y
    // Code se quedan: se toca un valor y se copia el módulo tal como ha quedado.
    ...(ENTREGA
      ? {
          actions: { disable: true },
          interactions: { disable: true },
          a11y: { disable: true },
          design: { disable: true },
        }
      : {}),

    docs: {
      source: { type: 'dynamic', language: 'html', transform: limpiaFuente },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      options: {
        xs: {
          name: 'xs · 375 (móvil)',
          styles: { width: '375px', height: '780px' },
          type: 'mobile',
        },
        sm: { name: 'sm · 576', styles: { width: '576px', height: '780px' }, type: 'mobile' },
        md: {
          name: 'md · 768 (tablet)',
          styles: { width: '768px', height: '1024px' },
          type: 'tablet',
        },
        lg: { name: 'lg · 992', styles: { width: '992px', height: '800px' }, type: 'desktop' },
        xl: { name: 'xl · 1200', styles: { width: '1200px', height: '900px' }, type: 'desktop' },
        xxl: { name: 'xxl · 1440', styles: { width: '1440px', height: '900px' }, type: 'desktop' },
      },
    },
    options: {
      storySort: {
        // En el orden en que se usan. Alfabéticamente no se leería; un nivel nuevo
        // se añade aquí o se cae al final.
        order: [
          'Welcome',
          'Release Notes',
          'Getting Started',
          'Design System',
          'Basics',
          'Snippets',
          'Layouts',
          'Pages',
        ],
      },
    },
  },
}

export default preview
