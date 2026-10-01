import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import remarkGfm from 'remark-gfm'

const AQUI = dirname(fileURLToPath(import.meta.url))
// Con `auth/` en el repo, el manager y el preview cargan la puerta (ver auth/guard.js).
const CON_PUERTA = existsSync(resolve(AQUI, '../auth/guard.js'))
const PUERTA = CON_PUERTA ? '\n<script type="module" src="/guard.js"></script>' : ''

// Una sola configuración, dos modos:
//
//   npm run storybook        → LOCAL. Todo menos lo suspendido.
//   npm run build-storybook  → ENTREGA. `production` y `WIP` (esta, rotulada).
//
// El interruptor es la etiqueta de cada story (`tags: ['production' | 'WIP' |
// 'suspended']`), que vive al lado del componente: nada de allowlists en otro
// fichero, que se olvidan. `check:stories` compila todo sin publicar (ver
// scripts/storybook-check.mjs).
const LOCAL = process.argv.includes('dev') || process.env.STARTERSLUG_STORYBOOK_TODO === '1'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const SRC = join(RAIZ, 'src')

const listar = (dir) =>
  readdirSync(dir).flatMap((entrada) => {
    const ruta = join(dir, entrada)
    return statSync(ruta).isDirectory() ? listar(ruta) : [ruta]
  })

// Título y etiqueta de cada story, leídos UNA vez: deciden qué se publica y
// alimentan el estado que pintan la barra lateral y Release Notes.
function leerPiezas() {
  return listar(SRC)
    .filter((f) => f.endsWith('.stories.js'))
    .map((f) => {
      const src = readFileSync(f, 'utf8')
      const etiqueta = src.match(/tags:\s*\[([^\]]*)\]/)
      // `(?<![\w$])` para que `title:` no case dentro de otra clave (`help_title:`).
      // Mismo regex en scripts/estado-entrega.mjs: las dos lecturas tienen que coincidir.
      const titulo = src.match(/(?<![\w$])title:\s*'([^']+)'/)
      return {
        fichero: f,
        titulo: titulo?.[1] ?? null,
        etiqueta: etiqueta ? etiquetaDe(etiqueta[1]) : null,
      }
    })
}

// Manda la suspensión aunque la story conserve su `production` de antes.
function etiquetaDe(lista) {
  if (lista.includes("'suspended'")) return 'suspended'
  if (lista.includes("'production'")) return 'production'
  return 'WIP'
}

const PIEZAS = leerPiezas()

// title → etiqueta. Viaja al preview como variable de entorno: son cadenas y no
// arrastran el código (ni los comentarios internos) de las stories al bundle.
const INDICE_PIEZAS = Object.fromEntries(
  PIEZAS.filter((p) => p.titulo).map((p) => [p.titulo, p.etiqueta])
)

// Estado de entrega de cada pieza (nueva / modificada / estable / en curso). Lo
// calcula scripts/estado-entrega.mjs (grupo «entrega»). Si el fichero no está,
// se arranca sin iconos en vez de reventar.
function leerEstado() {
  try {
    return JSON.parse(readFileSync(join(RAIZ, 'public/entrega/estado.json'), 'utf8'))
  } catch {
    return null
  }
}

const ESTADO = leerEstado()

