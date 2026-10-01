# Lecciones y errores — Starternombre harness · TEXTO COMPLETO (archivo)

> Formato de cada entrada: síntoma → causa → solución → regla general. Las más nuevas arriba.
> Las heredadas de la plantilla que traían un ejemplo del proyecto de origen viajan reducidas a
> su regla general.

## L-105 · Una imagen `lazy` que nunca entra en pantalla no está rota, y la sonda dice que sí

- **Síntoma:** al verificar las dos fichas nuevas del CMS, la comprobación de imágenes daba **6 rotas por página** (`paso-1`…`paso-4`, `junta-arbitral-consumo`, `logo-cliente`) incluso después de recorrer la página entera con `scrollTo`.
- **Causa:** son `loading="lazy"` dentro de diapositivas del carrusel y del pie, que nunca entran en el viewport. `naturalWidth` vale 0 y `complete` sigue en `false` sin que la URL falle. Lo delató que salían **las mismas seis en la ficha del 23-09, que ya estaba verificada buena**.
- **Solución:** las seis URL responden 200 con sus bytes. Para comprobar que resuelven desde la página hay que forzarlas: `if (i.loading === 'lazy') { i.loading = 'eager'; i.src = i.src }` y esperar. Entonces: cero rotas en las tres.
- **Regla general:** antes de dar una imagen por rota, distingue «falló» de «no ha empezado». Y si una sonda nueva marca en rojo algo que ya estaba verificado, sospecha de la sonda antes que del sitio.
- **Dónde:** contribución de las fichas 1Gb+120 y 600+10+40, 24-09.

## L-104 · Un oyente que no se engancha da verde y no mide nada

- **Síntoma:** dos comprobaciones seguidas en el navegador dijeron «cero peticiones a `storybook-starterslug`, cero excepciones». Eran ciertas por casualidad: **no había nadie escuchando**.
- **Causa:** `sesion.escucha?.(...)` con optional chaining sobre un método que no existe — en `scripts/lib/cdp.mjs` la clase `Sesion` expone `on`, no `escucha`. El `?.` convirtió el error en silencio.
- **Solución:** usar `sesion.on(...)`, y **poner un control que falle**: provocar una excepción de verdad y abortar si no se captura. Ojo con el control: un `throw` dentro de `Runtime.evaluate` vuelve en el resultado y **no** emite `Runtime.exceptionThrown`; hace falta `setTimeout(() => { throw … }, 0)`.
- **Regla general:** una sonda que solo puede decir «bien» no es una sonda. Toda captura pasiva —oyentes, listeners, hooks— necesita un control que la haga fallar a propósito antes de creerse su silencio.
- **Dónde:** verificación de las páginas del cliente, 24-09.

## L-103 · Valida contra un resultado ya publicado y bueno

**Regla general:** Cuando tengas un resultado ya bueno y publicado, úsalo de oráculo antes de producir el siguiente: convierte una lista de sospechas en reglas exactas.

## L-101 · El Ojo también se cuelga cerrando el pixel-check; que pare en las capturas

- **Síntoma:** 24-09, una tarea anterior. El Ojo capturó los 32 pares (8 bloques × 2 anchos) en 37 minutos y se colgó dos veces seguidas después («no progress for 600s»), sin escribir `pixel-check.md`. Un tercer Ojo lanzado sin CDP tampoco produjo nada en 20 min. Tres horas entre la Mano y el PR.
- **Causa:** la misma de L-100, un escalón más arriba: lo que se cuelga no es capturar, es lo que viene después (remediciones sueltas, revisar capturas, cerrar el informe) con Chrome/CDP abierto o con esperas que no vuelven. Capturar es una operación cerrada; «revisar y medir lo que haga falta» no lo es.
- **Solución:** el Ojo **para en las capturas** (build, un Chrome, `shots/` con figma y sb por bloque y ancho, y cierra Chrome). El **orquestador cierra el informe**: mira los pares con la herramienta de imágenes, mide las cajas que importen con `npm run medir:story` (varios `--sel`, varios `--ancho`, una sola build) y escribe `pixel-check.md` + `pixel-report.html` (el HTML se genera con un script de 10 líneas sobre `shots/`). Hoy: 18 selectores × 2 anchos en una build, informe en 15 minutos, un diff real encontrado y arreglado.
- **Regla general:** a un agente se le pide una operación que termina sola (capturar, exportar, escribir un fichero), no una que «termina cuando esté bien». Lo abierto lo cierra quien puede ver el reloj.
- **Además:** `medir-story.mjs` reescrito. El `--dir` del 22 no servía: la story desechable se escribía después de la build y la build no la contenía. Ahora escribe una story por selector y construye una vez.
- **Dónde:** `pipeline.md` → fila «Pieza o página nueva» (columna pixel-check), `starterslug-analyst.md`, 24-09.

## L-100 · El Ojo se cuelga en las remediciones cortas; un `play` desechable por el gate no

- **Síntoma:** tres remediciones acotadas el 22-09 terminaron en «no progress for 600s», sin informe ni rastro, tras 30–40k tokens cada una. Medir a mano con CDP (WebSocket + `http-server`) se colgó también.
- **Causa:** el Ojo monta build, Chrome por CDP y un informe entero para tres cajas; cualquier espera que no vuelve (un `scrollTo` con `scroll-behavior: smooth`, un servidor que no cierra) lo deja mudo, y el watchdog lo mata sin salida.
- **Solución:** `scripts/medir-story.mjs` (`npm run medir:story`): escribe una story desechable que hereda la pedida, cuyo `play` mide las cajas de los selectores y las lanza como aserto; la corre `play-errors.mjs`, que abre y cierra Chrome solo, y recoge el mensaje. Un selector por ejecución (el aserto trunca a ~40 caracteres). ≤ 5k tokens, sin cuelgues.
- **Regla general:** para medir tres números no se levanta un agente: se usa el gate que ya sabe abrir y cerrar el navegador. El Ojo es para medir contra un frame, no para confirmar un arreglo.
- **Dónde:** `pipeline.md` → «Arreglo de un diff», `starterslug-analyst.md`, 22-09.

## L-099 · `documentElement.scrollWidth` cuenta lo que hay dentro de un scroller aunque esté recortado

- **Síntoma:** `tariff-comparison` a 390 daba `documentElement.scrollWidth = 1131` contra 390 de viewport, en su story y en las siete páginas que la montan; el pixel-check lo apuntó como «desborde horizontal» y se abrió como deuda.
- **Causa:** la tabla es fija de 1281 dentro de `.table-responsive` (`overflow-x: auto`). Chrome hace que `documentElement.scrollWidth` incluya el ancho de contenido de ese scroller aunque esté recortado; **`body.scrollWidth` daba 390, `scrollTo(9999,0)` dejaba `scrollX` en 0 y ningún elemento ancho estaba sin recortar** (comprobado subiendo por los ancestros hasta el primero con `overflow ≠ visible`).
- **Solución:** ninguna en el código; era el instrumento. La prueba de desborde es `scrollX` tras `scrollTo` + `body.scrollWidth` + «elementos anchos sin ancestro que recorte», no `documentElement.scrollWidth`.
- **Regla general:** un `scrollWidth` del `html` mayor que el viewport no es desborde hasta que la página se desplace de verdad.
- **Dónde:** `tariff-comparison`, 22-09, ciclo corto de alguien del equipo.

## L-098 · Una medida sin sujeto ni condición se vuelve falsa

**Regla general:** Una medida sin sujeto ni condición se vuelve falsa

## L-097 · Una respuesta vacía no es un dato

**Regla general:** Una respuesta vacía (de un WAF, proxy o API) no es un dato: antes de concluir «no existe», comprueba el código de estado y las cabeceras.

## L-096 · Capturar el DOM después de que el JS lo toque se trae estado que el JS debía calcular

- **Síntoma:** tres fallos distintos el mismo día, y ninguno parecía el mismo problema. Un módulo con la animación **congelada en su fotograma final**; otro que el motor de parallax **no encontraba**; y el de tarifas con **19 cards en el DOM y 0 en pantalla**.
- **Causa, la misma para los tres:** el HTML se extrajo leyendo `innerHTML` de un Storybook ya renderizado, así que se llevó atributos y estilos que el JS **pone en ejecución** y que el HTML de origen no tiene: `style="--values-grid-run: 1"` (el estado final), la pérdida de `data-parallax-pin` (el hook que el motor busca), y un `role="tabpanel"` que añade `filtro-velocidad.js` — con él, el módulo de tarifas contaba su propia pista de cards como un panel más **y la escondía él solo**.
- **Solución:** comparar siempre lo extraído contra la fuente del módulo (`src/modules/<x>/<x>.html`) y quitar lo que no esté ahí. Un diff de `data-*`, `role`, `aria-*`, `hidden` y `style` con custom properties caza los tres. Y capturar con `prefers-reduced-motion` emulado, que evita que las animaciones dejen su estado final grabado.
- **Ojo con el falso positivo:** lo que «falta» respecto a la fuente puede ser un `{% if %}` que esa página no pasa. El `fibre-hero` sale sin selector de marcas ni carrusel y es correcto. **Mira el condicional antes de darlo por perdido.**
- **Por qué no se ve:** ninguno de los tres falla. La animación se ve terminada, el módulo se ve quieto y las cards simplemente no están. Parecen decisiones de diseño.
- **Regla general:** el DOM renderizado **no es** el HTML de origen. Si necesitas markup para copiar a otro sitio, sácalo de la fuente o límpialo contra ella.
- **Dónde:** contribución al CMS del cliente, 15-09. Detalle en `contribucion-cms-django.md`.

## L-095 · Un absoluto sin ancestro posicionado se escapa del `overflow` que lo recorta

- **Síntoma:** la página entera se podía desplazar a la derecha en móvil. `body.scrollWidth` daba 390 y no había ni un elemento sin recortar, pero `html.scrollWidth` daba **741** sobre un viewport de 390.
- **Causa:** la card de tarifa no estaba posicionada, así que los rótulos que lleva en `.visually-hidden` —que son `position: absolute`— resolvían su bloque contenedor contra el **`html`**. Y ahí está la regla que casi nadie tiene presente: **un `overflow` solo recorta a un descendiente si además es su bloque contenedor**. La pista del carrusel recortaba con `overflow-x: auto`, pero para ese `span` no era su bloque contenedor, así que se escapaba: el rótulo de la cuarta card aterrizaba en x=741 de la ventana y estiraba el documento.
- **Solución:** `position: relative` en la card. Un elemento posicionado entre el absoluto y el `html` basta para que el recorte vuelva a aplicarse.
- **Por qué no se veía:** en Storybook los envoltorios de la propia herramienta lo recortaban, así que `body.scrollWidth` daba 390 y **la sonda de desborde salía limpia**. Lo destapó el ENTREGABLE, que no tiene esos envoltorios. Familia de `L-077`: lo que mides en el sitio cómodo no es lo que se publica.
- **Regla general:** cuando algo desborda y el culpable «parece recortado», mira su **bloque contenedor**, no su ancestro con `overflow`. Y ojo con `.visually-hidden`: es absoluto por definición, así que **cualquier componente que lo use necesita un ancestro posicionado** o sus rótulos se van por ahí.
- **Dónde:** Una tarea anterior, `landing-tariffs`. Afecta a todas las páginas que montan tarifas, no solo a la landing.

## L-094 · Un paréntesis sin cerrar no tira una regla de CSS: se lleva el resto de la hoja

- **Síntoma:** el entregable de la landing salía **sin estilos**, con el CSS escrito y correcto dentro del fichero: 70 KB y 311 reglas acotadas. El navegador parseaba **61 de 311**.
- **Causa:** el empaquetador troceaba la lista de selectores con un `split(',')` pelado, así que partía también las comas que van **dentro** de un `:not(…)`. Con `.btn-white:not(:disabled, .disabled):active` de Bootstrap salían `.btn-white:not(:disabled,` y `.btn-white:not(:disabled`, las dos con el paréntesis abierto. Y ahí está lo que lo hace caro: **un paréntesis sin cerrar no invalida esa regla y sigue** — el parser se queda buscando el cierre y **se traga todo lo que venga detrás**.
- **Solución:** trocear por comas de **primer nivel**, respetando paréntesis, corchetes y comillas. Después: 219 reglas parseadas y el entregable pintado.
- **Regla general:** una lista de selectores **no se parte por comas**, se parte por comas de primer nivel — igual que no se parte un CSV por comas sin mirar las comillas. Y cuando falte «medio CSS», no busques la regla que falta: busca **la última que sí se aplicó** y mira qué hay justo después.
- **De propina:** otra página nunca lo vio porque su árbol no usa ninguna regla con coma anidada. Un fallo así duerme hasta que alguien usa el selector que lo despierta.
- **Dónde:** Una tarea anterior, `scripts/build-landing.mjs`.

## L-093 · Doce frames estrechos dan por diseñado el móvil de diez fichas que no lo tenían

- **Síntoma:** desde el 14-09, `sitemap:sync` sacaba cada mañana diez fichas de tarifa como «soloDesktop → completo» (1Gb + 120GB, Fibra 300Mb…). Parecía el aviso de que diseño había terminado sus móviles, y se propuso registrarlos en el mapa del sitio.
- **Causa:** el script consideraba móvil **cualquier frame de menos de 1000 de ancho**. En «09 Fichas tarifas» aparecieron doce frames sueltos de 734×320, llamados «01» a «17», y con eso bastaba. En esa página no hay ni un frame de teléfono. Los móviles de verdad están en «💣 War Room (Provisional)», que el script ignora a propósito, y ni siquiera están todos: 600Mb + 35GB + TV no tiene, 1Gb + 375GB + TV tiene dos candidatos, y Fibra 600Mb y 1Gb comparten plantilla.
- **Solución:** móvil es un ancho de teléfono, **360–430**, o un frame de menos de 1000 cuyo nombre diga que es móvil. Esa excepción la necesita la landing «Busco piso», que exporta su móvil a 940 con el nombre `landing_mobile__…`. Antes de fijar el rango se sondearon los anchos de todos los frames de menos de 1000 del archivo: 374, 375, 390, 426, 734 y 940. Solo los de 734 cambian de clasificación. «Diseño nuevo» bajó de 12 a 2 (las dos landings) y lo demás salió idéntico. No se registró nada en el mapa: se espera a que diseño pase los móviles a su página.
- **Regla general:** **un detector que clasifica por «lo que no es» se traga cualquier cosa que diseño deje suelta.** Define el positivo, lo que sí es un móvil, y comprueba el umbral contra los datos reales del archivo antes de fijarlo. Y **antes de registrar una novedad, ve a buscar el nodo que la justifica**: aquí no existía.
- **Dónde:** `scripts/site-map-sync.mjs → dispositivoDe`. Lo destapó el subagente que iba a registrar las fichas el 15-09, al no encontrar sus móviles. De paso vio que una tarea anterior no se desbloquea: la nueva plantilla de ficha no monta el módulo Promos.

## L-092 · Una comparación que reutiliza la captura vieja da por actual un fallo de ayer

- **Síntoma:** el empaquetador de landings dijo **84,07 % de píxeles distintos** en el entregable bilingüe. Ese número era exactamente el de un fallo REAL de tres horas antes —el CSS truncado por el troceo de selectores (`L-091` es de la misma tanda)— que ya estaba arreglado. El entregable estaba bien: 219 reglas parseadas, `.visually-hidden` correcto, el hero azul y el alto idéntico al de antes.
- **Causa, en tres eslabones:** (1) el entregable bilingüe lleva el idioma que no se ve en `hidden`, y **una imagen `loading="lazy"` dentro de un subárbol oculto no se carga nunca** —no entra en el viewport—, así que su `decode()` no resuelve jamás; (2) `shot-suelto.mjs` esperaba a TODAS las imágenes sin tope, así que se colgaba hasta el timeout de 60 s del CDP y **no escribía la captura**; (3) `pixel-diff` encontraba en la caché el `entregable.png` de la ejecución anterior y lo comparaba tan tranquilo.
- **Lo que lo hace caro:** ninguno de los tres eslabones grita. La captura falla en silencio, la caché tiene un fichero con el nombre correcto, y el número que sale es **plausible** —es un número real, solo que de otra ejecución—. Y como coincidía con un fallo que yo había visto ese mismo día, casi lo doy por una regresión mía.
- **Solución:** acotar la espera de la captura (`Promise.race` con 3 s por imagen — la que no se va a ver no debe frenar la foto). Después, 0,273 %, que es el antialias de siempre.
- **Regla general, que es la que vale:** **una comparación que no comprueba que sus dos entradas son de ESTA ejecución no compara, recuerda.** Si un paso escribe un artefacto y el siguiente lo lee por nombre, el segundo tiene que fallar cuando el primero no ha escrito — no seguir con lo que había. Es la familia de `L-077` (un servidor vivo sirviendo un índice viejo) y de `L-004` (un espejo que no lee la fuente): el patrón es siempre el mismo, **un dato viejo con formato de dato bueno**.
- **De propina, algo que sí conviene dejar:** que las imágenes del idioma oculto no se descarguen hasta que se cambia de idioma **es bueno** para quien abre la página. Lo que estaba mal era la sonda, no la página.
- **Dónde:** Una tarea anterior, empaquetando el entregable bilingüe de «Busco piso».

## L-091 · Comillas en `.env` fingen una credencial caducada

**Regla general:** Un valor de entorno entrecomillado puede corromper una credencial si el parseo no lo limpia; antes de declarar una credencial caducada, pruébala por una vía que ya funcione.

## L-090 · Un `padding` no reproduce una caja de Figma que no cambia con el cuerpo de letra

- **Síntoma:** el pixel-check daba 0,83 / 0,80 / 0,88 en las tres vistas del navegador de la landing, y **un solo defecto explicaba las tres**: la tinta de ESP/CAT caía a la derecha y demasiado junta. Todo lo demás estaba por debajo de 1 px.
- **Causa:** las cajas de esos dos textos en el nodo **no hacen hug** —56 y 62 para 35 y 38 de tinta—, así que con cajas que se ajustan al texto los huecos de caja del nodo (17 y 25) colocan la tinta donde no va. Y el arreglo intuitivo, un `padding-inline` simétrico, **tampoco vale**: la caja mide lo mismo en los dos breakpoints pero la letra pasa de 22 a 27, así que el aire sobrante son **cuatro valores distintos** (10,5/12 en escritorio, 5,5/7,5 en móvil). Con un padding único de 6,75 el móvil se pasaba +5,50 de hueco y +2,08 de margen.
- **Solución:** reproducir la caja, no el aire. Ancho fijo por rótulo (56 y 62 del nodo, escalados) con `text-align: center`, igual en los dos breakpoints. Los cuatro bordes de tinta quedaron a ≤0,50 px en escritorio y ≤0,42 en móvil.
- **Regla general:** cuando una caja de Figma no depende del cuerpo de letra y el texto sí, el aire entre ambos **no es una constante**. Si el rótulo es fijo, se clava la caja; si es variable, se hace hug y se asume la desviación — pero no se finge la caja con padding.
- **Dónde:** `src/modules/landing-nav/landing-nav.scss`.

