// Gate de páginas: el estándar que lleva TODA página, sin que nadie lo pida.
// ---------------------------------------------------------------------------
// Desde el 10-09 cada página (`src/pages/*/*.stories.js`) cumple cuatro cosas, y
// las cuatro se habían escapado alguna vez el mismo día en que se estrenaron:
//
//   1. Monta la cabecera con submenú de sección —`cabeceraDePagina()`— y la
//      comprueba en su `play` con `compruebaCabecera()`. Tarifas Móvil importaba
//      la comprobación y no la llamaba, y nadie lo vio.
//   2. Pone las marcas «INICIO/FIN SNIPPET» —`marcaSnippets()`— y las comprueba
//      con `compruebaSnippets()`. Las pidió el cliente para localizar cada pieza al copiar.
//   3. No vuelve a montar la banda `Snippets/Submenu`: la sustituye la cabecera.
//   4. Su primer módulo le deja sitio a la barra, que flota dentro de su card. Un
//      hero de sección que no sume `--starterslug-header-space` a su aire de arriba acaba
//      con el titular debajo de la barra (en móvil, la primera línea tapada).
//
// Es ESTÁTICO a propósito: lee los ficheros y no arranca nada, así que tarda un
// segundo y puede ir en los gates de siempre. Lo que solo se ve pintado —que la
// marca lleve el nombre de una pieza que existe, que sobreviva a la limpieza—
// lo comprueban los `play` con `npm run check:plays`.
//
// Las landings NO van aquí: son campañas, no rutas del sitio, y no llevan cabecera.

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PAGINAS = join(RAIZ, 'src', 'pages')

// Heroes que abren página y NO necesitan el hueco, con el porqué medido. Un hero
// nuevo no entra aquí por defecto: o suma `--starterslug-header-space`, o se mide y se
// añade con su motivo.
//
// ⚠️ ESTO ES POR MÓDULO, NO POR BREAKPOINT, y desde el 17-09 hay un caso que sí
// lo es: `page-hero` no necesita el hueco a 1440 y SÍ a 390, porque el nodo
// deja 119 de aire en uno y 45,5 en el otro contra una barra de 80 y 72. Para no
// perder la comprobación en la mitad donde sigue haciendo falta, un valor puede
// ser una cadena —no lo necesita en ningún ancho— o `{ motivo, tambienMovil }`,
// que además EXIGE que el SCSS siga leyendo `--starterslug-header-space`. El motivo se
// escribe entero en los dos casos: es lo que se lee en el parte.
// Ejemplo: `hero: 'su titular ya arranca por debajo de la barra (medido: …)'`.
const SIN_HUECO = {}

// El motivo, venga como cadena o como objeto.
const motivoDe = (v) => (typeof v === 'string' ? v : v.motivo)

const ficheros = readdirSync(PAGINAS, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => join(PAGINAS, d.name, `${d.name}.stories.js`))
  .filter(existsSync)

const rel = (f) => relative(RAIZ, f).replace(/\\/g, '/')

// El primer módulo de la página: la primera llamada a un pintor dentro de la
// lista de secciones, saltando la cabecera. Se busca de dónde se importa ese
// pintor y de ahí sale la carpeta del módulo.
const primerModulo = (src) => {
  const lista = src.match(/const (?:secciones|home|pagina)\s*=[^[]*\[([\s\S]*?)\n\]/)
  if (!lista) return null
  const llamada = [...lista[1].matchAll(/^\s*(\w+)\(/gm)]
    .map((m) => m[1])
    .find((f) => f !== 'cabeceraDePagina')
  if (!llamada) return null
  const imp = [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'([^']+)'/g)].find((m) =>
    m[1].split(',').some(
      (s) =>
        s
          .trim()
          .split(/\s+as\s+/)
          .pop() === llamada
    )
  )
  if (!imp) return null
  const m = imp[2].match(/modules\/([a-z0-9-]+)\//)
  return m ? m[1] : null
}

let fallos = 0
for (const f of ficheros) {
  const src = readFileSync(f, 'utf8')
  const problemas = []
  const exige = (cond, texto) => cond || problemas.push(texto)

  exige(/\bcabeceraDePagina\(/.test(src), 'no monta la cabecera: falta `cabeceraDePagina()`')
  exige(/await compruebaCabecera\(/.test(src), 'su `play` no llama a `compruebaCabecera()`')
  exige(
    /\bmarcaSnippets\(raiz\)/.test(src),
    'no pone las marcas de snippet: falta `marcaSnippets(raiz)`'
  )
  exige(/await compruebaSnippets\(/.test(src), 'su `play` no llama a `compruebaSnippets()`')
  exige(
    !/modules\/submenu\/datos-submenu\.js/.test(src),
    'vuelve a montar la banda `Snippets/Submenu`: la sustituye la cabecera'
  )

  const modulo = primerModulo(src)
  const exento = modulo ? SIN_HUECO[modulo] : null
  if (!modulo) {
    problemas.push('no encuentro su primer módulo en la lista de secciones')
  } else if (!exento || exento.tambienMovil) {
    const scss = join(RAIZ, 'src', 'modules', modulo, `${modulo}.scss`)
    const leeElHueco =
      existsSync(scss) && readFileSync(scss, 'utf8').includes('--starterslug-header-space')
    exige(
      leeElHueco,
      exento
        ? `abre con \`${modulo}\`, que a 1440 no necesita el hueco pero en móvil sí, y ya no lee \`--starterslug-header-space\`: la barra le tapará la primera línea`
        : `abre con \`${modulo}\`, que no suma \`--starterslug-header-space\` a su aire de arriba: la barra le pisará el titular`
    )
  }

  if (problemas.length) {
    fallos += 1
    console.log(`  ✖ ${rel(f)}`)
    for (const p of problemas) console.log(`      ${p}`)
  } else {
    const nota = exento ? ` (abre con ${modulo}: ${motivoDe(exento)})` : ` (abre con ${modulo})`
    console.log(`  ✔ ${rel(f)}${nota}`)
  }
}

console.log(
  fallos
    ? `\n  ✖ ${fallos} de ${ficheros.length} páginas no cumplen el estándar. Ver src/pages/README.md.`
    : `\n  ✔ Las ${ficheros.length} páginas cumplen el estándar: cabecera, marcas de snippet y hueco en el hero.`
)
process.exit(fallos ? 1 : 0)
