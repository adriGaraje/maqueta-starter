# M0 · Ingesta — la cola de entrada

Cómo entran los módulos y las páginas al harness. Detalle del primer movimiento del ritual.

## Cómo se lee el `devStatus`

| Canal | Qué da |
| --- | --- |
| REST `GET /v1/files/:key` | **devuelve `devStatus`** — es el canal |
| `use_figma` (MCP) | `"devStatus" is not a supported API` |
| REST `/dev_resources` | 200, pero es otra cosa |

La entrada manual del correo es el plan B. Si `npm run figma:ready` da `403 File not
exportable`, es la cuenta o el token de quien llama, no el archivo (L-029): **cuando un error de
permisos sugiera una causa, acota antes de actuar sobre ella.**

> **Ojo con el falso negativo.** Si `campoAusente` sale `true`, eso **no** es
> «diseño no ha marcado nada»: es que estamos ciegos. Dilo con esas palabras en el parte y
> pide el enlace del correo. Los dos casos se parecen y solo uno permite trabajar.

## Los dos barridos de la mañana

### 1 · `npm run figma:ready` — qué ha marcado diseño

Recorre el árbol, se queda con los `READY_FOR_DEV` y los cruza contra `modules.json`.
Devuelve los nuevos con su `node-id`, medidas y enlace directo en modo dev.

### 2 · `npm run sitemap:sync` — qué ha terminado diseño

Lo de arriba solo ve lo que diseño **marca**. Esto ve lo que diseño **hace**: compara el
archivo entero contra `config.paths.siteMap` y devuelve tres montones.

| Montón | Qué es | Qué se hace con él |
| --- | --- | --- |
| `readyForDev` | lo marcado formalmente | **abre tarea en Jira** (ver abajo) |
| `disenoNuevo` | páginas que antes no tenían diseño y ahora sí, o que pasan de solo escritorio a escritorio y móvil | se registra en el mapa del sitio |
| `modulosNuevos` | capas del diseño que no casan con ningún módulo del catálogo | o es una pieza nueva, o le falta el alias |

Códigos de salida: **0** sin novedades · **1** hay novedades · **2** error de uso o de red.

Detalles que importan y que costaron un rato:

- **Una sola petición.** Pedir el archivo dos veces se pasa de minutos; del árbol entero sale
  todo en segundos.
- **El cruce va por alias declarados**, no por parecido de palabras. Cada módulo del catálogo
  lista sus nombres de capa en Figma (`cabecera` responde a `Menu`, `Navbar`, `Header`). La
  heurística anterior daba `Menu` como módulo desconocido teniéndolo el mapa desde el principio.
- **Las páginas se casan por node-id**, no por nombre. El `figma.nodeId` del mapa puede ser
  la página o un frame suyo: el barrido lo resuelve a la página que lo contiene. Por nombre,
  un emoji o un renombrado de diseño deja páginas como «sin registrar». Si el nodo ya no existe, sale en «nodos del mapa que ya
  no existen» y solo entonces se casa por nombre, sin emoji ni signos.
- **Se descartan las capas ocultas y los contenedores sin nombre.** Un texto suelto con
  `visible: false` no es una pieza por maquetar.
- **`disenoFijado` gana al detector.** Una página con un frame de escritorio a medias parece
  un avance y no lo es. Ese flag dice «aquí manda el criterio humano»; sin él, la misma falsa
  novedad saldría cada mañana hasta que nadie leyese el parte.

## Qué hace el ritual con lo que encuentra

> **Autonomía.** Lo marcado `READY_FOR_DEV` **genera tareas en Jira sin preguntar**, y se
> enseñan ya creadas en el parte. Lo demás (registrar diseño en el mapa, dar de alta módulos
> nuevos) se propone. Enterarse de que hay trabajo disponible no debe costar una conversación.

Por cada nodo marcado:

1. **Comprueba que no exista ya.** Se casa por `node-id`, nunca por nombre — un renombrado en
   Figma no puede duplicar una tarea. Si ya hay tarea para ese nodo, no se toca.
2. **El subagente `config.models.analyst.agentName` (el Ojo) lee el nodo** y redacta la
   descripción AI-ready según `config.docs.jiraWorkflow`: contexto, criterios de aceptación, ficheros, dependencias, tokens
   y hooks Django previstos.
3. **Se crea la tarea de la página**, y **una por cada módulo suyo que no exista en el repo**,
   enlazadas como dependencia de la de página. Es lo que refleja el trabajo real: la página no
   se puede cerrar sin sus piezas.
   La ficha de página lleva siempre, entre sus criterios, el **estándar de páginas**: cabecera con
   submenú (y qué sección y entrada marca), hueco en el primer módulo, marcas de snippet y
   `config.pageStandard.checkCmd` en verde. Ver `pipeline.md`, «Si la tarea es una PÁGINA».
4. **Se registra en `modules.json`** con `pipelineState: "design-ready"`.
5. **Sale en el parte** con lo que se ha creado, no con lo que se propone crear.

Lo que **sigue necesitando OK**: mover tareas de estado, cerrar nada, tocar tareas de otra
persona, y adoptar en el repo cualquier decisión de diseño (una escala nueva, un módulo que
puede que sea otro con distinto nombre).

## Leer también las notas

El `devStatus` no captura los matices. Diseño y cliente dejan avisos en frames de texto
sueltos (del tipo «Requisitos de diseño …») que contienen bloqueos reales, p. ej. «esto lo
dejamos en STDBY hasta resolver aquello».

Un módulo puede estar marcado ready **y** bloqueado por una nota. Barre esos frames y cruza lo
que digan con la cola: si hay contradicción, **gana la nota** y se avisa en el reporte.

## Entrada manual — el enlace del correo

Sigue valiendo cuando el barrido no puede leer el campo, o cuando diseño avisa por otra vía.
De la URL salen `fileKey` y `node-id`:

```
https://www.figma.com/design/<fileKey>/<nombre>?node-id=12-345&m=dev
                                                         ^^^^^^ → 12:345
```

Con eso: `get_screenshot` del nodo para confirmar que es la pieza, `node scripts/figma-ready-scan.mjs
--node 12:345` para los metadatos, y de ahí el mismo camino de arriba.

## Webhook — descartado por ahora

El evento `DEV_MODE_STATUS_UPDATE` de los webhooks v2 avisaría en el momento en vez de esperar
al barrido de la mañana. Sigue sin montarse y ya no urge: con `devStatus` legible, el barrido
diario cubre el caso. Además pedía un receptor HTTPS (Cloud Function con plan Blaze, porque
Actions está capado org-wide) y no tendría histórico — solo captura lo que pase después de
crearlo.
