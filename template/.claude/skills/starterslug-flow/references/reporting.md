# Reportes visuales (spec de diseño)

Los reportes del harness se publican como **Artifacts HTML** (tool `Artifact`) — modernos,
theme-aware, self-contained, con interacciones ligeras pero muy visuales. Antes de construir
cualquiera, carga la skill `artifact-design` (y `dataviz` si hay gráficos).

## Identidad visual (marca del proyecto)

- **Paleta de marca.** Sale de `config.tokens.snapshotFile`, que es el volcado real de los
  styles de Figma. **No la escribas de memoria** ni la copies aquí: léela del snapshot cada vez.
  Asigna por papel: primario (acciones, barras), oscuro (fondos, cabecera), acento (hovers),
  OK/entregado, aviso, atrasado, destacado, texto sobre claro y texto secundario — cada uno al
  style de marca que mejor lo cumpla. Deriva tokens de estos, no colores sueltos.
- **Tema doble obligatorio:** `@media (prefers-color-scheme: dark)` + overrides
  `:root[data-theme="dark"]` / `[data-theme="light"]` (el toggle del visor debe ganar en ambos sentidos).
- **Tipografía:** system stack; jerarquía clara; números tabulares para métricas.
- **Layout:** grid responsive, `max-width` contenido, sin scroll horizontal del body (tablas/anchos
  con su propio `overflow-x:auto`). Tarjetas con radios amplios, sombras suaves, mucho aire.
- **Interacciones ligeras:** hover-lift en tarjetas, chips de estado con color por categoría,
  transiciones cortas, contadores/looks de "stat tile". Nada pesado ni dependencias externas.
- **Favicon:** `📊` para el reporte de día; `🎯` para el de pixel-perfect. Mantén el mismo entre redeploys.

## Reporte de arranque de día

**Título:** `{config.project.displayName} · Arranque {fecha}`. **Estructura:**
1. **Cabecera** — fecha, sprint activo, y una fila de **stat tiles**: tareas tuyas abiertas,
   tareas del resto del equipo, módulos listos para dev, warnings, entregados esta semana.
2. **Una columna "Tú" y una por cada compañero `activo`** (los nombres salen de `config.json →
   team`, no los escribas a mano) — tarjetas de tarea con: código `<KEY>-###` (`config.atlassian.jira.projectKey`), título, chip de estado
   (color por categoría Jira), asignado, y **badge de "comentario nuevo"** o "cambió de estado" si aplica.
   Cada tarjeta enlaza a `https://<config.atlassian.site>/browse/<KEY>-###`.
3. **Cola "Listo para dev"** — módulos disparados (Jira `ready-to-dev` + Excel), con fase, prioridad y
   dependencias; marca los que están desbloqueados.
4. **⚠️ Warnings / atrasadas** — panel destacado: bloqueadas, revisiones estancadas, dependencias sin
   cerrar, avisos de `lecciones.md`. Si está vacío, muéstralo en verde ("sin warnings").
5. **✅ Entregados** — mini-lista de lo cerrado desde el último arranque.
6. **🆕 Novedades de diseño** — qué se ha marcado como ready-to-dev desde ayer y qué tickets
   propone crear M0. Si el barrido no pudo leer el `devStatus` (ver `ingesta.md`), **dilo aquí
   explícitamente**: "no se pudo comprobar", nunca "0 módulos nuevos".
7. **🌡️ Termómetro del design system** — barras de progreso por nivel (átomos / moléculas /
   organismos / plantillas) sobre el total conocido en `modules.json`, con el % global.
   Es la única métrica de avance real que hay; crece sola según diseño libera piezas.
   El denominador es "lo que sabemos hoy" — dilo en la propia tarjeta para que nadie lea
   un 80 % como "queda poco".
8. **🔥 Racha y logros** — días consecutivos con entrega (de `state.json`), récord, y los
   logros desbloqueados en `logros.md`. Va en la cabecera, junto a los stat tiles.

Datos **reales** vía `searchJiraIssuesUsingJql`. Nada de placeholders. Si un bloque no tiene datos,
dilo explícitamente en el propio reporte.

## Reporte de pixel-perfect

**Título:** `{config.project.displayName} · Pixel-perfect · {módulo}`. **Estructura:**
1. Cabecera con módulo, `<KEY>-###`, **score** grande (anillo/medidor) y veredicto (verde/ámbar/rojo).
2. **Comparativa lado a lado**: Figma (referencia) vs Storybook (build), con toggle/slider si es fácil.
3. **Tabla de diffs**: zona · problema · fix · estado (resuelto/pendiente), coloreada por severidad.
4. **Metadatos**: tiempo de build, iteraciones hasta green, tokens/medidas comprobadas.

## Persistencia

- Guarda copia HTML en `docs/starterslug-harness/reports/<slug>/` (versionado por git para compartir).
- Publica el Artifact para verlo en el navegador. Reutiliza el mismo `file_path` para redeploy
  (mismo URL) cuando actualices un reporte del mismo módulo/día.

## Regla de oro

Real, claro y honesto: los reportes reflejan el estado **real** del board y del build. Un reporte
bonito con datos inventados es peor que no tener reporte. Si algo no se pudo comprobar, se dice.
