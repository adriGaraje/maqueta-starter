# Pipeline de construcción de un módulo (detalle)

Detalle de la FASE C de `starterslug-flow`. Todo con cwd en la raíz del repo. Estados por nombre
(runtime, ver `config.stateMachine`). Subagentes vía `Agent`: el Ojo con
`subagent_type: config.models.analyst.agentName` (`config.models.analyst.label`, fijado en su
propia definición — NO le pases `model`), la Mano con `model: config.models.maqueter.agentModel`.

## Presupuesto por tipo de tarea

> Los techos de tokens por tipo de tarea están en `SKILL.md` → «Presupuesto». Estas reglas los
> sostienen y mandan sobre cualquier costumbre anterior de este fichero: un agente que lee de más
> o corre gates por su cuenta es lo que dispara el coste.

**Qué lee cada agente, y nada más:**

| Agente | Lee | NO lee |
| --- | --- | --- |
| Ojo (spec) | el nodo por REST/MCP, la spec de la pieza hermana más parecida, `lecciones.md` → **solo la sección «Para el Ojo»** | `lecciones-archivo.md` entero, `criterios-heredados.md` entero, un fichero aparte entero (se hace `grep` por pieza) |
| Mano | la spec, la pieza hermana que la spec cite, `CLAUDE.md` reglas 1–4 y «Ways of working», `lecciones.md` → **solo «Para la Mano»** | el resto de `src/`, lecciones completas, criterios, specs de otras piezas |
| Ojo (pixel-check) | la spec, el commit (`git show --stat`), `lecciones.md` → «Para el Ojo» | otra vez el Figma entero |
| Orquestador | `lecciones.md` → «Para el orquestador» antes de git/PR/deploy | — |

Una lección concreta se consulta con `grep -n '^## L-0xx' docs/starterslug-harness/lecciones-archivo.md`.
`criterios-heredados.md` se abre **solo** si la tarea toca entrega, pre/pro o contenido del cliente.

**Qué se corre, por tipo de tarea:**

| Tipo | Ojo · spec | Mano · gates | Ojo · verificación |
| --- | --- | --- | --- |
| **Pieza o página nueva contra frame** | REST + export; Chrome solo si hay que medir un render. Spec ≤ 15 KB. | `build` · `lint:css` · `format:check` · `build:entrega` + `check:stories` · `check:paginas` si es página · **UNA** build `config.storybook.buildAllCmd -o <dir>` para `check:hooks -- --dir` (solo si hay hooks nuevos) y `play-errors --id` de lo tocado. Se borra la build. | **El Ojo captura y para** (L-101): **una** build, **un** Chrome, `shots/figma-{ancho}-{n}-{bloque}.png` y `sb-…` por bloque y ancho, cierra Chrome. **El orquestador cierra el informe**: mira los pares, mide con `npm run medir:story` (varios `--sel` y `--ancho`, una build) y escribe `pixel-check.md` (score con denominador enumerado, «Heredado» aparte) y `pixel-report.html`. |
| **Página por diferencia** (misma plantilla, otro contenido) | **Por diferencia** contra la plantilla: árbol de bloques, qué cambia de estructura, contenido transcrito en JSON. Sin Chrome. | Los mismos gates; lectura acotada a la plantilla y sus `datos-*`. | Solo lo que cambia (hero, bloques propios, alto total) y que la plantilla no se ha movido. |
| **Retoque sin frame** (variantes, propuestas, notas de revisión) | No hay Ojo. | `build` · `lint:css` · `format:check` · `check:stories` · `play-errors --id` de la story tocada sobre una build. **Sin `check:hooks` salvo hooks nuevos.** | **No hay Ojo.** Se mira en pre o en localhost. |
| **Arreglo de un diff del pixel-check** | — | Lo que toque el diff (a menudo lo hace el orquestador si son ≤ 10 líneas). | **Sin Ojo.** Remedición con `npm run medir:story -- --story <stories.js> --sel <selector> [--ancho <config.viewports.mobile>] [--dir <build viva>]` (un play desechable por el gate de plays: ≤ 5k tokens, no se cuelga). El orquestador añade la sección «Segunda pasada · <hash>» al `pixel-check.md` con las cajas medidas; nunca se reescribe. El Ojo vuelve solo si hay que **recapturar** comparativas o el arreglo tocó más de una pieza. |

