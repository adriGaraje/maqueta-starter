import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import htmlInject from 'vite-plugin-html-inject'

const r = (p) => resolve(import.meta.dirname, p)

export default defineConfig({
  // Source lives in /src; the project root points there so URLs stay clean.
  root: 'src',
  publicDir: '../public',
  base: './',

  plugins: [
    // Enables <load src="..."> HTML partial includes (HTML Inject).
    htmlInject(),
  ],

  resolve: {
    alias: {
      '@': r('src'),
      '@styles': r('src/styles'),
      '@components': r('src/components'),
      '@layouts': r('src/layouts'),
      '@scripts': r('src/scripts'),
      '@assets': r('src/assets'),
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        // Ruta de los .woff2 vista por Vite. Es relativa a `src/styles/main.scss`,
        // el punto de ENTRADA, no al parcial que declara el @font-face: Vite resuelve
        // los url() del CSS contra el fichero que compila, no contra el que los
        // escribió. Con la ruta del parcial la build no falla — solo avisa y deja el
        // url() tal cual, y la fuente da 404 en `dist/`. Ver settings/_typography.scss.
        additionalData: "$font-path: '../assets/fonts';\n",
        // Bootstrap 4.1.3 still uses legacy Sass APIs; silence its deprecation noise.
        quietDeps: true,
        silenceDeprecations: ['import', 'color-functions', 'global-builtin'],
      },
    },
  },

  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: r('src/index.html'),
      },
    },
  },

  server: {
    port: 5173,
    open: true,
  },
})
