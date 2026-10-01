// Genera lo que el cliente se lleva del Storybook:
//
//   public/entrega/starterslug-global.css        ← la capa global + los átomos del Design System
//   public/entrega/starterslug-global.js         ← Bootstrap + los scripts de cualquier página
//   public/entrega/fonts/*.woff2        ← On Air, que starterslug-global.css pide como `fonts/…`
//   public/entrega/snippets/<x>.css     ← el CSS de cada snippet, ya resuelto y SIN minificar
//   public/entrega/snippets/<x>.js      ← el JS de los snippets que lo tienen
//
// Por qué existe y no están escritos a mano: si se copian a mano, envejecen en
// cuanto alguien toca un token, y nadie se entera hasta que el cliente pega algo
// que ya no es lo que pinta el Storybook. Se regenera antes de cada `storybook`,
// `build-storybook` y `build` (ver package.json).
//
// Nada de esto duplica listas que ya existan: las capas se leen de `main.scss` y
// las piezas de `styles/components/_index.scss`, que es el registro real de lo
// que se publica.

import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  statSync,
  existsSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Script } from 'node:vm'
import * as sass from 'sass'
import { build } from 'vite'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const ESTILOS = join(RAIZ, 'src', 'styles')
const SALIDA = join(RAIZ, 'public', 'entrega')
const SALIDA_SNIPPETS = join(SALIDA, 'snippets')

// La capa que NO es global: la que viaja dentro de cada snippet.
const CAPA_COMPONENTES = 'components/index'

// Piezas de `_index.scss` que, pese a estar ahí, son GLOBALES: en el Storybook
// viven bajo «Design System», no bajo «Snippets» — son información transversal,
// no algo que se pegue. Sus estilos los usa medio sitio (el botón sale en el
// footer, en las cards y en el hero), así que repetirlos en cada snippet sería
// mandar el mismo CSS quince veces.
const DEL_GLOBAL = [] // piezas cuyo CSS va en el global (p. ej. 'button')

// Bootstrap entero emite CSS; sus variables y mixins, no. Para compilar un snippet
// suelto hacen falta los segundos (media-breakpoint-up y compañía) sin los primeros.
const BOOTSTRAP_SIN_CSS = "@import 'bootstrap/scss/variables';\n@import 'bootstrap/scss/mixins';"

const kb = (n) => `${(n / 1024).toFixed(1)} KB`

// Sass arrastra el BOM del fichero de origen (Bootstrap lo trae) a la primera
// posición de su salida. Un BOM al principio del fichero el navegador lo ignora;
// en MEDIO —que es donde acaba en cuanto le antepones una cabecera— es un token
// inválido, y el parser se traga la primera regla entera intentando leerlo como
// selector. Se comió el `:root,[data-bs-theme=light]{…}` de Bootstrap, así que
// todo lo pegado heredaba negro en vez de #212529 — y mirando el fichero no se
// veía, porque la regla SÍ estaba escrita. Se quita siempre.
const sinBom = (s) => s.replace(/﻿/g, '')

// `compressed` por defecto porque es lo que quieren los DOS usos internos: el
// guardarraíl del prelude y el análisis de qué clase define cada pieza. Ese
// análisis lee el CSS con una expresión regular, y en `expanded` los comentarios
// sobreviven: un `/* la .tariff-card de arriba */` se contaría como una clase
// definida y torcería el cálculo de dependencias sin dar ningún error.
//
// Lo que SÍ sale `expanded` es el CSS de cada snippet — ver `cssSnippets`.
const compilar = (fuente, estilo = 'compressed') =>
  sinBom(
    sass.compileString(fuente, {
      loadPaths: [ESTILOS, join(RAIZ, 'node_modules')],
      style: estilo,
      quietDeps: true,
      silenceDeprecations: ['import', 'color-functions', 'global-builtin'],
    }).css
  )

// Regla 7 del CLAUDE.md: los comentarios no llegan al código publicado. En
// `compressed` los quitaba Sass de propina; en `expanded` sobreviven, así que hay
// que quitarlos aquí. El `/*!` de cabecera se antepone DESPUÉS, así que no lo toca.
const sinComentarios = (css) =>
  css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