**El pixel-check no lo cierra el Ojo.** Captura los pares y para (L-101); lo que viene después —mirar, medir, escribir el informe— lo hace el orquestador con `medir:story`. Un Ojo que sigue tras capturar se cuelga.

**Remediciones acotadas: nunca por el Ojo.** Un Ojo para tres números se cuelga y cuesta 30–40k; `scripts/medir-story.mjs` da las mismas cajas por el gate de plays, que abre y cierra Chrome solo. L-100.

**Prohibido sin que lo pida el orquestador:** `check:plays` completo, `build-storybook` de entrega,
una segunda build de Storybook, capturas a más de una escala, correlaciones de imagen, abrir Chrome
en la fase de spec, releer Figma en el pixel-check, y cualquier gate que no esté en la tabla.
Si el agente cree que hace falta otro, lo dice en el informe; no lo corre.

**Formato de spec (≤ 15 KB):** tablas, no prosa. (1) reparto vertical bloque a bloque con nodo,
y, alto; (2) por bloque: existente/modificado/nuevo, medidas en `text-style('…')` y tokens;
(3) hooks del perfil de hand-off (`config.repo.handoff`); (4) **contenido transcrito en un bloque JSON listo para `datos-*.js`**; (5) assets
con node-id, escala y recorte; (6) hueco de cabecera; (7) preguntas a diseño, al final y numeradas.
Lo que el Ojo argumenta de más se lo lee la Mano y no lo usa: el coste es doble.

**Informes:** `pixel-check.md` lleva el denominador enumerado y clasifica cada diff en diseño /
nuestro (fichero:línea) / decisión / propuesta. Una pasada posterior **añade** una sección; no
regenera capturas que no cambian.

**Agrupar:** varias notas de revisión sobre la misma pieza van en **una** pasada de la
Mano, no una por nota.

## Paso 1 — Claim + rama

1. `getTransitionsForJiraIssue` sobre la tarea → localiza la transición a `in-progress` (`En curso`).
2. `transitionJiraIssue` a `En curso`; asigna la tarea a ti (`editJiraIssue` assignee).
3. Sincroniza el espejo local: en `config.repo.tasksMirror` y en el fichero `tasks/<KEY>-###-*.md`, pon
   `Status: In Progress` y `Assignee`. (Mantener ambos en sync — regla del repo.)
4. Git (ver `config.docs.gitWorkflow`; `<KEY>` = `config.atlassian.jira.projectKey`):
   ```bash
   git checkout <integrationBranch> && git pull origin <integrationBranch>
   git checkout -b <config.git.branchPattern>     # type: feat|fix|refactor|chore|docs
   ```
   > **Rama base: `config.git.integrationBranch`, nunca `config.git.releaseBranch`.** La de
   > integración alimenta el target de verificación; la de release es producción y solo recibe
   > releases aprobadas.
5. **Protocolo paralelo:** si otra tarea `In Progress` (de otro dev) declara en "Files likely touched"
   un fichero que necesitas, NO lo toques: secuencia con dependencia o elige otro módulo.

## Paso 2 — Extracción de Figma (el Ojo)

Lanza `Agent` con `subagent_type: config.models.analyst.agentName` (y nada más: su modelo y su
effort salen de su fichero en `.claude/agents/`). El agente debe:
- Extraer del **nodo exacto** (con `node-id`) del archivo Figma (`fileKey` en config o URL del módulo):
  `get_metadata` (estructura), `get_design_context` (la implementación de referencia), `get_screenshot`
  (captura de referencia, guárdala en `docs/starterslug-harness/reports/<slug>/figma.png`), `get_variable_defs`
  (tokens: colores, espaciados, tipografía), y `get_libraries`/`search_design_system` si hace falta
  casar con el sistema de diseño.
