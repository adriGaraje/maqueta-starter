# M5 · Cierre — "buenas noches"

El espejo del ritual de la mañana. Lo dispara el hook cuando el humano se despide
("me voy", "cerramos", "buenas noches", "hasta mañana") o al pedirlo a mano.

Su trabajo es que **mañana por la mañana el harness sepa dónde lo dejasteis**. Sin esto,
cada arranque empieza de cero y el parte pierde el "qué ha cambiado desde ayer".

## Pasos

### 1. Sincronizar espejo ↔ Jira

Recorre las tareas tocadas hoy y comprueba que `config.repo.tasksMirror`, el fichero
`tasks/<KEY>-###-*.md` (`<KEY>` = `config.atlassian.jira.projectKey`) y el estado real de Jira dicen lo mismo. Si divergen, **avisa y
propone** cuál gana (normalmente Jira). Es la desincronización más habitual del repo.

### 2. Registrar hitos

Por cada módulo que haya llegado a `Done` hoy, una fila en `docs/starterslug-harness/hitos.md`
(más reciente arriba): fecha · módulo · hito · quién · Jira · notas.

### 3. Recoger lecciones

Si durante el día se resolvió un fallo no trivial que **no** estaba en `lecciones-archivo.md` (búscalo en el índice `lecciones.md`),
añádelo como `L-NNN` con síntoma → causa → solución. Pregunta antes si hay dudas de si
merece entrada: el archivo vale por lo que se filtra, no por lo que se acumula.

### 4. Actualizar `state.json`

```json
{
  "ultimoCierre": "2026-07-21T19:40:00+02:00",
  "ultimoFoco": "nav (36:710) — spec extraída, pendiente de maquetar",
  "racha": { "dias": 3, "ultimoDiaConEntrega": "2026-07-21", "record": 5 },
  "vistoEnJira": { "issues": { "<KEY>-012": "2026-07-21T18:02:00Z" } }
}
```

- **`ultimoFoco`** es lo que más se agradece al día siguiente: una frase en cristiano
  de por dónde ibas. El hook de `SessionStart` la enseña antes de que preguntes nada.
- **`vistoEnJira`** es lo que permite que mañana el parte diga "comentario NUEVO" en vez
  de repetirte los mismos veinte comentarios cada día.
- **`racha`**: días laborables consecutivos con ≥1 módulo a `Done`. El finde no la rompe;
  un lunes en blanco, sí. Si se bate el récord, díselo — es el 80 % de la gracia.

### 5. Logros

Comprueba el catálogo de `docs/starterslug-harness/logros.md` y desbloquea lo que corresponda.
Muévelo de "Catálogo" a "Desbloqueados" con fecha y quién. Sin inventarse ninguno:
si la condición no se cumple exactamente, no se desbloquea.

### 6. Deploy pendiente

Si hay trabajo verde en `config.git.integrationBranch` que no está publicado
(`state.json → deploy.commitDesplegado` ≠ su HEAD), **ofrece** el deploy a Firebase al target de
esa rama en `config.deploy.targets` — ver `deploy.md`.
Con confirmación explícita y green previo. Nunca automático: publica algo que ve gente.

### 6 bis. Si es el último día de alguien: traspaso

Si el hook ha inyectado `traspaso="<saliente>→<relevo>"`, quien cierra deja hoy el proyecto
(`config.json → team[].salida`). Después de los pasos 1-6, ejecuta **`traspaso.md`** entero.
Está autorizado de antemano, así que aquí sí se reasigna en Jira y se hace commit, PR y merge.

### 7. Despedida

Un resumen corto en el chat: qué se cerró, qué queda en vuelo, la racha, y el logro si cayó
alguno. Sin reporte HTML — el parte visual es cosa de la mañana.

## Guardarraíles

- **No** hace commits ni push por su cuenta. Si hay trabajo sin commitear, lo dice y ofrece.
- **No** cierra tareas que el humano no haya aprobado durante el día.
- **No** inventa hitos ni logros para que el cierre quede bonito. Un día sin entregas se
  escribe como un día sin entregas.
