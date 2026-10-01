// Cabecera de página (esqueleto): la monta toda página, fuera del `<main>`. Sustitúyela
// por el `site-header` real del proyecto conservando la API y el `data-module`.
import { expect } from 'storybook/test'

export const cabeceraDePagina = ({ seccion = '', sub = '' } = {}) => `
<header class="site-header" data-module="site-header">
  <nav class="site-header__bar">${seccion ? `<a href="#" aria-current="page">${seccion}</a>` : ''}</nav>
  ${sub ? `<a class="site-header__sub-link" href="#" aria-current="page">${sub}</a>` : ''}
</header>`

export const compruebaCabecera = async (canvasElement, { seccion = '', sub = '' } = {}) => {
  const cabeceras = canvasElement.querySelectorAll('[data-module="site-header"]')
  await expect(cabeceras).toHaveLength(1)
  await expect(cabeceras[0].closest('main')).toBeNull()
  const marcada = cabeceras[0].querySelectorAll('.site-header__bar [aria-current="page"]')
  await expect(marcada).toHaveLength(seccion ? 1 : 0)
  const entrada = cabeceras[0].querySelectorAll('.site-header__sub-link[aria-current="page"]')
  await expect(entrada).toHaveLength(sub ? 1 : 0)
}
