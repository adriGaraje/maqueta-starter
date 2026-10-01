# M3 · Housekeeping — el mantenimiento aburrido de Jira

Reglas que el ritual aplica cada mañana sobre el board. Detecta desajustes entre el
estado real del trabajo (git, PRs, build) y lo que dice Jira, que es donde siempre
se desincroniza todo.

## Regla de oro

**Nivel de autonomía pactado: PROPONER, no ejecutar.** Cada regla produce una fila en
el reporte con la acción sugerida y un botón mental de "¿lo hago?". Nada se transiciona,
comenta ni cierra sin OK explícito del humano en esa misma sesión.

Y nunca, bajo ninguna regla, se toca una tarea **asignada a otra persona**. Sobre las de
los demás solo se observa y se informa. Quién es «otra persona» sale de `config.json → team`
cruzado con quién está usando el harness, no de una lista escrita aquí.

## Las reglas

### 1. PR mergeado, tarea abierta

Tarea en `En revisión` cuyo PR está mergeado (`gh pr view --json state`).
→ **Propone** mover a `Listo` y cerrar el ciclo (backlog, `modules.json`, hito).

### 2. Tarea estancada

Tarea tuya `En curso` sin commits en su rama en ≥ `config.housekeeping.staleDays` días laborables.
→ **Propone**: retomarla, comentarla con un "sigo en ello", o devolverla a la cola.
Un `En curso` viejo bloquea la pieza para el resto del equipo sin que ellos lo sepan.

### 3. Revisión olvidada

Tarea en `En revisión` con > `config.housekeeping.reviewDays` días y sin comentarios nuevos.
→ **Propone** recordatorio al revisor mencionándole por `accountId`.

### 4. Comentario nuevo

Comentario en una tarea tuya posterior al `state.json → vistoEnJira`.
→ Lo trae **al reporte, citado**, y prepara un borrador de respuesta. No responde solo:
un comentario en Jira lo lee gente y no se manda en tu nombre sin que lo leas.

### 5. Vuelta de revisión

Tarea movida a `Pendiente de revisar` (fallback `En curso`) con comentarios.
→ **Pre-digiere la lista de ajustes** desde los comentarios, agrupada por fichero, para
que el pipeline arranque con los diffs ya masticados.

### 6. Dependencia desbloqueada

Tarea `Bloqueado` cuya dependencia pasó a `Listo` desde el último arranque.
→ La sube al top de la cola y lo marca como novedad del día. Es la que más tiempo ahorra.

### 7. Bloqueo de diseño

Módulo en la cola que una nota de Figma marca como STDBY (ver `ingesta.md`).
→ Lo saca de "listos para empezar" y lo pinta en warnings citando la nota y quién la firmó.

### 8. Drift de tokens

Si el chequeo de arranque detecta deriva en `config.tokens.colorsFile`.
→ Lo resalta con token, valor antes→después, y **lo aplica en la rama de la tarea que se
arranque**, nunca en `config.git.integrationBranch`.

## Descubrimiento de estados

Nunca uses IDs de transición fijos. Sobre cada tarea, `getTransitionsForJiraIssue` y casa
**por nombre** contra `config.stateMachine`. Si un estado tiene `pending: true` y aún no
existe en el board, usa su `fallbackOf`.

Con un estado en fallback, las reglas 5 y 7 funcionan a medias: `Pendiente de revisar` cae en
`En curso` y se confunde con trabajo activo. La vuelta de revisión se reconoce por el
**comentario** de la tarea, no por el estado.

## Lo que NO hace

- No cierra tareas. Cerrar es del humano.
- No mueve tareas de otra persona.
- No responde comentarios en tu nombre.
- No crea issues (eso es M0, y también proponiendo).
- No hace push ni merge.
