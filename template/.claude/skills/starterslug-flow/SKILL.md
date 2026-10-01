---
name: starterslug-flow
description: >-
  Flujo de trabajo diario de maquetación del proyecto (ver config.project.displayName). Ritual de arranque (M0 ingesta de módulos
  ready-to-dev desde Figma → M1 barrido → M2 parte visual → M3 housekeeping de Jira →
  M4 pregunta), bucle de construcción de módulos del design system (Figma → Jira →
  Storybook → Confluence) con el Ojo (Opus 5 · effort xhigh) extrayendo contexto y verificando
  pixel-perfect y la Mano (Opus 5) maquetando, y M5 de cierre de día. Úsalo cuando el humano salude ("buenos
  días", "buenas", "a currar"), se despida ("me voy", "cerramos"), o pida "reporte de
  tareas", "arrancar un módulo", "maquetar el siguiente" o "/starterslug-flow".
---

# starterslug-flow — harness de maquetación con IA

Eres el orquestador del flujo diario de maquetación del proyecto `config.project.displayName`.
Este harness **automatiza y respeta** el workflow existente del repo (`CLAUDE.md`,
`config.docs.jiraWorkflow`, `config.docs.gitWorkflow`) y le añade la capa de IA. **No reinventes** convenciones: síguelas.

## 0. Carga de contexto (SIEMPRE al empezar)

> **Con quién estás.** El equipo son varias personas y **no siempre eres tú quien lo usa**. El
> hook de `SessionStart` resuelve quién es a partir de `git config user.email` contra
> `config.json → team` y te lo dice en la primera línea. De ahí sale qué tareas son «tuyas» y
> cuáles «del resto». Si el hook avisa de que ha caído al usuario por defecto porque el email no
> casa con nadie, **pregunta antes de enseñar tareas ajenas como propias** — es un fallo que no
> se ve: el parte sale igual de bien hecho, solo que con las tareas de otra persona.

Antes de nada, lee y ten presente:
1. `docs/starterslug-harness/config.json` — identidades, `cloudId`, `fileKeys`, **mapa de estados**, fases, roles de modelo, rutas y nombres del proyecto. Cuando este texto cita `config.<clave>`, el valor está ahí.
2. `docs/starterslug-harness/modules.json` — `pipelineState` de cada módulo.
3. `docs/starterslug-harness/lecciones.md` — **índice por rol** de los errores ya resueltos: lee la sección de tu rol; el texto completo de UNA lección se busca en `lecciones-archivo.md` con `grep`. Nunca se lee entero.
4. `CLAUDE.md`, `config.docs.jiraWorkflow`, `config.docs.gitWorkflow` — el contrato del repo.
5. **Chequeo de tokens: Figma → lo que pinta Storybook.** Los colores y la tipografía de marca
   salen de Figma y cambian sin avisar. Se comprueba **todas las mañanas**, antes de maquetar
   nada. Detalle en `config.docs.designTokens`.

   1. **Vuelca los styles frescos por MCP.** Por cada nodo de
      `config.figma.files[config.figma.primaryFile].nodos`, llama a `get_variable_defs` (fileKey del
      archivo marcado `scanned: true`) y **funde todas las respuestas en un solo JSON plano**
      nombre-de-style → valor. Guárdalo en un temporal.
      No uses `use_figma` para esto: lee del archivo abierto en el escritorio, no del que toca.
   2. `config.tokens.diffCmd -- <fresh.json>` y **lee el código de salida**:

      | Exit | Qué significa | Qué haces |
      | --- | --- | --- |
      | 0 | Storybook pinta lo que dice Figma | nada, dilo en el parte en una línea |
      | 1 | Hay valores que **no coinciden** | **alinea el repo** (abajo) |
      | 3 | Figma tiene styles que el repo no adopta | **no lo arregles solo**: es una decisión, sácalo en el parte y pregunta |
      | 2 | Falta el vuelco | error de uso tuyo, repite el paso 1 |

   3. **Si exit 1, alinea** `config.tokens.colorsFile` / `config.tokens.typographyFile` con los
      valores de Figma, regenera el snapshot (`config.tokens.diffCmd -- <fresh.json> --write-snapshot`,
      escribe `config.tokens.snapshotFile`), pasa green y **resáltalo en el parte**: style, valor
      antes → después, y qué componentes lo usan. Hazlo en la rama de la tarea que se arranque,
      nunca en `config.git.integrationBranch` ni en `config.git.releaseBranch`.
   4. **Nunca des por borrado un style que no aparezca.** El barrido va nodo a nodo: prueba
      presencia, no ausencia. El script ya los lista como «sin comprobar»; repítelo tal cual.

   > La cadena que se comprueba es `Figma → config.tokens.typographyFile →
   > config.tokens.classPrefix* → story config.tokens.storyTitle`. Esa story **lee las medidas del CSS compilado** con
   > `getComputedStyle`, así que no puede mentir: si el SCSS está alineado, lo que se ve en
   > Storybook está alineado.

Todo se ejecuta con el **cwd en la raíz del repo**. Atlassian y Figma van por los plugins de repo
(`config.atlassian.mcpServer`, `config.figma.mcpServer`), NO por los conectores de claude.ai.

> **Descubrimiento de estados en runtime.** El board puede tener 5 o 7 estados según se hayan
> creado `Listo para Dev` / `Pendiente de revisar`. Nunca uses IDs de transición fijos: llama a
> `getTransitionsForJiraIssue` sobre la tarea y **casa por nombre** contra `config.stateMachine`.
> Si un estado tiene `pending:true` y aún no existe, usa su `fallbackOf`.

## Roles de modelo (reparto de trabajo)

Lanza subagentes con `Agent`:
- **`analyst` → `subagent_type: config.models.analyst.agentName`** · **el Ojo** 👁: extrae el
  contexto de Figma en una **spec de maquetación** y hace la **verificación visual pixel-perfect**.
  Mide y juzga, nunca maqueta. **No le pases `model`**: su definición
  (`.claude/agents/<config.models.analyst.agentName>.md`) ya fija modelo y `effort`
  (`config.models.analyst.label`), y un `model` en la llamada solo puede desalinearlo.
- **`maqueter` → `config.models.maqueter`** (`model: config.models.maqueter.agentModel`,
  `agentType: "general-purpose"`) · **la Mano** ✋: construye el componente pixel-perfect
  siguiendo la spec.

> **El `effort` no se pasa en la llamada al `Agent`**, sale del frontmatter del agente; por eso
> cambiar `models.analyst` en `config.json` **no cambia nada en ejecución** — ese bloque
> documenta, el frontmatter manda.

> ⚠️ **Dónde vive un agente y dónde se lee no son el mismo sitio.** Los agentes están versionados
> en `<repo>/.claude/agents/`, pero **Claude Code no los lee de ahí**: los skills sí se descubren
> en subcarpetas, los agentes solo en la raíz del proyecto (la carpeta que CONTIENE el repo, la
> del `settings.json` que invoca los hooks) y en `~/.claude/agents/`.
>
> Lo resuelve el hook de `SessionStart`, que los copia en cada arranque. No hay que hacer nada a
> mano — pero **un agente recién instalado no existe hasta el siguiente reinicio**, porque el
> registro se construye al arrancar. Si `subagent_type` responde «agent type not found», es eso:
> reinicia. El hook lo avisa en el propio contexto de arranque cuando acaba de copiar algo.
>
> **Un agente que no se encuentra no rompe nada de forma visible** — el pipeline se cae al
> modelo por defecto y sigue, que es el peor modo de fallo posible. Estar en git no es estar
> instalado.

Usa los apodos al narrar el progreso ("el Ojo encontró 3 diffs, la Mano ya los ha arreglado"):
hace el log legible de un vistazo y deja claro quién hizo qué.

El detalle exacto de cada paso está en [`references/pipeline.md`](references/pipeline.md).
El diseño de los reportes visuales, en [`references/reporting.md`](references/reporting.md).

## Presupuesto (manda sobre cualquier costumbre)

Tokens de agentes por tarea completa, como techo:

| Tipo de tarea | Objetivo |
| --- | --- |
| Página o pieza nueva contra frame | **≤ 550k** |
| Página por diferencia (misma plantilla) | **≤ 250k** |
| Retoque sin frame | **≤ 100k** |

Qué lee cada agente y qué se corre por tipo: la tabla de
[`references/pipeline.md` → «Presupuesto por tipo de tarea»](references/pipeline.md#presupuesto-por-tipo-de-tarea).
Tres reglas lo sostienen, y están allí: la **spec ≤ 15 KB** («Formato de spec»), **el Ojo
captura y para** (el pixel-check lo cierra el orquestador) y las **remediciones van por
`medir:story`**, nunca por el Ojo. Si una tarea va a pasarse del techo, dilo antes de seguir.

---

## El ritual de arranque (M0 → M4)

Se dispara solo: el hook `UserPromptSubmit` (`.claude/hooks/ritual-detect.mjs`) detecta el
saludo del humano e inyecta `<starterslug-flow trigger="ritual">`. También vale invocar `/starterslug-flow`.

> **Autonomía pactada.** M3 solo PROPONE. M0 crea tareas **solo** para lo que diseño ha marcado
> `READY_FOR_DEV`; todo lo demás que toque Jira necesita OK explícito. El ritual escribe por su
> cuenta el HTML del reporte, `state.json` y esas tareas de ingesta: enterarse de que hay trabajo
> disponible no debe costar una conversación. El detalle y sus límites, en
> [`references/ingesta.md`](references/ingesta.md).

### M0 · Ingesta — la cola de entrada

Qué ha marcado diseño y qué ha terminado. **Dos barridos, y no ven lo mismo.** Detalle completo
en [`references/ingesta.md`](references/ingesta.md).

1. **`npm run figma:ready -- --json`** — lo que diseño **marca** como Ready for dev.
   `devStatus` se lee por REST; el enlace del correo es el plan B.
2. **`npm run sitemap:sync`** — lo que diseño **hace**: páginas que ya tienen diseño y módulos
   que el mapa del sitio no conoce. Tarda unos 6 segundos y sale con 1 si hay novedades.
3. Si `campoAusente: true` → estamos ciegos. **Dilo tal cual** y pide el enlace del correo.
   Nunca lo reportes como «0 módulos»: se parecen y solo uno permite trabajar.
4. Por cada nodo marcado, y **casando siempre por `node-id`, nunca por nombre**:
   `analyst` (el Ojo) lee el nodo, redacta el ticket AI-ready, y **se crea**: una tarea para la
   página y una por cada módulo suyo que no exista en el repo, enlazadas como dependencia.
   Si ya hay tarea para ese `node-id`, no se toca.
5. Lo de `disenoNuevo` y `modulosNuevos` **se propone**, no se escribe: registrar una página como
   diseñada o dar de alta un módulo nuevo son decisiones, no hallazgos.

### M1 · Barrido

En una sola tanda de subagentes en paralelo:
- **Jira** de **cada miembro con `activo: true`** en `config.json → team`:
  `searchJiraIssuesUsingJql` con
  `assignee = <accountId> AND project = <config.atlassian.jira.projectKey> ORDER BY updated DESC`,
  pidiendo `comment` en `fields`. Cruza contra `state.json → vistoEnJira` para saber qué es
  **nuevo de verdad**. No hardcodees nombres: el equipo cambia y una lista escrita a mano aquí
  se queda vieja sin que nadie lo note.
- **Git**: `git fetch`, estado de ramas, PRs abiertos y su estado de merge.
- **Tokens** (punto 5 de la carga de contexto): barrido de `get_variable_defs` + `tokens:diff`.
  Es del barrido de la mañana, no algo que se hace «cuando toque»: si diseño movió un tamaño
  ayer, todo lo que se maquete hoy sale mal. Al parte va **siempre una línea**, aunque no haya
  nada: «tokens alineados» o los desajustes con su antes → después.
- **`lecciones.md`**: avisos relevantes a lo que hay en vuelo.
- **Mapa del sitio**: lo que devolvió `sitemap:sync` en M0. Al parte va **siempre una línea**,
  como con los tokens: «el mapa está al día» o qué páginas han ganado diseño. Es la métrica que
  dice si el proyecto tiene por dónde seguir.

### M2 · El parte 📊

**Reporte visual** (artifact HTML, ver [`references/reporting.md`](references/reporting.md)) y
resumen en el chat. Bloques: tus tareas / las del resto del equipo · cola de listos para dev · warnings ·
entregados · **novedades de diseño** · **tokens** · **termómetro del design system** ·
**racha y logros**.

El bloque de **tokens** sale del chequeo del punto 5 y va siempre, con una de estas tres caras:
- ✔ alineado — una línea y a otra cosa.
- ✖ desajuste — tabla `style · repo → Figma · qué componentes lo usan`, y si ya lo has alineado,
  dilo y enlaza la rama. Esto es un **warning**, no una nota al pie: lo que se maquete hoy sin
  arreglarlo sale mal.
- ○ novedades — styles que Figma tiene y el repo no. Pregunta si se adoptan; no los metas por tu
  cuenta, que una escala nueva (p. ej. la `Mobile/*`) es una decisión de diseño.

Datos reales vía JQL contra el `cloudId` de config. **Si un bloque está vacío, dilo; si no se
pudo comprobar, dilo distinto.** Un reporte bonito con datos inventados es peor que no tener reporte.

### M3 · Housekeeping 🤖

Desajustes entre el trabajo real y lo que dice Jira: PRs mergeados sin cerrar, tareas estancadas,
revisiones olvidadas, comentarios nuevos, dependencias desbloqueadas, bloqueos de diseño.
Reglas exactas en [`references/housekeeping.md`](references/housekeeping.md). **Propone, no ejecuta.**
Nunca toca tareas de otra persona.

### M4 · Pregunta por dónde empezar

Con `AskUserQuestion`, opciones adaptadas a lo que haya salido (no todas si no aplican):
- **Atacar un warning/bloqueo** — prioridad alta.
- **Seguir una tarea inacabada tuya** (`En curso` sin cerrar).
- **Arrancar un módulo nuevo** de la cola `ready-to-dev`.
- **Responder/ajustar** una tarea que volvió como `Pendiente de revisar`.
- **Revisar** una tarea de otra persona del equipo que esté `En revisión` esperándote.

No arranques a maquetar sin confirmación. **Excepción:** si el hook inyectó `modo="turbo"`
(el humano dijo "buenos días y a saco"), salta M4 y arranca el pipeline con el primero de la cola.

## Bucle de construcción de un módulo

Cuando se elige un módulo, ejecuta el pipeline de [`references/pipeline.md`](references/pipeline.md).
Resumen del bucle (cada paso detallado allí):

1. **Claim + rama.** Mueve la tarea a `in-progress` (Jira + `tasks/backlog.md` + fichero de tarea,
   assignee = tú). Crea rama `config.git.branchPattern` (con `<KEY>` =
   `config.atlassian.jira.projectKey`) desde `config.git.integrationBranch` fresco. Respeta el
   protocolo de trabajo paralelo (no toques ficheros de tareas ajenas `In Progress`).
2. **Extracción (el Ojo).** Subagente `config.models.analyst.agentName` lee el nodo de Figma (`get_metadata`,
   `get_design_context`, `get_screenshot`, `get_variable_defs`) y produce una **spec de maquetación**
   completa: estructura, tokens/variables, medidas, estados, responsive, mapeo a clases Bootstrap y
   a hooks del perfil de hand-off. Guarda la captura de referencia de Figma.
3. **Maquetación (la Mano, `config.models.maqueter`).** Subagente `maqueter` construye el
   componente con la anatomía del repo (`<name>.html` + `.scss` + `.stories.js` [+ `.mdx`]),
   Bootstrap-first, registra el SCSS en `config.paths.componentsIndex` (¡`@import`, no `@use` en
   main.scss!), y pasa los green gates.
4. **Pixel-perfect (el Ojo).** `npm run build-storybook` (o `storybook` dev) → captura del componente
   renderizado → subagente `analyst` compara **visualmente y en medidas** contra la captura de Figma.
   Devuelve diffs concretos. Si NO es pixel-perfect → vuelve al paso 3 con los diffs. Bucle hasta **green**.
5. **A revisión.** Con green de pixel-perfect: mueve la tarea a `in-review`, abre PR según
   `git-workflow.md`, y **comenta la tarea mencionando al responsable** (`addCommentToJiraIssue` con
   la mención al accountId) para que le llegue notificación. Adjunta el reporte de pixel-perfect.
6. **Ajustes.** Si el humano deja comentarios y mueve a `pending-fixes`: lee los comentarios, aplica
   los ajustes en la misma rama, re-verifica pixel-perfect, y vuelve a `in-review` avisando de nuevo.
7. **Cierre.** Cuando el humano aprueba: mueve la tarea a `done` (Jira + backlog + `modules.json`),
   actualiza el `estado_diseno` del Excel si hay acceso, **documenta en Confluence** (pág.
   `maquetacionIaPageId`) cuando haya permiso de escritura, y registra el **hito** en `hitos.md`.
8. **Deploy.** Ofrece publicar el Storybook actualizado en **Firebase Hosting** (`npm run deploy`:
   la rama decide el target de `config.deploy.targets`) — ver
   [`references/deploy.md`](references/deploy.md). Se dispara **localmente** (Actions está capado
   por IT), con green previo y confirmación del humano.

Durante todo el bucle: si algo falla de forma no trivial y lo resuelves, **añade una lección** a
`docs/starterslug-harness/lecciones-archivo.md` (síntoma → causa → solución, entrada completa) y su línea en el índice `lecciones.md`, en la sección del rol al que sirve.

## M5 · Cierre — "buenas noches" 🌙

El espejo del ritual. Lo dispara el mismo hook cuando el humano se despide ("me voy", "cerramos",
"hasta mañana"). Sincroniza backlog↔Jira, registra hitos y lecciones, actualiza `state.json` con
**dónde lo dejasteis** (lo que el hook de `SessionStart` te enseña mañana), desbloquea logros y
ofrece deploy si hay verde sin publicar.

Detalle en [`references/cierre.md`](references/cierre.md).

**Cuando alguien deja el proyecto**, su último cierre hace además el **traspaso**: sus tareas,
sus PR y su memoria local pasan a su relevo, y deja de salir en los partes. Se programa en
`config.json → team[].salida`. Detalle en [`references/traspaso.md`](references/traspaso.md).

---

## Cómo se dispara todo esto

| Gatillo | Qué pasa |
| --- | --- |
| Abrir/reanudar sesión | Hook `SessionStart` → contexto barato (quién eres, fecha, rama, cola, dónde lo dejaste). Sin red. |
| **Primer saludo de alguien nuevo** | Hook `UserPromptSubmit` → **onboarding** ([`docs/starterslug-harness/onboarding.md`](../../../docs/starterslug-harness/onboarding.md)) **en vez del** ritual |
| "buenos días" / "buenas" / "a currar" | Hook `UserPromptSubmit` → ritual M0→M4 |
| "buenos días **y a saco**" | Ídem en **modo turbo**: salta M4 y arranca el pipeline |
| "me voy" / "cerramos" / "hasta mañana" | M5 cierre |
| "me voy" **el último día de alguien** (`team[].salida`) | M5 cierre + **traspaso** de todo lo suyo a su relevo ([`references/traspaso.md`](references/traspaso.md)) |
| `/starterslug-flow` | Ritual completo a mano |

Los hooks viven en `config.harness.hooksDir` y están cableados en `.claude/settings.json`. Solo
disparan con saludos **en seco** (≤ `config.triggers.maxLen` caracteres; las frases de la tabla
son las de `config.triggers`): "buenos días, arregla el header" es una petición
concreta y no debe secuestrarse con el ritual entero.

**El onboarding gana al ritual** cuando el alias de quien saluda no está en
`state.json → onboarding.hechoPor`. Es a propósito: sin las conexiones montadas, M0 y M1 fallan
a medias y parece que el harness está roto cuando lo que falta es un login. Al terminarlo se
**propone** apuntar el alias para que no vuelva a saltar; escribirlo sin OK sería la única cosa
que este harness hace sola, y no va a ser esta.

---

## Integración con futuras skills de maquetación

Cuando existan skills específicas de maquetación por nivel, se registran en
`config.harness.levelSkills` (nivel → skill). El paso 3 (Maquetación) **delega en la skill que
corresponda al nivel del módulo** en lugar de maquetar genérico: detecta el `nivel`/`tier` del
módulo (`modules.json`) y, si hay una skill registrada para ese nivel, invócala; si no, maqueta
con las convenciones base de `CLAUDE.md`.
Deja este punto de extensión explícito y no lo hardcodees.

## Guardarraíles (no romper)

- **Nunca** commits/push a `config.git.releaseBranch` ni a `config.git.integrationBranch`. Una
  tarea = una rama = un PR. Green antes de PR (`config.repo.greenGates`, y
  `config.pageStandard.checkCmd` si toca una página).
- **Toda página nueva lleva el estándar de páginas** sin que nadie lo pida: cabecera con submenú,
  hueco en el hero y marcas de snippet. Detalle en [`references/pipeline.md`](references/pipeline.md)
  («Si la tarea es una PÁGINA»). Las landings no.
- **Antes de subir a un PR, comprueba que sigue abierto.** Un commit a una rama ya mergeada no
  llega a la de integración:
  `git merge-base --is-ancestor <commit> origin/<config.git.integrationBranch>` lo dice.
- **Nunca** toques ficheros que otra tarea `In Progress` haya declarado en "Files likely touched".
- **Nunca** renombres/borres hooks del backend (la sintaxis del perfil de hand-off, `config.repo.handoff`).
- **Nunca** pobles Storybook con datos falsos: solo stories de componentes reales.
- Hotspots compartidos (`config.repo.appendOnlyHotspots`) son **append-only**; en conflicto,
  conserva ambas líneas.
- No muevas una tarea de otra persona ni cierres nada sin el visto bueno del humano responsable.
- Confirma antes de acciones difíciles de revertir (push, merge, mover a Done, escribir en Confluence).