// Lo mismo en JS, y aquí hay que ir con más cuidado: sin minificar, los
// comentarios sobreviven, pero quitarlos con una expresión regular es jugar con
// fuego —un `//` dentro de una cadena o de una plantilla multilínea no es un
// comentario—. Así que se quitan SOLO los que abren la línea, que son los únicos
// que se pueden distinguir sin parsear, y después se comprueba que lo que queda
// sigue siendo JavaScript válido. Si el corte rompiese algo, se publica el
// original entero antes que un fichero roto, y se dice por consola.
const sinComentariosJs = (js, nombre) => {
  const podado = js
    .replace(/^[ \t]*\/\/.*$\n?/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  try {
    new Script(podado)
    return podado
  } catch (e) {
    console.warn(
      `entrega · ${nombre}.js: quitar los comentarios lo dejaba inválido (${e.message}). ` +
        'Se publica con ellos. Mira si hay un `//` al principio de línea dentro de una plantilla.'
    )
    return js.trim()
  }
}

const barras = (p) => p.replace(/\\/g, '/')

// --- el registro de piezas -------------------------------------------------

function entradas() {
  const indice = readFileSync(join(ESTILOS, 'components', '_index.scss'), 'utf8')
  return [...indice.matchAll(/@import\s+'([^']+)'/g)].map((m) => {
    const nombre = basename(m[1])
    const scss = resolve(join(ESTILOS, 'components'), m[1])
    // El HTML hermano declara qué compone la pieza. `_button.scss` y compañía no
    // tienen: son estilos sin marcado propio.
    const html = join(dirname(scss), `${nombre}.html`)
    return { nombre, scss: barras(scss), html: existsSync(html) ? html : null }
  })
}

function prelude() {
  const lineas = readFileSync(join(ESTILOS, 'main.scss'), 'utf8').split('\n')
  const corte = lineas.findIndex((l) => l.includes("bootstrap/scss/bootstrap'"))
  if (corte === -1) {
    throw new Error(
      'build-entrega: no encontré el @import de Bootstrap en main.scss. Sin él no sé ' +
        'dónde acaba la capa de definiciones y empieza la que emite CSS.'
    )
  }
  const p = [...lineas.slice(0, corte), BOOTSTRAP_SIN_CSS].join('\n')

  // Guardarraíl: el prelude tiene que ser MUDO. Si alguien mete una regla en
  // settings/ o tools/, se colaría en los 18 ficheros de snippet a la vez y nadie
  // lo vería: el CSS seguiría siendo válido, solo que repetido en cada Snippet.
  const ruido = compilar(p)
  if (ruido.trim()) {
    throw new Error(
      `build-entrega: el prelude emite ${ruido.length} caracteres de CSS y debería emitir cero.\n` +
        `Alguna capa de settings/ o tools/ ha dejado de ser solo definiciones. Empieza por:\n  ` +
        ruido.slice(0, 200)
    )
  }
  return p
}

// --- quién necesita a quién ------------------------------------------------

const clasesQueDefine = (css) =>
  new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]))

const clasesQueUsa = (html) =>
  new Set(
    [...html.matchAll(/class="([^"]*)"/g)]
      .flatMap((m) => m[1].split(/\s+/))
      // Los hooks del backend dentro de un class="" no son clases (cualquier perfil).
      .filter((c) => c && !/[{}%<>$@?]/.test(c))
  )

// Las piezas que un HTML compone, por las dos vías en que puede declararlo:
//
//   1. `{% include "components/promo-card.html" %}` — la composición explícita de
//      Django. Es la buena: el módulo Promos no lleva ni una clase de la card en
//      su propio HTML, así que por clases no se veía.
//   2. Las clases que usa y define otra pieza — para lo que se compone sin
//      include, como la línea de tarifa dentro de la card.
const compuestasPor = (html, candidatas, defs) => {
  const incluidas = [...html.matchAll(/\{%\s*include\s+"([^"]+)"/g)].map((m) =>
    basename(m[1], '.html')
  )
  const usadas = clasesQueUsa(html)
  return candidatas.filter(
    (c) => incluidas.includes(c.nombre) || [...defs.get(c.nombre)].some((cl) => usadas.has(cl))
  )
}

