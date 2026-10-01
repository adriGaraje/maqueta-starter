# Lecciones — Starternombre harness · ÍNDICE POR ROL

> Una línea por lección: título y regla. **Cada agente lee solo su sección.** El texto completo
> está en [`lecciones-archivo.md`](lecciones-archivo.md); se consulta una lección concreta con
> `grep -n '^## L-0xx' docs/starterslug-harness/lecciones-archivo.md`, nunca entero.
>
> Heredadas de la plantilla: las genéricas, con su numeración original (por eso hay huecos).
> **Alta de una lección nueva:** entrada completa arriba del archivo (síntoma → causa → solución →
> regla general) y su línea aquí, en la sección del rol al que sirve. Numeración correlativa.

## Para la Mano · maquetar (léelas antes de tocar SCSS o partials)

- **L-095** · Un absoluto sin ancestro posicionado se escapa del `overflow` que lo recorta — cuando algo desborda y el culpable «parece recortado», mira su bloque contenedor, no su ancestro con `overflow`.
- **L-094** · Un paréntesis sin cerrar no tira una regla de CSS: se lleva el resto de la hoja — una lista de selectores no se parte por comas, se parte por comas de primer nivel — igual que no se parte un CSV por comas sin mirar las comillas.
- **L-090** · Un `padding` no reproduce una caja de Figma que no cambia con el cuerpo de letra — cuando una caja de Figma no depende del cuerpo de letra y el texto sí, el aire entre ambos no es una constante.
- **L-089** · `vertical-align` en `em` no mide en el cuerpo del padre, y el subíndice se queda a medio bajar — cuando dos propiedades de la misma regla se miden en `em` y una de ellas es `font-size`, la segunda ya está en otra escala.
- **L-088** · Un gate rápido puede necesitar un paso previo — Si un gate importa un artefacto que genera otro paso del pipeline de entrega, ejecuta ese paso antes, aunque el gate en sí sea el más rápido de correr.
- **L-086** · Cuatro `play` en rojo y ninguna pieza rota: dos nunca pasaron y uno medía con una regla que se partía — un rojo fijo no es una regresión hasta que se demuestre que alguna vez fue verde. Antes de buscar qué cambio lo rompió, mira la fecha del aserto contra la del gate qu
- **L-084** · El submenú de la cabecera empujaba la página 44 px, y en su story no se veía — un estado que se abre se prueba montado en su sitio real, no solo en su story, y midiendo: la posición del primer módulo antes y después de abrirlo.
- **L-083** · Un `backdrop-filter` con máscara se sale del recorte redondeado del padre — `overflow: hidden` + `border-radius` en el padre no es garantía de recorte.
- **L-082** · Reiniciar un servidor que no se murió: media hora midiendo el proceso viejo — cuando un cambio de configuración no mueve el resultado ni un poco, sospecha del proceso antes que del cambio.
- **L-081** · Catorce tablas rotas en la entrega, y el código estaba bien — una sintaxis que el parser no reconoce no da error: da texto.
- **L-077** · Un servidor de desarrollo vivo no sirve lo que hay en disco — localizar al que ocupa el puerto (`Get-NetTCPConnection -LocalPort 6006` → PID → `Get-CimInstance Win32_Process` para confirmar que es el tuyo), cerrarlo y arrancar de nu
- **L-076** · Un `min-height` de otro breakpoint no rompe el layout: rompe la animación, y en silencio — una propiedad de otro breakpoint que no rompe el reposo puede estar destrozando el recorrido.
- **L-075** · Un `transition: padding` no es una decisión sobre el aire: es una decisión sobre el ancho del texto — cualquier propiedad que toque la caja de línea —`padding` y `margin` horizontales, `width`, `font-size`— recompone el párrafo en cada fotograma si entra en una transi
- **L-072** · `npx storybook build` no es `npm run build-storybook`, y la diferencia acusa a otro — cuando un fallo aparece exactamente en el fichero de otra persona, sospecha primero de cómo lo estás ejecutando tú.
- **L-069** · El gate de hooks mide la build que encuentra, no la que acabas de escribir — un chequeo que lee un artefacto del disco tiene dos modos de mentir, no uno.
- **L-066** · Un aviso no evita el fallo; un gate sí — Un aviso escrito al lado de código compartido no impide que el fallo se repita; conviértelo en un gate automático que compruebe que las copias/consumidores no se han desincronizado.
- **L-064** · Un `play` que revienta en su primera línea parece un `play` que no hace nada — `await waitFor(() => expect(...).toHaveLength(1))`.
- **L-062** · Una guardia puede tener el mismo fallo que viene a arreglar — cuando el fallo es «leer una propiedad de este objeto lanza», toda guardia que lea una propiedad de ese mismo objeto es sospechosa.
- **L-061** · Un fallo que «no se reproduce» puede tener el mecanismo a mano — cuando un fallo intermitente no se deja reproducir, separa mecanismo de disparador.
- **L-058** · La lista de `init` de una página se escribe a mano, y lo que falta no lo dice nadie — `initTabs` en la página, y el filtro de velocidad extraído a `modules/tariffs/filtro-velocidad.js`, que usan los dos consumidores.
- **L-057** · `down(X)` no es «por debajo de X» — En mixins de breakpoint down/up, los cortes de un mismo eje tienen que casar — si escritorio entra en up(X), móvil acaba en down(el breakpoint anterior) —; sospecha de solape si el mismo fichero usa los dos con el mismo nombre.
- **L-054** · Una pieza no lee la variable de otra — El código de un componente solo debe leer de lo compartido común (settings/tools/framework), nunca de un componente vecino; verifícalo compilándolo aislado, porque el orden normal del build puede esconder la dependencia.
- **L-051** · Un token «fuente de verdad» que nadie leía — Un token documentado como fuente de verdad no sirve de nada si ningún fichero lo lee de verdad; verifícalo con una comprobación en tiempo de ejecución, no leyendo el código.
- **L-050** · Un estado debe repetir cada propiedad de su base — Un estado (`:hover` y similares) que no repite explícitamente cada propiedad de su base hereda la del framework si esta tiene más especificidad; audita el CSS compilado en el estado real, no el SCSS en reposo.
- **L-047** · `flex-basis` no encoge una imagen, y una prueba con imagen falsa lo tapa — en un contenedor flex, `flex-basis` es un deseo y `min-width: auto` es la ley.
- **L-046** · Un comentario caduca con la dependencia que justificaba — Cuando migres una dependencia, los comentarios que se apoyaban en ella son código a revisar, no prosa: búscalos por el nombre de la dependencia, no por el síntoma.
- **L-042** · Un Storybook viejo dice que tu trabajo no existe, y suena convincente — la pantalla es una build, y una build tiene fecha.
- **L-041** · «Sin padding» no es neutral cuando hay dos ritmos de página — un módulo sin padding de sección no es agnóstico: es una apuesta silenciosa por el ritmo de la Home.
- **L-040** · Un regex perezoso se traga bloques hermanos — Un patrón/regex perezoso entre dos marcas de apertura y cierre no delimita un bloque: se traga bloques hermanos del mismo tipo hasta la siguiente marca que encuentre; hace falta un candado que le impida cruzar la siguiente apertura.
- **L-039** · Cambiar `display` a `flex` no borra el `justify-content` de la rejilla que había debajo — al reescribir el `display` de un selector que ya tenía estilos, hay que repasar todas las propiedades de alineación heredadas del modo anterior (`justify-content`, `a
- **L-037** · Renombrar el export de una story deja referencias muertas que los cuatro gates aplauden — un rename no termina en la declaración.
- **L-036** · Las paradas de un degradado de Figma NO son porcentajes de la caja — de un degradado de Figma hacen falta dos datos, y los stops son solo uno.
- **L-026** · Un renombrado por palabra se come la prosa, y algunas palabras son nombres de producto — antes de un reemplazo masivo, pregúntate si el identificador es también una palabra.
- **L-025** · `prettier --write` sobre `.mdx` los rompe, y por eso el `format:check` no los cubre — el `format` del repo cubre `js/scss/html` y no mdx a propósito, no por olvido.
- **L-024** · El hueco de la rejilla se estira; la card de dentro, no — `grid-auto-rows: 1fr` en el contenedor nivela todas las filas a la más alta, y `height: 100%` en la card hace que llene su hueco.
- **L-022** · El `replace` se gasta en el comentario de cabecera — quitar el comentario primero y sustituir después.
- **L-020** · Storybook llama al `render` con `{}`, no con `undefined` — desestructurar campo a campo con su valor por defecto — `pinta({ title = TITULO, items = ITEMS } = {})` — en vez de tomar el objeto entero.
- **L-019** · Dos mixins con la misma intención, distinta geometría — Dos utilidades que dicen hacer lo mismo con implementaciones distintas son una bomba de relojería que solo explota en el rango donde nadie mira; únelas en una sola regla compartida.
- **L-017** · PowerShell se come los acentos, y los cuatro gates lo aplauden — para tocar ficheros con texto en español, node o el tooling del agente, que leen y escriben UTF-8 sin que haya que pedírselo.
- **L-016** · Lo que monta la story no es el snippet — `.storybook/limpia-fuente.js`, aplicado en el panel y en `docs.source.transform`, e idempotente para que ninguno dependa del otro.
- **L-014** · Nuestro design system rompió el resaltador de código — una clase global de una sola palabra —`.tag`, `.card`, `.title`— no es un nombre, es una apuesta a que nadie más la use.
- **L-012** · Un BOM en medio del CSS se come la primera regla, en silencio — quitar el BOM siempre de la salida de Sass antes de concatenar nada (`sinBom()` en `scripts/build-entrega.mjs`).
- **L-011** · El CSS de un snippet compuesto no basta — Al entregar el código de una pieza compuesta, la pregunta no es qué le pertenece en su propio fichero, sino qué hace falta para que se vea igual fuera del entorno de desarrollo.
- **L-010** · Los cuatro gates en verde y la story reventando — los bucles que envuelven a otros tienen que ser codiciosos y llegar al último `{% endfor %}`; solo el de más adentro puede ir perezoso.

## Para el Ojo · medir y capturar

- **L-105** · Una imagen `lazy` que nunca entra en pantalla no está rota — distingue «falló» de «no ha empezado», y si una sonda nueva marca en rojo algo ya verificado, sospecha de la sonda.
- **L-104** · Un oyente que no se engancha da verde y no mide nada — `sesion.on`, no `escucha`; y toda captura pasiva necesita un control que falle a propósito antes de creerse su silencio.
- **L-101** · El Ojo también se cuelga cerrando el pixel-check; que pare en las capturas — el orquestador cierra el informe con los shots y `medir:story`.
- **L-100** · El Ojo se cuelga en las remediciones cortas; un `play` desechable por el gate no — para medir tres números no se levanta un agente: `npm run medir:story`.
- **L-099** · `documentElement.scrollWidth` cuenta lo que hay dentro de un scroller aunque esté recortado — un `scrollWidth` del `html` mayor que el viewport no es desborde hasta que la página se desplace de verdad: mide `scrollX` tras `scrollTo` y `body.scrollWidth`.
- **L-098** · Una medida correcta descrita con un sujeto genérico se vuelve falsa en la siguiente lectura
- **L-092** · Una comparación que reutiliza la captura vieja da por actual un fallo de ayer — acotar la espera de la captura (`Promise.race` con 3 s por imagen — la que no se va a ver no debe frenar la foto).
- **L-091** · Comillas en `.env` fingen una credencial caducada — Un valor de entorno entrecomillado puede corromper una credencial si el parseo no lo limpia; antes de declarar una credencial caducada, pruébala por una vía que ya funcione.
- **L-087** · Seis nodos del barrido de tokens «dejan de existir» y la REST dice que siguen ahí — que la REST conteste 200 no quiere decir que el nodo exista: para saberlo, busca el id en el árbol del archivo.
- **L-080** · El chequeo de tokens no ve lo que no tiene estilo, y hoy ha pasado tres veces — ninguna todavía, y por eso esto es una lección y no un arreglo.
- **L-079** · Una carpeta de Figma escondió seis páginas diseñadas, y el mapa dijo «sin diseñar» — aplanar las `SECTION` (recursivamente, que pueden anidarse) antes de filtrar.
- **L-071** · Un frame autocerrado en `get_metadata` no es un frame vacío: es un frame que no se ha mirado — la ausencia de hijos en la metadata es ausencia de información, no información sobre ausencia.
- **L-070** · Una causa bien medida no valida el arreglo que propone — cuando una verificación entrega causa y arreglo, el arreglo es una hipótesis más, no una conclusión.
- **L-068** · En un nodo girado, la metadata de Figma mezcla dos sistemas de coordenadas — en cuanto un nodo lleve rotación, la metadata no sirve para colocarlo directamente.
- **L-067** · Quitar una indeterminación puede destapar otra, y la nueva sale en verde — cuando cambies el mecanismo de espera de un instrumento, no compruebes solo que el fallo viejo se fue: compara los resultados entre sí.
- **L-065** · `complete` no es «se puede pintar», y una racha de 26 no es un arreglo
- **L-063** · «No se ve» no es «no pasa»: apagar el panel no apaga el `play` — una sonda que solo se ejecuta sobre el estado arreglado no mide nada.
- **L-059** · `body.scrollWidth` no crece aunque la página se desplace: el número que hay que mirar es el de `documentElement` — al usar la sonda, la condición es que los dos coincidan con el viewport.
- **L-056** · Chrome headless no despacha eventos de scroll, y el instrumento miente tres veces seguidas — antes de acusar al código, descarta el instrumento. Si dos ejecuciones del mismo código dan resultados distintos, el problema está en la medición, no en lo medido.
- **L-055** · El chequeo de tokens solo ve lo que sus nodos usan, y a lo demás lo llama «sin comprobar» — un style que sale como «sin comprobar» no es una baja: es un punto ciego. Y la forma barata de destaparlos es al revés de como se venía haciendo — en vez de mirar qué
- **L-045** · Figma no exporta una página entera a 1:1, y la captura reescalada no lo dice — antes de dar por buena una captura de referencia, comprueba sus dimensiones contra las del nodo.
- **L-038** · Una auditoría vale lo que cubre, y «0 px de diferencia» no dice qué se miró — un informe de auditoría tiene que decir qué se miró, no solo el resultado.
- **L-035** · `scrollWidth` miente sobre el scroll horizontal; `scrollX` no — ante un scroll horizontal fantasma, no vayas probando `overflow: hidden` por los ancestros hasta que calle.
- **L-034** · `sips --cropOffset` desplaza desde el CENTRO, y el recorte parece un fallo de maquetación — no usar `sips` para recortar por coordenadas.
- **L-033** · Un logo exportado con el fondo dentro no se ve mal: se ve _casi_ bien — un activo heredado se comprueba antes de darlo por bueno, aunque «se vea bien».
- **L-032** · Capturar contra una build que ya no existe se parece mucho a una story rota — para capturar hay que construir una build propia y conservarla — `STARTERSLUG_STORYBOOK_TODO=1 npx storybook build -o .sb-verify` — y borrarla al acabar.
- **L-030** · 36 de 45 fichas apuntaban a nodos de Figma que ya no existen — un node-id de una ficha es una referencia externa que caduca, como una URL.
- **L-029** · `File not exportable`: el archivo sí exporta; el 403 es de la cuenta o el token de quien llama — cuando un error de permisos sugiera una causa, acota antes de actuar sobre ella, y acota por los dos ejes: qué archivo es y quién lo pide.
- **L-021** · Dos componentes casi iguales, y los nombres de capa mienten — para medidas, medir el nodo que usa la página, no el que se llame parecido.
- **L-013** · Un icono un 20 % más grande no se ve; se mide — `viewBox="-2 -2 24 24"` en el burger (24 unidades, así el glifo va 1:1, y el −2/−2 lo recentra) y `1rem` en el aspa.
- **L-009** · Mirar la instancia y no el SET esconde estados enteros — una instancia enseña _un_ fotograma.
- **L-008** · Chrome headless no baja de 500 px, y la captura de móvil miente en silencio — cuando el render no cuadra con lo que dice el CSS, mide el viewport antes de tocar el CSS.
- **L-007** · El chequeo de tokens se comparaba consigo mismo — un chequeo de deriva tiene que comparar contra lo que se publica, no contra una copia de sí mismo.
- **L-006** · El archivo bueno vivía en la cabeza de alguien — Cuando un dato crítico (qué archivo/fuente es la buena) solo vive en la cabeza de alguien, regístralo con quién lo confirmó y cuándo — el repo no está desactualizado, está incompleto.
- **L-005** · FileKey copiada no es fileKey verificada — Antes de confiar en una referencia externa (fileKey, id…), verifícala resolviendo un nodo conocido contra ella; una referencia equivocada contesta 200 y no falla, solo no devuelve nada.

## Para el orquestador · git, Jira y entrega

- **L-105** · Una imagen `lazy` que nunca entra en pantalla no está rota — distingue «falló» de «no ha empezado», y si una sonda nueva marca en rojo algo ya verificado, sospecha de la sonda.
- **L-104** · Un oyente que no se engancha da verde y no mide nada — `sesion.on`, no `escucha`; y toda captura pasiva necesita un control que falle a propósito antes de creerse su silencio.
- **L-103** · Valida contra un resultado ya publicado y bueno — Cuando tengas un resultado ya bueno y publicado, úsalo de oráculo antes de producir el siguiente: convierte una lista de sospechas en reglas exactas.
- **L-101** · El Ojo también se cuelga cerrando el pixel-check; que pare en las capturas — el orquestador cierra el informe con los shots y `medir:story`.
- **L-100** · El Ojo se cuelga en las remediciones cortas; un `play` desechable por el gate no — para medir tres números no se levanta un agente: `npm run medir:story`.
- **L-097** · Una respuesta vacía no es un dato — Una respuesta vacía (de un WAF, proxy o API) no es un dato: antes de concluir «no existe», comprueba el código de estado y las cabeceras.
- **L-096** · Capturar el DOM después de que el JS lo toque se trae estado que el JS debía calcular — el DOM renderizado no es el HTML de origen.
- **L-093** · Doce frames estrechos dan por diseñado el móvil de diez fichas que no lo tenían — un detector que clasifica por «lo que no es» se traga cualquier cosa que diseño deje suelta. Define el positivo, lo que sí es un móvil, y comprueba el umbral contra l
- **L-085** · Un commit subido a una rama cuyo PR ya estaba mergeado no llega a `develop` — antes de subir a un PR, comprueba que sigue abierto, y antes de desplegar o de dar algo por entregado, comprueba que el commit está en `develop`.
- **L-078** · «Cero PR abiertos» no significa que no quede nada por entregar — `0` no es lo mismo que `nada pendiente`. Una métrica que cuenta objetos —PR abiertos, issues sin cerrar, ficheros modificados— vale cero tanto cuando no hay trabajo c
- **L-074** · `git cherry` da falsos positivos en cuanto hay squash-merge — `git cherry` responde «¿está este parche aplicado?», que no es «¿está este trabajo dentro?».
- **L-073** · Un `.gitignore` arreglado en otra rama no protege a esta — lo que decide qué se ignora es el `.gitignore` de la rama desde la que ramificas, no el del árbol donde lo escribiste.
- **L-060** · Un PR mergeado no significa que su rama esté integrada — el estado de un PR es una afirmación sobre un momento, no sobre una rama.
- **L-053** · Los tres fallos del día eran el mismo: verde y publicado mal — `deploy.mjs` revisa lo construido entre construir y subir, y aborta si ni una pieza sale como nueva o modificada —diciendo qué tag usa de referencia— o si la build no
- **L-052** · Avisar del alcance no es lo mismo que parar
- **L-049** · Un artifact que se republica a sí mismo se quedó sin estilo, y se envió igual — el estilo lleva `id="app-style"` y se lee con `getElementById`, en el generador y en la reconstrucción.
- **L-048** · Buscar por node-id evita tareas duplicadas — Antes de crear una tarea nueva para una pieza de diseño, busca por su identificador estable (node-id u otro id externo), no por nombre ni catálogo local, para evitar duplicados entre agentes en paralelo.
- **L-044** · `origin/develop` se mueve solo bajo tus pies, y `reset --soft` sobre él escribe un revert — `reset --soft <ref remota>` solo es seguro si esa ref no se ha movido desde que ramificaste — y en este repo se mueve sola.
- **L-043** · Renombrar una rama por la API de GitHub **cierra** su PR, no lo repunta — en GitHub, `head` y `base` no se tocan igual.
- **L-031** · Las menciones de Jira no funcionan en markdown, y fallan sin avisar — el comentario largo puede ir en markdown —tablas y listas se convierten bien—, pero si el objetivo es que alguien se entere, la mención va en ADF.
- **L-028** · Un PR apilado sobre una rama que se mergea antes se queda en tierra de nadie — si apilas un PR, el orden de merge es parte del PR, no un detalle.
- **L-027** · Alinear una rama copiando en vez de mergeando explota en la entrega siguiente — dos ramas se alinean mergeando, nunca copiando. Si el contenido de una tiene que ser el de la otra, el merge con `read-tree` da el mismo resultado _y_ la historia com
- **L-023** · Borrar una rama porque alguien dice que está mergeada — antes de borrar una rama, comprobar `merged: true` por API (`GET /pulls/:n`), no `state`.
- **L-018** · «El árbol está limpio» puede querer decir que acabas de borrar algo — antes de cualquier operación que reescriba el árbol —`read-tree --reset`, `reset --hard`, `checkout -f`— mirar `git status` y guardar en stash lo que haya.
- **L-015** · Un sitio retirado que sigue sirviendo es peor que un enlace roto — redirigir en vez de apagar, para que los enlaces repartidos por Jira y por chat sigan valiendo.
- **L-004** · Un «espejo» que no lee la fuente es peor que no tener espejo — si un fichero generado afirma reflejar un sistema externo, o lo consulta o lo dice.
- **L-003** · Escritura en Confluence da 403 aunque leas bien — logout+login limpio en `/mcp` concediendo escritura; si no aparece la opción, lo activa un admin de Confluence.
- **L-002** · Las tools del plugin no aparecen tras instalarlo — autenticar el servidor en `/mcp` y reiniciar Claude Code en la carpeta.
