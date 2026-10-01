# Onboarding — poner a alguien a trabajar en Starternombre

> Lo ejecuta el asistente cuando alguien saluda por primera vez. Lo dispara el hook
> `ritual-detect.mjs`: si tu alias no está en `state.json → onboarding.hechoPor`, tu
> primer «buenos días» entra por aquí y **no** por el ritual.

## Cómo se ejecuta esto

Paso a paso y **con comprobación real** en cada uno: una llamada que devuelve datos, no una
deducción. Lo que no se pueda comprobar se anota como bloqueo y se sigue.

## 0 · Quién eres

Tu `git config user.email` tiene que estar en `config.json → team` (o en tus
`emailsAlternativos`). Si no está, el parte te enseñará tareas ajenas como tuyas: añade tu ficha.

## 1 · Jira, por el plugin del repo

`/mcp` → autenticar el plugin de Atlassian que declara `.claude/settings.json`. La instalación
es **por máquina**, no por repo: si no aparece ninguna tool de Jira, instálalo.

**Comprobación:** `getVisibleJiraProjects` devuelve el proyecto de `config.json → atlassian.jira.projectKey`.

## 2 · Reiniciar Claude Code

Las tools de un plugin recién autenticado no existen hasta el siguiente arranque. Los agentes
de `.claude/agents/` tampoco: el hook de SessionStart los copia, y se registran al reiniciar.

**Comprobación:** una llamada real a `searchJiraIssuesUsingJql` sobre el proyecto.

## 3 · Confluence

Lectura con el mismo plugin. La escritura depende de los permisos del espacio.

**Comprobación:** leer la página índice de `config.json → atlassian.confluence.indexPageId`.

## 4 · Figma

`/mcp` → autenticar el plugin de Figma. Necesita asiento en la organización del archivo; si
no llega al archivo, es una licencia que falta, no configuración: anótalo y sigue.

**Comprobación:** `get_screenshot` de un nodo conocido de `config.json → figma.files`.

## 5 · El archivo de Figma bueno, en el `.env`

`FIGMA_FILE_KEY=<fileKey>` y `FIGMA_TOKEN` en `.env` (sin comillas raras). **Un archivo
equivocado no falla**: contesta 200 y devuelve nada. Antes de dar una fileKey por buena,
resuelve un nodo conocido contra ella.

## 6 · El entorno

```bash
node -v          # la de .nvmrc
npm install
npm run storybook # localhost:6006
```

Si creas o renombras un fichero de story, **reinicia** `npm run storybook`: la lista se calcula
al arrancar y un fichero nuevo no se recoge.

**Comprobación:** que abra el Storybook y vea las piezas. Es el entregable.

## 7 · Cómo se trabaja aquí

- Los PR van contra `develop`, nunca contra `main`. Una entrega es un PR `develop → main`.
- Una tarea = una rama = un PR. Verde antes de PR: `npm run build`, `npm run lint:css`,
  `npm run format:check`. Y `npm run check:stories` si tocas una story suspendida.

## 8 · Qué leer, y en este orden

1. **[`lecciones.md`](lecciones.md)** — fallos ya resueltos, por rol. Lo que más tiempo ahorra.
2. **[`../../CLAUDE.md`](../../CLAUDE.md)** — el contrato del repo.
3. **[`../git-workflow.md`](../git-workflow.md)** y **[`../jira-workflow.md`](../jira-workflow.md)**.
4. **[`config.json`](config.json)** — cómo está montado el harness.

## Al terminar

**Propón** añadir el alias a `state.json → onboarding.hechoPor`. Es lo que hace que el
onboarding no vuelva a saltar. Se propone, no se escribe solo.

Si quedó algo bloqueado (asiento de Figma, permisos), que salga en el primer parte como aviso.