// Un snippet tiene que llevar el CSS de las piezas que pinta: si el footer trae su
// CTA, el CSS del footer solo no basta — el botón saldría con el aspecto de
// Bootstrap. Se deduce del propio marcado, así que se mantiene solo: si mañana el
// hero mete una card, entra sin que nadie tenga que acordarse.
function dependencias(pieza, candidatas, defs) {
  if (!pieza.html) return []
  const dentro = new Set()
  const cola = [pieza]

  while (cola.length) {
    const actual = cola.pop()
    if (!actual.html) continue
    for (const c of compuestasPor(readFileSync(actual.html, 'utf8'), candidatas, defs)) {
      if (c.nombre === pieza.nombre || dentro.has(c.nombre)) continue
      dentro.add(c.nombre)
      cola.push(c)
    }
  }

  return candidatas.filter((c) => dentro.has(c.nombre))
}

// --- las tres salidas ------------------------------------------------------

function cssGlobal(piezas, pre) {
  const lineas = readFileSync(join(ESTILOS, 'main.scss'), 'utf8').split('\n')
  const global = lineas.filter((l) => !l.includes(CAPA_COMPONENTES))
  if (global.length === lineas.length) {
    throw new Error(
      `build-entrega: no encontré la línea de '${CAPA_COMPONENTES}' en main.scss. Sin ella ` +
        'el CSS global saldría con el de todos los componentes dentro.'
    )
  }

  // Los átomos del Design System se cuelan al final, después de las capas: son
  // componentes, y en main.scss irían justo ahí.
  const atomos = piezas
    .filter((p) => DEL_GLOBAL.includes(p.nombre))
    .map((p) => `@import '${p.scss}';`)

  if (atomos.length !== DEL_GLOBAL.length) {
    const faltan = DEL_GLOBAL.filter((n) => !piezas.some((p) => p.nombre === n))
    throw new Error(
      `build-entrega: DEL_GLOBAL nombra piezas que ya no están en _index.scss: ${faltan.join(', ')}. ` +
        'Si se han renombrado o borrado, actualiza la lista — si no, su CSS no viaja en ningún sitio.'
    )
  }

  const css = compilar([...global, ...atomos].join('\n'))
  const cabecera =
    '/*! Starternombre · CSS global — generado por scripts/build-entrega.mjs, no editar a mano.\n' +
    '    Va UNA SOLA VEZ en la plantilla base del sitio, antes del CSS de los snippets.\n' +
    '    Contiene: Bootstrap 4.1.3, tokens de marca, tipografía, resets, utilidades,\n' +
    '    y los átomos del Design System (botones e iconos), que usa medio sitio.\n' +
    '    NO contiene el CSS de cada snippet: ese va con su snippet. */\n'

  mkdirSync(SALIDA, { recursive: true })
  writeFileSync(join(SALIDA, 'starterslug-global.css'), cabecera + css)
  return cabecera.length + css.length
}

async function jsGlobal() {
  await build({
    configFile: false,
    logLevel: 'error',
    // Sin esto Vite copia `public/` entero dentro de outDir — y como outDir ES
    // `public/entrega/`, el favicon acababa dentro de la carpeta de entrega.
    publicDir: false,
    build: {
      outDir: SALIDA,
      emptyOutDir: false,
      lib: {
        entry: join(RAIZ, 'src', 'scripts', 'globals.js'),
        name: 'StarterslugGlobal',
        formats: ['iife'],
        fileName: () => 'starterslug-global.js',
      },
    },
  })

  const ruta = join(SALIDA, 'starterslug-global.js')
  const cabecera =
    '/*! Starternombre · JS global — generado por scripts/build-entrega.mjs, no editar a mano.\n' +
    '    Va UNA SOLA VEZ en la plantilla base, al final del <body>.\n' +
    '    Contiene: solo los scripts propios que necesita cualquier página.\n' +
    '    NO contiene Bootstrap: su JS (con jQuery y Popper) lo pone la página, antes que este.\n' +
    '    El JS de cada snippet, si lo tiene, va aparte. */\n'
  writeFileSync(ruta, cabecera + readFileSync(ruta, 'utf8'))
  return statSync(ruta).size
}

