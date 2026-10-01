# Qué genera

Con todos los grupos, para el slug `acme`:

```
acme/
├── CLAUDE.md                     # la biblia: reglas de oro, estructura, Storybook, git
├── README.md                     # primeros pasos, ritual, presupuesto de tokens, gates, grupos
├── .claude/
│   ├── settings.json             # hooks + plugins (Atlassian si jira, Figma si figma)
│   ├── hooks/session-start.mjs   # carga estado, cola y quién eres (git user.email → team)
│   ├── hooks/ritual-detect.mjs   # «buenos días» → arranque · «cerramos» → cierre
│   ├── skills/acme-flow/         # la skill del ritual y sus references (ingesta, pipeline, deploy…)
│   └── agents/acme-analyst.md    # el Ojo: spec desde Figma y pixel-perfect, mide y no maqueta
├── .mcp.json                     # si se pidió: MCP de GitHub con ${GITHUB_TOKEN}
├── .env / .env.example           # FIGMA_*, ATLASSIAN_*, JIRA_*, GITHUB_TOKEN (nunca en config)
├── .githooks/pre-commit          # arregla el SCSS antes del commit (core.hooksPath vía prepare)
├── .storybook/                   # main, preview, manager (Release Notes, rótulos), parches
├── docs/
│   ├── acme-harness/             # config.json (fuente única), lecciones, modules, state, onboarding
│   └── architecture, styling, design-tokens, storybook-guide, git-workflow, jira-workflow
├── src/
│   ├── components/_template/     # cópiala para la primera pieza (html + scss + story)
│   ├── styles/                   # ITCSS: settings · tools · Bootstrap · generic · elements · components · trumps
│   ├── stories/                  # Welcome, Release Notes, code-tabs, snippet-code, lib/django
│   ├── pages/                    # estándar de página: cabecera y marcas de snippet
│   └── scripts/                  # main.js (global / por pieza) + globals.js
├── scripts/                      # gates y sondas: storybook-check, paginas-check, play-errors,
│                                 #   medir-story, pixel-shot/diff/measure, conexiones-check…
├── tasks/                        # [jira] espejo del tablero + plantilla de tarea
├── auth/                         # [auth] guard.js, login/, auth-config.js, firebase-config.js
├── firebase.json · .firebaserc   # [entrega] targets pre y entrega sobre storybook-static
└── public/entrega/               # [entrega] globales y estado.json, generados en cada build
```

## Los grupos

| Grupo     | Ficheros                                                       | Scripts                                           |
| --------- | -------------------------------------------------------------- | ------------------------------------------------- |
| base      | todo lo demás                                                  | dev, build, storybook, check:*, lint:css, format… |
| `figma`   | figma-ready-scan, figma-tokens-diff, site-map-sync             | tokens:diff, figma:ready, sitemap:sync            |
| `jira`    | jira-mirror, `tasks/`                                          | tasks:mirror                                      |
| `entrega` | build-entrega, estado-entrega, entrega-check, deploy, Firebase | build:entrega, deploy, deploy:pre, check:entrega… |
| `django`  | hooks-check                                                    | check:hooks                                       |
| `auth`    | `auth/` (Storybook lo sirve como staticDir si existe)          | —                                                 |

## El deploy

`npm run deploy` lee la rama: la de integración (`develop`) va al target `pre`, la de release
(`main`) a `entrega`, y cualquier otra aborta; `npm run deploy:pre` publica la rama actual en pre.
Las ramas, sitios y URLs salen de `config.json → deploy.targets`. Exige árbol limpio y rama al día
con origin, y desde release crea el tag `entrega/AAAA-MM-DD` (el push es manual).

## Qué escribe el generador encima de la plantilla

`config.json` (respuestas en sus claves; los ids de estado de Jira a `null` porque son de cada
Jira), `.env`, `settings.json`, `.mcp.json`, `auth/*.js`, `.firebaserc`, el Figma de
`jira-mirror`, el README, y `scripts/conexiones-check.mjs` + `scripts/lib/conexiones.mjs`
(de `extras/` y `scripts/lib/` del starter). Después formatea con Prettier, `git init` y el commit
«Arranque desde maqueta-starter» (con el `package-lock.json` si hubo `npm install`).

`config.repo.remote` lleva la URL final del repo. En modo «crear», el generador crea el repo en
GitHub (`POST /user/repos` u `/orgs/<org>/repos`), lo añade como `origin` y, si se pidió, sube la
rama de release; el token va solo en la URL de ese push, nunca en `.git/config`. Si la creación
falla, el repo local queda hecho y el aviso dice cómo terminarlo. `config.team` lleva una persona,
quien lo arranca; el README generado dice dónde añadir más.
