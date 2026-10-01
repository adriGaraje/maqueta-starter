# Storybook guide — cómo montamos y entregamos cada pieza

> Taxonomía, hand-off (copiar HTML/SCSS) y el split WIP/producción.
> Inventario y estados → `story-map.md`. Reglas → [`../CLAUDE.md`](../CLAUDE.md).

Stack: **Storybook 10 + `@storybook/html-vite`** (stories = funciones que devuelven HTML), preview con
la CSS real (`src/styles/main.scss`). Addons: `docs`, `a11y`, `designs`, `links`.

## Enfoque: herramientas visuales > documentación

**Menos prosa, más addons.** Las herramientas en vivo son la documentación:

- **Controls** — el cliente prueba textos, tamaños y variantes sin tocar código.
- **Design** — el frame de Figma al lado de la story (comparar maqueta vs diseño).
- **Accessibility** — auditoría axe-core por pieza.
- **Viewport / caja W/H** — redimensionar el canvas para ver responsive.
- **Code** — pestaña fija (panel propio) con el HTML de hand-off, que se **actualiza con los Controls**.
  Copiar y listo, sin abrir Docs. Es un estándar: toda story de componente lo tiene.

El `.mdx` de cada pieza se queda en lo mínimo: qué es, cómo entregarla, y los bloques de código. Las
explicaciones largas sobran cuando el addon lo enseña en directo.

### La pestaña Code (estándar del proyecto)

El panel `Code` (`.storybook/manager.jsx`) es global — sale en toda story. Muestra lo que emite
`docs.source`, así que **cada story de componente define `docs.source.transform`** para que el snippet
salga limpio (sin envoltorios de decorator) y con los hooks Django intactos:

```js
// pieza construida desde args (botón):
docs: { source: { language: 'html', transform: (_c, ctx) => snippet(ctx.args) } }
// pieza que es un .html crudo (hero, cards):
docs: { source: { language: 'html', transform: () => rawHtml } }
```

Usa `transform`, no `source.code`: el panel escucha el source **dinámico**, y `code` (estático) no se
emite por ese canal.

## 1. Taxonomía de títulos (por TIPO de pieza)

Cada pieza vive en un único sitio según **qué es** (Atomic Design), no por dónde se reutiliza.

```
Welcome                                                                         (landing)
Getting Started   → los dos ficheros globales y cómo se enlazan
Design System/*   → información: Foundations · Buttons · Icons · Parallax
Basics/*          → las piezas base, de lo indivisible a lo compuesto
                                                            (src/components/*, src/modules/*)
Snippets/*        → una sección entera de página            (src/modules/*)
Layouts/*         → regiones del sitio: Site Header · Site Footer  (src/layouts/*)
Pages/*           → páginas completas por sección real      (src/pages/*)
```

El **nombre es el del fichero en Title Case** (`tariff-card` → `Tariff Card`). Así el título no
puede envejecer respecto al código: si no coinciden, uno de los dos está mal y se ve.

**Idioma** (regla 4 de `CLAUDE.md`): títulos y nombres de story en **inglés** (identidad de código);
prosa que lee el cliente (labels de Controls, `description`, `.mdx`, comentarios) en **español**.
**Excepción:** los nombres propios del cliente (productos, páginas que son rutas reales del
sitio) se quedan como son. Ojo con la trampa: **una página nuestra no entra en la excepción**
(una herramienta del repo va en inglés como todo lo demás).

Orden en `.storybook/preview.js` → `options.storySort.order`.

> **Esqueletos pre-diseño:** mientras no hay diseño, cada pieza tiene un placeholder low-fi en
> `src/stories/placeholders/` con `tags: ['WIP']`. Al llegar el diseño se sustituye por la pieza real.

## 2. component / module / layout / page

Los grupos de Storybook = los tiers del repo (1:1):

| Nivel     | Qué es                         | Carpeta                  | Hand-off         |
| --------- | ------------------------------ | ------------------------ | ------------------- |
| component | átomo/molécula reutilizable    | `src/components/<name>/` | parte de un Snippet |
| module    | faldón que compone componentes | `src/modules/<name>/`    | **un Snippet**      |
| layout    | chrome global (header/footer)  | `src/layouts/<name>/`    | Snippet global      |
| page      | página que compone módulos     | `src/pages/<name>/`      | una página del CMS  |

Anatomía: `<name>.html` (+ hooks Django + comentario de mapeo), `<name>.scss` opcional (registrar en
`styles/components/_index.scss`), `<name>.js` opcional, `<name>.stories.js`, `<name>.mdx` (hand-off).

## 3. Nada de envoltorios dentro de la story

Lo que la story **devuelve** es lo que el cliente copia. Un fondo o ancho para verla mejor va en un **decorator**,
no en el markup — si no, el `<div>` viaja con el copy-paste.

| Necesidad                             | Herramienta                                                          |
| ------------------------------------- | -------------------------------------------------------------------- |
| Fondo fijo por story                  | `parameters.backgrounds` — pinta `.docs-story` por CSS, no envuelve. |
| Fondo/ancho que sigue a un control    | Un **decorator** `(story, ctx)` que lee `ctx.args`.                  |
| Garantía de que el código sale exacto | `parameters.docs.source.transform` — emite lo que tú digas.          |

El `transform` es el cinturón: el "Show code" se renderiza lazy y no es fácil de auditar. Lo usan
`content-card`, `tariff-card` y `buttons`. Ver también `src/stories/lib/container.js`.

## 4. Hand-off — cómo el cliente copia el código

Cada pieza real ships un `<name>.mdx` co-locado con el HTML y el SCSS en bloques `Source` (con copiar):