// El reparto global vs. por pieza NO se decide aquí: está declarado en `main.js`,
// bajo «POR PIEZA», que es donde lo escribe quien maqueta. Se lee de ahí por lo
// mismo que las capas se leen de `main.scss` y las piezas de `_index.scss` — una
// segunda lista se desincroniza y nadie se entera.
function piezasConJs() {
  const main = readFileSync(join(RAIZ, 'src', 'scripts', 'main.js'), 'utf8')
  const corte = main.indexOf('--- POR PIEZA')
  if (corte === -1) {
    throw new Error(
      'build-entrega: no encontré el bloque «POR PIEZA» en src/scripts/main.js. Es el registro ' +
        'de qué script viaja con qué snippet; sin él no sé cuáles emitir.'
    )
  }

  return [...main.slice(corte).matchAll(/import\s+'([^']+\.js)'/g)].map((m) => {
    const ruta = resolve(join(RAIZ, 'src', 'scripts'), m[1])
    return { nombre: basename(ruta, '.js'), entrada: ruta }
  })
}

async function jsSnippets() {
  const piezas = piezasConJs()
  mkdirSync(SALIDA_SNIPPETS, { recursive: true })
  const hechos = []

  for (const p of piezas) {
    await build({
      configFile: false,
      logLevel: 'error',
      publicDir: false,
      build: {
        outDir: SALIDA_SNIPPETS,
        emptyOutDir: false,
        // Sin minificar, por lo mismo que el CSS: esto se lee en la ficha del
        // snippet y se pega en el CMS. `starterslug-global.js` sí sigue minificado — ese
        // se enlaza con un <script src>, no lo lee nadie. (27-08.)
        minify: false,
        lib: {
          entry: p.entrada,
          name: `Starterslug${p.nombre.replace(/[^a-zA-Z0-9]/g, '')}`,
          formats: ['iife'],
          fileName: () => `${p.nombre}.js`,
        },
      },
    })

    // IIFE y no módulo: esto se pega en una página, no se importa. Así funciona
    // dentro de un <script> a secas, sin `type="module"`.
    const ruta = join(SALIDA_SNIPPETS, `${p.nombre}.js`)
    const cabecera =
      `/*! Starternombre · JS del snippet «${p.nombre}» — generado, no editar a mano.\n` +
      '    Va CON este snippet, al final del <body>. Solo hace falta si el snippet\n' +
      '    está en la página. Necesita que starterslug-global.js ya esté puesto. */\n'
    writeFileSync(ruta, cabecera + sinComentariosJs(readFileSync(ruta, 'utf8'), p.nombre) + '\n')
    hechos.push({ nombre: p.nombre, peso: statSync(ruta).size })
  }

  return hechos
}

function cssSnippets(piezas, pre) {
  const snippets = piezas.filter((p) => !DEL_GLOBAL.includes(p.nombre))
  const defs = new Map(
    snippets.map((p) => [p.nombre, clasesQueDefine(compilar(`${pre}\n@import '${p.scss}';`))])
  )

  mkdirSync(SALIDA_SNIPPETS, { recursive: true })
  const hechos = []

  for (const p of snippets) {
    const deps = dependencias(
      p,
      snippets.filter((c) => c.nombre !== p.nombre),
      defs
    )
    const imports = [...deps, p].map((x) => `@import '${x.scss}';`).join('\n')
    // `expanded`, no `compressed`: esto es lo que se lee en la pestaña CSS de la
    // ficha del snippet y lo que el cliente pega en el CMS. Minificado es ilegible, y una
    // pieza que nadie puede leer nadie la puede ajustar. Pesa más y da igual: no
    // es un asset que sirva el sitio, es código para copiar. El global sigue `compressed` — ese sí es un fichero que se enlaza.
    const css = sinComentarios(compilar(`${pre}\n${imports}`, 'expanded')) + '\n'

    const nota = deps.length
      ? `    Incluye el CSS de las piezas que compone: ${deps.map((d) => d.nombre).join(', ')}.\n`
      : ''
    const cabecera =
      `/*! Starternombre · CSS del snippet «${p.nombre}» — generado, no editar a mano.\n` +
      nota +
      '    Va CON este snippet. Necesita que starterslug-global.css ya esté puesto en la página. */\n'

    writeFileSync(join(SALIDA_SNIPPETS, `${p.nombre}.css`), cabecera + css)
    hechos.push({ nombre: p.nombre, deps: deps.length, peso: cabecera.length + css.length })
  }
  return hechos
}