// Secciones de primer nivel, para plegarlas EN LA ENTREGA. Se deducen de los
// títulos: una lista a mano se queda vieja en cuanto aparece una sección nueva.
const saneaId = (s) =>
  s
    .toLowerCase()
    .replace(/[ ’–—―′¿'`~!@#$%^&*()_|+\-=?;:'",.<>{}[\]\\/]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

function raicesDelArbol() {
  return [
    ...new Set(
      PIEZAS.filter((p) => p.titulo?.includes('/')).map((p) => saneaId(p.titulo.split('/')[0]))
    ),
  ]
}

// Páginas .mdx sueltas de src/stories/: no documentan ninguna pieza y van siempre.
const SUELTAS = (f) => relative(join(SRC, 'stories'), f).split(/[\\/]/).length === 1

// Ficheros que van a la entrega. Guardarraíl: una story sin etiqueta rompe la
// build con su nombre, porque viajaría sin estado que enseñar.
function storiesDeEntrega() {
  const sinEtiqueta = PIEZAS.filter((p) => !p.etiqueta).map((p) => relative(RAIZ, p.fichero))
  if (sinEtiqueta.length) {
    throw new Error(
      `Storybook: ${sinEtiqueta.length} story sin etiqueta. Añade tags: ['production'], ['WIP'] o ['suspended'] a:\n  ` +
        sinEtiqueta.join('\n  ')
    )
  }

  const aprobadas = PIEZAS.filter((p) => p.etiqueta === 'production' || p.etiqueta === 'WIP').map(
    (p) => p.fichero
  )
  // Los .mdx de una pieza viajan con ella (se casan por nombre de fichero).
  const nombres = new Set(aprobadas.map((f) => basename(f, '.stories.js')))
  const mdx = listar(SRC).filter(
    (f) => f.endsWith('.mdx') && (nombres.has(basename(f, '.mdx')) || SUELTAS(f))
  )

  return [...aprobadas, ...mdx].map((f) =>
    relative(join(RAIZ, '.storybook'), f).replace(/\\/g, '/')
  )
}

// LOCAL: todo menos lo suspendido. Se calcula al arrancar: crear o renombrar una
// story pide reiniciar `npm run storybook` (editarla recarga en caliente).
function storiesLocales() {
  const suspendidas = new Set(
    PIEZAS.filter((p) => p.etiqueta === 'suspended').map((p) => basename(p.fichero, '.stories.js'))
  )
  const ficheros = listar(SRC).filter((f) => {
    if (f.endsWith('.stories.js')) return !suspendidas.has(basename(f, '.stories.js'))
    if (f.endsWith('.mdx')) return !suspendidas.has(basename(f, '.mdx'))
    return false
  })

  return ficheros.map((f) => relative(join(RAIZ, '.storybook'), f).replace(/\\/g, '/'))
}

const config = {
  stories: LOCAL ? storiesLocales() : storiesDeEntrega(),
  // En la entrega solo los addons que le sirven a quien la recibe.
  addons: [
    '@storybook/addon-links',
    ...(LOCAL ? ['@storybook/addon-a11y', '@storybook/addon-designs'] : []),
    '@storybook/addon-docs',
  ],
  // Tablas GFM en los .mdx. Va en `options` de la raíz y NO en el addon: con el
  // builder de Vite, colgarlo del addon no llega y las tablas salen crudas.
  options: {
    mdxPluginOptions: {
      mdxCompileOptions: {
        remarkPlugins: [remarkGfm],
      },
    },
  },
  env: (config) => ({
    ...config,
    STORYBOOK_STARTERSLUG_ENTREGA: LOCAL ? '' : '1',
    STORYBOOK_STARTERSLUG_PIEZAS: JSON.stringify(INDICE_PIEZAS),
    STORYBOOK_STARTERSLUG_ESTADO: JSON.stringify(ESTADO ?? null),
    STORYBOOK_STARTERSLUG_DESTINO: process.env.STARTERSLUG_DESTINO ?? '',
  }),
  // La puerta de acceso (grupo `auth` del exportador) vive en `auth/` y se sirve
  // en la raíz: `/guard.js`, `/login/`. Si la carpeta no existe, no hay puerta.
  staticDirs: ['../public', ...(CON_PUERTA ? ['../auth'] : [])],
  // El estado va INLINE: `renderLabel` (manager.jsx) es síncrono y un fetch llegaría tarde.
  managerHead: (head) =>
    `${head}\n<script>window.STARTERSLUG_ESTADO = JSON.parse(${JSON.stringify(
      JSON.stringify(ESTADO ?? null)
    )})\nwindow.STARTERSLUG_RAICES_PLEGADAS = JSON.parse(${JSON.stringify(
      JSON.stringify(LOCAL ? [] : raicesDelArbol())
    )})
window.STARTERSLUG_DESTINO = ${JSON.stringify(process.env.STARTERSLUG_DESTINO ?? '')}</script>${PUERTA}`,
  previewHead: (head) => `${head}${PUERTA}`,
  framework: {
    name: '@storybook/html-vite',
    options: {},
  },
  core: {
    disableTelemetry: true,
  },
  viteFinal: async (cfg) => {
    cfg.css = cfg.css || {}
    cfg.css.preprocessorOptions = {
      ...(cfg.css.preprocessorOptions || {}),
      scss: {
        api: 'modern-compiler',
        // Ruta de los .woff2 relativa a `src/styles/main.scss`, el punto de entrada.
        additionalData: "$font-path: '../assets/fonts';\n",
        quietDeps: true,
        silenceDeprecations: ['import', 'color-functions', 'global-builtin'],
      },
    }

    // EN LA ENTREGA, LOS `play` NO CORREN. Un `play` es NUESTRO test: publicado,
    // el cliente vería la pieza como la deja el test y no en su estado por defecto.
    // Apagar `interactions` solo esconde el informe; lo que vale es renombrar la
    // clave para que Storybook no la encuentre. En local no se toca nada.
    if (!LOCAL) {
      cfg.plugins = cfg.plugins || []
      cfg.plugins.push({
        name: 'starterslug-sin-play-en-entrega',
        enforce: 'pre',
        transform(code, id) {
          if (!id.replace(/\\/g, '/').includes('/src/')) return null
          if (!id.split('?')[0].endsWith('.stories.js')) return null

          // Formas soportadas: `play: async (…)` y `Story.play = async (…)`.
          const CLAVE = /(^|[^\w$.])play(\s*:\s*async\b)/gm
          const PROP = /(\.)play(\s*=\s*async\b)/g

          const limpio = code
            .replace(CLAVE, '$1playApagadoEnEntrega$2')
            .replace(PROP, '$1playApagadoEnEntrega$2')

          // Guardarraíl: no puede quedar ninguna clave `play` viva.
          const vivos = limpio.match(/(^|[^\w$.])play\s*[:=]/gm) ?? []
          if (vivos.length) {
            throw new Error(
              `main.js: ${vivos.length} \`play\` sin apagar en ${relative(RAIZ, id)}. ` +
                'Formas soportadas: `play: async (…)` y `Story.play = async (…)`.'
            )
          }
          return { code: limpio, map: null }
        },
      })
    }

    return cfg
  },
}

export default config