- Devolver una **spec de maquetación** estructurada (Markdown), guardada en
  `docs/starterslug-harness/reports/<slug>/spec.md`, con:
  1. **Anatomía**: jerarquía de nodos → estructura HTML propuesta.
  2. **Tokens**: colores (→ variables `config.tokens.scssPrefix*` o Bootstrap `$primary/...`), espaciados, radios,
     tipografía (→ `config.tokens.classPrefix*` si aplica), sombras.
  3. **Medidas exactas**: tamaños, paddings, gaps, breakpoints de cambio.
  4. **Mapeo Bootstrap-first**: qué se resuelve con clases/grid/utilidades Bootstrap y qué necesita
     SCSS custom (kebab-case, BEM `__element`).
  5. **Estados**: hover/focus/active/disabled, vacío/error si aplica.
  6. **Responsive**: comportamiento por breakpoint (`@include media-breakpoint-up(md)`).
  7. **Hooks** propuestos, en la sintaxis del perfil de hand-off (`config.repo.handoff`): `<hook> → .clase`
     (comentario de cabecera del `.html`). Con `html` no hay hooks.
  8. **A11y**: roles, `aria-*`, foco, `visually-hidden`.

> El Ojo **no escribe código de producción**: produce la spec y la captura de referencia.

## Paso 3 — Maquetación (la Mano, `maqueter`)

Lanza `Agent` con `model: config.models.maqueter.agentModel`, `agentType: "general-purpose"`, pasándole la spec y la captura.
Debe construir el componente siguiendo la **anatomía exacta del repo**:

```
src/components/<name>/
├── <name>.html          # REQUERIDO. Bootstrap 4.1.3. Cabecera con mapeo de hooks.
├── <name>.scss          # OPCIONAL. Solo lo que Bootstrap no puede. Cabecera "// COMPONENT · <name> — …"
├── <name>.js            # OPCIONAL. Solo si interactivo más allá de la data-api de Bootstrap.
├── <name>.stories.js    # Story Storybook.
└── <name>.mdx           # OPCIONAL. Página de hand-off (copia HTML/SCSS al CMS).
```

Reglas de maquetación (de `CLAUDE.md` + briefing del repo):
- **Bootstrap-first**: clases/grid/utilidades; CSS custom como último recurso.
- Cabecera de `.html` con el mapeo (forma completa cuando se conocen las vars), cada hook en la
  sintaxis del perfil de hand-off — se escriben con `var` / `bucle` / `si` de `src/stories/lib/hooks.js`:
  ```html
  <!--
    Component: <name> (Bootstrap 4.1.3)
    <hook de item.name>  → .clase
    <hook de item.price> → .<name>__amount
  -->
  ```
- Registrar el SCSS con `@import '../../components/<name>/<name>';` en
  **`config.paths.componentsIndex`** (¡ojo! NO `@use` en `main.scss` — es un error común: la doc
  dice "@use en main.scss" pero el código real usa `@import` en `config.paths.componentsIndex`).
- Cabecera del `.scss`: `// COMPONENT · <name> — <descripción>`.
- Story `.stories.js`: `import x from './<name>.html?raw'`; `title: '<Sección>/<Nombre legible>'`
  en español; `tags: ['WIP']` por defecto, a `['production']` solo cuando la tarea esté entregada.
  **La etiqueta es obligatoria**: sin ella la build de entrega falla, y es lo único que decide qué
  se publica. Para componentes
  con datos, patrón `render(args)` con `argTypes`/`args` y `docs.source.code` = el HTML `?raw` con sus hooks, resuelto con `pinta()` de `hooks.js`.
  **No** stories con datos placeholder para piezas que no existen.
- Taxonomía: los niveles de `config.storybook.titleLevels`, en ese orden. La regla: **¿esto se pega tal cual en un Snippet del CMS?**
  Sí → `Snippets/…`. No → `Design System/…` (color, tipografía, botones, iconos: información).
  Las composiciones de página van a `Pages/…`. Nuestra jerarquía átomo/molécula/organismo es
  interna: no sale en los títulos, que los lee quien recibe la entrega.