// La tipografía de marca viaja con el CSS que la pide. `starterslug-global.css` la pide
// como `fonts/OnAir-*.woff2` —relativa al propio CSS, ver $font-path—, así que la
// carpeta tiene que ir al lado: si el cliente mueve el CSS, se lleva `fonts/` con él.
//
// Se copia y no se enlaza porque `public/entrega/` está en .gitignore: es salida
// generada, y la fuente de verdad son los ficheros de `src/assets/fonts/`.
//
// Si falta alguno, revienta. La alternativa —seguir y publicar un CSS que pide
// una fuente que no existe— es el fallo que no se ve: la página sale en Segoe y
// pasa los cuatro gates.
function fuentes() {
  const origen = join(RAIZ, 'src', 'assets', 'fonts')
  const destino = join(SALIDA, 'fonts')
  // La lista va clavada y tiene que seguir a `generic/_fonts.scss`: cada
  // `@font-face` de ahí necesita su fichero aquí. El Black entró el 09-09 con la
  // landing «Busco piso» — si se añade un peso al SCSS y no a esta
  // lista, el CSS pide una fuente que no viaja y el titular cae a Bold sin que
  // ningún gate lo vea.
  const ficheros = [
    // 'Brand-Regular.woff2',
  ]

  mkdirSync(destino, { recursive: true })
  let peso = 0
  for (const f of ficheros) {
    const src = join(origen, f)
    if (!existsSync(src)) {
      throw new Error(
        `build-entrega: falta ${f} en src/assets/fonts/. starterslug-global.css declara su @font-face, ` +
          'así que sin el fichero la entrega saldría en la tipografía de respaldo.'
      )
    }
    const datos = readFileSync(src)
    writeFileSync(join(destino, f), datos)
    peso += datos.length
  }
  return { n: ficheros.length, peso }
}

// --- ejecución -------------------------------------------------------------

const piezas = entradas()
const pre = prelude()

const pesoCss = cssGlobal(piezas, pre)
const pesoJs = await jsGlobal()
const tipos = fuentes()
const snippets = cssSnippets(piezas, pre)
const scripts = await jsSnippets()

console.log(`entrega · starterslug-global.css   ${kb(pesoCss)}`)
console.log(`entrega · starterslug-global.js    ${kb(pesoJs)}`)
console.log(
  `entrega · fonts/*.woff2   ${tipos.n} ficheros, ${kb(tipos.peso)} — On Air 300/400/700/900`
)
console.log(
  `entrega · snippets/*.css  ${snippets.length} ficheros, ${kb(snippets.reduce((t, s) => t + s.peso, 0))}`
)
for (const s of snippets.filter((s) => s.deps)) {
  console.log(`           ${s.nombre} arrastra ${s.deps} pieza(s) que compone`)
}
console.log(
  `entrega · snippets/*.js   ${scripts.length} ficheros, ${kb(scripts.reduce((t, s) => t + s.peso, 0))}` +
    ` — ${scripts.map((s) => s.nombre).join(', ')}`
)

// --- poda ------------------------------------------------------------------
// LO QUE YA NO SE GENERA, SE BORRA. Este script solo escribía, nunca quitaba, así
// que al RETIRAR una pieza su `.css` y su `.js` se quedaban en `public/entrega/`
// para siempre: la carpeta está en `.gitignore`, o sea que no se ve en ningún
// diff, y `staticDirs` los sigue copiando a la build. El resultado es que una
// pieza borrada del repo se seguía publicando en cada deploy hecho desde una
// máquina que la hubiese construido alguna vez.
//
// Se descubrió retirando el manifiesto: el generador ya no lo listaba y
// sus tres ficheros seguían ahí.
//
// Solo se tocan los `.css` y `.js` de `snippets/`, y solo los que este mismo
// script acaba de decidir que no le corresponden. Nada de vaciar la carpeta antes
// de generar: si la generación fallara a medias, la entrega se quedaría sin
// ficheros en vez de con uno de más.
const vivos = new Set([
  ...snippets.map((s) => `${s.nombre}.css`),
  ...scripts.map((s) => `${s.nombre}.js`),
])
const sobran = readdirSync(SALIDA_SNIPPETS).filter((f) => /\.(css|js)$/.test(f) && !vivos.has(f))
for (const f of sobran) rmSync(join(SALIDA_SNIPPETS, f))
if (sobran.length) {
  console.log(`entrega · podados        ${sobran.length}: ${sobran.join(', ')}`)
}
