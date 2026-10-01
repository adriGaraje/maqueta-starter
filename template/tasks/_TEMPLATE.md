<!--
  Task template. Copy to tasks/STARTERSLUG-<NNN>-<slug>.md, fill EVERY field, and add a row to
  tasks/backlog.md. Conventions: docs/jira-workflow.md · Git: docs/git-workflow.md
-->

# STARTERSLUG-NNN — <Imperative task title>

| Field       | Value                                             |
| ----------- | ------------------------------------------------- |
| **Type**    | Story · Task · Bug                                |
| **Epic**    | <epic name or —>                                  |
| **Sprint**  | STARTERSLUG Sprint N · Backlog                             |
| **Status**  | Backlog · To Do · In Progress · In Review · Done  |
| **Assignee**| unassigned · dev-1 · dev-2                        |
| **Estimate**| 1 · 2 · 3 · 5 · 8                                 |
| **Priority**| Highest · High · Medium · Low                    |
| **Labels**  | frontend, sass, component, …                      |
| **Branch**  | `<type>/STARTERSLUG-NNN-<slug>`                            |

## Context
<!-- Why this exists / where it fits. Link the Epic and any design. -->

## Goal
<!-- One or two sentences: the outcome, not the steps. -->

## Acceptance criteria
- [ ] <testable statement>
- [ ] Responsive (sm/md/lg), hover/focus states where relevant
- [ ] Accessibility: keyboard, aria, contrast
<!-- Si es una PÁGINA, estas cuatro van siempre (estándar de páginas, ver src/pages/README.md): -->
- [ ] Cabecera con submenú de sección: `cabeceraDePagina({ seccion, sub })`, fuera del `<main>`
- [ ] El primer módulo deja sitio a la barra (`--starterslug-header-space`)
- [ ] Marcas de snippet: `marcaSnippets(raiz)` y `compruebaSnippets()` en el `play`
- [ ] `npm run check:paginas` en verde

## Technical notes
<!-- Approach, tokens/mixins to use, existing patterns to follow, gotchas. -->

## Files likely touched
<!-- Explicit list — how parallel agents avoid collisions. -->
- `src/components/<name>/*`
- `src/styles/main.scss` (append @use)

## Dependencies
- Blocked by: —
- Blocks: —

## Definition of Done
- [ ] Meets all acceptance criteria
- [ ] `npm run build` / `npm run lint:css` / `npm run format:check` green
- [ ] PR merged to `main`, branch deleted, task → Done

## References
<!-- Figma / Django target / related tasks / URLs. -->
