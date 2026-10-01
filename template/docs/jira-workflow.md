# Cómo trabajamos en Jira

> **El tablero manda.** Proyecto `STARTERSLUG` en `<site>.atlassian.net`. Si el tablero y este
> repo se contradicen, gana el tablero.
>
> Este documento existe por una razón concreta: **la PM sigue el proyecto mirando el kanban del
> backlog.** No pregunta, no entra al repo, no lee PRs. Lo que no esté reflejado ahí, para ella
> no ha pasado. Mover la tarjeta no es burocracia: es el informe de estado.

## Entregables, no sprints

No hay sprints. Trabajamos por **entregables**, y cada entregable es un **Epic**:

| Epic | Entregable | Estado |
| --- | --- | --- |
| `STARTERSLUG-1` | **Entregable 1 · <página>** | en marcha |

Un entregable se cierra cuando todas sus tareas están en `Listo`: entonces esa página está
maquetada y se puede enseñar. La barra de progreso del epic **es** el avance del entregable, y
es lo que mira la PM.

Los siguientes entregables se desglosan
cuando el anterior esté cerca de cerrarse, no antes.

## Las capas van en etiquetas

Dentro de un entregable, cada tarea lleva una etiqueta de capa. Marca el orden de ataque:

| Etiqueta | Qué es | Cuándo |
| --- | --- | --- |
| `atomo` | Iconos, botones, badges, tabs, separadores | Primero: todo lo demás los usa |
| `molecula` | Cards, precios, listas, barras de tabs | Después: componen átomos |
| `modulo` | Las secciones de la página | Al final: componen moléculas |

Hay etiquetas adicionales por zona (`tarifas`, `footer`, `hero`, `promos`, `app`, `manifiesto`,
`tv`) y dos de aviso: `clave` (pieza con muchas dependencias) y `bloqueada`.

## Los estados del tablero

| Estado | Qué significa de verdad |
| --- | --- |
| `Por hacer` | Definida y lista para cogerse |
| `En curso` | Alguien la tiene y está trabajando en ella **ahora** |
| `En revisión` | Terminada, con PR abierto esperando revisión |
| `Bloqueado` | No se puede avanzar por algo externo |
| `Listo` | Mergeada en `develop` y verificada |

## Cuándo se mueve cada cosa

**Esta es la parte que no se salta.** Sin esto el tablero miente, y un tablero que miente es
peor que no tener tablero.

| Momento | Qué haces en Jira |
| --- | --- |
| Coges la tarea | `Por hacer` → **`En curso`** y te asignas |
| Creas la rama | Comentas el nombre de la rama |
| Abres el PR | `En curso` → **`En revisión`** y comentas el enlace del PR |
| Te mergean | `En revisión` → **`Listo`** |
| Te atascas | → **`Bloqueado`**, marcas *Impediment* y **comentas por qué** |
| Descubres algo que afecta a otra tarea | Lo comentas **en la otra tarea**, no solo en la tuya |

Reglas que van con esto:

- **Una tarea `En curso` por persona.** Si necesitas empezar otra, cierra o devuelve la primera.
- **`Bloqueado` siempre lleva comentario.** Una tarjeta bloqueada sin explicación no le sirve a
  nadie; es justo la que la PM va a mirar primero.
- **No se salta a `Listo`.** Aunque el cambio sea de una línea, pasa por `En revisión`.
- **No cojas una tarea cuyas dependencias no estén en `Listo`.** Están en el apartado *Depende de*
  de cada tarea.
- **Antes de coger una tarea, mira los ficheros que toca.** Si otra tarea `En curso` toca los
  mismos, coge otra. Está en el apartado *Ficheros que va a tocar*.

## Cómo está escrita una tarea

Cada tarea es autosuficiente: alguien sin contexto puede cogerla y empezar. Lleva:

- **Qué es** — una frase.
- **Dónde en Figma** — el nodo exacto, con enlace directo o con la ruta de capas si está dentro
  de una instancia y no se puede abrir por URL.
- **Captura** — la ruta del PNG en `docs/assets/home/`.
- **Especificación** — medidas reales y contenido real, no aproximaciones.
- **Aceptación** — la lista contra la que se autoverifica antes de abrir el PR.
- **Ficheros que va a tocar** — para no pisarse.
- **Depende de** — qué tiene que estar `Listo` antes.

Todo enlaza a `docs/task-brief.md`, que tiene lo común: cómo abrir el
Figma, las reglas del proyecto y la definición de terminado.

## Claves y ramas

- La clave de Jira es **`STARTERSLUG-N`**, sin ceros a la izquierda: `STARTERSLUG-17`, no `STARTERSLUG-017`.
- Rama: `<tipo>/STARTERSLUG-<n>-<slug>` → `feat/STARTERSLUG-17-boton-secundario`
- Commit: `tipo(scope): resumen [STARTERSLUG-17]`
- PR: título `[STARTERSLUG-17] <resumen>`, **contra `develop`**. Nunca contra `main`.


## El espejo local

[`tasks/`](../tasks/) es un espejo de Jira: una ficha por tarea y
[`tasks/backlog.md`](../tasks/backlog.md) con la tabla completa. Sirve para trabajar sin abrir
el navegador.

**No duplica la descripción** — esa vive en Jira, que es la fuente de verdad. La ficha guarda lo
necesario para no pisarse: ficheros, dependencias y enlaces.

Se regenera, no se edita a mano:

```bash
node scripts/jira-mirror.mjs --board <dump.json>
```

### Quién manda sobre cada columna

| Dato | Fuente |
| --- | --- |
| Título · Estado · Asignada | **Jira.** Se leen del tablero en cada ejecución. |
| Nodo de Figma · captura · dependencias · ficheros · rama | **El repo.** Jira no los conoce; viven en la tabla del propio script. |

El vuelco del tablero lo genera la skill `starterslug-flow` por MCP, igual que el drift-check de tokens
consume un vuelco de Figma (ver [`design-tokens.md`](design-tokens.md)): los scripts no tienen
credenciales, el agente sí. Si prefieres que el script se lo pida solo, pon `JIRA_EMAIL` y
`JIRA_API_TOKEN` en el `.env` y llámalo sin `--board`.

> **Sin datos del tablero el script falla a propósito** (exit 2). Hasta el 2026-08-04 escribía
> `Por hacer` y `sin asignar` como literales, así que cada ejecución devolvía el backlog al día
> cero: el fichero que se anunciaba como «espejo de Jira» era justo el que borraba el estado.
> Para trabajar sin red está `--sin-estado`, que regenera lo local y marca esas dos columnas
> como no comprobadas en vez de inventárselas.

## Lo que todavía no tenemos

Por si alguien lo echa en falta:

- **Sin estimación.** El proyecto no tiene campo de puntos, así que no hay burn-up ni previsión
  de fecha. Se activaría en Ajustes del proyecto → Estimación (hace falta admin).
- **Sin integración con GitHub.** Decidido a propósito: la PM sigue el kanban, no los commits.
  Por eso el enlace del PR se pega **a mano** en un comentario al pasar a `En revisión` — si no,
  esa trazabilidad se pierde.
