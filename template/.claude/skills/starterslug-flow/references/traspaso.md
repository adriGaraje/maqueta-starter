# Traspaso: cuando alguien deja el proyecto

Qué hace el harness cuando una persona del equipo se va y otra, o varias, se quedan con lo suyo. Lo dispara
el **cierre (M5) de su último día**. El hook `ritual-detect.mjs` lo detecta con
`config.json → team[].salida` e inyecta `traspaso="<saliente>→<relevo>[+<relevo>…]"` en el cierre. `salida.relevo` admite
un alias o una lista de alias.

> **Quien se va programa su salida** en `team[].salida` (último día, relevo o relevos, reparto
> previo si lo hay) y deja **autorizado de antemano** el traspaso completo en su último cierre.
> Desde el día siguiente, todo lo suyo (Jira, repo, harness y entregas) lo llevan sus relevos.
>
> Es la única excepción a dos reglas del harness: «nunca toques tareas de otra persona» y
> «el cierre no hace commits ni push». Aquí sí se reasigna, se commitea, se abre PR y se
> mergea a `config.git.integrationBranch`, porque al día siguiente ya no está quien tendría que dar el OK.

## Red de seguridad

Si el último día no hay cierre (se olvida el «me voy», o se cierra la sesión sin más), el hook
de `SessionStart` avisa desde el día siguiente con **«⚠️ Traspaso pendiente»**, lo abra quien
lo abra. Se ejecuta entonces este mismo procedimiento, desde la máquina que sea. Lo único que
no se podrá hacer es el paso 5, porque la memoria local solo existe en la máquina de quien se
fue: se dice así en el documento de traspaso.

## Antes del último día: checklist con cada relevo

Lo que el harness no puede hacer por nadie. Se repasa **antes** del último día, con las dos
personas delante, porque después ya no hay a quién preguntar. **Se repasa con cada relevo**:
que lo tenga uno no sirve si el otro está solo el día que haga falta.

- [ ] **Figma REST.** El relevo corre `npm run figma:ready` en su máquina, con su propio token
      en `.env`. Si da `403 File not exportable` (L-029), la ingesta de la mañana (M0) queda
      ciega. Se arregla en su cuenta o su token, no en el archivo: con otra credencial exporta.
- [ ] **Firebase.** El relevo hace `npx firebase-tools login` con una cuenta que tenga acceso al
      proyecto `config.deploy.firebaseProject` y lo prueba con `npm run deploy:pre` desde una
      rama. Sin esto no hay ni verificación ni entregas.
- [ ] **GitHub.** El relevo puede mergear PR a `config.git.integrationBranch` y a
      `config.git.releaseBranch` en `config.repo.remote` y subir tags (`git push origin entrega/…`).
- [ ] **Jira.** El relevo puede asignar y transicionar en el board `config.atlassian.jira.boardId`.
- [ ] **La entrega.** El relevo ha visto una entrega entera: PR `release/…` →
      `config.git.releaseBranch`, `npm run deploy` desde ella (el target de entrega va **sin** el
      rótulo «EN CURSO») y el push del tag.
- [ ] **Con quién se habla.** `config.contacts`: las dudas de Figma van a `contacts.design`; las
      de texto y contenido, a `contacts.client`.

## Pasos (en el cierre del último día)

Primero, **el cierre normal entero** (`cierre.md`, pasos 1-6): el trabajo del día se apunta a
nombre de quien lo hizo. Después:

### 1. Inventario (solo lectura)

- **Jira:** `project = <config.atlassian.jira.projectKey> AND assignee = <accountId saliente> AND statusCategory != Done`.
- **GitHub:** los PR abiertos de la persona, y sus ramas remotas sin mergear
  (`git branch -r --no-merged origin/<config.git.integrationBranch>`, filtrando por autor).
- **`modules.json`:** entradas con `assignee` = alias saliente y `pipelineState` distinto de `done`.
- **Su máquina:** `git status`, `git stash list` y `git worktree list`. **Si hay trabajo sin
  subir, se para aquí y se pregunta.** Lo que no está en origin no se puede traspasar.

Enséñalo en el chat antes de tocar nada, para que se vea qué va a pasar.

### 2. Jira

