# Mantener la plantilla

`template/` no se edita a mano: es la salida del exportador del harness, con **marcadores** en
lugar del proyecto. El starter los sustituye al generar.

| Marcador                           | Se convierte en                                             |
| ---------------------------------- | ----------------------------------------------------------- |
| `starterslug`                      | el slug (`acme-web`); pegado a un identificador JS, con `_` |
| `STARTERSLUG_`                     | prefijo de entorno (`ACME_WEB_`)                            |
| `STARTERSLUG`                      | la clave de Jira si la hay; si no, el slug en mayúsculas    |
| `Starterslug`                      | el slug en PascalCase (`AcmeWeb`)                           |
| `Starternombre` / `STARTERNOMBRE`  | el nombre del proyecto                                      |
| `STARTERHANDOFF`                   | el destino del HTML: `Blade (Laravel)`                      |
| `STARTERHOOK_VAR` / `_FOR` / `_IF` | el hook de ejemplo en la sintaxis del perfil                |

Valen también en nombres de fichero y carpeta (`.claude/skills/starterslug-flow/`…).

Y dos bloques de líneas: `<!-- si:hooks -->` … `<!-- /si:hooks -->` y `<!-- si:html -->` …
`<!-- /si:html -->` (en `.mdx`, `{/* si:hooks */}`): se queda el que toca según el perfil y se
van las marcas.

## El perfil de hand-off: lo que el exportador de O2 aún no trae

Llegó en el starter el 01-10. Hasta que el exportador lo emita, tras regenerar `template/` hay que
volver a poner esto (o llevarlo al exportador, que es lo bueno):

1. **`src/stories/lib/hooks-perfiles.js`** (la tabla: escritores, regex, `crudo`) y
   **`src/stories/lib/hooks.js`** (`var`/`bucle`/`si`, `pinta`, `bloqueSi`/`bloqueFor`,
   `resuelveOpcionales`, `exigeResuelto`; lee `config.repo.handoff`). **`lib/django.js`** queda como
   alias que reexporta de `hooks.js` y mantiene la firma vieja de `bucle(html, 'x in y', …)`.
   El asistente sirve `hooks-perfiles.js` como `/perfiles.js`: es su única tabla de perfiles.
2. **`_template`**: `_template.html` lo **reescribe el generador** con el perfil
   (`scripts/lib/plantilla-template.mjs`); el de la plantilla es la versión Django de esa misma
   función. `datos-template.js`, `_template.stories.js` (con `pinta`) y `_template.mdx` (con
   bloques `si:` y `STARTERHOOK_*`) son nuevos.
3. **`scripts/hooks-check.mjs`**: la regex del DOM sale de `PERFIL.crudo`; con `html` sale 0 con
   aviso; ignora `<!--?…-->` al quitar comentarios (es PHP que el navegador comentó).
4. **`src/stories/code-tabs.jsx`**: `<Variables>` toma las filas que empiezan por un hook del
   perfil (`esHook`), no solo `{{`/`{%`.
5. **`scripts/build-entrega.mjs`**: `clasesQueUsa` descarta cualquier hook (`{}%<>$@?`) en `class=""`.
6. **Textos**: `CLAUDE.md` con `STARTERHANDOFF` / `STARTERHOOK_*` y bloques `si:`; «hooks Django»
   → «hooks del perfil de hand-off (`config.repo.handoff`)» en `pipeline.md`, `SKILL.md`,
   `ingesta.md`, el agente analyst y `docs/storybook-guide.md`.
7. **`config.json`**: `repo.handoffLabel` junto a `repo.handoff`.
8. **El grupo `django` se llama `hooks`** (también la línea `- \`hooks\` — …`del README): el
exportador tiene que aceptar`--with …,hooks,…`. El generador sigue aceptando `django` en un
   JSON de respuestas.

## Regenerarla

Desde el repo que tiene el harness vivo y su exportador:

```sh
rm -rf <aquí>/template
npm run harness:export -- <aquí>/template --slug starterslug --name Starternombre --with figma,jira,entrega,hooks,auth
```

Siempre con **los cinco grupos**: el starter quita los que no se eligen, no los añade.

## Qué comprobar después

1. **Fugas.** Nada del proyecto de origen: `grep -rniI "<cliente>\|<agencia>\|<nombres del equipo>" template`.
   Ojo con los identificadores con el nombre del origen (una vez fue un `id="<origen>-out"`).
2. **Los dos arreglos que el exportador aún no trae**, si siguen faltando:
   - `scripts/deploy.mjs` lee rama → target de `config.deploy.targets` (antes iba fijo a develop/main).
   - El final de `README.md` es una sección `## Grupos` con un `- \`grupo\` — …` por grupo: el
     generador borra las líneas de los grupos que no viajan.
3. **Las claves que rellena el generador** siguen donde las busca (`scripts/generar.mjs`, paso 2):
   `config.json`, `auth/auth-config.js` (`brand`, `subtitle`, `poweredBy`, `accent`, `ink`,
   `surface`), `auth/firebase-config.js`, `const FIGMA = 'TODO'` en `jira-mirror.mjs`, y la línea
   «Generada con `npm run harness:export …`» del README.
4. **Grupos nuevos o ficheros movidos**: actualiza `FICHEROS` y `SCRIPTS` en `scripts/generar.mjs`.
5. **La prueba completa**, que es la que vale:
   ```sh
   npm run generar -- --respuestas respuestas.ejemplo.json   # con destino nuevo
   ```
   Tiene que acabar en `ok`, con `storybook-static/guard.js` y `login/`, `check:stories` verde, y
   en el destino `npm run format:check`, `lint:css`, `build` y `check:hooks` en verde. Repite con
   solo `base`, y con `proyecto.handoff` en `blade` y en `html` (este, `check:hooks` saltado).