## L-089 · `vertical-align` en `em` no mide en el cuerpo del padre, y el subíndice se queda a medio bajar

- **Síntoma:** el «₂» de «Conoce O₂» tenía que bajar **6 px** sobre un texto de 30 (0,2 em, medido en el PNG del nodo). Escrito tal cual —`sub { font-size: 0.645em; vertical-align: -0.2em }`— baja **3,9**.
- **Causa:** las dos declaraciones no comparten unidad. `font-size: 0.645em` resuelve contra el padre, pero el `em` de `vertical-align` resuelve contra el cuerpo **ya reducido del propio elemento**. O sea que ese −0,2 em son 0,2 × 0,645 = **0,129 em del padre**. No hay error visible en el CSS y el subíndice sale «casi bien», que es lo que hace que nadie lo mire.
- **Solución:** dividir el descenso por el factor de tamaño: `vertical-align: -0.31em` (0,2 / 0,645) para bajar los 0,2 em del padre. Y en el mismo bloque, `position: static`: Bootstrap Reboot baja `sub` con `position: relative` + `bottom: -.25em`, y sin deshacerlo los dos descensos se suman.
- **Regla general:** cuando dos propiedades de la misma regla se miden en `em` y una de ellas es `font-size`, la segunda ya está en otra escala. Escribir la proporción medida no basta: hay que convertirla.
- **Dónde:** `src/styles/elements/_elements.scss`.

## L-088 · Un gate rápido puede necesitar un paso previo

**Regla general:** Si un gate importa un artefacto que genera otro paso del pipeline de entrega, ejecuta ese paso antes, aunque el gate en sí sea el más rápido de correr.

## L-087 · Seis nodos del barrido de tokens «dejan de existir» y la REST dice que siguen ahí

- **Síntoma:** en el arranque del 14-09, `get_variable_defs` respondía «node ID invalid» para seis de los diez nodos del barrido: menu, hero, bento-promos, banner-cobertura, un módulo y footer. El viernes funcionaban. El diff salió en verde, pero con 12 styles sin comprobar. Para complicarlo, la REST (`/v1/files/:key/nodes?ids=…`) **devolvía los seis** con nombre y tipo `COMPONENT_SET`, y parecía un fallo del MCP.
- **Causa:** los seis eran los sets de componente, y la página donde estaban (Componentes) ya no aparece en el árbol del archivo, que se modificó a las 00:05 del 14-09 durante la normalización de diseño. La REST mantiene los sets en `componentSets` y los resuelve por id porque todavía hay instancias que los usan, pero **sin hijos y sin página**: es un rastro, no un nodo. Recorriendo el árbol entero no aparecen.
- **Solución:** cambiarlos por sus **instancias** en la página 00 Home. Banner_cobertura ya solo tiene instancia en móvil. Además se buscaron en el árbol los nodos que usan cada style sin comprobar y entraron seis más. Resultado: 16 nodos, 31 styles vistos y cero sin comprobar. Todos verificados por MCP.
- **Regla general:** **que la REST conteste 200 no quiere decir que el nodo exista**: para saberlo, busca el id en el árbol del archivo. Y **el barrido apunta a instancias o frames de página, no a sets**. Los componentes se mueven cada vez que diseño reordena, mientras que la página es lo que se entrega.
- **Estado:** resuelto 2026-09-14. Queda abierto, y le toca a diseño: saber si la página Componentes se ha borrado o se ha llevado a una librería, y por qué el Banner de cobertura ya no está en la Home de escritorio.

## L-086 · Cuatro `play` en rojo y ninguna pieza rota: dos nunca pasaron y uno medía con una regla que se partía

- **Síntoma:** `check:plays` llevaba desde el 09-09 con cuatro rojos fijos en `develop` —`tariff-price`, `tariff-card` y los dos de `site-header`—, idénticos cifra a cifra en cada medición. Parecían cuatro regresiones sin dueño.
- **Causa, medida en Chrome y no deducida:** eran tres fallos distintos, y los tres del test.
  1. **Dos asertos que no han estado verdes nunca.** `tariff-price` pedía que «€/mes» cayese en el mismo sitio con el 7 que con el 35, apoyándose en las cifras tabulares, que igualan **cada dígito** y no una cifra contra dos: el rojo (24,9) es el ancho de un dígito, y el Figma dibuja justo eso, la cifra en hug con 12 de hueco. `tariff-card` exigía que la destacada fuese la más alta, como en el handoff, pero con **otro contenido**: aquí la de la derecha lleva logos (36 + 16) y le gana a la del tag (24 + 16). Los dos asertos se escribieron el mismo día que la pieza y el gate que los ve llegó semanas después.
  2. **Una regla que dependía de su caja.** Para medir el ancho en negrita, el `play` de la cabecera clonaba el enlace con `position: absolute` dentro de su `li`. El submenú (27-08) puso ese `li` en `relative`, el clon pasó a medir contra un `li` justo del ancho en regular, y «Fibra y Móvil» en negrita **se partía en tres líneas**: 35,5 contra 81,3. La reserva de ancho funcionaba; la regla no.
  3. **Una carrera con la transición.** El `play` de `MobileOpen` esperaba a la clase `--open` y leía la opacidad en ese instante, que es el 0 del arranque de una transición de 240 ms.