- Convenciones: kebab-case ficheros, camelCase funciones JS, `$kebab-case` vars SCSS, 2 espacios,
  **sin `;` en JS** (Prettier), LF, todo en inglés en el código.
- **Green gates** antes de dar por hecho el paso: `config.repo.greenGates`.

### Si la tarea es una PÁGINA — el estándar, sin que nadie lo pida

Toda página (`config.pageStandard.appliesTo`) lleva esto de serie. No hace falta que venga en la
ficha ni que lo pida nadie: es el estándar de desarrollo de las páginas, y un gate lo exige.
Nombres y valores en `config.pageStandard`.

1. **La cabecera con submenú de sección**, fuera del `<main>` y antes de él:
   `raiz.append(<headerFn>({ seccion, sub }), main)` (`config.pageStandard.headerModule`).
   `seccion` es el rótulo de la barra que va en negrita; `sub`, la entrada de su submenú. Sin
   `seccion` si la página no es ninguna de las `config.pageStandard.sectionsCount`. **Sustituye**
   a las franjas de `config.pageStandard.replacedBands` que el Figma dibuja encima de cada hero de
   sección: esas franjas NO se maquetan, y al comparar contra Figma se excluyen del diff.
2. **El hueco en el primer módulo.** La barra flota dentro de su card, así que el hero de sección
   suma `var(<headerSpaceVar>, 0px)` a su aire de arriba (`headerDesktopPx` en escritorio,
   `headerMobilePx` en móvil; lo publica `config.pageStandard.headerSpaceSource`). Si el hero es
   nuevo, se hace en su SCSS. Si de verdad no lo necesita —centra su contenido, o su titular ya
   queda por debajo de la barra—, se mide y se añade con su motivo a
   `config.pageStandard.exemptionsTable` en `config.pageStandard.checkScript`.
3. **Las marcas de snippet**: `<snippetMarkFn>(raiz)` justo después de montar
   (`config.pageStandard.snippetModule`). Cada pieza sale entre `<!-- <snippetMarkers.start> Nombre -->`
   y `<!-- <snippetMarkers.end> Nombre -->` en el código que copia el cliente. Una pieza que no
   esté en su tabla `config.pageStandard.snippetTable` se añade ahí con su nombre de Storybook.
4. **El `play`** llama a `<headerCheckFn>(canvasElement, { seccion, sub })` y a
   `<snippetCheckFn>(canvasElement)`.
5. **Un gate más**: `config.pageStandard.checkCmd`, que falla si falta cualquiera de los cuatro
   puntos de arriba. Y antes del PR, `npm run check:plays` sobre la build local para las
   comprobaciones que solo se ven pintadas —que la marca lleve el nombre de una pieza que existe
   y que sobreviva a la limpieza del código publicado—.

Al verificar una página (paso 4), además: **desplegar el submenú con el ratón** en escritorio y
medir que el primer módulo no se mueve, y comprobar el aire entre la barra y el titular a
`config.viewports.desktop` y a `config.viewports.mobile`. Un submenú que empuja la página no se
ve en la story suelta.

## Paso 4 — Verificación pixel-perfect (el Ojo)

1. Renderiza el componente: `npm run build-storybook` (o levanta `npm run storybook` en
   `config.storybook.devPort`) y
   captura la story del componente (mismo tamaño/viewport que la referencia de Figma). Guarda en
   `docs/starterslug-harness/reports/<slug>/build.png`.
2. Lanza `Agent` con `subagent_type: config.models.analyst.agentName` y **ambas imágenes** (figma.png vs build.png) y la spec. Debe
   comparar **visualmente y en medidas**: layout, espaciados, tipografía, color, radios, estados,
   responsive. Devuelve un veredicto estructurado:
   ```json
   { "pixelPerfect": false, "score": 0.86, "diffs": [
       {"zona":"precio","problema":"font-size 28px vs 32px en Figma","fix":"usar <classPrefix>h3"},
       {"zona":"card","problema":"radius 8px vs 16px","fix":"$border-radius-lg"} ] }
   ```
