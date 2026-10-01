# CLAUDE.md — Starternombre · Maqueta

> La biblia del proyecto. Léela antes de tocar nada. Menos de 120 líneas; el detalle vive en `docs/`.

## Qué es

La **maqueta** front-end de Starternombre: HTML por componentes con **Bootstrap 4.1.3** + JS ligero,
empaquetado con Vite y **entregado como plantillas para el CMS**. Nosotros hacemos el
marcado, los estilos y el JS; el backend conecta las piezas (`{{ vars }}`, `{% for %}`, `{% include %}`).

**Es nuestro:** HTML, SCSS, JS, assets, la librería de componentes, Storybook.
**No lo tocamos nunca:** modelos, vistas, migraciones ni lógica de backend.

## Reglas de oro

1. **No renombres ni borres un hook del backend.** `{{ item.title }}`, `{% for %}`, `{% endif %}`…
   se conservan exactos. Si no sabes de dónde sale una variable, pregunta.
2. **Bootstrap primero.** Clases, rejilla y utilidades de Bootstrap. La marca va en las variables
   SASS (`src/styles/settings/`). CSS propio solo cuando Bootstrap no llega.
3. **Clases:** las de Bootstrap; las pocas propias en **BEM** kebab-case (`.bloque__elemento--mod`).
4. **Estructura en inglés, prosa en español.** Inglés: clases, ficheros, carpetas, variables,
   títulos y nombres de story, labels y opciones de Controls. Español: comentarios, docs, `.mdx`
   y la `description` de Controls. El nombre de una story describe la variante, no cita su texto.
5. **Una carpeta = una pieza** (`html` + `scss`/`js` opcionales).
6. **Sin frameworks JS.** JS propio en vanilla.
7. **Los comentarios no llegan al bloque de código publicado** (`src/stories/snippet-code.js` los
   filtra). El mapeo de variables del backend sí: va en la cabecera como `{{ var }} → qué es`.
8. **Un snippet lleva su propio envoltorio**: se pega tal cual en el CMS, sin `<div>` de la
   página alrededor. Usa el mixin `wrap` en su SCSS.

## Estructura

```
src/
├── index.html      # entrada mínima de Vite
├── components/     # piezas reutilizables (carpeta cada una) → {% include %}
│   └── _template/  #   cópiala para empezar una pieza
├── modules/        # secciones de página ("snippets") → un snippet del CMS cada una
├── layouts/        # regiones del sitio (cabecera, pie)
├── pages/          # una carpeta por página: solo su story (ver pages/README.md)
├── styles/         # ITCSS + Bootstrap 4.1.3
├── scripts/        # main.js (GLOBAL / POR PIEZA) + globals.js
├── stories/        # utilidades de Storybook y páginas sueltas (.mdx)
└── assets/         # imágenes, fuentes, iconos
```

## Estilos — ITCSS + Bootstrap 4.1.3

`settings/` (tokens de Figma → alias → variables de Bootstrap) · `tools/` (mixins: `wrap`,
`text-style`) · Bootstrap · `generic/` · `elements/` · `components/` (`_index.scss` registra el
SCSS de cada pieza, append-only) · `trumps/`. **Figma es la fuente de verdad** de color y
tipografía: `settings/_tokens.scss` y `_typography.scss` (ver `docs/design-tokens.md`).
Responsive con la rejilla y `@include media-breakpoint-up(md)`.

## Storybook

**Es el entregable**: lo que se publica es lo que recibe el cliente. Niveles, de menor a mayor:

| Nivel       | Qué entra                                                  |
| ----------- | ---------------------------------------------------------- |
| `Basics/`   | piezas base, de la indivisible a la que compone varias     |
| `Snippets/` | una sección entera de página: lo que se pega en el CMS |
| `Layouts/`  | regiones del sitio                                         |
| `Pages/`    | cómo encajan las piezas en cada ruta del sitio             |

El nombre es el del fichero en Title Case (`tariff-card` → `Tariff Card`). El orden de las secciones
está en `.storybook/preview.js`. **Cada story declara `tags: ['production' | 'WIP' | 'suspended']`**:
la build de entrega falla si falta. `production` y `WIP` (rotulada) se publican; `suspended` no se
ve en ningún sitio. El estado nunca va en el `title`: de ahí salen el id y la URL.

Una pieza no está terminada sin su `<name>.mdx` (HTML/SCSS en bloques `?raw` + tabla de variables).
Nada de datos inventados en el design system: stories solo de piezas y datos reales.
Patrón de story: `src/components/_template/_template.stories.js`.

## Hand-off al backend

- Comentario de mapeo en cada pieza: `{{ item.title }} → .card__title`.
- Un listado en la maqueta repite unos pocos ítems; la página real hace el bucle con `{% for %}`.

## Forma de trabajar

- **Tareas** en Jira, espejo local en `tasks/` (ver `docs/jira-workflow.md`). Coge la tarea antes
  de tocar código; nunca trabajes una tarea `En curso` de otra persona.
- **Una tarea = una rama = un PR.** Rama `<tipo>/STARTERSLUG-###-<slug>` desde `develop`; PR contra
  `develop`; `main` solo recibe entregas. Commits `tipo(scope): resumen [STARTERSLUG-###]`. Squash.
- **Verde antes del PR:** `npm run build`, `npm run lint:css`, `npm run format:check`.
- **Hotspots compartidos** (`_index.scss`, `main.js`): append-only; en conflicto, las dos líneas.

## El harness

La skill `.claude/skills/starterslug-flow/` lleva el ritual diario (arranque, bucle de maquetación,
cierre); el agente `starterslug-analyst` (el Ojo) extrae la spec de Figma y verifica pixel-perfect.
Configuración en `docs/starterslug-harness/config.json`; memoria en `state.json` y `modules.json`.
Presupuesto de tokens: ver README.

## Comandos

| Comando                       | Para qué                                    |
| ----------------------------- | ------------------------------------------- |
| `npm run dev`                 | Vite + HMR                                  |
| `npm run build`               | build a `dist/` (confirma que todo compila) |
| `npm run storybook`           | Storybook local (todo menos lo suspendido)  |
| `npm run build-storybook`     | Storybook de entrega                        |
| `npm run check:stories`       | compila TODAS las stories, WIP incluidas    |
| `npm run check:plays`         | gate de `play` en rojo                      |
| `npm run check:paginas`       | estándar de páginas                         |
| `npm run medir:story`         | mide una story sin levantar un agente       |
| `npm run lint:css` / `format` | Stylelint / Prettier                        |

## Docs

- `docs/architecture.md` — carpetas y pipeline de build.
- `docs/styling.md` — Bootstrap y tema de marca.
- `docs/design-tokens.md` — Figma → tokens SCSS y el chequeo de drift.
- `docs/storybook-guide.md` — cómo se monta una pieza en Storybook.
- `docs/git-workflow.md` · `docs/jira-workflow.md` — ramas y tareas.
- `docs/starterslug-harness/onboarding.md` — primera sesión con el harness.
