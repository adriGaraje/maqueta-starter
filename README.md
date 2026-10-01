# maqueta-starter

Un asistente web que genera un **repo de maquetación nuevo** con el harness completo de Claude
Code: Storybook + Vite + SCSS ITCSS sobre Bootstrap, la skill del ritual (`<slug>-flow`), el
agente Ojo (`<slug>-analyst`), hooks, gates, lecciones y la puerta de acceso del Storybook
publicado. Sale configurado con lo que respondas; lo que saltes queda como `TODO`.

## Arrancar

Desde la carpeta donde quieras que nazca el proyecto:

```sh
curl -fsSL https://raw.githubusercontent.com/adriGaraje/maqueta-starter/main/instalar.sh | bash
```

`instalar.sh` comprueba, una línea `✔`/`✖` por paso y qué hacer si falla: git, Node ≥ 20 (si falta
o es viejo, instala **Node 24 con nvm** en tu usuario; en una terminal pregunta antes), npm ≥ 9,
acceso al repo y que el puerto 4747 esté libre. Luego lanza el asistente. Las opciones pasan tal
cual: `curl … | bash -s -- --port 5000 --no-open`. Con `--sin-instalar` solo dice qué falta.
También vale descargarlo y ejecutarlo: `bash instalar.sh`.

Si ya tienes Node 20+ y npm, el `npx` directo:

```sh
npx --allow-git=all github:adriGaraje/maqueta-starter
```

(`--allow-git=all` hace falta desde npm 12, que no descarga paquetes de git por defecto; con npm 10 o 11
sobra. Para no escribirlo cada vez: `npm config set allow-git all`.) Sin `sudo`: todo es de tu usuario.

Al arrancar imprime un **autodiagnóstico** (Node, npm, desde dónde corre, dónde creará el
proyecto, puerto) y la URL. Abre el asistente, genera el proyecto en `./<slug>` (o donde digas) y,
cuando todo está generado y comprobado, **se borra de la caché de npx** y apaga el servidor.
`--diagnostico` hace solo las comprobaciones y sale.

### Si no pasa nada

- **El navegador no se abre.** Entra a mano en <http://localhost:4747> (o el puerto que hayas
  dado). Si la consola dice que el puerto está ocupado, dice también por quién: ciérralo o usa
  `--port 4748`.