3. **Los tamaños se miden, no se miran.** Un icono de 18×12 y uno de 15×10 son indistinguibles a
   ojo en una captura, y un diff así puede pasar días sin verse. Para cada pieza cuyo
   tamaño esté en duda, pasa `pixel-measure` por las **dos** imágenes y compara **cajas**:

   ```
   node scripts/pixel-measure.mjs <png> '#0050FF' --dentro claro --inset 10
   ```

   Reglas al leerlo, que si no engaña: mide siempre también la referencia de Figma (el antialias
   deja la caja ~1 px por debajo de la nominal, en las dos por igual); con `--dentro` sobre un
   contenedor redondo añade `--inset`, porque la caja es rectangular y sus esquinas son fondo; y
   compara cajas, nunca el recuento de píxeles, que Chrome y Figma reparten distinto.
4. Si `pixelPerfect=false` → vuelve al **Paso 3** pasando los `diffs` al `maqueter`. Repite hasta
   `pixelPerfect=true` (o hasta que el humano acepte un score con desviaciones justificadas).
5. Genera el **reporte visual de pixel-perfect** (ver `reporting.md`): figma vs build lado a lado,
   score, diffs resueltos. Guárdalo en `docs/starterslug-harness/reports/<slug>/pixel-report.html`.

## Paso 5 — A revisión + aviso

1. Green de pixel-perfect → PR según `config.docs.gitWorkflow` (rebase sobre
   `origin/<config.git.integrationBranch>`, green —y `config.pageStandard.checkCmd` si la tarea
   toca una página—, push, PR a **`config.git.integrationBranch`** con título
   `config.git.prTitlePattern` y `Closes <KEY>-###`).
2. `transitionJiraIssue` a `En revisión`; sincroniza backlog/fichero a `In Review`.
3. `addCommentToJiraIssue` **mencionando al responsable** (accountId de config) para que le llegue
   notificación: resumen de lo hecho, link al PR, score pixel-perfect y captura. Ese comentario es
   la señal de "listo para tu revisión".
4. `modules.json` → `pipelineState: "in-review"`.

## Paso 6 — Ciclo de ajustes

- El humano revisa; si pide cambios, deja comentarios en Jira y mueve a `Pendiente de revisar`
  (`pending-fixes`, fallback `En curso`).
- Al detectarlo: lee los comentarios (`getJiraIssue` con `fields: ["comment"]`), aplica los ajustes en
  la **misma rama**, re-verifica pixel-perfect (Paso 4), y vuelve a `En revisión` avisando de nuevo.

## Paso 7 — Cierre

Solo con aprobación explícita del humano:
1. Merge del PR (squash) según `config.docs.gitWorkflow`; borra la rama.
2. `transitionJiraIssue` a `Listo`; backlog/fichero → `Done`; `modules.json` → `done`.
3. Excel nexo: si hay acceso de escritura, `estado_diseno` → `Entregado`; si no, indícalo en el reporte.
4. Confluence (cuando haya escritura): actualiza la fila del módulo en la pág. `maquetacionIaPageId`
   (esfuerzo IA real vs estimado) y, si hubo decisión estructural, la bitácora `02. BITÁCORA`.
5. `hitos.md`: añade la fila del hito (arriba).
6. `config.docs.storyMap`: actualiza el `Estado` de la pieza (→ `Entregado`) y su carpeta/Snippet.
7. **Deploy** (opcional, con confirmación): publica el Storybook con `npm run deploy` desde la
   rama cuyo target de `config.deploy.targets` toque (ver [`deploy.md`](deploy.md)).
   Green antes; registra el deploy en `hitos.md` con la URL.

## Manejo de errores

Ante un fallo no trivial: busca primero en el índice `lecciones.md` y abre esa lección en `lecciones-archivo.md` con `grep`. Si es nuevo y lo resuelves, añade una
entrada `L-NNN` (síntoma → causa → solución). Si te bloqueas de verdad, mueve la tarea a `Bloqueado`
con un comentario explicando el bloqueo y avisa al humano.