Cada tarea del inventario se **reasigna a un relevo sin cambiarle el estado**, con
`editJiraIssue` y su `accountId`. Jira solo admite un responsable por tarea, así que **con
varios relevos hay que repartir**: en el inventario del paso 1 se propone a quién va cada
tarea y **decide quien se va**, que en el cierre todavía está delante. **Si `salida.reparto`
ya fija a quién va una tarea, se respeta sin volver a preguntar**: es una decisión tomada antes,
con su nota, y no se reabre en la despedida. Si no hay nadie para
decidir (traspaso tardío), todo va al **primer relevo de la lista** y el comentario menciona
a todos. Si un relevo aún **no es asignable en el proyecto de Jira**, su tarea va
al otro y el comentario dice para quién es. Además, se le deja un comentario que menciona a
los relevos: quién se va y cuándo, en qué estado la recibe y, en una o dos líneas, el contexto
que no esté ya en la ficha. Las tareas sin asignar y las de otras personas no se tocan.

### 3. GitHub

Los PR abiertos **no se cierran**: se comenta en cada uno a qué relevo pasa, con el mismo reparto
que en Jira. Las ramas sin PR
tampoco se borran: van listadas en el documento de traspaso.

### 4. `modules.json`

`assignee` → alias del relevo que se quede con la pieza, igual que en Jira, en todo lo que no
esté en `done`.

### 5. La memoria que no está en el repo

La auto-memoria de Claude Code (`~/.claude/projects/<proyecto>/memory/`) vive **solo en la
máquina de quien se va**, y ahí hay criterios que el equipo aplica a diario (los targets de
deploy no publican lo mismo, preguntas a diseño por nombre de componente, quién es quién…). Si no se vuelca, el
relevo empieza sin ellos.

Pásalas a `docs/starterslug-harness/criterios-heredados.md`, con una sección por criterio: la regla,
el porqué y cómo se aplica. Solo las de tipo `feedback`, `project` y `reference` que sigan
vigentes y no estén ya escritas en el repo. **Compruébalas contra el código antes de copiarlas**:
una memoria es una foto de un día. No copies las personales (cuentas propias, preferencias de
estilo de esa persona). Enlaza el fichero desde `CLAUDE.md → Deep-dive docs`.

### 6. El documento de traspaso

un fichero aparte, dirigido a los relevos y en español:

- **Lo que recibís:** tabla de tareas (clave, título, estado, **para quién**, lo siguiente que hay que hacer),
  PR abiertos y ramas sin mergear.
- **Decisiones pendientes:** lo abierto en un fichero aparte y lo que quedó a medias en
  el último `ultimoFoco`.
- **Cómo está pro:** la última entrega (tag), qué lleva y qué va rotulado en pre.
- **Accesos:** el checklist de arriba, con lo que quedó sin comprobar marcado bien a la vista.
- **Vuestro primer día:** qué hace cada uno al abrir la sesión.

### 7. `config.json`

- Saliente: `activo: false`, `isDefaultUser: false`, y `salida.traspasoHecho` con fecha y hora.
- Primer relevo de la lista: `isDefaultUser: true`. Solo puede haber uno, y es solo el desempate
  cuando un correo no casa con nadie: no da más peso a una persona que a otra.

Con `activo: false`, el barrido de la mañana deja de consultarle y **no vuelve a salir en los
partes**. La ficha no se borra: el histórico (hitos, logros, «decisión de…») la sigue nombrando, y
si la persona vuelve basta con cambiar `activo` a true.

### 8. `state.json`

- `ultimoFoco` se reescribe **para los relevos**: es lo primero que ven el día siguiente. Una
  frase de bienvenida, el enlace al documento de traspaso y por dónde seguir. **Lo que `salida.reparto`
  fija para un relevo va lo primero, con su nombre**, citando la nota: es lo que tiene que ver en su
  primer parte sin buscarlo.
- `racha` sigue igual, porque es del equipo y no de una persona.
- Se añade un registro en `traspasos` con la fecha, quién, a quiénes, y cuántas tareas y PR a cada uno.

### 9. Commit, PR y merge

Rama `chore/traspaso-<saliente>-<relevo>` desde `config.git.integrationBranch` fresco. Commit,
push y PR a esa rama, y **se mergea** (autorizado de antemano). Después se comprueba con
`merge-base` que el commit está en `origin/<config.git.integrationBranch>` (L-085). Si el merge falla, el PR se queda abierto y
se dice alto en la despedida: lo mergea el primero de los relevos que llegue.

### 10. Despedida

En el chat: cuántas tareas y PR han pasado a cada relevo, dónde está el documento y lo que quedó sin
comprobar del checklist. Sin adornos.

## Lo que el traspaso no hace

- No cierra tareas ni PR, ni borra ramas.
- No toca las tareas de terceros ni las que están sin asignar.
- No cambia el histórico: hitos, logros, lecciones y «decisión de X» siguen como están.
- No reasigna nada si queda trabajo sin subir en la máquina de quien se va: primero se sube.
