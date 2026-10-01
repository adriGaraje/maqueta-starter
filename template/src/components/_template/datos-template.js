// Datos de ejemplo del _template: lo que el backend pondrá en los hooks de `item`.
// Con la forma que tendrán en la plantilla real, para que `pinta()` los resuelva
// tal cual (`item.title`, `item.features[].label`…).
export const DATOS = {
  item: {
    title: 'Titular de ejemplo',
    text: 'Entradilla de ejemplo para ver la pieza con contenido.',
    tag: 'Nuevo',
    features: [{ label: 'Primera ventaja' }, { label: 'Segunda ventaja' }],
  },
}