- **No hay acceso al repo.** Casi siempre es la red: sin conexión o un proxy/VPN que corta
  GitHub (`git ls-remote https://github.com/adriGaraje/maqueta-starter.git` lo confirma). Si el
  repo fuese privado, hace falta además aceptar la invitación
  (<https://github.com/adriGaraje/maqueta-starter/invitations>) y tener git autenticado
  (`gh auth login` o un token en el llavero).
- **Node o npm viejos.** Con Node < 20 o npm < 9, `npx` falla o no arranca nada. `instalar.sh`
  instala Node 24 con nvm; a mano: `nvm install 24 && nvm use 24`.

Desde un clon, para desarrollar el starter:

```sh
nvm use        # Node 20
npm i          # solo Prettier: el starter no tiene dependencias de runtime
npm run starter
```

Se abre `http://localhost:4747` (`-- --no-open` para no abrirlo, `-- --port 5000` para otro, `-- --diagnostico` solo comprueba).

## Los pasos

1. **Proyecto** — nombre (lo único obligatorio), slug, carpeta destino (`../<slug>` por defecto), descripción y
   **destino del HTML / hand-off** (ver abajo).
2. **Figma** — fileKey o URL del handoff, nombre, `FIGMA_TOKEN` (a `.env`), viewports.
3. **Jira / Atlassian** — site, cloudId, clave, nombre, boardId, Confluence, email + API token (a `.env`).
4. **GitHub** — «Crear el repo» (por defecto): token (a `.env`), dónde (tu usuario u organización), nombre, privado y push del primer commit; o «Ya existe»: URL del remote.
   Después, ramas de integración y release, patrón de rama y MCP de GitHub (`.mcp.json`).
5. **Tú** — alias, email de git (propuestos de esta máquina) y `accountId` de Jira («Buscarlo» lo pide a Jira). Más gente, luego en `config.team`.
6. **Firebase y puerta** — proyecto y sitios de Hosting (`storybook-<slug>` y `-pre`), claves web y aspecto del login.
7. **Qué llevar** — el mismo desplegable de destino, los grupos `figma`, `jira`, `entrega`, `hooks`, `auth`, y la
   comprobación final.
8. **Resumen** — tabla, «Probar todo», Finalizar y progreso en vivo.

Cada paso con credenciales tiene **«Probar conexión»**: la llamada la hace el servidor, nunca el
navegador, y nada se escribe en disco hasta Finalizar. El borrador vive en `localStorage`.

## Destino del HTML (perfil de hand-off)

Dónde acaba el HTML entregado decide en qué sintaxis van los hooks del backend. Se elige en
`proyecto.handoff` (en el JSON) y el generador lo lleva a todo lo que depende de ella: el helper
`src/stories/lib/hooks.js` (escribe con `var`/`bucle`/`si`, resuelve con `pinta`), el `_template`
(HTML, story y `.mdx` con su tabla de variables), `check:hooks`, `CLAUDE.md` y
`config.repo.handoff` / `handoffLabel`.

| Clave              | Variable    | Bucle                                                | Condicional                           | Para                          |
| ------------------ | ----------- | ---------------------------------------------------- | ------------------------------------- | ----------------------------- |
| `django` (defecto) | `{{ x }}`   | `{% for i in xs %}…{% endfor %}`                     | `{% if c %}…{% endif %}`              | Django, Flask/Jinja2, Pelican |
| `twig`             | `{{ x }}`   | como django                                          | como django; filtros `\|default('…')` | Symfony, Drupal, Craft        |
| `liquid`           | `{{ x }}`   | `{% for i in xs %}…{% endfor %}`                     | `{% if c %}…{% endif %}`              | Shopify, Jekyll               |
| `nunjucks`         | `{{ x }}`   | como django                                          | como django                           | Eleventy                      |
| `blade`            | `{{ $x }}`  | `@foreach ($xs as $i)…@endforeach`                   | `@if ($c)…@endif`                     | Laravel                       |
| `handlebars`       | `{{x}}`     | `{{#each xs as \|i\|}}…{{/each}}`                    | `{{#if c}}…{{/if}}`                   | Mustache, Ghost               |
| `php`              | `<?= $x ?>` | `<?php foreach ($xs as $i): ?>…<?php endforeach; ?>` | `<?php if ($c): ?>…<?php endif; ?>`   | WordPress a pelo              |
| `html`             | —           | —                                                    | —                                     | HTML estático, sin plantillas |

Con `html` el `_template` sale con el texto literal, `pinta` devuelve el HTML tal cual y el grupo
`hooks` no va por defecto (si va, `check:hooks` se salta con un aviso). Un JSON antiguo con
`proyecto.cms` en texto libre o el grupo `django` sigue valiendo: se traducen solos.

## Modo CLI

```sh
npm run generar -- --respuestas respuestas.ejemplo.json
```

Una línea por paso (`✔` / `✖`) y, la última, el resultado en JSON:
`{ ok, destino, grupos, saltados, pendientes, alTrabajar, avisos }`. Si el destino existe y no
está vacío, aborta sin tocar nada.

## Lo que queda a mano

- Autorizar los MCP en Claude Code con `/mcp` (Atlassian, Figma, GitHub).
- Exportar `GITHUB_TOKEN` en el shell que lanza `claude`: Claude Code no lee `.env`.
- `npx firebase login` una vez, y crear proyecto y sitios si no existían (el paso 6 ofrece crearlos).
- Los `TODO` que lista `pendientes`. Los de `tokens.*` y `pageStandard.*` se rellenan al maquetar.
- `npm run check:conexiones` en el repo nuevo repite las pruebas cuando quieras.

## Presupuesto de tokens (regla heredada)

El repo generado la trae en su README: tokens de agentes por tarea, sin la sesión principal.
Página nueva ≤ 550k · página por diferencia ≤ 250k · retoque ≤ 100k. Si una tarea va a pasarse,
se para y se dice antes de seguir.

## Más

- [`docs/que-genera.md`](docs/que-genera.md) — el árbol del repo generado.
- [`docs/mantener-la-plantilla.md`](docs/mantener-la-plantilla.md) — cómo se regenera `template/`.