- **Solución:** los cuatro, en el test. Hueco de 12 y alineación solo entre cifras iguales; «tres contenidos, tres altos» en vez de un orden; `white-space: nowrap` en el clon; y `waitFor` sobre la opacidad real. Se comprobó además que el test de la cabecera sigue cazando lo suyo: quitando la reserva, el primer enlace da 2,67 de diferencia y el aserto salta. [STARTERSLUG-151](https://<site>.atlassian.net/browse/STARTERSLUG-151).
- **Regla general:** **un rojo fijo no es una regresión hasta que se demuestre que alguna vez fue verde.** Antes de buscar qué cambio lo rompió, mira la fecha del aserto contra la del gate que lo ve: si el aserto es más viejo que el gate, puede que simplemente nunca haya pasado. Y **un elemento que se crea para medir hereda su caja**: un clon absoluto mide contra su ancestro posicionado, y cualquier `position: relative` que alguien añada por otro motivo le cambia la regla sin tocar el test.
- **Estado:** resuelto 2026-09-11. Queda abierto, y no es del test: con `tabular-nums` el «35» mide 49,8 y en el Figma 44.

## L-085 · Un commit subido a una rama cuyo PR ya estaba mergeado no llega a `develop`

- **Síntoma:** el cambio de contraste de la cabecera se dio por «subido al #256» y no estaba en `develop`. Salió al ir a desplegar: `git merge-base --is-ancestor c146f0a origin/develop` dijo que no.
- **Causa:** el #256 se mergeó a las 10:41 y el commit se empujó a su rama a las 10:50. GitHub acepta el push a la rama de un PR cerrado sin avisar, y editar la descripción de un PR cerrado tampoco da error. Todo parecía hecho.
- **Solución:** el mismo commit, con `cherry-pick`, en una rama nueva desde `develop` y su propio PR (#257).
- **Regla general:** **antes de subir a un PR, comprueba que sigue abierto**, y **antes de desplegar o de dar algo por entregado, comprueba que el commit está en `develop`**. Las dos cosas se miran en un segundo por la API o con `merge-base`; dar por hecho cualquiera de las dos costó un PR y un deploy de más.
- **Estado:** resuelto 2026-09-10. Queda en los guardarraíles de la skill.

## L-084 · El submenú de la cabecera empujaba la página 44 px, y en su story no se veía

- **Síntoma:** al desplegar el submenú de sección en una página, el hero entero bajaba 44 px. Lo vio alguien del equipo en cuanto la cabecera entró en las páginas.
- **Causa:** el panel del submenú estaba en el flujo de la cabecera. La cabecera devuelve con margen negativo solo el alto de la barra, así que al abrirse el panel crecía y empujaba todo lo de debajo. En la story suelta la cabecera no tiene nada debajo: el salto existía, pero no había nada que se moviera.
- **Solución:** el panel pasa a `position: absolute` bajo la barra (la cabecera, `sticky`, le hace de caja). Flota sobre el hero, que es lo que dibuja el Figma.
- **Regla general:** **un estado que se abre se prueba montado en su sitio real**, no solo en su story, y **midiendo**: la posición del primer módulo antes y después de abrirlo. Una pieza que se superpone a otras no puede cambiar de alto al abrirse.
- **Estado:** resuelto 2026-09-10 (#256). Queda en el paso 4 del pipeline para las páginas.

---

## L-083 · Un `backdrop-filter` con máscara se sale del recorte redondeado del padre

- **Síntoma:** las cards de promos de la Home perdían el redondeo **por la izquierda**, y solo en pantallas anchas. Alguien del equipo lo cazó mirando la ficha de Docs en su portátil. La lectura evidente —«el radio está en la imagen y no en la caja»— era falsa: `.promo-card` lleva `border-radius: 25.6px` **y** `overflow: hidden`, medido con `getComputedStyle`.
- **Causa:** el `::after` del velo combina `backdrop-filter` **con `mask-image`**. Un elemento así se compone en su propia capa, y el navegador aplica el desenfoque al fondo **sin recortarlo por las esquinas redondeadas del ancestro**. El velo de debajo, con `backdrop-filter` a secas, sí lo recorta la card: **es la máscara la que rompe el recorte**, no el filtro.
- **Solución:** darle el radio a la capa que se escapa (`border-radius: inherit` en el velo y en su `::after`). Una línea.
- **Regla general:** `overflow: hidden` + `border-radius` en el padre **no** es garantía de recorte. Cualquier descendiente que cree su propia capa de composición —`backdrop-filter`, `mask-image`, `filter`, `will-change`— puede pintarse fuera de las esquinas. Si una caja redondeada lleva una de esas dentro, **el radio hay que repetirlo en la capa**.
- **Las dos pistas que llevaban a la causa, y que conviene saber leer:** fallaba **solo de `lg` en adelante** —que es donde entra el desenfoque progresivo— y **solo por un lado** —el mismo hacia el que abre la máscara—. Un fallo de radio «de verdad» no tendría ni breakpoint ni lado.
- **De propina, por qué llevaba tanto sin verse:** la vista previa de Docs se renderiza **al ancho de su columna** (1000, unos 968 reales), y a ese ancho la card está por debajo de `lg` y el `::after` ni existe. O sea que el sitio donde más se miran las piezas era justo el sitio donde el fallo no aparecía. Ese mismo mecanismo explica los «la cabecera sale apiladísima en Docs»: no es la maqueta, es que a 968 se está mirando el móvil estirado. Está anotado en `.storybook/preview-head.html`.
- **Estado:** resuelto 2026-09-09.

## L-082 · Reiniciar un servidor que no se murió: media hora midiendo el proceso viejo

- **Síntoma:** después de cablear `remark-gfm`, las tablas seguían saliendo crudas. Se cambió la configuración de sitio, se borró la caché de Vite, se reinició cuatro veces y se leyó el código minificado del addon para ver de dónde saca la opción. Nada cambiaba **ni un carácter** del resultado.
- **Causa:** el `npm run storybook` viejo **nunca murió**. `pkill -f "storybook dev"` no lo mató —en Windows el proceso real es otro— así que cada relanzamiento se encontraba el puerto 6006 ocupado y **se quedaba preguntando por consola** «¿lo levanto en el 6007?». Como el arranque iba en segundo plano, esa pregunta no se veía. La sonda seguía midiendo, contenta, contra el servidor original.
- **Solución:** matar por puerto y no por nombre: `Get-NetTCPConnection -LocalPort 6006 -State Listen` → `Stop-Process -Id <OwningProcess> -Force`, y **comprobar que el puerto queda libre antes de relanzar**. Al hacerlo, la configuración que llevaba tres intentos siendo «la que no funciona» funcionó a la primera.
- **Regla general:** cuando un cambio de configuración no mueve el resultado **ni un poco**, sospecha del proceso antes que del cambio. Un resultado que no se mueve nada no es un cambio que no funciona: es un cambio que no se ha ejecutado. La comprobación barata es preguntarle al servidor **desde cuándo está vivo**, no volver a leer el código.
- **De propina, y es lo que lo destapó:** la sonda que se metió en `main.js` para ver qué opciones llegaban **imprimió lo correcto** —la opción estaba puesta y bien puesta—. Eso descartó la hipótesis en la que se llevaba media hora y dejó una sola explicación posible: lo que se estaba midiendo no era ese proceso.
- **Estado:** resuelto 2026-09-09.

## L-081 · Catorce tablas rotas en la entrega, y el código estaba bien

- **Síntoma:** Alguien del equipo avisa de que la sección «Comportamiento» de las fichas de Docs «en ningún sitio está bien». Leído el DOM de lo publicado, la tabla no salía mal: **no salía**. Los catorce `.mdx` con tabla la publicaban como un párrafo de texto crudo lleno de `|` y de `---`.
- **Causa:** las tablas son **GFM**, no markdown básico, y **Storybook dejó de traer GFM por defecto en la 7**. Sin `remark-gfm` el parser no reconoce la sintaxis y la deja pasar como texto. No hay error, ni aviso, ni nada en el log.
- **Solución:** `npm i -D remark-gfm` y cablearlo en `.storybook/main.js`. ⚠️ **En `options` de la raíz, no en las opciones del addon**: con el builder de Vite el plugin de MDX lo lee con `presets.apply('options')`, así que la forma que documenta Storybook —escrita para webpack— no llega, y **falla igual de callada**.
- **Regla general:** una sintaxis que el parser no reconoce **no da error: da texto**. Es el mismo modo de fallo que L-004 y L-007 — algo que se lee como si funcionara. Para la documentación que se entrega, el código fuente no es evidencia: hay que mirar **lo publicado**, y para eso hace falta leer el DOM, no la fuente.
- **Coletazo:** salió revisando otra cosa. Se estaba limpiando el texto interno que se colaba en las fichas de Docs —53 ficheros de 104, 225 marcas— y la revisión de lo publicado destapó esto, que llevaba ahí desde que existe el primer `.mdx` con tabla. Ninguna de las dos cosas se ve leyendo el repo.
- **Estado:** resuelto 2026-09-09.

## L-080 · El chequeo de tokens no ve lo que no tiene estilo, y hoy ha pasado tres veces

- **Síntoma:** el chequeo de la mañana dio **verde** —«lo que pinta Storybook es lo que dice Figma»— y en el mismo día aparecieron **tres desviaciones de la escala** que no había visto ninguna.
- **Los tres casos, que son tres agujeros distintos del mismo método:**
  1. **El `h1` del hero de una página pinta la interlínea al 100 % donde `Desktop/Display` dice 90 %. `get_variable_defs` sobre ese nodo devuelve **solo `Neutrales/Blanco`**: el texto está suelto, sin text style, con la interlínea escrita a mano.
  2. **El botón de la banda de una página no es instancia de `Button`: `get_variable_defs` devuelve `{}`, cero styles. Los valores sí son los del sistema, o sea que es nuestro botón redibujado a mano.
  3. **El titular de la rejilla de valores** devuelve `{}` por MCP… **pero por Plugin API sí tiene `Desktop/H1` y `Neutrales/Negro`**. El nodo está **oculto**, y un nodo oculto no reporta sus estilos por esa vía.
- **Causa:** el chequeo compara **los styles que el vuelco encuentra**. Un valor que no cuelga de un style no entra en el vuelco, así que no hay nada que comparar y **la ausencia se lee como acuerdo**. Los tres casos difieren en por qué no hay style —a mano, redibujado, u oculto— pero el efecto es el mismo.
- **Y el tercero es peor que los otros dos**, porque no es un descuido del archivo sino **un defecto de la sonda**: el estilo existe y el método no lo ve. O sea que hoy el chequeo da **falsos «sin comprobar» en todo lo que esté oculto**, y lo oculto es justo donde se acumulan los estados alternativos.
- **Solución:** ninguna todavía, y por eso esto es una lección y no un arreglo. Lo que sí queda dicho es **qué habría que cambiar**: contar los nodos **sin style** como una tercera categoría del informe —hoy solo hay «alineado», «desajuste» y «sin comprobar»—, y leer los ocultos por Plugin API en vez de darlos por vacíos.
- **Regla general, que es la que vale:** **un chequeo que solo mira lo que está declarado no mide la deriva, mide la disciplina de quien declara.** Es la familia de `L-007` —donde el chequeo se comparaba consigo mismo— y del punto ciego de `Mobile/H3` de agosto, pero al revés: **entonces faltaba el nodo, ahora falta el style**. Mientras el verde de la mañana signifique «no he encontrado nada que comparar», hay que leerlo como lo que es.
- **De propina, el patrón que lo destapó:** las tres salieron **maquetando**, no barriendo. Quien abre un nodo para construirlo lo ve; el barrido, no.
- **Estado:** diagnosticado 2026-09-08. Sin arreglar. Preguntas 2.45 del dossier y P-18 de la spec de la rejilla.

## L-079 · Una carpeta de Figma esconde páginas enteras

**Regla general:** aplanar las `SECTION` (recursivamente, que pueden anidarse) antes de filtrar.

## L-078 · «Cero PR abiertos» no significa que no quede nada por entregar

- **Síntoma:** el cierre del 04-09 escribió «cuatro PR, todos mergeados. Cero PR abiertos y develop en verde», y era **verdad**. El 07-09 el barrido de la mañana encontró en `origin` una rama con un **módulo entero sin entregar**: `feat/STARTERSLUG-130-tv-offer-hero`, 47 ficheros y 3.389 líneas, maquetada, verificada a 0,94 y con sus dos vueltas de pixel-check. Tres días parada.
- **Causa:** los commits son de las **13:08** y el cierre fue a las 13:10. La rama se subió y el PR nunca se abrió. `gh pr list` devolvía `[]` con toda la razón: **un PR que no se abre no aparece en la lista de PR abiertos**, y la métrica del cierre solo miraba esa lista.
- **Por qué el resto tampoco lo vio:** Jira decía «En curso», que es exactamente lo que dice una tarea que se está maquetando; no distingue «trabajando en ello» de «terminado y sin entregar». Y `git status` estaba limpio, porque el trabajo **sí** se había commiteado y subido. Las tres señales que se suelen mirar daban tranquilidad a la vez.
- **Solución:** la comprobación que lo caza en dos segundos, y que ya corre en el arranque:
  ```
  for b in $(git branch -r --list 'origin/*'); do
    git cherry origin/develop $b | grep -q '^+' && echo "$b tiene commits fuera de develop"
  done
  ```
  Es `git cherry` otra vez —comparando parches, no nombres ni ancestría— con el modo de fallo que avisa `L-074`: sobre ramas ya squash-mergeadas da falsos positivos, así que un `+` es «mira esto», no «esto falta».
- **Regla general:** **`0` no es lo mismo que `nada pendiente`.** Una métrica que cuenta objetos —PR abiertos, issues sin cerrar, ficheros modificados— vale cero tanto cuando no hay trabajo como cuando el trabajo **no llegó a entrar en el sistema que la métrica mira**. Un cierre que solo pregunta «¿cuántos PR hay abiertos?» está midiendo el papeleo; para medir el trabajo hay que preguntarle al árbol. Misma familia que `L-060`: media tarea se lee igual que una entera si buscas por nombre en vez de por parche.
- **Y el aviso de proceso:** los dos commits son de cinco minutos antes del cierre. Empujar la última pieza del día justo contra la hora es cuando se pierde el paso de entregarla — el pixel-check ya estaba verde, lo único que faltaba era el `gh pr create`.
- **Estado:** resuelto 2026-09-07 · [STARTERSLUG-130](https://<site>.atlassian.net/browse/STARTERSLUG-130) · PR #234.

## L-077 · Un servidor de desarrollo vivo no sirve lo que hay en disco

- **Síntoma:** Alguien del equipo dice que no ve el snippet nuevo en `localhost:6006`. El puerto responde 200, el módulo está en disco, compila, y `check:stories` lo da por bueno. Parecía un fallo de la pieza.
- **Causa:** el Storybook llevaba horas levantado —lo arrancó el harness por la mañana— y su **índice se quedó congelado en la rama en la que arrancó**. Servía 175 stories con `fibre-offer-hero` dentro y **sin** `benefit-grid`, que se creó después. Cambiar de rama no lo actualiza.
- **Y el reintento tapó el diagnóstico:** `TaskStop` mató el **envoltorio** de la tarea, no el proceso `storybook dev` que tenía el puerto. El nuevo arrancó, vio el 6006 ocupado, preguntó por consola «¿lo pongo en el 6007?» y —con la entrada cerrada— **salió con código 0**. O sea: el reinicio «funcionó», el viejo siguió sirviendo, y la comprobación siguió diciendo que la story no estaba.
- **Solución:** localizar al que ocupa el puerto (`Get-NetTCPConnection -LocalPort 6006` → PID → `Get-CimInstance Win32_Process` para confirmar que es el tuyo), cerrarlo y arrancar de nuevo. 177 stories y las tres piezas dentro.
- **Regla general, y es la que vale:** **«¿responde el puerto?» no es la comprobación; «¿está mi story en `index.json`?» sí lo es.** Un 200 solo dice que hay alguien escuchando, no quién. `curl -s localhost:6006/index.json | grep <pieza>` contesta la pregunta de verdad en un segundo.
- **Segundo aviso, para el harness:** un proceso lanzado en segundo plano puede sobrevivir a su `TaskStop`. Si algo tenía que reiniciarse y «ya está», comprueba el efecto —el PID, el índice, la versión— y no el código de salida.
- **Estado:** resuelto 2026-09-04.

## L-076 · Un `min-height` de otro breakpoint no rompe el layout: rompe la animación, y en silencio

- **Síntoma:** Alguien del equipo, mirando `feature-reel` en local: «se abre muy rápido y cuando llega a abrirse hace un salto feo». En reposo todo medía bien —fila cerrada 64, panel abierto 654, lista 800—, y los cinco gates en verde.
- **Causa:** `.feature-reel__item--open` declara `min-height: 27.5rem` (440) **para el móvil**, y esa regla no estaba dentro de ninguna media query, así que también se aplicaba en escritorio. Un `min-height` **gana a la altura animada**: la caja saltaba de 64 a 440 en el primer fotograma y solo se animaban los 214 que quedaban hasta 654.
- **Cómo se cazó, que es lo interesante:** muestreando el alto fotograma a fotograma. Al 25 % del tiempo el recorrido iba por el **64 %**, y al 50 % **seguía en el 64 %**. Dos lecturas idénticas en una animación monótona es **imposible**, y ese absurdo fue la pista: el 64 % son 441 px, y 440 es el mínimo de móvil. Estuve a punto de dar el dato por ruido de mi propia sonda.
- **Solución:** `min-height: 0` dentro de `up(lg)`, donde el alto es fijo y no hace falta ningún mínimo. Medido después: 12 % → 69 % → 96 %, sin meseta.
- **Regla general:** una propiedad de otro breakpoint que **no rompe el reposo** puede estar destrozando el recorrido. En reposo la caja medía sus 654 exactos, así que **ningún gate, ninguna captura y ninguna medida en reposo podían verlo** — solo aparece muestreando la animación. Hermana de `L-067`, donde `pixel-shot` daba 30 verdes y las capturas enseñaban un estado a medias.
- **Y la de método:** el número que no cuadra es la pista, no el ruido. Antes de culpar a la sonda, pregúntate qué defecto explicaría exactamente ese absurdo.
- **Estado:** resuelto 2026-09-04.

## L-075 · Un `transition: padding` no es una decisión sobre el aire: es una decisión sobre el ancho del texto

- **Síntoma:** Alguien del equipo: «los textos se descontrolan cuando entra en juego el efecto». Al abrir un apartado de `feature-reel`, el párrafo del que se cerraba se re-partía línea a línea durante los 600 ms.
- **Causa:** la fila cerrada ponía los 56 de los lados en su **botón** y el panel abierto los ponía en el **ítem** — y el ítem es lo que se anima. Así que el `padding` iba de 0 a 56 durante la transición y **el ancho disponible del texto cambiaba en cada fotograma**. El navegador recalcula los cortes de línea en cada uno.
- **Solución:** los 56 horizontales viven en el ítem y valen **lo mismo en los dos estados**, así que no hay nada que interpolar; el botón va a `padding: 0` y ocupa el ancho del contenido, con lo que el «+» sigue cayendo a 56 del borde. Y se transicionan `padding-top` y `padding-bottom` **por separado**, para que el horizontal no pueda volver a colarse cuando alguien toque un valor.
- **Cómo se verificó:** muestreando el ancho del párrafo fotograma a fotograma mientras se cierra. Un solo valor —574,83— durante los 37 fotogramas de la animación, con el alto recorriendo 34 valores distintos. El único 0 aparece al final, cuando el JS ya ha escondido el panel.
- **Regla general:** cualquier propiedad que toque la **caja de línea** —`padding` y `margin` horizontales, `width`, `font-size`— recompone el párrafo en cada fotograma si entra en una transición. Anima el alto, el color y la opacidad; el ancho del texto, nunca. Y si tienes que animar una caja cuyo padding cambia entre estados, **iguala el horizontal en los dos** antes que transicionarlo.
- **Y una de alcance:** los cinco gates dieron verde con el fallo dentro, porque ninguno mira lo que pasa **durante** una transición. Lo cazó una persona abriéndolo.
- **Estado:** resuelto 2026-09-04.

## L-074 · `git cherry` da falsos positivos en cuanto hay squash-merge

- **Síntoma:** el barrido de la mañana buscó trabajo sin integrar y `git cherry develop <rama>` marcó **tres ramas viejas** con un commit sin aplicar cada una: la migración a Bootstrap 4.1.3 (`861da8b`, una tarea anterior), las 29 preguntas en documento (`6ac153b`) y el parte del 25-08 (`26473f8`). Con pinta de tres tareas perdidas.
- **Causa:** ninguna lo estaba. `git cherry` casa por **patch-id**, y un **squash-merge reescribe el parche** —otro padre, otro diff— así que el commit original nunca casa con el que aterrizó en `develop`. Como aquí se mergea con squash por convención (`git-workflow.md`), _toda_ rama vieja va a salir marcada, y para siempre.
- **Cómo se descartó, y es lo barato:** mirar el **efecto**, no el commit. El `package.json` de `develop` dice `bootstrap: 4.1.3`, y `git ls-tree develop` encuentra los dos ficheros de docs. Tres comprobaciones de diez segundos contra tres investigaciones.
- **Regla general:** `git cherry` responde «¿está este **parche** aplicado?», que no es «¿está este **trabajo** dentro?». Sirve para lo que hizo el 31-08 —commits que se quedaron en la punta de una rama **ya mergeada**, donde el parche sí se conserva— y no sirve para ramas cerradas con squash. Antes de dar por perdido lo que marque, **comprueba el efecto en el árbol**.
- **Matiz sobre `L-060`, que es donde escuece:** allí `git cherry` quedó escrito como la herramienta fiable «porque compara parches en vez de nombres», frente a los once falsos positivos de catorce que daba `--no-merged`. Sigue siendo verdad **para aquel caso**. Lo que faltaba decir es que tiene su propio modo de fallo y que en este repo se dispara solo: hoy dio **3 de 3**. Ninguna herramienta de estas contesta la pregunta que se le hace; contesta la suya.
- **De propina, el uso bueno del mismo día:** sobre `develop` contra `origin/main` sí dijo la verdad y ahorró el susto — de los diez commits sin mergear dejó solo `34beef1` y su propio _Revert_, o sea que el merge no traía código. Ahí no había squash de por medio.
- **Estado:** resuelto 2026-09-03.

## L-073 · Un `.gitignore` arreglado en otra rama no protege a esta

- **Síntoma:** **18,2 MB en 256 ficheros** —una build de Storybook entera, `storybook-local2/`— entraron en un commit y de ahí a `develop`. Nadie lo vio hasta el día siguiente, al mirar el peso de otro commit.
- **Causa:** el patrón `storybook-local*/` se añadió al `.gitignore` **en la rama de una tarea**. La rama de la tarea siguiente se sacó de `develop`, que todavía no lo tenía, y un `git add -A` se los llevó.
- **Solución:** `git rm -r --cached` para dejar de rastrearlos. Ojo: **un fichero ya rastreado sigue rastreado** por mucho que lo cubra el `.gitignore` después — el ignore solo actúa sobre lo no rastreado.
- **Regla general:** lo que decide qué se ignora es el `.gitignore` de **la rama desde la que ramificas**, no el del árbol donde lo escribiste. Un arreglo de infraestructura que va a hacer falta en varias ramas se mete **primero en `develop`**, no dentro de la tarea que lo destapó.
- **Lo que esto NO arregla:** los blobs siguen en el histórico. Sacarlos pide reescribir `develop` y un push forzado, que con más gente trabajando encima no se hace por cuenta propia.
- **Estado:** resuelto 2026-09-02 (PR #222).

## L-072 · `npx storybook build` no es `npm run build-storybook`, y la diferencia acusa a otro

- **Síntoma:** al verificar la integración de dos ramas, la build de entrega falló con `Could not resolve "../../../public/entrega/snippets/tariff-comparison.css?raw"`. El fichero que falla es de **otro módulo, recién mergeado**, así que todo apuntaba a que venía roto de su rama.
- **Causa:** no venía roto. `public/entrega/snippets/*.css` los **genera** `scripts/build-entrega.mjs`, cableado como `prebuild-storybook`. Llamar a `npx storybook build` directamente **se salta el script de npm y su paso previo**, así que el CSS de un módulo nuevo no existe todavía. Con `npm run build-storybook` pasa limpio.
- **Por qué no se había visto antes:** los módulos que ya tenían su CSS generado de ejecuciones anteriores seguían resolviendo. Solo falla el **primer** módulo nuevo tras el cambio de rama, que es justo el del compañero.
- **Regla general:** cuando un fallo aparece **exactamente** en el fichero de otra persona, sospecha primero de cómo lo estás ejecutando tú. Y para los gates, invoca **siempre por su script de npm**: el pre/post es parte del comando, no un adorno.
- **Hermana de `L-069`:** allí el gate medía una build vieja, aquí una mal construida. En los dos casos el gate hizo bien su trabajo y midió otra cosa.
- **Estado:** resuelto 2026-09-02.

## L-071 · Un frame autocerrado en `get_metadata` no es un frame vacío: es un frame que no se ha mirado

- **Síntoma:** la spec del snippet `feature-reel` afirmaba que los tres estados del módulo comparten la misma foto. **Son tres fotos distintas.** El dato llegó hasta la maqueta, que puso marcador de «asset pendiente» en dos de los tres, y costó **una vuelta entera** de maquetación y verificación.
- **Causa:** `get_metadata` devuelve la columna de imagen como un elemento **autocerrado** —`<frame id="3564:26675" … width="621" height="800" />`—, sin hijos. Los tres estados se leen **idénticos** en el XML, así que la diferencia es invisible para quien solo mire la metadata. Solo aparece pidiendo `get_screenshot` de cada nodo por separado.
- **Solución:** cuando un nodo que **debería** tener contenido sale autocerrado, pide su captura antes de afirmar nada sobre él. Y si la spec dice «los tres usan X», que sea porque se han abierto los tres.
- **Regla general:** la ausencia de hijos en la metadata es **ausencia de información**, no información sobre ausencia. Es la misma familia que `L-055` —el barrido solo ve lo que sus nodos usan— y que L-065: **un verde que no ha mirado nada se lee igual que un verde de verdad.**
- **De propina:** lo destapó la verificación pixel-perfect, no la extracción. El Ojo corrigió su propia spec, que es exactamente para lo que sirve tener dos pasos.
- **Estado:** resuelto 2026-09-02 · [STARTERSLUG-127](https://<site>.atlassian.net/browse/STARTERSLUG-127).

## L-070 · Una causa bien medida no valida el arreglo que propone

- **Síntoma:** el pixel-check de `tariff-comparison` sacó un único diff: la etiqueta «Móvil desde 0€» caía **1 px por debajo** del centro de su fila. El diagnóstico venía confirmado por tres vías independientes —rect del navegador, cajas de tinta sobre el PNG y el detalle de la fila aislada— y traía el arreglo escrito: `vertical-align: middle` sobre el tag.
- **Qué pasó al aplicarlo:** **nada en la fila 5 y peor en la 6** (celda del tag 9,92 % → 10,87 %, módulo 2,467 % → 2,477 %). El arreglo obvio, derivado de una causa correctamente medida, movía la pieza en la dirección equivocada.
- **Causa:** `vertical-align: middle` **no centra en la caja de línea**. Alinea el centro del elemento con la línea base más la mitad de la altura x de la fuente del padre — que es otro punto, y depende de la tipografía. Con `line-height: 24px` en la celda y un contenido de 46,39 no coincide con el centro de la fila.
- **Solución, y ya estaba escrita al lado:** sacar la etiqueta del flujo en línea (`display: flex` + `width: fit-content` + `margin-inline: auto`). Es **exactamente** lo que ese mismo fichero hace tres reglas más abajo con el botón, con su porqué comentado —«la celda deja de crear línea de texto»—. El diagnóstico y el precedente estaban a la vista; lo que faltó fue conectarlos.
- **Resultado medido:** celda del tag 9,67 % → **8,07 %** (fila 5) y 9,92 % → **8,32 %** (fila 6), módulo 2,467 % → **2,432 %**, y **0 px cambiados fuera de esas dos celdas**. El tag queda a −0,24 y −0,63 px del centro de su fila.
- **Regla general:** cuando una verificación entrega causa **y** arreglo, el arreglo es una hipótesis más, no una conclusión. **Vuelve a medir después de aplicarlo**, con el mismo número que lo destapó, y compara contra el valor de antes — no contra el criterio de aprobado. Un arreglo que no mueve el número no es un arreglo, y aquí uno lo movía hacia atrás.
- **De propina:** medir el desvío contra las filas de _Figma_ daba 3 px y contra las filas de _la maqueta_ daba 1. Las dos son ciertas: las filas de la maqueta acumulan 0,391 px cada una por el alto real de `.btn-pill`. Si el número de un diff no cuadra con el de otra medición, mira **contra qué** está midiendo cada una antes de decidir cuál miente.
- **Estado:** resuelto 2026-09-02 · [STARTERSLUG-126](https://<site>.atlassian.net/browse/STARTERSLUG-126).

## L-069 · El gate de hooks mide la build que encuentra, no la que acabas de escribir

- **Síntoma:** al rebasar la rama de una tarea anterior sobre `develop` y pasar los gates, `npm run check:hooks` salió con **1**: «16 stories publican 47 hooks Django sin resolver», con `{{ icon.modifier }}` en los iconos del Design System y `{{ card.fibre }}` en `tariff-card`. Un rojo concreto, con nombres y cuentas, sobre una rama que no había tocado ninguno de esos ficheros.
- **Causa:** el gate lee `storybook-static/`, y **no comprueba que esa build corresponda al código de ahora**. La que había en el árbol era del día anterior a las 12:43 — anterior al propio commit de una tarea anterior (14:08) y a los PR #216, #217 y #219, que son justo los que arreglaron esos hooks. El gate midió bien; midió otra cosa.
- **Cómo se separó:** montar un `git worktree` en `origin/develop` y correr el gate ahí. Salió con **2** —«no he podido comprobar»— porque en un árbol recién sacado no hay `storybook-static`. Esa tercera salida es la que delata el mecanismo: si el gate sabe avisar cuando la build **falta**, la vez anterior es que había encontrado una, y entonces la pregunta deja de ser «¿qué stories fallan?» y pasa a ser «¿de cuándo es esta build?». Un `stat` del `index.json` lo cerró en un segundo.
- **Solución:** `npm run build-storybook` antes de `check:hooks`. Con la build fresca: **119 de 119 stories montadas, cero hooks crudos, exit 0**.
- **Regla general:** un chequeo que lee un artefacto del disco tiene **dos** modos de mentir, no uno. El que está cubierto es que el artefacto no esté; el que no, que esté **viejo**. Y el viejo es peor, porque contesta con detalle. Antes de creerte un veredicto sobre una build, mira su fecha.
- **Cabo suelto:** `hooks-check.mjs` distingue «no hay build» de «hay build», pero no «build más antigua que el último commit que toca `src/`». Podría, y entonces este rato no lo pierde nadie más.
- **Estado:** resuelto 2026-09-02 · [STARTERSLUG-119](https://<site>.atlassian.net/browse/STARTERSLUG-119).

## L-068 · En un nodo girado, la metadata de Figma mezcla dos sistemas de coordenadas

- **Síntoma:** al maquetar el móvil de la card de una página (`3264:3633`, una tarea anterior), la metadata daba `x=88 y=98,447 w=1029,88`. Colocarlo ahí dejaba el diff de la banda en **37 %**; colocarlo donde decían los píxeles —`y` negativa, `−72`— lo bajaba a **1,2 %**. La `x` clavaba y la `y` estaba a 170 px de distancia, lo que parecía un error de la herramienta.
- **Causa:** no hay error. **`x`/`y` son la traslación del `relativeTransform` —la esquina superior-izquierda de la caja YA girada—, mientras que `width`/`height` son el AABB de esa caja girada.** No describen el mismo rectángulo. Leerlos como si lo fueran falla de las dos maneras: tomar `x`/`y` como origen del AABB da 37 % de diferencia, y tomar `width`/`height` como tamaño intrínseco da 50 %.
- **La trampa:** la `x` **puede** coincidir con el borde izquierdo del AABB —coincide cuando el signo del giro lleva esa esquina a ser el punto más a la izquierda—. Esa coincidencia es lo que engaña: hace pensar que la `y` viene mal, cuando lo que pasa es que las dos están en un sistema y el tamaño en otro.
- **Solución:** reconstruir, no leer.

  ```
  intrínseco = width / (cos θ + sin θ)
  centro     = (x, y) + R · (intrínseco / 2)
  origen sin girar = centro − intrínseco / 2
  ```

  Comprobación de que cierra, con los números reales: elemento a 876,16 px con `rotate(-11.22deg)` → AABB = 876,16 × 1,175464 = **1029,89**, que es el `width` publicado; y su esquina superior-izquierda transformada cae en (88,01 · 98,40), que es el `x`/`y` publicado con 0,05 de margen.

- **Regla general:** en cuanto un nodo lleve rotación, **la metadata no sirve para colocarlo directamente**. O se reconstruye con la fórmula, o se fija por diff de píxel. Y si un solo eje «parece mal» mientras el otro clava, sospecha del sistema de coordenadas antes que de la herramienta.
- **Estado:** resuelto 2026-09-01 · [STARTERSLUG-119](https://<site>.atlassian.net/browse/STARTERSLUG-119).

## L-067 · Quitar una indeterminación puede destapar otra, y la nueva sale en verde

- **Síntoma:** al conducir Chrome por DevTools Protocol, `pixel-shot` dejó de perder imágenes: **30 pasadas seguidas del mismo comando, 30 con exit 0 y las 27 imágenes decodificadas en todas**. Criterio cumplido. Pero al comparar los PNG entre sí, **28 tenían un hash y 2 otro**.
- **Causa:** `--virtual-time-budget` no solo servía para esperar — **adelantaba el reloj y remataba las transiciones CSS al instante**. Al quitarlo, el tiempo vuelve a ser real y `alliance-hero__reel-poster` tarda sus `transform 0.6s` en esparcir los pósters. La captura caía en medio. Las 2 raras eran las buenas; las 28 de la mayoría enseñaban el abanico a medio abrir, un estado que el usuario no ve nunca.
- **Lo que lo destapó, y es lo importante:** no el parte del script, que decía verde 30 veces, sino **hashear las 30 capturas y ver que no eran la misma**. El instrumento no sabía que le faltaba una espera, así que no podía avisar de ella. Un chequeo solo cubre las hipótesis que le metiste.
- **Solución:** esperar a `document.getAnimations()` —que incluye las transiciones CSS— descartando las de `iterations: Infinity`, con tope real, y **avisar si alguna sigue corriendo** al capturar. Con eso: **30 de 30 pixel-idénticas**.
- **Regla general:** cuando cambies el mecanismo de espera de un instrumento, **no compruebes solo que el fallo viejo se fue: compara los resultados entre sí**. Un cambio de temporización mueve más cosas de las que fuiste a arreglar, y las que mueve de más salen en verde porque nadie escribió el aserto que las miraba.
- **De propina, y cierra L-008:** `Emulation.setDeviceMetricsOverride` fija un viewport REAL de cualquier ancho. Medido: sin emular `innerWidth` da **504** —el mínimo de ventana de Chrome del que hablaba L-008—; emulando a 390 da **390** y la media query de `xs` resuelve. Eso retira el iframe con el que `pixel-shot` esquivaba el problema, y el iframe era además lo que dejaba sin foco a los `play` (L-063). Quedan cuatro sondas más montadas sobre iframe —`focus-getter`, `gaps`, `margen`, `overflow`— que pueden pasarse al mismo driver cuando toque.
- **Estado:** resuelto 2026-09-02 · [STARTERSLUG-121](https://<site>.atlassian.net/browse/STARTERSLUG-121).

## L-066 · Un aviso no evita el fallo; un gate sí

**Regla general:** Un aviso escrito al lado de código compartido no impide que el fallo se repita; conviértelo en un gate automático que compruebe que las copias/consumidores no se han desincronizado.

## L-065 · `complete` no es «se puede pintar», y una racha de 26 no es un arreglo

- **Síntoma:** `pixel-shot.mjs` —la herramienta del paso pixel-perfect— sacaba el carrusel de Netflix en negro **6 de cada 11 ejecuciones** del mismo comando sobre la misma build. Me hizo perder un rato persiguiendo un fallo inexistente en una página ya entregada ([STARTERSLUG-107](https://<site>.atlassian.net/browse/STARTERSLUG-107)).
- **La causa, en dos capas.** El servidor del script no declaraba `image/webp` —21 assets de la build lo son—, así que los servía como `application/octet-stream` y Chrome tenía que adivinar. Eso solo subió la tasa de 5 a 7 buenas de 11: **no era la causa principal**. La de verdad es que nuestro marcado lleva `decoding="async"`, que **autoriza expresamente a Chrome a pintar el fotograma sin esperar al decodificado**. `img.complete` es cierto en cuanto el recurso llegó; no dice nada de si se puede dibujar. La sonda decía «22 imágenes de 22 cargadas» y la banda salía negra.
- **Lo que sí ata las dos cosas** es `img.decode()`, la promesa que resuelve cuando la imagen ya se puede pintar.
- **EL ERROR QUE CASI COMETO, Y ES EL QUE HAY QUE LLEVARSE:** con `decode()` puesto medí **11 de 11** y luego **15 de 15** limpias, y estuve a punto de darlo por resuelto. No lo estaba. Con `p ≈ 0.93` por ejecución, una racha de 26 sale el **15 %** de las veces: no es una prueba, es una tirada afortunada. Al volver a medir sobre el código definitivo salió **1 de 15** negra, y luego **2 de 12**. Una racha limpia no demuestra ausencia de un fallo intermitente; solo la mide una tasa sobre suficientes ejecuciones, y hay que decir cuántas.
- **Dos guardias mías que firmaron éxito sin mirar**, las dos del mismo tipo que L-062:
  1. «ninguna imagen pendiente» es cierto **cuando no hay ninguna**: la primera versión se conformaba antes de que la story montara y escribía «todas pintadas» con cero imágenes. Se arregla exigiendo primero que la story haya montado.
  2. un `setTimeout` de 4 s por imagen para no colgarse: **bajo `--virtual-time-budget` el tiempo virtual salta y ese temporizador vence al instante**, así que contaba como decodificada una que solo se había rendido. Volvió a colarse un negro. Rendirse no es terminar, y si se cuentan juntos el parte miente.
- **Dónde queda, y esto es lo honesto:** la tasa baja de **6 de 11** negras a **2 de 12**, y **no está cerrado**. Lo que sí se ha ganado es que la herramienta **avisa**: en las doce ejecuciones medidas, las dos negras salieron marcadas, y **ninguna captura con el decodificado cerrado limpio salió negra**. O sea que un `exit 0` de `pixel-shot` ya significa algo, que antes no. A cambio avisa de más: ocho buenas también salieron marcadas.
- **El arreglo de verdad, para quien lo retome:** `--screenshot` + `--virtual-time-budget` no permiten decir «captura AHORA, que ya he esperado». Hay que pasar a conducir Chrome por DevTools Protocol y llamar a `Page.captureScreenshot` después de resolver los `decode()`. Es más obra y no entraba en [STARTERSLUG-118](https://<site>.atlassian.net/browse/STARTERSLUG-118).
- **Estado:** mitigado 2026-09-01, no resuelto.

---

## L-064 · Un `play` que revienta en su primera línea parece un `play` que no hace nada

- **Síntoma:** al cerrar una tarea anterior, tres stories de `tariff-module` no se movían de su reposo **ni con los `play` encendidos**. La conclusión cómoda era «headless no puede con esto» — la misma familia que L-056.
- **Cómo se separó, y es lo que hay que copiar:** **un clic propio en la misma build**. Dos segundos después de cargar, pulsar «Fibra» a mano movía la pieza de `panel-fibra-movil-tv` a `panel-fibra`. O sea que el módulo funcionaba y el instrumento veía: lo que fallaba era el `play`. Un control que ejercita el mecanismo por otra vía distingue «no funciona» de «no lo veo» en una medición.
- **Causa, capturada del canal de Storybook y no deducida:** `playFunctionThrewException :: AssertionError: expected […] to have a length of 1 but got 4`. La primera línea del `play` cuenta los paneles visibles esperando uno, y encuentra los cuatro: **quien esconde los otros tres es el init del módulo, y el `play` llega antes**. Carrera, no lógica.
- **Solución:** `await waitFor(() => expect(...).toHaveLength(1))`. El patrón ya estaba resuelto en `site-header.stories.js → MobileOpen`, con su nota explicando que la story arranca el init en un `requestAnimationFrame`. Lo que faltaba era aplicarlo donde valía igual.
- **Lo que de verdad hay que llevarse:** ese `play` llevaba tiempo sin comprobar nada y **nadie podía verlo**, porque la entrega apaga el panel de `interactions`. Un test roto y un test apagado se parecen desde fuera: los dos salen verdes. Es una tarea anterior leído del otro lado — allí el instrumento se colaba en el entregable, aquí el instrumento estaba muerto y el informe apagado lo tapaba.
- **Y una distinción que la sonda ahora hace explícita:** de los tres, solo uno estaba roto. `SubtabsKeepPanel` funcionaba y la huella no lo veía porque miraba la barra principal cuando su `play` mueve la **sub-barra**; `SpeedFilter` acaba donde empieza **a propósito** —pulsa «Fibra 1Gb» y vuelve a «600Mb» para probar que filtrar no destruye cards—, así que ninguna huella del DOM puede decir si corrió. «Sin rastro por diseño» no es «no lo certifico», y meterlos en el mismo montón esconde al que sí estaba roto.
- **Estado:** resuelto 2026-09-01 ([STARTERSLUG-117](https://<site>.atlassian.net/browse/STARTERSLUG-117)). El control pasó de mover 5 casos de 8 a mover **7**, con 1 idempotente declarado y **ninguno ciego**.

---

## L-063 · «No se ve» no es «no pasa»: apagar el panel no apaga el `play`

- **Síntoma:** `basics-tabs--primary` se publicaba en la entrega con la **segunda** pestaña activa. El cliente abría la pieza y veía el estado en que la dejaba nuestro test de interacción, no el suyo por defecto ([STARTERSLUG-116](https://<site>.atlassian.net/browse/STARTERSLUG-116)).
- **Causa:** los `play` de las stories **se ejecutan en el Storybook publicado**. `preview.js` apagaba `interactions` en la entrega, y eso esconde el **informe** del panel; el `play` corre igual. El de esa story hace `primera.focus()` y `userEvent.keyboard('{ArrowRight}')`, que es exactamente lo que mueve la selección.
- **Lo que no funcionó, y por qué:** aliasar `storybook/test` a un stub inerte en `viteFinal`. Storybook resuelve ese especificador por su cuenta antes de que llegue el alias, y `@testing-library` seguía en el bundle.
- **Solución:** Storybook compone el play con `storyAnnotations?.play ?? componentAnnotations?.play`, así que basta con que **no encuentre la clave**. Un plugin de Vite —solo en la build de entrega— renombra `play:` a `playApagadoEnEntrega:` en los `.stories.js`. **No se borra el cuerpo de la función a propósito:** quitar una clave es un cambio léxico de una línea que se puede contar; recortar un bloque de código con una expresión regular, no. El guardarraíl revienta la build si queda algún `play` vivo, que es el patrón que ya usaba `starterslug-sin-notas-internas`.
- **Y la parte que casi se cuela, que es la que hay que llevarse:** la sonda que escribí para verificarlo montaba cada story **en un iframe fuera de pantalla**, y daba el caso del ticket por inmóvil **incluso con el `play` encendido**. En un iframe sin foco, el `focus()` del `play` no agarra y el `{ArrowRight}` no va a ninguna parte. O sea que **la sonda tenía el mismo defecto que venía a medir**: enseñaba verde porque no podía ver. Cargando la story como **página de primer nivel** el control pasó de mover 4 casos a mover 5, y el del ticket entró entre ellos. Es L-062 otra vez, y en menos de veinticuatro horas.
- **Regla general:** una sonda que solo se ejecuta sobre el estado arreglado no mide nada. Hay que pasarla también sobre el estado **roto** —aquí, la build local, donde los `play` sí corren— y **un caso que no se mueve en ese control es un caso que la sonda no certifica**. Se dice aparte en la salida en vez de contarlo como verde: tres de los ocho (`snippets-tariff-module--*`) siguen sin distinguirse, y para esos lo único medido es el mecanismo.
- **El cabo suelto, ya cerrado:** eran tres cosas distintas metidas en el mismo montón — uno reventaba, otro no se veía por mirar la barra equivocada y el tercero es idempotente a propósito. Se desenredó el mismo día en [STARTERSLUG-117](https://<site>.atlassian.net/browse/STARTERSLUG-117), ver L-064.
- **Estado:** resuelto 2026-09-01, `npm run check:play`.

---

## L-062 · Una guardia puede tener el mismo fallo que viene a arreglar

- **Síntoma:** el blindaje de una tarea anterior se ejecutaba —medido, en las 42 fichas—, el getter que quedaba en el prototipo **era el nuestro** —medido también— y las 42 fichas seguían lanzando `Illegal invocation`. Todo indicaba que algo lo reinstalaba por detrás. No era eso.
- **Causa:** el fallo original es que el getter del core lee `this.ownerDocument`, que es un **accesor nativo**, y sobre `HTMLElement.prototype` eso lanza. Mi guardia preguntaba `typeof this.nodeType === 'number'` para saber si `this` era un nodo… y **`nodeType` es otro accesor nativo**. O sea que la comprobación reventaba exactamente igual, antes de llegar a decidir nada. El blindaje se rompía solo.
- **Solución:** no comprobar `this`. Intentar el getter original dentro de un `try` y, si lanza, devolver el `focus` nativo. Probar y atrapar no puede tener el fallo que se está atrapando, y de paso cubre cualquier otro receptor raro.

  ```js
  const getterSeguro = function () {
    try {
      return getterOriginal.call(this)
    } catch {
      return focusNativo(getterOriginal)
    }
  }
  ```

- **Regla general:** cuando el fallo es «leer una propiedad de este objeto lanza», **toda guardia que lea una propiedad de ese mismo objeto es sospechosa**. Y el conjunto no es obvio: en un nodo del DOM, `nodeType`, `ownerDocument`, `parentNode`, `nodeName` y compañía son accesores del prototipo, no campos. Ante la duda, `try`/`catch` en vez de predicado.
- **Lo que lo destapó, y es lo que hay que copiar:** la sonda medía tres cosas por separado —si el blindaje se había ejecutado, de quién era el getter al final, y si leerlo lanzaba—. Con solo la tercera, el diagnóstico habría sido «algo reinstala el parche» y se habría perseguido durante horas al culpable equivocado. **Tres mediciones que se contradicen señalan dónde está el fallo; una sola solo dice que lo hay.**
- **Estado:** resuelto 2026-08-31 ([STARTERSLUG-115](https://<site>.atlassian.net/browse/STARTERSLUG-115)).

---

## L-061 · Un fallo que «no se reproduce» puede tener el mecanismo a mano

- **Síntoma:** Una tarea anterior se cerró el 28-08 con «no se consiguió reproducir»: 44 fichas barridas en headless, cero apariciones. El fallo seguía saliendo en pro.
- **Causa:** se estaba buscando el **disparador** —qué código de Storybook lee `.focus` sobre el prototipo, y cuándo—, que depende de una carrera al montar y no se deja provocar. Pero el **mecanismo** sí: leer `HTMLElement.prototype.focus` lanza siempre, en cuanto el parche está puesto.
- **Solución:** la sonda no busca el fallo, lo provoca — `void iframe.contentWindow.HTMLElement.prototype.focus` en cada ficha. De golpe el fallo pasó de «no reproducible» a **42 de 45 fichas**, y el antes/después del arreglo se pudo medir.
- **Regla general:** cuando un fallo intermitente no se deja reproducir, separa **mecanismo** de **disparador**. Si el mecanismo se puede activar a mano, no hace falta conocer el disparador para arreglarlo ni para demostrar que está arreglado. Y al revés: un barrido que sale limpio buscando el disparador **no prueba nada**, que es justo cómo esto se dio por cerrado el viernes.
- **Coletazo:** la sonda informa de en cuántas fichas está el parche instalado, precisamente para que un verde no pueda confundirse con «la sonda no midió». En la entrega son 42 de 45: las tres que se salvan son las `.mdx` sueltas, que no montan ninguna story.
- **Estado:** resuelto 2026-08-31. Sonda en `scripts/focus-getter-probe.mjs` (`npm run check:focus`).

---

## L-060 · Un PR mergeado no prueba que la rama esté dentro

**Regla general:** el estado de un PR es una afirmación sobre un momento, no sobre una rama.

## L-059 · `body.scrollWidth` no crece aunque la página se desplace: el número que hay que mirar es el de `documentElement`

- **Síntoma:** Alguien del equipo: «en segunda residencia hay scroll lateral». Yo había barrido esa misma página en **17 anchos** con `overflow-probe` y los diecisiete salían «limpios». Los dos teníamos razón: el scroll estaba, y mi lectura decía que no.
- **Causa:** comparé `body.scrollWidth` contra el viewport. **El body no crece** — se queda en el ancho de la ventana— y quien crece es `documentElement`. En esa página: `body` 390 y `html` **679**. `overflow-probe` imprime **los dos números**; yo leí uno y di por bueno el barrido entero.
- **Solución:** al usar la sonda, la condición es que **los dos** coincidan con el viewport. Si solo se mira uno, se mira el que no se entera.
- **Y lo que había debajo, que es la otra mitad:** el desbordamiento era **el mismo fallo de `tariff-panel__cards` en `fibre-hero__cards`** —los `.visually-hidden` absolutos escapando de una pista estática, ver el arreglo del 28-08—. Se arregló un carrusel por la mañana y **no se miró si el patrón vivía en el hermano**. Cuando un fallo sale de un patrón compartido, el arreglo no termina hasta haber buscado los demás sitios donde vive.
- **De propina, un rodeo que evitó el control de L-056:** midiendo con clics parecía que la culpa era de abrir el acordeón, y **los tres selectores daban exactamente 679**. Ese empate olía mal; midiendo sin pulsar nada también salía 679. No era el estado, era el reposo.
- **Estado:** resuelto 2026-08-28.

---

## L-058 · La lista de init a mano se desincroniza

**Regla general:** `initTabs` en la página, y el filtro de velocidad extraído a `modules/tariffs/filtro-velocidad.js`, que usan los dos consumidores.

## L-057 · `down(X)` no es «por debajo de X»

**Regla general:** En mixins de breakpoint down/up, los cortes de un mismo eje tienen que casar — si escritorio entra en up(X), móvil acaba en down(el breakpoint anterior) —; sospecha de solape si el mismo fichero usa los dos con el mismo nombre.

## L-056 · Chrome headless no despacha eventos de scroll, y el instrumento miente tres veces seguidas

- **Síntoma:** buscando un fallo del carrusel del hero, el navegador headless devolvió tres diagnósticos distintos y contradictorios del mismo código: «el bullet nunca cambia», «funciona bien» y «al volver se queda congelado para siempre». El tercero reproducía **exactamente** lo que había descrito el humano, así que parecía la causa encontrada.
- **Causa:** `--virtual-time-budget` **no despacha el evento `scroll`**. Ni uno. Lo que variaba entre pruebas no era el código sino cuánto esperaba cada instrumento antes de leer el DOM, y qué había alcanzado a ejecutarse del `refresca()` inicial.
- **Cómo se cerró, y es lo que hay que copiar:** un **`div` de control** creado en el mismo documento, con contenido desbordado, movido con el mismo `scrollTo` y el mismo timing. Marcó **cero eventos** igual que la pista. Si el control se comporta como el sospechoso, el sospechoso no es el problema.
- **Solución para verificar de todas formas:** el módulo registra `refresca` en **dos** eventos, `scroll` y `resize`. `resize` sí se despacha, así que se posiciona `scrollLeft` a mano y se dispara un `resize`: eso ejercita el código real —no una copia de la fórmula— sin depender del evento que falta.
- **Regla general:** **antes de acusar al código, descarta el instrumento.** Si dos ejecuciones del mismo código dan resultados distintos, el problema está en la medición, no en lo medido. Y un instrumento que confirma la hipótesis que ya tenías es justo el que más hay que dudar.
- **Consecuencia para el harness:** las capturas de `pixel-shot.mjs` y cualquier verificación en headless **no cubren nada que dependa de `scroll`** — carruseles, scroll-snap, cabeceras que se pegan, apariciones al hacer scroll. Eso se abre a mano, y conviene decirlo en el PR.
- **Estado:** resuelto 2026-08-28 ([STARTERSLUG-109](https://<site>.atlassian.net/browse/STARTERSLUG-109)).

---

## L-055 · El chequeo de tokens solo ve lo que sus nodos usan, y a lo demás lo llama «sin comprobar»

- **Síntoma:** `ventajas-tv` y `feature-accordion` escribían `Mobile/H3` (28/130 %/−2 %) a pelo, con el comentario «la escala `Mobile/*` no está en el repo». Y era verdad a medias: Una tarea anterior había adoptado **cinco** estilos de móvil, no seis. El chequeo de cada mañana daba **exit 0, alineado**, todos los días.
- **Causa:** `tokens:diff` no compara contra el archivo de Figma: compara contra un **vuelco de los nodos que `config.json` enumera**. `Mobile/H3` existe en Figma desde siempre, pero **ninguno de los diez nodos barridos lo usaba**, así que no aparecía en el vuelco. El script lo listaba —correctamente— entre los «sin comprobar», que es una sección que se lee por encima porque casi siempre son colores de campaña. Nadie lo cruzó con «y además hay código que lo usa a mano».
- **Por qué esto no lo caza ningún gate:** no hay nada roto. El SCSS compila, los valores a pelo son los buenos, el chequeo sale verde y el snapshot está al día. **La escala del design system estaba incompleta y todo el semáforo decía que no.**
- **Solución:** entra `ventajas-movil` (`2897:25968`) en `config.json → figma.files.handoff.nodos`, que es el nodo donde vive `Mobile/H3`. Con él, el barrido lo comprueba de verdad en vez de listarlo como no visto.
- **Regla general:** **un style que sale como «sin comprobar» no es una baja: es un punto ciego.** Y la forma barata de destaparlos es al revés de como se venía haciendo — en vez de mirar qué dice Figma y buscarlo en el repo, **buscar en el SCSS los valores escritos a mano con un nombre de style al lado**: cada uno de ésos es un style que existe y que el barrido no está viendo.
- **De propina, del mismo día:** la escala de móvil llevaba desde el 27-08 en `$type-scale` y **no se publicaba**. `Design System/Foundations → Typography` enumera sus claves a mano, así que las seis `mobile-*` existían en el repo y el cliente no las veía. Que una story lea las medidas del CSS compilado la protege de **mentir**, no de **omitir**.
- **Estado:** resuelto 2026-08-28 ([STARTERSLUG-108](https://<site>.atlassian.net/browse/STARTERSLUG-108)).

---

## L-054 · Una pieza no lee la variable de otra

**Regla general:** El código de un componente solo debe leer de lo compartido común (settings/tools/framework), nunca de un componente vecino; verifícalo compilándolo aislado, porque el orden normal del build puede esconder la dependencia.

## L-053 · Los tres fallos del día eran el mismo: verde y publicado mal

- **Síntoma:** en una sola tarde se publicaron en pro tres cosas que nadie quería — 53 piezas de más, las **notas internas** del mapa del sitio (dónde miramos, qué medimos, qué nos chirría del handoff) y, al republicar, un Storybook **sin un solo icono** de nuevo/modificado.
- **Causa común:** los cuatro gates comprueban que **compile**, no lo que se publica. Ninguno de los tres se cazó con ellos. Los tres los vio alguien del equipo abriendo el sitio.
- **Y el de los iconos, en concreto:** al republicar varias veces el mismo día se fue **moviendo el tag** `entrega/AAAA-MM-DD` al commit que se publicaba. `estado-entrega.mjs` coge como referencia el tag más reciente que sea antecesor de HEAD… y ese tag **era** HEAD: la entrega se comparaba consigo misma y todo salía «estable». Una entrega no puede ser su propia referencia.
- **Solución:** `deploy.mjs` **revisa lo construido entre construir y subir**, y aborta si ni una pieza sale como nueva o modificada —diciendo qué tag usa de referencia— o si la build no tiene entradas. En cada publicación imprime una línea de revisión **aunque no falle nada**. Va antes de subir a propósito: una entrega mala no se retira de la vista de quien ya la abrió.
- **Lo que hay que llevarse:** un gate que mira el código no cubre una entrega. Lo que se publica hay que **mirarlo**, y mirarlo con un programa, porque mirarlo a ojo es lo que ya falló.
- **De propina:** apagar el render de las notas internas **no basta** — el texto seguía dentro del bundle. «No se ve» no es «no viaja»: se vacían en el módulo de datos antes de compilar.
- **Estado:** resuelto 2026-08-27.

---

## L-052 · Avisar del alcance no es lo mismo que parar

- **Síntoma:** «despliega el header a pro». Se publicó el Storybook **entero**: el cliente pasó de 26 títulos a 48 y vio **53 piezas rotuladas «En curso»** que nunca había visto, con lorem dentro. Hubo que rehacer la entrega dejando solo lo del 19-08 más la cabecera.
- **Causa:** no fue desconocimiento. Se avisó **dos veces**, con la tabla de números delante, de que publicar arrastraba 172 commits — y se ejecutó igual, tomando el aviso por consentimiento.
- **Solución, y no es técnica:** cuando la consecuencia es **irreversible y la ve el cliente**, avisar no basta. Se para y se pregunta. «Publica X» no autoriza a publicar lo que viaja con X, y menos cuando eso multiplica por dos lo que el cliente tenía.
- **Lo mismo, en pequeño, el mismo día:** se pidió una **variante** de la cabecera con submenú y se metió el submenú en la cabecera por defecto. Idéntico patrón — hacer lo que parece razonable en vez de lo que se pidió.
- **Cómo se deja pro con solo lo que toca:** casando por **fichero** contra el tag de la entrega anterior, nunca por título. El 25-08 `Atoms/` y `Molecules/` pasaron a `Basics/`, así que por título **ocho piezas que el cliente ya tiene parecen nuevas**. Y «entregada» significa `production` **en aquel tag**: la política de que las `WIP` viajan es del 25-08.
- **⚠️ La mina que deja:** las suspensiones que recortan la entrega viven en `main`. Un merge `develop → main` **no las levanta**, así que la siguiente entrega saldría sin esas piezas y nadie se enteraría. Hay que revertir ese commit antes de la próxima.
- **Estado:** resuelto 2026-08-27, con la mina pendiente. Ver también **L-053**, que es el mismo día visto desde los gates.

---

## L-051 · Un token «fuente de verdad» que nadie leía

**Regla general:** Un token documentado como fuente de verdad no sirve de nada si ningún fichero lo lee de verdad; verifícalo con una comprobación en tiempo de ejecución, no leyendo el código.

## L-050 · Un estado debe repetir cada propiedad de su base

**Regla general:** Un estado (`:hover` y similares) que no repite explícitamente cada propiedad de su base hereda la del framework si esta tiene más especificidad; audita el CSS compilado en el estado real, no el SCSS en reposo.

## L-049 · Una página que se reescribe debe buscarse por id

**Regla general:** el estilo lleva `id="app-style"` y se lee con `getElementById`, en el generador y en la reconstrucción.

## L-048 · Buscar por node-id evita tareas duplicadas

**Regla general:** Antes de crear una tarea nueva para una pieza de diseño, busca por su identificador estable (node-id u otro id externo), no por nombre ni catálogo local, para evitar duplicados entre agentes en paralelo.

## L-047 · `flex-basis` no encoge una imagen, y una prueba con imagen falsa lo tapa

- **Síntoma:** en `feature-split--media` la columna de bloques salía de **21 px** —el texto partido letra a letra— y ni el titular ni la foto aparecían. El HTML era correcto, el CSS compilado era correcto, la clase estaba puesta y la media query era la buena. Todo comprobado uno por uno.
- **Causa:** un elemento flex arranca con **`min-width: auto`**, que para un `<img>` es su ancho **intrínseco**. La foto se guarda al doble para pantallas densas (812 px), así que `flex: 0 0 406px` no la encogía: se quedaba a 812, se comía la columna del medio y a la lista le sobraban los 21 px que quedaban.
- **Solución:** `min-width: 0` en la imagen. Una línea.
- **Regla general:** en un contenedor flex, **`flex-basis` es un deseo y `min-width: auto` es la ley**. Cualquier hijo con tamaño intrínseco —imagen, vídeo, `<canvas>`— necesita `min-width: 0` para respetar su basis. Con texto casi nunca se nota; con imágenes, siempre.
- **Y lo que más costó, que no fue el fallo sino el diagnóstico:** monté un HTML de prueba con el CSS real y el mismo marcado para medir las columnas, y **salió perfecto** — 357 / 406 / 399. Usaba un GIF de 1×1 como imagen, así que el intrínseco era 1 y el problema desaparecía. **Una prueba con un asset de mentira no prueba el layout**: mide otra cosa y con más confianza. Hay que medir con la imagen de verdad.
- **Estado:** resuelto 2026-08-26 ([STARTERSLUG-97](https://<site>.atlassian.net/browse/STARTERSLUG-97)).

## L-046 · Un comentario caduca con la dependencia que justificaba

**Regla general:** Cuando migres una dependencia, los comentarios que se apoyaban en ella son código a revisar, no prosa: búscalos por el nombre de la dependencia, no por el síntoma.

## L-045 · Un export de diseño se reescala en silencio

**Regla general:** antes de dar por buena una captura de referencia, comprueba sus dimensiones contra las del nodo.

## L-044 · `origin/develop` se mueve solo bajo tus pies, y `reset --soft` sobre él escribe un revert

- **Síntoma:** un commit que debía tocar 6 ficheros del harness sale con **18**, y dentro va la reversión entera de otra tarea: los 9 títulos de `Basics/` vuelven a `Atoms/` y `Molecules/`, y el `storySort` con ellos. Ni un conflicto, ni un aviso. El `git commit` dice «18 files changed» y ahí acaba la pista.
- **Causa:** dos cosas que por separado son inofensivas. (1) El IDE hace `git fetch` en segundo plano, así que `origin/develop` **avanza durante la sesión** sin que tú hagas nada — aquí entró el PR #141 mientras trabajaba. (2) La rama se había creado del `origin/develop` de **antes**, y al terminar hice `git reset --soft origin/develop`. Eso mueve HEAD al develop **nuevo** dejando el índice con el árbol **viejo**: el commit resultante es, literalmente, «pon el repo como estaba antes del #141».
- **Por qué no lo caza nada:** no hay conflicto —el reset --soft no fusiona, solo recoloca HEAD—, los gates pasan porque el árbol viejo era válido, y el diff «huele» normal salvo por el número de ficheros. **La única señal fue el recuento**, y solo porque yo sabía cuántos ficheros había tocado.
- **Solución:** reconstruir el commit contra el develop de verdad: `git reset --hard origin/develop` y traer **solo** los ficheros propios con `git checkout <commit-malo> -- <rutas>`. Como la rama aún no tenía PR, un force-push lo dejó limpio.
- **Regla general:** `reset --soft <ref remota>` solo es seguro si esa ref no se ha movido desde que ramificaste — y en este repo **se mueve sola**. Si vas a resetear contra `origin/*`, `git fetch` primero y compara: `git rev-parse origin/develop` antes y después. Y **cuenta los ficheros del commit antes de empujar**: si salen más de los que tocaste, no es que git haya sido listo, es que has arrastrado algo.
- **Es el segundo tropiezo del mismo día con la misma causa raíz.** Por la mañana el parte de arranque afirmó que una tarea anterior «no estaba mergeado»: era cierto al comprobarlo y falso veinte minutos después, porque `origin/develop` se movió en medio. **Un dato leído de `origin/*` tiene fecha de caducidad dentro de la propia sesión.**
- **Estado:** resuelto 2026-08-25 en [STARTERSLUG-88](https://<site>.atlassian.net/browse/STARTERSLUG-88).

## L-043 · Renombrar una rama por la API de GitHub **cierra** su PR, no lo repunta

- **Síntoma:** se renombra `feat/release-notes-entrega` → `feat/STARTERSLUG-86-release-notes` con `POST /repos/:o/:r/branches/:b/rename` contando con que GitHub retargetee el PR abierto. La llamada devuelve 200 y el nombre nuevo. El PR #138 aparece **`closed`**, y con el `head` apuntando todavía al nombre viejo.
- **Y no se puede deshacer:** reabrirlo da `Validation Failed · state cannot be changed. The <rama vieja> branch has been deleted`. El PR queda cerrado para siempre, con sus comentarios y su revisión dentro.
- **Causa:** el renombrado es un borrado más una creación. La documentación dice que las PR abiertas se actualizan, pero eso vale para la rama **base**, no para la `head` cuando el que renombra es la API. Con la `head` borrada, GitHub cierra el PR igual que si la hubieras borrado a mano.
- **Solución:** decidir el nombre de la rama **antes** de abrir el PR — o sea, crear la tarea de Jira antes de la rama, que es lo que dice `docs/jira-workflow.md` y aquí se hizo al revés. Si ya está abierto y hay que repuntarlo: se abre un PR nuevo desde la rama nueva y se enlaza al cerrado. No hay forma de conservar el original.
- **Regla general:** en GitHub, `head` y `base` no se tocan igual. `base` se cambia con un `PATCH` al PR y es reversible; `head` **no se puede cambiar**, y cualquier cosa que borre esa rama cierra el PR de forma definitiva.
- **Ojo con el número de esta lección, que es media lección aparte:** se escribió como **L-043** y no como L-041 estando L-041 libre en `develop`, porque el PR #137 —abierto en ese momento— ya traía L-041 y L-042. Al mergearse, las tres entraron sin pisarse y el único conflicto fue de posición en el fichero. Coger «el siguiente número libre _de mi rama_» es exactamente lo que provocó la colisión de L-040 del 24-08: dos lecciones distintas con el mismo número, escritas el mismo día sin verse. **Antes de numerar una lección, mira también las ramas abiertas** — `git log --all --oneline -- docs/starterslug-harness/lecciones.md` las enseña todas.
- **Estado:** resuelto 2026-08-25 en [STARTERSLUG-86](https://<site>.atlassian.net/browse/STARTERSLUG-86).

## L-042 · Un Storybook viejo dice que tu trabajo no existe, y suena convincente

- **Síntoma:** la página `Pages/Tarifas Fibra` estaba maquetada, verificada al píxel, commiteada y empujada — y en `localhost:6006` no aparecía por ningún lado. Ni la página ni los tres snippets nuevos. La primera lectura razonable es «no está hecha».
- **Causa:** el `storybook dev` llevaba corriendo desde las 10:55 y los ficheros se crearon a las 15:02. HMR recoge los cambios **dentro** de un fichero de story que ya conocía, pero un **fichero de story nuevo** no siempre entra sin reiniciar el servidor.
- **Cómo se cazó:** no mirando la pantalla, sino comparando dos índices. El `index.json` del servidor vivo servía **127 entradas**; una build fresca daba **131**. Las cuatro de diferencia eran exactamente las de esa tarde. Un número contra otro número, no una impresión.
- **Solución:** reiniciar `npm run storybook` cuando aparezca una story nueva. Y ante «no lo veo», preguntar antes al `index.json` que a los ojos: `curl -s localhost:6006/index.json`.
- **Regla general:** la pantalla es una build, y una build tiene fecha. Cuando la pantalla contradice al repo, el sospechoso por defecto es la build, no el repo — es el mismo género que **L-032** (capturar contra una build que ya no existe) y que **L-015** (un sitio retirado que sigue sirviendo). Lo caro de este fallo no es el minuto de reinicio: es que la conclusión equivocada —«esto no está hecho»— es perfectamente creíble y no deja rastro.
- **Estado:** resuelto 2026-08-24 en [STARTERSLUG-74](https://<site>.atlassian.net/browse/STARTERSLUG-74). __

## L-041 · «Sin padding» apuesta por el ritmo de una página

**Regla general:** Un módulo sin padding de sección no es agnóstico: es una apuesta silenciosa por el ritmo de la Home.

## L-040 · Un regex perezoso se traga bloques hermanos

**Regla general:** Un patrón/regex perezoso entre dos marcas de apertura y cierre no delimita un bloque: se traga bloques hermanos del mismo tipo hasta la siguiente marca que encuentre; hace falta un candado que le impida cruzar la siguiente apertura.

## L-039 · Cambiar `display` a `flex` no borra el `justify-content` de la rejilla que había debajo

- **Síntoma:** el carrusel de tarifas de la página de alianza arrancaba por la quinta card. `scrollLeft` era 0 y el orden del DOM era el correcto —38, 45, 47, 50…—, pero la primera card estaba en `x: -527`, fuera del alcance del scroll. `scrollWidth` daba 1955 en vez de los 2560 del contenido, así que ni siquiera se notaba que faltaba nada.
- **Causa:** el módulo de tarifas monta las cards con `display: grid` + `justify-content: center` en escritorio. La variante de alianza las repasa a `display: flex` para poder desplazarlas, pero **`justify-content` no es una propiedad de grid: es de alineación de caja y sobrevive al cambio de `display`**. Centrar una línea flex que desborda reparte el sobrante —que es negativo— a los dos lados, y lo que se sale por la izquierda de un contenedor de scroll **no es alcanzable**: el scroll solo llega a lo que desborda por la derecha.
- **Solución:** `justify-content: flex-start` explícito en la variante, y el centrado de «cuando sí caben» con `margin-inline-start/end: auto` en la primera y la última card. Con espacio libre negativo los `auto` valen 0, así que la misma regla sirve para los dos casos sin media queries ni JS.
- **Cómo se cazó:** no por la captura —parecía un carrusel normal empezado por otro sitio— sino midiendo en el navegador `scrollLeft`, `scrollWidth`, `clientWidth` y el `getBoundingClientRect().x` de la primera card. El síntoma «se ve mal» y el síntoma «hay contenido inalcanzable» se distinguen en los números, no a ojo.
- **Regla general:** al reescribir el `display` de un selector que ya tenía estilos, hay que repasar **todas** las propiedades de alineación heredadas del modo anterior (`justify-content`, `align-content`, `justify-items`, `place-*`), no solo las que son obviamente de grid. Y `justify-content: center` **nunca** va en un contenedor con `overflow: auto` salvo con `safe`.
- **Estado:** resuelto 2026-08-24 en [STARTERSLUG-73](https://<site>.atlassian.net/browse/STARTERSLUG-73).

## L-038 · Una auditoría vale lo que cubre, y «0 px de diferencia» no dice qué se miró

- **Síntoma:** la migración a Bootstrap 4 se audita comparando 10 capturas contra la versión anterior. Salen **las 10 a 0 px**, incluida la Home entera a 1440 y a 390. Se da por buena. Al día siguiente aparecen cuatro piezas rotas — entre ellas la story de botones del Design System, que enseñaba los cuatro estados idénticos porque los forzaba con propiedades CSS que ya no existían.
- **Causa:** las 10 capturas eran ciertas y el método estaba bien. Lo que falló es el **alcance**: ninguna incluía `src/stories/` ni `src/pages/`. Un cero muy rotundo sobre una muestra parcial se lee como «no se ha roto nada», cuando solo dice «no se ha roto nada de lo que miré».
- **Solución:** antes de comparar píxeles, **barrer el repo por la API que se está retirando** y usar ese barrido para decidir qué capturar. Aquí, un `grep` de `--bs-*`, de las funciones de SASS de la 5 y de `data-bs-*` sobre `src/` entero saca las cuatro en segundos, y además dice exactamente qué stories hay que meter en la muestra.
- **Y no basta con grepear una vez:** el barrido inicial de una tarea anterior sí encontró esos 16 usos en `buttons.stories.js` —salían en el recuento— pero al ir a corregir solo se tocaron los ficheros `.scss`. La lista se miró para dimensionar, no para tacharla entera.
- **Regla general:** un informe de auditoría tiene que decir **qué se miró**, no solo el resultado. «10 de 10 a 0 px» sin la lista de las 10 es un número sin denominador.
- **Estado:** resuelto 2026-08-21 en [STARTERSLUG-85](https://<site>.atlassian.net/browse/STARTERSLUG-85).

## L-037 · Renombrar el export de una story deja referencias muertas que los cuatro gates aplauden

- **Síntoma:** se renombran los exports de `submenu.stories.js` (`Fibra` → `Fiber`, `Móvil` → `Mobile`). **Los cuatro gates dan verde**, `check:stories` incluido. La story `Mobile` está rota: en vez del componente pinta la caja de error de Storybook con `Fibra is not defined`.
- **Causa:** al final del fichero, `Fibra.play = comprueba(FIBRA)` y `Móvil.play = comprueba(MOVIL)` seguían apuntando a los nombres viejos. Es un `ReferenceError` **a nivel de módulo**, así que revienta la story entera, no solo el test.
- **Por qué no lo caza ningún gate:** `check:stories` **compila** el bundle, no lo ejecuta. Un identificador inexistente es JavaScript perfectamente válido hasta que corre. `build` no toca las stories y `format:check` solo mira el formato. Es el género de `L-010` y `L-016` —verde en los cuatro y roto en pantalla— con un agravante nuevo: **`pixel-shot` produjo un PNG con pinta de captura buena**, y solo abriéndolo se ve que dentro hay un error.
- **Solución:** tras renombrar un export, `grep` del nombre viejo en el propio fichero. Y una comprobación que cuesta cinco líneas:
  ```js
  const exports = [...t.matchAll(/^export const (\w+)/gm)].map((m) => m[1])
  const usos = [...t.matchAll(/^(\w+)\.play/gm)].map((m) => m[1])
  usos.filter((u) => !exports.includes(u)) // tiene que salir vacío
  ```
- **Regla general:** un rename no termina en la declaración. Y **una captura no es una verificación si nadie la mira**: el paso de pixel-perfect existe justo para esto — lo encontró el Ojo al abrir la imagen, no el harness al generarla.
- **Estado:** resuelto 2026-08-21.

## L-036 · Las paradas de un degradado de Figma NO son porcentajes de la caja

- **Síntoma:** se copian los `gradientStops` del nodo tal cual a un `linear-gradient` y el resultado sale **lavado**. En el footer, el fondo se iba a `#9cc9ff` abajo cuando el render de Figma da `#286bfb`: un azul cielo pálido donde tenía que haber azul saturado. A ojo parece «el degradado tira demasiado a claro» y uno se pone a mover colores, que es la pista falsa.
- **Causa:** las paradas van sobre el **eje** del degradado, y el eje **no tiene por qué acabar en el borde de la caja**. Lo dicen los `gradientHandlePositions`, no los stops. En el footer los tirantes van de `y=0` a `y=1,165`: el eje se extiende un **16,5 % por debajo** del elemento.

  |           | stop en Figma | dónde cae en la caja            |
  | --------- | ------------- | ------------------------------- |
  | `#02018c` | 0 %           | 0 %                             |
  | `#034efb` | 80 %          | **93,2 %**                      |
  | `#add6ff` | 100 %         | **116,5 %** — fuera de la vista |

  O sea que el último color **no llega a verse**: abajo del todo solo se ve el arranque hacia él.

- **Solución:** multiplicar cada parada por la longitud del eje (aquí ×1,165) antes de escribirla. CSS admite paradas por encima del 100 %, así que la última se queda en `116.5%` y se lee igual de bien que en Figma.
- **Cómo se comprueba:** exportando el nodo por REST y **comparando el color a la misma altura relativa** en las dos imágenes. Es lo que destapó el fallo: en la captura se veía «más claro», pero la tabla de `#0243eb` frente a `#0050ff` a cada 10 % dice exactamente cuánto y dónde.
- **Regla general:** de un degradado de Figma hacen falta **dos** datos, y los stops son solo uno. Sin los tirantes no se sabe dónde caen. Vale para cualquier degradado del handoff, no solo este.
- **Estado:** resuelto 2026-08-21 en [STARTERSLUG-83](https://<site>.atlassian.net/browse/STARTERSLUG-83).

## L-035 · `scrollWidth` miente sobre el scroll horizontal; `scrollX` no

- **Síntoma:** en móvil, al arrastrar el carrusel hasta el tope, **el gesto se lleva la página entera** y el viewport se queda corrido a la derecha con medio módulo fuera. Al ir a diagnosticarlo, `documentElement.scrollWidth` da 663 sobre un viewport de 390 — o sea, parece que algo desborda 273 px.
- **Causa:** dos cosas distintas que se confunden en una.
  1. El `scrollWidth` de 663 es **ruido**: Chrome lo calcula sobre la unión de las cajas de los descendientes aunque un ancestro las recorte. Con `overflow: hidden` en el módulo y `overflow-x: auto` en el carrusel, nada escapaba. La prueba que zanja: `window.scrollTo(9999, 0)` y leer `scrollX` — dio **0**, así que el documento no se desplazaba.
  2. Lo que sí pasaba es **encadenamiento de scroll**: cuando un contenedor de scroll llega a su tope, el navegador propaga el gesto al ancestro. No hace falta que la página desborde para que se mueva.
- **Solución:** `overscroll-behavior-x: contain` en cada contenedor de scroll. Es exactamente lo que existe para esto. No es un apaño: un `overflow: hidden` en el `body` habría tapado el síntoma sin arreglar la causa, y de paso habría roto cualquier scroll horizontal legítimo.
- **La herramienta:** `scripts/overflow-probe.mjs`. Monta la story en un iframe del ancho pedido, lista los elementos que pasan del viewport, dice **cuáles de ellos no los recorta ningún ancestro** —que son los únicos culpables posibles— y comprueba si el documento se desplaza de verdad. Sale por `--dump-dom`, así que no hay que interpretar una imagen.
- **Regla general:** ante un scroll horizontal fantasma, no vayas probando `overflow: hidden` por los ancestros hasta que calle. Mide quién escapa y si de verdad se desplaza; las dos preguntas tienen respuesta exacta y son distintas.
- **Estado:** resuelto 2026-08-21 en [STARTERSLUG-77](https://<site>.atlassian.net/browse/STARTERSLUG-77).

## L-034 · `sips --cropOffset` desplaza desde el CENTRO, y el recorte parece un fallo de maquetación

- **Síntoma:** se recorta la captura del Storybook con `sips -c <alto> <ancho> --cropOffset 0 0` para mirar una zona, y sale **todo corrido a la izquierda y cortado**. Diagnóstico inmediato y equivocado: «el módulo desborda, el contenedor está mal centrado» — y se empieza a buscar el fallo en el SCSS que se acaba de escribir.
- **Causa:** `sips` recorta **centrado** por defecto y `--cropOffset` es un desplazamiento **respecto al centro**, no la esquina superior izquierda. Con `0 0` no recorta desde el origen: devuelve la banda central. Sobre una captura de 520 de ancho —que es lo que da `pixel-shot` en móvil, ver `L-008`— pedir 390 «desde 0,0» sale con el contenido movido 65 px a la izquierda.
- **Solución:** no usar `sips` para recortar por coordenadas. Se decodifica el PNG y se copia el rectángulo que toca, que además es lo que ya hace `scripts/pixel-measure.mjs` para medir.
- **Por qué engaña tanto:** el recorte mal hecho produce una imagen **plausible** — se ve la pieza, se lee, solo está desplazada. A ojo es indistinguible de un `overflow` mal resuelto, y aparece justo después de tocar el CSS, que es donde uno mira primero. Antes de creer que la maqueta está rota, **mira la captura sin recortar**.
- **Prima de `L-032`:** allí una build a medias parecía una story rota; aquí un recorte mal hecho parece un layout roto. En los dos casos falla la herramienta de verificación y la culpa se le echa a lo verificado.
- **Estado:** resuelto 2026-08-21 en [STARTERSLUG-77](https://<site>.atlassian.net/browse/STARTERSLUG-77).

## L-033 · Un logo exportado con el fondo dentro no se ve mal: se ve _casi_ bien

- **Síntoma:** el sello de la Junta Arbitral pinta una caja ligeramente más clara a su alrededor sobre el azul del footer. Se lee perfectamente, no desencaja nada y ningún gate lo mira — llevaba desde que se montó el footer, publicado en producción, sin que nadie lo cazara.
- **Causa:** el PNG del repo **no tenía transparencia**: sus 7.770 píxeles estaban al 100 % de opacidad. No era un logo sobre transparente sino un rectángulo de 185×42 relleno, y dentro llevaba un trozo del **degradado del propio footer**, capturado al exportarlo (`#0550FB` arriba, `#1E64FC` abajo). Como el footer real va de `#00008C` a `#0050FF`, el azul incrustado y el azul de debajo no coinciden — de ahí la caja.
- **Solución:** reexportar el nodo desde el handoff en vez de reutilizar el fichero que hay (`2163:11526`, a 3× para retina). El original de Figma estaba bien: **el 69,8 % de sus píxeles son transparentes**. Lo que estaba mal era la exportación que entró en el repo.
- **Cómo se comprueba sin abrir nada:** el `colorType` de la cabecera IHDR del PNG dice si hay canal alfa (6 = RGBA, 2 = RGB), y contar los valores de alfa dice si lo usa. Un logo sobre transparente tiene un porcentaje alto de alfa 0; uno con el fondo dentro tiene **0 %**. Es un dato, no una impresión — mirar la captura no lo distingue.
- **Regla general:** un activo heredado se comprueba antes de darlo por bueno, aunque «se vea bien». Los defectos que sobreviven meses no son los que rompen la pantalla: son los que se parecen a la pantalla correcta. Mismo patrón que `L-030` —un `node-id` muerto tampoco rompe nada— y que el punto ciego del drift-check con los valores sin nombre.
- **Estado:** resuelto 2026-08-21 en [STARTERSLUG-24](https://<site>.atlassian.net/browse/STARTERSLUG-24).

## L-032 · Capturar contra una build que ya no existe se parece mucho a una story rota

- **Síntoma:** se captura la story recién escrita con `pixel-shot` y sale una **pantalla negra** con un «no» suelto en la esquina. Diagnóstico inmediato y equivocado: «la story compila pero revienta al pintar», que es justo el fallo que describe `L-010`.
- **Causa:** la captura apuntaba a `storybook-static-check`, el directorio de `npm run check:stories`. Y ese script **borra su salida al terminar** (`rmSync` tras un exit 0), a propósito, porque solo existe para comprobar que todo compila. Lo que se estaba fotografiando era una carpeta vacía servida como sitio estático.
- **Solución:** para capturar hay que construir una build propia y conservarla — `STARTERSLUG_STORYBOOK_TODO=1 npx storybook build -o .sb-verify` — y borrarla al acabar. Contra ella, la misma story salió perfecta a la primera.
- **Cómo se caza en 30 segundos:** captura **otra story que ya funcionaba**. Si también sale negra, no es tu código: es el directorio. Comprobarlo cuesta lo mismo que mirar el tuyo y descarta la mitad del espacio de búsqueda. Y un `ls` del directorio de build lo cierra del todo.
- **Lo que engaña de verdad:** los cuatro gates y `check:stories` estaban en **verde**, así que el reflejo era buscar el fallo en lo único no cubierto por ellos, el renderizado. La herramienta de verificación se había convertido en la fuente del error, y una captura en negro **no distingue** entre «no hay build» y «la build pinta mal». Un fallo de andamiaje disfrazado de fallo de producto.
- **Hermana de `L-018`:** allí «el árbol está limpio» podía querer decir que acabas de borrar algo. Aquí una captura vacía puede querer decir que no hay nada que capturar. En los dos casos la herramienta contesta con normalidad a una pregunta que no es la que creías estar haciendo.

## L-031 · Las menciones de Jira no funcionan en markdown, y fallan sin avisar

- **Síntoma:** se comenta una tarea con `[~accountid:712020:...]` y `contentFormat: "markdown"`. El comentario se publica y parece correcto, pero **a la persona mencionada no le llega nada**. En el cuerpo devuelto se ve por qué: `\[\~accountid:...\]` — el conversor escapó los corchetes y lo dejó en texto plano.
- **Causa:** el conversor de markdown de la API de Jira no reconoce la sintaxis de mención; la trata como texto y la escapa. Una mención de verdad es un **nodo `mention` de ADF**, no una cadena.
- **Solución:** `contentFormat: "adf"` y el cuerpo como documento, con la mención como nodo:
  ```json
  { "type": "mention", "attrs": { "id": "<accountId>", "text": "@Nombre" } }
  ```
  Se confirma leyendo la respuesta: tiene que salir `<custom data-type="mention">`, no `\[\~accountid:`.
- **Regla general:** el comentario largo puede ir en markdown —tablas y listas se convierten bien—, pero **si el objetivo es que alguien se entere, la mención va en ADF**. Y compruébalo en la respuesta: es un fallo silencioso, y el harness avisa a la persona equivocada de nada mientras el tablero parece correcto.
- **Estado:** resuelto 2026-08-20.

## L-030 · Un node-id caduca como una URL

**Regla general:** un node-id de una ficha es una referencia externa que caduca, como una URL.

## L-029 · Un 403 puede ser del token, no del archivo

**Regla general:** cuando un error de permisos sugiera una causa, acota antes de actuar sobre ella, y acota por los dos ejes: qué archivo es y quién lo pide.

## L-028 · Un PR apilado sobre una rama que se mergea antes se queda en tierra de nadie

- **Síntoma:** el PR #91 salía como `merged: true` y su trabajo **no estaba en `develop`**. Tres commits —toda la taxonomía del design system— desaparecidos del sitio donde se buscaban.
- **Causa:** #91 iba `refactor/STARTERSLUG-nombres-ingles → chore/STARTERSLUG-alcance-entrega`, apilado a propósito porque los dos tocaban las mismas 21 stories y separarlos garantizaba conflicto. Pero el #90 (`chore/STARTERSLUG-alcance-entrega → develop`) se mergeó **18 segundos antes**. Cuando el #91 aterrizó, su base ya era una rama muerta: el merge fue real, el destino ya no llevaba a ninguna parte.
- **Solución:** los commits seguían intactos en `origin/chore/STARTERSLUG-alcance-entrega`. Se recuperaron con un merge de esa rama sobre una nueva salida de `develop`, conservando su historia, y de ahí salió el PR #92.
- **Regla general:** si apilas un PR, **el orden de merge es parte del PR**, no un detalle. Dilo en el cuerpo y comprueba después de mergear la base que el apilado ha reapuntado a `develop`; GitHub a veces lo hace solo y a veces no. Y lo que de verdad protege: `git merge-base --is-ancestor <commit> origin/develop` sobre los commits clave, en vez de fiarte de un `merged: true` que solo dice que aterrizó **en algún sitio**.
- **Hermana de `L-023`:** las dos son lo mismo — dar por bueno un «mergeado» sin comprobar dónde.
- **Estado:** resuelto 2026-08-19.

## L-027 · Alinear una rama copiando en vez de mergeando explota en la entrega siguiente

- **Síntoma:** el PR de entrega `develop → main` no se podía mergear: **72 conflictos**, en ficheros que nadie había tocado en semanas.
- **Causa:** ninguno era un conflicto de verdad, eran todos `add/add`. El 14-08 se alineó `main` con `develop` **copiando** el contenido en un commit nuevo (`d5444d0`, una tarea anterior) en vez de mergeando. Para git, cada fichero compartido pasa a estar añadido de forma independiente en las dos ramas, sin ancestro común que los relacione. La rama _parecía_ alineada —el contenido era idéntico— y la bomba solo estalla cuando alguien recorre la ruta de verdad. Tardó cinco días.
- **Solución:** merge de `develop` en `main` tomando **el árbol de develop entero** (`git read-tree --reset -u develop` con el merge en curso, y commit). Queda un merge con los dos padres y el árbol exacto de develop. Comprobado con `git diff develop HEAD` vacío. Después, merge de vuelta `main → develop` para cerrar el grafo.
- **Regla general:** **dos ramas se alinean mergeando, nunca copiando.** Si el contenido de una tiene que ser el de la otra, el merge con `read-tree` da el mismo resultado _y_ la historia compartida. Un `git diff` vacío entre dos ramas no significa que se puedan mergear: eso lo dice `git merge-base`.
- **Estado:** resuelto 2026-08-19. A partir de aquí las dos ramas comparten historia y la próxima entrega no debería chocar.

## L-026 · Un renombrado por palabra se come la prosa, y algunas palabras son nombres de producto

- **Síntoma:** tras renombrar las variantes de las stories quedaron cosas como `«FibreOnly y Móvil»`, `«la sub-barra de FibreMobileAndTv»` y un `label: 'OnImage sobre fondo azul'`.
- **Causa:** un reemplazo con `\b…\b` sobre el fichero entero. Da igual que el límite de palabra sea correcto: `TV`, `Fibra`, `Movil` y `Blanco` **también son palabras normales** que salen en comentarios, en los `name:` y en datos de la story. El script no distingue una declaración de un texto.
- **Solución:** los cuatro paneles se renombraron a mano, tocando solo la línea del `export const` y la del `.play`. El resto sí se pudo automatizar porque sus nombres (`CuatroItems`, `SubbarraNoCambiaPanel`) no aparecen en prosa.
- **Regla general:** antes de un reemplazo masivo, pregúntate **si el identificador es también una palabra**. Si lo es, no se automatiza: se hace a mano o se ancla el patrón a la declaración (`^export const X`). Y siempre `git diff` antes de commitear — aquí se cazó así, no con un test.
- **Prima de `L-022`:** allí el reemplazo se gastó en el comentario de cabecera. Mismo género: el script no sabe qué es código y qué es texto.
- **Estado:** resuelto 2026-08-19.

## L-025 · `prettier --write` sobre `.mdx` los rompe, y por eso el `format:check` no los cubre

- **Síntoma:** `npm run check:stories` falló con `Error: Could not parse expression with acorn` / `Unable to index ./src/stories/getting-started.mdx`, justo después de formatear.
- **Causa:** se lanzó `prettier --write "src/**/*.{js,mdx}"` añadiendo `.mdx` por mi cuenta. Prettier trata `{/* comentario */}` como énfasis de markdown y lo reescribe a `{/_ comentario _/}`, que ya no es un comentario JSX válido. También reformatea el JSX de dentro, pero eso es inocuo; lo que rompe es el comentario.
- **Solución:** revertir **todos** los `.mdx` (`git checkout -- "*.mdx"`) y reaplicar a mano los cuatro cambios reales. Los `.js` sí se quedan formateados.
- **Regla general:** el `format` del repo cubre `js/scss/html` y **no** mdx **a propósito**, no por olvido. Si amplías el glob de una herramienta que ya existe, asume que el recorte estaba puesto por algo y compruébalo antes.
- **Estado:** resuelto 2026-08-19.

## L-024 · El hueco de la rejilla se estira; la card de dentro, no

- **Síntoma:** las cinco cards del manifiesto salían a tres alturas distintas —282, 291,2 y 313,5— y los bordes inferiores de cada fila no alineaban. Lo vio alguien del equipo a simple vista el 18-08.
- **Causa, y son dos capas que se confunden:**
  1. La rejilla **sí** iguala: `align-items` vale `stretch` por defecto, así que los `<li>` de una misma fila ya medían lo mismo. Pero la card vive **dentro** del `<li>` y solo tenía `min-height`, así que se quedaba en su alto de contenido y dejaba aire debajo. En «No te molestaremos»: hueco de 313,5 y card de 282.
  2. Y `stretch` iguala **por fila**, no por rejilla. Con dos filas en escritorio y cinco en móvil, cada fila se nivelaba por su cuenta.
- **Solución:** `grid-auto-rows: 1fr` en el contenedor nivela **todas** las filas a la más alta, y `height: 100%` en la card hace que llene su hueco. Las dos cosas hacen falta: cada una sola deja la mitad del problema.
- **Lo que destapó de propina:** el JS del reparto mide el centro del **hueco** para saber cuánto viaja cada card hasta el montón. Una card más baja que su hueco se apilaba descentrada media diferencia —unos 16 px— sin que nadie lo relacionara con el texto largo de otra card.
- **La regla que queda:** cuando algo «no cuadra de alto» en una rejilla, mide **las dos cajas**, la del hueco y la del contenido. Si solo mides una, el diagnóstico sale al revés: parecía que la rejilla no igualaba, y lo que no llenaba era la card.
- **Ojo con el número:** los 313,5 no son el diseño. El Figma dice 282 con On Air, y estamos midiendo con la fuente de respaldo ([STARTERSLUG-57](https://<site>.atlassian.net/browse/STARTERSLUG-57)). Iguales sí están; a la medida del handoff volverán cuando lleguen los `.woff2`.
- **Estado:** resuelto 2026-08-18. Medido con Chrome headless a 390, 768, 992, 1280, 1440 y 1920: diferencia 0 en todos.

## L-023 · Borrar una rama porque alguien dice que está mergeada

- **Síntoma:** el 18-08, tras un «mergeado», se borró la rama `feat/STARTERSLUG-13-tag-oferta` en local y en remoto. El PR #84 estaba **cerrado pero NO mergeado**, así que el commit quedó huérfano y el trabajo fuera de `develop`.
- **Causa:** se dio por buena la palabra en vez de comprobar el estado. Y no era la primera vez: ese mismo día, con el #79, el merge por API falló por los acentos del título y **el borrado de rama que iba detrás se ejecutó igual**, cerrando un PR sin mergear. Dos veces en un día, por dos caminos distintos.
- **Qué lo salvó:** el commit seguía en el object store local, así que bastó `git branch <rama> <sha>` y volver a pushear. Desde otra máquina, o después de un `gc`, no habría vuelta.
- **Solución:** antes de borrar una rama, comprobar **`merged: true`** por API (`GET /pulls/:n`), no `state`. Un PR puede estar `closed` sin estar mergeado — y borrar la rama es justo una de las formas de dejarlo así.
- **Regla general, que es lo que importa:** borrar la rama va **al final y solo con la confirmación en la mano**. Encadenar merge y delete en una sola orden es cómodo hasta que el merge falla en silencio y el delete no se entera. Y «me han dicho que está mergeado» no es una comprobación: es un rumor con buena intención.
- **Estado:** resuelto 2026-08-18. Rama restaurada, PR #84 reabierto.

## L-022 · El `replace` se gasta en el comentario de cabecera

- **Síntoma:** la story `Snippets/Tag` pintaba literalmente `{{ badge.label }}`, sin fondo, sin forma y sin texto. Llevaba así desde que se montó.
- **Causa:** el helper resolvía los hooks **antes** de quitar el comentario de cabecera del partial. Ese comentario documenta los hooks, así que también contiene `{{ badge.label }}`. Como `String.replace` con una cadena solo cambia **la primera ocurrencia**, se gastaba en la del comentario; luego el comentario se borraba y el token de verdad se quedaba escrito en pantalla.
- **Solución:** quitar el comentario **primero** y sustituir después. Una línea de orden, explicada en el código para que no vuelva.
- **Regla general, que es lo que importa:** todos nuestros partials documentan sus hooks en la cabecera, así que **cada `{{ … }}` del marcado tiene un gemelo dentro del comentario**. Cualquier renderizador que use `replace` con cadena sin quitar antes el comentario está resolviendo el token equivocado. Merece la pena repasarlo en el resto de piezas.
- **Ningún gate lo caza**, porque el resultado compila: es HTML válido que contiene una llave. Es el género de `L-016` y `L-017` — verde en los cuatro y roto en pantalla.
- **Estado:** resuelto 2026-08-18 · [STARTERSLUG-13](https://<site>.atlassian.net/browse/STARTERSLUG-13).

## L-021 · Dos componentes casi iguales, y los nombres de capa mienten

- **Síntoma:** las cards de tarifa tenían mal el ancho, el padding, todos los huecos internos, la altura del tag y los siete tamaños de texto. Y la nota del SCSS explicaba, muy convencida, que la card destacada «estaba escalada a 1,0496» y que por eso no había que replicarla.
- **Causa:** estaban maquetadas contra **`Card` 2004:7658**, que la Home no usa. El bueno es **`Card_tarifa`**, y no es el mismo a otro tamaño: es otro componente. 282 contra 296 de ancho, 32 contra 24 de padding, 44 contra 56 de hueco, tag de 21 contra 24, fila de logos de 46 con cajas de 34 contra 36 con cajas de 36. Lo del «escalado» salió de comparar el ancho de uno con el del otro.
- **Segundo engaño, encima del primero:** al auditar el contenido, los **nombres de capa del metadato están obsoletos**. Hay cards cuyo nombre dice `Fibra 600` y cuyo texto es otro — se nota porque el ancho del nodo de texto no coincide entre dos capas del mismo nombre. `get_metadata` da estructura fiable y **nombres no fiables**.
- **Solución:** para medidas, medir el nodo que usa la página, no el que se llame parecido. Para contenido, **`get_design_context`**, que devuelve el texto real. Y antes de dar un nodo por bueno, resolver contra él algo que ya se sepa — la misma desconfianza que `config.json` ya obliga a tener con las fileKeys, aplicada a los componentes.
- **Regla general, que es lo que importa:** una nota en el código que explica por qué el diseño «está mal» es una señal de alarma, no una explicación. Aquí la del escalado justificó durante semanas no hacer más alta la card destacada, que es exactamente lo que el diseño pedía. **Cuando el diseño parece absurdo, sospecha del nodo antes que del diseñador.**
- **Estado:** resuelto 2026-08-18 · PR #82 y #83.

## L-020 · Storybook llama al `render` con `{}`, no con `undefined`

- **Síntoma:** al pasar las piezas a Controls, las stories de estado —`Stacked`, `Scrub`, la sub-barra— se habrían quedado en blanco. Compilando en verde.
- **Causa:** el patrón obvio para no romper la página es `pinta(datos = TODO)`. Pero una story **sin** `args` no recibe `undefined`: recibe `{}`. Y un objeto vacío no dispara el valor por defecto del parámetro, así que dentro no hay ni título ni ítems y el módulo se pinta vacío.
- **Solución:** desestructurar **campo a campo** con su valor por defecto — `pinta({ title = TITULO, items = ITEMS } = {})` — en vez de tomar el objeto entero. Así da igual que llegue `{}`, un objeto a medias o nada.
- **Regla general, que es lo que importa:** el valor por defecto de un parámetro **solo salta con `undefined`**. Cualquier API que te llame con «nada» en forma de objeto vacío se lo salta. Vale para Storybook y para cualquier cosa que reparta opciones.
- **Estado:** resuelto 2026-08-17 · [STARTERSLUG-59](https://<site>.atlassian.net/browse/STARTERSLUG-59).

## L-019 · Dos mixins con la misma intención, distinta geometría

**Regla general:** Dos utilidades que dicen hacer lo mismo con implementaciones distintas son una bomba de relojería que solo explota en el rango donde nadie mira; únelas en una sola regla compartida.

## L-018 · «El árbol está limpio» puede querer decir que acabas de borrar algo

- **Síntoma:** al cerrar el 14-08, `state.json` estaba en la versión del **12**. También `logros.md`. Y el bloque del target `pre` había desaparecido de `config.json`. El cierre del 13-08 —un día entero de trabajo de harness— no estaba por ninguna parte.
- **Causa:** ese cierre nunca se commiteó: llevaba toda la mañana en el árbol como cuatro ficheros modificados. Al alinear `main` con `develop` se usó **`git read-tree -u --reset origin/develop`**, que pone índice y árbol de trabajo en el estado del árbol dado — y **descarta sin avisar los cambios locales de los ficheros trackeados**. No pregunta, no hace copia, no imprime nada.
- **Lo que lo hizo invisible:** justo después se ejecutó `git status` para comprobar que se podía desplegar, salió vacío, y se escribió «el árbol local está limpio» como buena noticia. Los cuatro ficheros modificados habían estado ahí toda la mañana y **dejaron de estar**; esa desaparición era la señal, y se leyó como lo contrario.
- **Solución:** antes de cualquier operación que reescriba el árbol —`read-tree --reset`, `reset --hard`, `checkout -f`— mirar `git status` y **guardar en stash lo que haya**. Y si un `git status` sale más limpio de lo que esperabas, averiguar por qué antes de seguir.
- **Regla general, que es lo que importa:** un cambio sin commitear **no existe** para git; solo vive en una carpeta. Cualquier orden que sincronice el árbol con un commit lo puede evaporar. El error real no fue el `read-tree` — fue dejar un día entero de trabajo de harness sin commitear porque «son solo ficheros de notas».
- **Qué se salvó y qué no:** todo el **código** del 13-08 (`scripts/deploy.mjs`, el entorno de pre, `firebase.json`) estaba commiteado en el PR #71 y no se tocó — por eso el deploy siguió funcionando. Lo que se perdió fue solo la **memoria del harness**, que es justo lo que nadie mira hasta la mañana siguiente. Reconstruida en el cierre del 14-08 a partir de lo leído esa misma mañana; la fila de `hitos.md` del 13 va marcada como reconstruida.
- **De propina:** el M5 escribe esos ficheros y el propio cierre dice que **no** commitea por su cuenta, sino que ofrece. Si el ofrecimiento no se acepta, el trabajo se queda a merced del primer `reset`. Merece la pena que el cierre insista.
- **Estado:** resuelto 2026-08-14.

## L-017 · PowerShell se come los acentos, y los cuatro gates lo aplauden

- **Síntoma:** cambiar una etiqueta en doce stories (`tags: ['WIP']` → `['production']`) produjo un diff de **192 líneas cambiadas** donde tenían que ser doce. `Snippets/Línea de tarifa` se había quedado en `Snippets/LÃ­nea de tarifa`, y con él todos los acentos, eñes y comillas angulares de los doce ficheros.
- **Causa:** `Get-Content -Raw` en **PowerShell 5.1** no lee UTF-8: lee con la página de códigos ANSI del sistema. Cada `í` de dos bytes se convierte en dos caracteres, y al reescribir con `[System.IO.File]::WriteAllText` —que sí escribe UTF-8— esos dos caracteres se codifican otra vez. La codificación se **dobla**. Y como la lectura ya venía mal, el fichero de salida es un UTF-8 perfectamente válido que contiene basura.
- **Solución:** para tocar ficheros con texto en español, **node o el tooling del agente**, que leen y escriben UTF-8 sin que haya que pedírselo. Si tiene que ser PowerShell, `Get-Content -Encoding UTF8` y `Set-Content -Encoding utf8` de forma explícita en los dos lados — pero no merece la pena: es una trampa que hay que recordar cada vez.
- **Regla general, que es lo que importa:** **los gates validan la sintaxis, no el texto.** `build`, `lint:css`, `format:check` y `check:stories` dieron **verde los cuatro** con los doce ficheros corruptos, porque `'Snippets/LÃ­nea de tarifa'` es una cadena de JavaScript impecable. Nada de lo que comprobamos mira si las palabras siguen siendo palabras — y este repo es medio español, así que el daño cae siempre en lo que lee una persona: títulos de la barra lateral, descripciones de Controls, fichas de hand-off.
- **Lo que sí lo cazó:** el **tamaño del diff**. Doce ficheros para doce líneas de cambio; salieron 192. Un diff mucho mayor de lo que pide el cambio es una señal, no una casualidad — merece mirarse antes de commitear, no después.
- **Es el género de `L-012`**: un fichero corrupto que pasa todas las validaciones porque sigue siendo sintácticamente correcto. Allí un BOM en medio del CSS se comía cuarenta variables; aquí una doble codificación se come el idioma. En los dos casos leer el fichero no basta — hay que mirar el **resultado**.
- **Coletazo:** el cliente lo habría visto antes que nosotros. Estos doce ficheros eran justo los que pasaban a `production`, así que el mojibake iba directo a la barra lateral del Storybook que se entrega.
- **Estado:** resuelto 2026-08-14 · [STARTERSLUG-54](https://<site>.atlassian.net/browse/STARTERSLUG-54).

## L-016 · Lo que monta la story no es el snippet

- **Síntoma:** en la primera toma de contacto de la entrega, Cristina —que copia el marcado del panel **Code** para pegarlo en los Snippets del CMS— avisó de que «encima de la `section` aparece un `div`». Mirando el partial no había ninguno: `hero.html` empieza en `<section class="hero">`. El div era real, pero no estaba en el fichero.
- **Causa:** venía de **cómo se monta la story**. El patrón `const caja = document.createElement('div'); caja.innerHTML = pinta(...); return caja` está en once stories, y el panel Code serializa el DOM que devuelve la story, caja incluida. Al tirar del hilo salieron **dos fugas más de la misma familia**: los envoltorios de previsualización —el degradado de `sobreHero`, el simulador de contenedor de `withContainer`—, que además llevan **estilos en línea**, y los **comentarios internos** del partial, que Docs sí filtraba y este panel no. De propina, los `sinComentario` de los `datos-*.js` van sin la bandera `g`: solo quitaban el de cabecera, así que los de en medio del marcado (`coverage-strip`, `site-footer`, `site-header`) llegaban enteros.
- **Solución:** `.storybook/limpia-fuente.js`, aplicado en el panel y en `docs.source.transform`, e idempotente para que ninguno dependa del otro. Con `DOMParser` y no con expresiones regulares: desenvolver el elemento de fuera es una operación de árbol y con regex se rompe en cuanto hay un `</div>` anidado. Desenvuelve **solo** si el envoltorio es la raíz, es un `div` pelado y contiene UNA pieza —si contiene varias es una story de comparación y ahí el envoltorio sí es parte de lo que se enseña— y los envoltorios de previsualización se marcan con `data-starterslug-preview`, marca explícita en vez de reconocerlos por sus estilos.
- **Regla general, que es lo que importa:** **el andamio con el que enseñas una pieza acaba viajando con ella si no lo sacas a propósito.** Y el daño no es simétrico: un `div` pelado es inofensivo, pero un `max-width:1350px` **en línea** pegado al marcado no se puede corregir luego desde la hoja de estilos, porque el estilo en línea gana. Lo que se copia hay que mirarlo desde el lado de quien copia, no desde el fichero de origen.
- **Cómo se encontró, que es la parte incómoda:** mirando. Los cuatro gates daban verde y llevaban dándolo semanas. Es el mismo agujero de `L-010` —compilar no es renderizar— pero un paso más allá: aquí ni siquiera bastaba con renderizar, había que mirar **lo que se copia**, que es un artefacto distinto de lo que se ve. Nadie lo tenía en la lista de cosas que se comprueban.
- **Coletazo:** verificándolo salió que el `src` de las imágenes se resuelve a **URL absoluta del servidor de Storybook**, con el nombre troceado por el build. Copiado tal cual apunta a una máquina que no existe. Abierto en [STARTERSLUG-52](https://<site>.atlassian.net/browse/STARTERSLUG-52) como decisión pendiente, no como fallo de esta lección.
- **Estado:** resuelto 2026-08-14 · [STARTERSLUG-52](https://<site>.atlassian.net/browse/STARTERSLUG-52).

## L-015 · Un sitio retirado que sigue sirviendo es peor que un enlace roto

- **Síntoma:** «en la URL de pro aún se ve el nombre del cliente». Se buscó en el `authDomain` de Firebase, que era la sospecha obvia — y estaba equivocada: el login va por email y contraseña, sin redirect OAuth, así que ese dominio no llega a verse nunca.
- **Causa:** el sitio viejo, el sitio viejo, **seguía en pie y sirviendo contenido**. Y no una copia del actual: un Storybook de antes de la reorganización del 06-08, con la taxonomía vieja (`Components/`, `Layouts/`, `Modules/`, `Pages/Fibra y Móvil`…) y **28 secciones** frente a las 8 del real. `config.json` lo tenía anotado como «sigue sirviendo su última build para no romper enlaces repartidos», y esa frase sonaba inofensiva.
- **Solución:** redirigir en vez de apagar, para que los enlaces repartidos por Jira y por chat sigan valiendo. Un segundo target de hosting con `redirects` y 302 —no 301— para poder revertir. La raíz necesita **regla propia**: `"/:ruta*"` no casa con `/` a secas, y sin eso la portada caía en el `index.html` de respaldo y redirigía por `meta refresh` en vez de por servidor.
- **Regla general, que es lo que importa:** un entregable viejo que sigue accesible **compite con el nuevo**, y gana cuando parece más completo. Quien abriera ese enlace veía 28 secciones y concluía que el proyecto iba mucho más avanzado de lo que va. Un 404 es una molestia; una versión muerta que se hace pasar por viva es desinformación.
- **De propina:** salió también que `npm run deploy` llamaba a `firebase` a secas y en esta máquina no está en el PATH — el proyecto usa `npx firebase-tools`, como decía la config del harness desde el principio. El script llevaba roto desde que se escribió, y no se supo hasta el primer deploy de verdad.
- **Estado:** resuelto 2026-08-12.

## L-014 · Nuestro design system rompió el resaltador de código

- **Síntoma:** el código de la pestaña Docs salía desparramado — `<   section   class   =   "   hero   "   >`, con huecos enormes entre cada token. Es lo primero que ve quien entra a copiar un snippet, y el Storybook **es el entregable**.
- **Causa:** un **choque de nombres**. Prism marca cada etiqueta HTML con `<span class="token tag">`, y nosotros tenemos un componente `.tag` —el badge de una tarea anterior— que es `display:inline-flex; padding:.25rem .75rem`. La página de Docs carga `main.scss` entero, así que esa regla le caía a cada token de tipo etiqueta de cada bloque de código: 12 px de padding a cada lado de `section`, de `class` y de cada `=`.
- **Cómo se encontró:** midiendo. Se probaron y descartaron tres hipótesis —`text-align: justify`, `word-spacing`, el `display:flex` que Storybook le pone al `<pre>`— antes de dar con ella. Lo que la cazó fue `getComputedStyle` sobre **los tokens que fallaban**: `display: inline-flex · padding: 4px 12px`, clavado con nuestro `.tag`. Ojo con esto, que costó dos vueltas: la primera sonda midió los seis primeros spans, que son los del **comentario** y se pintan bien. Hay que medir el elemento que falla, no el primero que aparece.
- **Solución:** neutralizar **todos** los tokens de Prism en la página de Docs, no solo `.tag` — Prism usa nombres genéricos (`string`, `number`, `function`, `property`, `bold`, `url`, `variable`, `important`…) y en cuanto el sistema crezca chocará otro. Va en `.storybook/preview-head.html`, que arregla el visor y **no entra en `starterslug-global.css` ni en el CSS de ningún snippet**.
- **Regla general:** una clase global de una sola palabra —`.tag`, `.card`, `.title`— no es un nombre, es una apuesta a que nadie más la use. Y aquí el CSS se **pega en el sitio de otro**, así que la apuesta se hace contra código que no controlamos. `CLAUDE.md` ya pide BEM (regla 3) justamente por esto.
- **Coletazo tranquilizador:** el texto del DOM siempre fue correcto —se comprobó volcándolo—, así que «Copy code» nunca llegó a copiar HTML roto. Era un fallo de pintado, no del entregable.
- **Pendiente:** renombrar `.tag`. Toca el snippet entregado, su `.mdx` y su story, así que no se hizo la víspera de una demo.
- **Estado:** parcheado 2026-08-12; el renombrado, abierto.

## L-013 · Un icono un 20 % más grande no se ve; se mide

- **Síntoma:** el menú llevaba desde el 6 de agosto dado por maquetado, con la revisión visual pendiente «porque no había navegador». Al hacerla por fin, el icono burger renderizaba a **18×12** cuando el diseño lo pone a **15×10**, y el aspa de cierre a 13,15 cuando va a 16. Nadie lo había visto en semanas de mirar la story.
- **Causa (las dos, distintas):** el burger tenía `viewBox="0 0 20 20"` y `.btn-icon > svg` fuerza `24×24`; 24/20 = 1,2, y el glifo salía escalado un 20 %. El SVG era correcto: lo que estaba mal era la caja. El aspa tenía el CSS a `0.8219rem` con un comentario que lo justificaba como «13,15 dentro de la caja de 24 del diseño» — pero 13,15 es el tamaño del **path exportado**, no el del icono **colocado**, que el Figma pone a 16 con inset del 16,67 %.
- **Solución:** `viewBox="-2 -2 24 24"` en el burger (24 unidades, así el glifo va 1:1, y el −2/−2 lo recentra) y `1rem` en el aspa. Y sobre todo, `scripts/pixel-measure.mjs`: decodifica el PNG y da la caja de un glifo en píxeles, para la captura del Storybook y para la exportada de Figma por igual.
- **Regla general, que es lo que importa:** **una verificación visual que solo mira no verifica tamaños.** Un 20 % de diferencia en un icono de 15 px son 3 px, y a esa escala el ojo no distingue eso de un antialias. Lo que se puede medir, se mide; mirar se reserva para lo que no tiene número — composición, jerarquía, si «se parece».
- **Tres trampas al medir, que descubrimos pisándolas:** (1) el antialias cae fuera del umbral y la caja sale ~1 px corta, así que hay que medir **también** la referencia y comparar medida contra medida, nunca medida contra el número del diseño; (2) acotar por la caja de un contenedor **redondo** mete sus cuatro esquinas, que son fondo — con fondo azul y glifo azul, el burger pasaba de medir 14×10 a 35×56; (3) el **recuento** de píxeles no es comparable entre Chrome y Figma (28 frente a 56 con la misma caja), porque reparten el antialias distinto. La caja es la señal; el recuento, ruido.
- **De propina:** el comentario del aspa es el caso interesante. No era código sin documentar — era código **documentado con la justificación equivocada**, que es peor: el comentario invitaba a no tocarlo.
- **Estado:** resuelto 2026-08-12.

## L-012 · Un BOM en medio del CSS se come la primera regla, en silencio

- **Síntoma:** maquetando una tarea anterior, todo lo que se pegaba en una página con `starterslug-global.css` heredaba **color negro** en vez del `#212529` del sitio. El fichero tenía la regla escrita: `grep` encontraba `--bs-body-color: #212529` sin problema.
- **Causa:** Sass arrastra el BOM del fichero de origen (Bootstrap lo trae) a la primera posición de su salida. Al anteponerle una cabecera de comentario, ese BOM (U+FEFF) queda **en medio del fichero**. Al principio el navegador lo ignora; en medio es un token inválido, y el parser lo lee como el comienzo de un selector y se traga el bloque entero hasta la primera `{…}` — que era justo el `:root,[data-bs-theme=light]{…}` con todas las variables de Bootstrap.
- **Solución:** quitar el BOM siempre de la salida de Sass antes de concatenar nada (`sinBom()` en `scripts/build-entrega.mjs`).
- **Regla general, que es lo que importa:** **un fichero generado no se valida leyéndolo.** El CSS era correcto carácter a carácter y aun así el navegador descartaba 40 variables. Lo que lo cazó fue medir el resultado en un navegador de verdad, no revisar el fichero. Y ojo con concatenar a la salida de una herramienta: lo que era inofensivo en la posición 0 deja de serlo en la 250.
- **Estado:** resuelto 2026-08-11.

## L-011 · El CSS de un snippet compuesto no basta

**Regla general:** Al entregar el código de una pieza compuesta, la pregunta no es qué le pertenece en su propio fichero, sino qué hace falta para que se vea igual fuera del entorno de desarrollo.

## L-010 · Los cuatro gates en verde y la story reventando

- **Síntoma:** maquetando el footer, `build`, `lint:css`, `format:check` y `check:stories` daban verde los cuatro, y al abrir la story salía `TypeError: Cannot read properties of null (reading '1')` en vez del footer.
- **Causa:** un `.match()` que devolvía `null` en el pintor de la story. Los tres bucles Django del footer están **anidados** —columna → grupo → enlace— y los regex de fuera iban perezosos (`[\s\S]*?`), así que cortaban en el `{% endfor %}` del bucle de dentro y no casaban.
- **Solución:** los bucles que envuelven a otros tienen que ser **codiciosos** y llegar al último `{% endfor %}`; solo el de más adentro puede ir perezoso.
- **Regla general, que es lo que importa:** `check:stories` **compila** las stories, no las **renderiza**. Un fallo en tiempo de ejecución —un `match` nulo, un `undefined.map`, un dato que no llega— pasa los cuatro gates sin despeinarse. La única red que lo caza hoy es la captura de `pixel-shot.mjs`, que sí renderiza. Por eso el pixel-check no es un lujo del final: es el único gate que ejecuta el código.
- **De propina:** el `play` de la story tampoco lo habría cazado en la build, porque los `play` solo corren en el navegador. Si algún día se monta `@storybook/addon-vitest`, esto pasa a ser un test de verdad.
- **Estado:** resuelto 2026-08-10.

## L-009 · Mirar la instancia y no el SET esconde estados enteros

- **Síntoma:** el manifiesto se maquetó como una baraja apilada y punto. La ficha avisaba de que el nombre de la variante «apunta a que hay más variantes que representan los pasos de una animación», se buscó, no se encontró nada, y se entregó con una nota de «el Figma no dice el efecto».
- **Causa:** se leyó el **nodo colocado en la Home** (`2084:5593`), que es una _instancia_. El **component set** (`2084:5332`) tiene una variante `State` con dos valores, `Start` y `End` — y resulta que las dos instancias puestas en la Home son las dos `Start`. El `End` —las cards repartidas en rejilla— no estaba colocado en ningún sitio de la página, así que barriendo la Home no aparece nunca.
- **Solución:** `list_file_components_for_code_connect` sobre la fileKey lista **todos los sets con sus propiedades y valores de variante**. Una llamada, y salen los estados que existen aunque no estén colocados. Se hace **antes** de maquetar, no después.
- **Regla general:** una instancia enseña _un_ fotograma. Si el módulo puede tener estados —y casi todos los tienen: hover, abierto, start/end—, la fuente es el set, no la instancia. Y si un set tiene un estado que no está colocado en la página, ese estado es justo el que se va a olvidar.
- **Coletazo bueno:** la misma llamada destapó los nodos de **Footer (`2163:11877`)** y **Modulo_APP (`2122:9790`)**, que estaban dados por bloqueados «sin node-id válido» porque los de `config.json` eran sublayers de instancia (ver L-008 y las notas de `modules.json`). Y tres módulos que no están en el board: `FAQs`, `Modulo_ventajas` y `Feature_left/right`.
- **Coletazo malo:** entregar el estado equivocado no fue solo un fallo estético. Con la baraja como reposo, cuatro de los cinco puntos del manifiesto quedaban tapados sin manera de verlos.
- **Estado:** resuelto 2026-08-10.

## L-008 · Chrome headless no baja de 500 px, y la captura de móvil miente en silencio

- **Síntoma:** maquetando el hero, las capturas a 390×852 salían con el texto saliéndose del marco y cortado por la derecha. El CSS parecía mal, pero las cuentas no daban: `max-width` y `padding` decían que tenía que caber.
- **Causa:** `chrome --headless --window-size=390,852` **no maqueta a 390**. Chrome fuerza un ancho mínimo de ventana de ~500 px, maqueta la página a 500 y luego entrega un PNG de 390 recortado. Las media queries resolvían contra 500, no contra 390. Se vio metiendo una sonda que imprimía `window.innerWidth`: decía **500**.
- **Solución:** cargar la story dentro de un **iframe** del tamaño pedido. Un iframe establece su propio viewport y las media queries resuelven contra él; la ventana de Chrome va a 520 como mínimo y lo que sobra sale en blanco. Está en `scripts/pixel-shot.mjs`.
- **Regla general:** cuando el render no cuadra con lo que dice el CSS, **mide el viewport antes de tocar el CSS**. Una herramienta de captura que recorta en vez de fallar produce evidencia falsa con pinta de buena — y encima habrías «arreglado» un CSS que estaba bien.
- **De propina:** esto desbloquea el paso 4 del pipeline. `modules.json` decía que la revisión visual de una tarea anterior no se pudo hacer «por no haber navegador»: Chrome y Edge están instalados en la máquina y no hace falta Playwright.
- **Estado:** resuelto 2026-08-10.

## L-007 · El chequeo de tokens se comparaba consigo mismo

- **Síntoma:** `tokens:diff` daba «sin drift» mientras la escala tipográfica del repo llevaba semanas desalineada. `Desktop/H2` era 32/130% Bold en el SCSS y 40/120% Regular en Figma. Y `Desktop/H3` no existía en el repo: apareció maquetando una tarea anterior, a mano.
- **Causa:** comparaba el vuelco fresco **contra el snapshot**, no contra el SCSS. Si el snapshot estaba tan viejo como el código —y lo estaba, era del archivo equivocado (ver `L-006`)— los dos coincidían y el chequeo daba verde. Un espejo mirándose a otro espejo.
- **Solución:** el script parsea ahora `_tokens.scss` y `_typography.scss` y compara **Figma contra lo que el repo pinta de verdad**; el snapshot pasa a ser lo secundario («qué tocó diseño desde ayer»). Y para que el ojo humano lo vea: `.text-style-*` se genera del mapa, y la story de tipografía lee las medidas con `getComputedStyle` en vez de llevarlas escritas.
- **Regla general:** un chequeo de deriva tiene que comparar contra **lo que se publica**, no contra una copia de sí mismo. Si el snapshot y el código pueden envejecer juntos, no hay chequeo.
- **De propina:** exit 1 (valores que no cuadran, hay que arreglar) y exit 3 (Figma tiene algo que el repo no adopta, hay que decidir) se separan a propósito. Un chequeo que sale en rojo todas las mañanas por una decisión pendiente se acaba ignorando.
- **Estado:** resuelto 2026-08-06.

## L-006 · El archivo bueno vivía en la cabeza de alguien

**Regla general:** Cuando un dato crítico (qué archivo/fuente es la buena) solo vive en la cabeza de alguien, regístralo con quién lo confirmó y cuándo — el repo no está desactualizado, está incompleto.

## L-005 · FileKey copiada no es fileKey verificada

**Regla general:** Antes de confiar en una referencia externa (fileKey, id…), verifícala resolviendo un nodo conocido contra ella; una referencia equivocada contesta 200 y no falla, solo no devuelve nada.

## L-004 · Un «espejo» que no lee la fuente es peor que no tener espejo

- **Síntoma:** `tasks/backlog.md` daba por «Por hacer / sin asignar» tareas que en Jira estaban `Listo`. Al ejecutar `jira-mirror.mjs` para arreglarlo, **no cambiaba ni una línea**.
- **Causa:** el script no consultaba el tablero. Llevaba las 43 tareas escritas a mano dentro y emitía `'Por hacer'` y `'sin asignar'` como literales. O sea que cada ejecución _reintroducía_ la deriva, y la cabecera del fichero decía «Espejo de Jira. El tablero manda».
- **Solución:** separar quién manda sobre cada dato — título/estado/asignada del tablero, y nodo de Figma/dependencias/ficheros del repo, que Jira no conoce. El estado entra por `--board <dump.json>` (vuelco del agente por MCP, mismo patrón que `figma-tokens-diff`) o por REST si hay `JIRA_EMAIL`/`JIRA_API_TOKEN`. **Sin datos, exit 2**: antes que escribir un estado inventado, no escribe.
- **Regla general:** si un fichero generado afirma reflejar un sistema externo, o lo consulta o lo dice. Un dato inventado con formato de dato real no se detecta leyendo.
- **Estado:** resuelto 2026-08-04.

## L-003 · Escritura en Confluence da 403 aunque leas bien

- **Síntoma:** `getConfluencePage` funciona pero editar da `403 The app is not installed on this instance`.
- **Causa:** el token del plugin de Atlassian tenía solo scopes de **lectura** de Confluence (`read:page:confluence`…), sin `write:*`.
- **Solución:** logout+login limpio en `/mcp` concediendo escritura; si no aparece la opción, lo activa un **admin de Confluence**. Verificar scopes con `getAccessibleAtlassianResources`.
- **Estado:** escritura pendiente de activación por admin (a fecha 2026-07-17).

## L-002 · Las tools del plugin no aparecen tras instalarlo

- **Síntoma:** plugin `enabled` y servidor `Connected` en `claude mcp list`, pero las tools `mcp__plugin_*` no están disponibles en la sesión.
- **Causa:** Claude Code carga el toolset de cada servidor **al arrancar**; si la sesión empezó antes de autenticar, no las registra.
- **Solución:** autenticar el servidor en `/mcp` y **reiniciar** Claude Code en la carpeta.
