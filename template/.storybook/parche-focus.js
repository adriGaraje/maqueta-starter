// El getter de `focus` de Storybook, hecho a prueba de balas.
// ---------------------------------------------------------------------------
// EL FALLO. Al abrir algunas fichas de Docs la pieza no se pinta y sale la caja
// roja de Storybook («The component failed to render properly, likely due to a
// configuration issue»). No hay nada mal configurado: el mensaje despista.
//
//     TypeError: Illegal invocation
//         at HTMLElement.get [as focus]  (assets/iframe-*.js)
//         at wl                          (assets/blocks-*.js)
//
// LA CAUSA. Las anotaciones core del preview reemplazan `focus` por un getter en
// `HTMLElement.prototype`, para poder saber a qué se le ha dado el foco durante
// un `play`. El getter, tal cual sale en el bundle:
//
//     Object.defineProperties(HTMLElement.prototype, {
//       focus: { get() { return this.ownerDocument?.defaultView ? … : noop } }
//     })
//
// Lee `this.ownerDocument` **sin protegerlo**. `ownerDocument` es un accesor
// nativo, así que con un `this` que no sea un nodo del DOM —el propio prototipo,
// por ejemplo, que es lo que hace cualquier código que compruebe
// `HTMLElement.prototype.focus`— lanza `Illegal invocation`. El `?.` protege de
// que `ownerDocument` sea null, no de que su lectura reviente.
//
// DÓNDE ESTÁ Y DÓNDE NO. El parche va en el bundle SIEMPRE (es del core, aparece
// junto a `composedWithCoreAnnotations`) pero se **instala** en un loader, y los
// loaders solo corren al renderizar una story. Por eso las únicas tres fichas de
// la entrega que se salvan son las tres `.mdx` sueltas —Welcome, Getting Started
// y Release Notes—, que no montan ninguna. Medido con
// `scripts/focus-getter-probe.mjs`: 42 fichas con el parche, 3 con el nativo.
//
// Y por eso esto es un LOADER y no un decorator ni un `beforeAll`: los loaders del
// preview se concatenan **después** de los del core, así que cuando este corre el
// parche ya está puesto y se puede envolver. Es el único punto del ciclo donde el
// orden está garantizado; con un decorator habría que sondear con un temporizador
// y volveríamos a depender de una carrera.
//
// QUÉ HACE. Sustituye el getter por uno que intenta el original y, si lanza,
// devuelve el `focus` nativo. No cambia ni un caso que hoy funcione: el único
// comportamiento que se altera es el que reventaba. Verificado con la sonda —
// 42 fichas vulnerables antes, 0 después, con el parche del core todavía puesto
// en las 42, y el `play` de `tabs` sigue moviendo el foco igual que antes.
//
// SE PUEDE QUITAR cuando Storybook proteja esa lectura. Mientras siga así, el
// gate de `focus-getter-probe.mjs` avisa si vuelve a poder lanzar.

// El `focus` de verdad. Se captura al cargar el módulo, que es cuando se evalúa
// `preview.js` — antes de que corra ningún loader, así que aquí todavía suele ser
// el nativo. Se lee del DESCRIPTOR y no como `HTMLElement.prototype.focus`: si el
// parche ya estuviera puesto, esa lectura es justo la que revienta.
//
// No vale `Element.prototype.focus`: `focus()` no vive en `Element`, sino en el
// mixin `HTMLOrSVGElement`, así que ahí es `undefined`.
const FOCUS_INICIAL = (() => {
  try {
    const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'focus')
    return d && typeof d.value === 'function' ? d.value : undefined
  } catch {
    return undefined
  }
})()

let yaEnvuelto = false

// Qué devolver cuando el getter original revienta. Lo que lee `.focus` sobre el
// prototipo casi siempre está comprobando que exista (`typeof x.focus`), así que
// lo que importa es devolver una función y no explotar.
//
//   1. el nativo capturado al cargar el módulo, si lo hubo;
//   2. si no, se le pregunta al propio getter del core con un elemento de verdad
//      —ahí sí funciona— y lo que devuelva es el nativo que él guardó;
//   3. y como último recurso, una función que no hace nada, que es justo lo que
//      el getter del core devuelve para un elemento sin `defaultView`.
function focusNativo(getterOriginal) {
  if (typeof FOCUS_INICIAL === 'function') return FOCUS_INICIAL
  try {
    const f = getterOriginal.call(document.createElement('div'))
    if (typeof f === 'function') return f
  } catch {
    /* se cae al recurso de abajo */
  }
  return function () {}
}

export function blindaFocus() {
  if (yaEnvuelto || typeof HTMLElement === 'undefined') return { envuelto: false, motivo: 'n/a' }

  const proto = HTMLElement.prototype
  const d = Object.getOwnPropertyDescriptor(proto, 'focus')

  // Sin parche no hay nada que blindar: `focus` es una función normal y leerlo
  // nunca lanza. Pasa en las fichas que no montan ninguna story, y pasaría si
  // Storybook dejara de parchearlo.
  if (!d || typeof d.get !== 'function') return { envuelto: false, motivo: 'sin-parche' }
  if (d.get.__starterslugBlindado) return { envuelto: false, motivo: 'ya-estaba' }

  const getterOriginal = d.get

  // Se intenta el getter original y se atrapa lo que lance. NO se comprueba antes
  // si `this` es un nodo, y eso es lo importante:
  //
  //   la primera versión de esto preguntaba `typeof this.nodeType === 'number'`…
  //   y `nodeType` es OTRO accesor nativo, así que leerlo sobre el prototipo lanza
  //   exactamente igual que `ownerDocument`. O sea que la guardia tenía el mismo
  //   fallo que venía a arreglar, y el blindaje reventaba solo. Se vio midiendo:
  //   el getter final era el nuestro en las 42 fichas y las 42 seguían lanzando.
  //
  // Cualquier comprobación previa sobre `this` tiene ese riesgo. Probar y atrapar
  // no lo tiene, y además cubre cualquier otro receptor raro que aparezca mañana.
  const getterSeguro = function () {
    try {
      return getterOriginal.call(this)
    } catch {
      return focusNativo(getterOriginal)
    }
  }
  getterSeguro.__starterslugBlindado = true

  try {
    Object.defineProperty(proto, 'focus', { ...d, get: getterSeguro })
    yaEnvuelto = true
    return { envuelto: true, motivo: 'ok' }
  } catch {
    // Si el descriptor no fuese configurable no se puede hacer nada, y tampoco
    // hay que romper el render por eso: el fallo original es intermitente y
    // reventar aquí sería peor que dejarlo como estaba.
    return { envuelto: false, motivo: 'no-configurable' }
  }
}

// El loader. Devuelve `{}` porque su valor no lo usa nadie: está aquí por el
// momento en que corre, no por lo que produce.
export const loaderBlindaFocus = () => {
  const r = blindaFocus()
  // Rastro para `scripts/focus-getter-probe.mjs`: sin esto, un resultado malo no
  // distingue «el blindaje no funciona» de «el blindaje no se ha ejecutado».
  try {
    window.__STARTERSLUG_BLINDAJE = {
      ...(window.__STARTERSLUG_BLINDAJE ?? {}),
      veces: (window.__STARTERSLUG_BLINDAJE?.veces ?? 0) + 1,
      ultimo: r.motivo,
    }
  } catch {}
  return {}
}