```mdx
import { Meta, Title, Canvas, Controls, Source } from '@storybook/addon-docs/blocks'
import * as Stories from './<name>.stories'
import html from './<name>.html?raw'
import scss from './<name>.scss?raw'

<Meta of={Stories} />
<Title />
Qué es y cómo entregarla…
<Canvas of={Stories.Default} />
<Controls of={Stories.Default} />
## HTML
<Source code={html} language="html" />
## SCSS
<Source code={scss} language="scss" />
```

- El `.html` conserva los `{{ }}` / `{% %}` (contrato Django); el `Source` lo muestra tal cual.
- El `.scss` es solo el CSS propio. La base compartida (reset + `.text-preset-*` + OnAir) se entrega
  **una vez por página**, no por Snippet.

## 5. Qué se publica y qué no

**Una sola config, dos modos.** El Storybook publicado **es** el entregable: lo que se ve ahí es
lo que recibe el cliente. No hay un segundo sitio interno.

| Comando                   | Modo    | Qué lleva                    |
| ------------------------- | ------- | ---------------------------- |
| `npm run storybook`       | local   | Todo menos `tags: ['suspended']` |
| `npm run build-storybook` | entrega | Solo `tags: ['production']`  |

Hay **tres** etiquetas, no dos. `production` se publica, `WIP` solo se ve en local, y
`suspended` no se ve en ninguno de los dos: es una pieza **aparcada por decisión**, no una a
medias. Su código sigue en el repo y las páginas que la montan la siguen montando; lo único que
desaparece es su entrada en Storybook. En `Pages/Site Map` sale como **En pausa**, en gris,
porque pintarla de «sin empezar» sería mentir sobre trabajo que está hecho.

El interruptor es **la etiqueta de la story**, que vive al lado del componente. Antes había una
allowlist a mano en una segunda config (`.storybook-prod`): se quedó con un solo componente
durante semanas sin que nadie lo notara. Una lista en otro fichero es una lista que se olvida.

> ⚠️ **Si creas o renombras un fichero de story, reinicia `npm run storybook`.** Desde que existe
> `suspended`, los dos modos calculan la lista de ficheros al arrancar en vez de usar un glob —
> un glob no sabe leer etiquetas. Editar el contenido de una story sigue recargando en caliente;
> lo que no se recoge es un fichero nuevo o renombrado, **y falla en silencio**: la pieza no sale
> y no hay error. Si una story «ha desaparecido» del Storybook local, mira esto primero.

**Etiquetar es obligatorio.** Si una story no declara `tags`, la build de entrega falla con su
nombre. Es a propósito: «se me olvidó» es justo como se cuela un WIP en lo que ve el cliente.

Se promueve una pieza cambiando su etiqueta a `production`, y eso pasa **cuando la tarea está
entregada**, no cuando compila.

### Las secciones

| Sección           | Qué va                                        | Para qué                       |
| ----------------- | --------------------------------------------- | ------------------------------ |
| **Design System** | Color, tipografía, botones, iconos            | Información. Se consulta       |
| **Basics**        | Las piezas base, de lo indivisible a lo compuesto | El producto. Copiar y pegar  |
| **Snippets**      | Secciones enteras de página                   | El producto. Copiar y pegar    |
| **Layouts**       | Regiones del sitio (cabecera, footer)         | El producto. Copiar y pegar    |
| **Pages**         | Composiciones de las anteriores               | Ver dónde encaja cada uno      |

> **`Basics` sustituye a `Atoms` + `Molecules`** desde el 25-08. La frontera
> átomo/molécula era vocabulario nuestro: discutir si `Tabs` es una cosa u otra no cambia cómo se
> pega, y a quien recibe el Storybook no le dice nada. La frontera que **sí** importa —y se
> queda— es la de abajo: una pieza base (`Basics`) contra una sección entera de página (`Snippets`),
> que es lo que va a un Snippet del CMS.
>
> Cambiaron con ella las URL: `atoms-tag--default` pasó a `basics-tag--default`. Los enlaces
> profundos repartidos antes de esa fecha ya no resuelven.

Primera regla, la de siempre: **¿esto se pega tal cual en un Snippet del CMS?** Si no, va a
`Design System`, que es la sección informativa. Si sí, va por nivel, del más pequeño al más
grande. El nombre es el del fichero en Title Case (`tariff-card` → `Tariff Card`), en inglés, y
así título y código no pueden discrepar.

**El nivel de los organismos se llama `Snippets/`, no `Organisms/`.** No es un descuido: es el
nombre que el cliente usa para lo que se pega en el CMS, y una sección entera de página es exactamente
eso. La escala —átomo, molécula, sección— es nuestra; el nombre de la unidad que se entrega es
del cliente, y gana el del cliente.

El **orden** de las secciones no es alfabético: se declara en `.storybook/preview.js`
(`storySort.order`). Sin él saldría `Basics · Design System · Getting Started · Layouts ·
Pages · Snippets`, que no hay por dónde leerlo.

## 6. Checklist de alta de una pieza

1. Carpeta en el nivel correcto, nombre kebab-case (Story Map).
2. HTML Bootstrap 4.1.3 + hooks Django + comentario de mapeo `{{ var }} → .clase`.
3. SCSS solo si Bootstrap no llega; registrar en `styles/components/_index.scss`.
4. JS solo si hace falta; enganchar en `scripts/main.js`.
5. Story: `title` en la sección que toca (`Design System/` o el nivel atómico que corresponda), `args`/`argTypes` para el texto editable, `withActions`, `tags: ['WIP']` (obligatorio),
   y **`docs.source.transform`** para la pestaña Code (ver arriba).
6. `.mdx` de hand-off (HTML + SCSS).
7. Estado en el Story Map + verde (`build` + `lint:css` + `format:check`).
8. Al entregar la tarea: cambiar la etiqueta a `tags: ['production']`. Eso, y solo eso, la publica.
