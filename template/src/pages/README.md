# Pages

Páginas completas del sitio. Cada página compone **layouts** (cabecera/pie) y **módulos**, y en
el hand-off se convierte en una plantilla del CMS.

## Convención — una carpeta por página

```
src/
└── pages/
    └── <page>/                    # una carpeta por página, en kebab-case como su URL
        └── <page>.stories.js      # la página: compone sus módulos y monta la cabecera
```

- Lo que se reutiliza entre páginas va en `components/`, `modules/` o `layouts/`, no aquí.
- **Una página es una story, no un `.html`**: no tiene documento propio y **no se registra en
  `vite.config.js`** (añadir al `rollupOptions.input` algo sin `.html` rompe la build).

## El estándar de página — `npm run check:paginas`

El gate (`scripts/paginas-check.mjs`) exige a cada `src/pages/*/*.stories.js`:

1. Monta la cabecera con `cabeceraDePagina()` y la comprueba en su `play` con `compruebaCabecera()`.
2. Pone las marcas `<!-- INICIO SNIPPET Nombre -->` / `<!-- FIN SNIPPET Nombre -->` con
   `marcaSnippets(raiz)` y las comprueba con `compruebaSnippets()`: localizan cada pieza al copiar
   una página entera y son los únicos comentarios que llegan al código publicado.
3. Su primer módulo le deja sitio a la cabecera: suma `--starterslug-header-space` a su aire de
   arriba, o está en `SIN_HUECO` con el motivo medido.

Los helpers están en esta carpeta como esqueletos: `cabecera-de-pagina.js` monta un `<header>`
mínimo (sustitúyelo por la cabecera real, conservando la API y `data-module="site-header"`) y
`marca-snippets.js` trae `SNIPPETS` vacío: cada pieza que vaya en una página se registra ahí.
