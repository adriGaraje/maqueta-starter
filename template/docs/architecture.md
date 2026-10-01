# Architecture

> Deep dive into the folder layout and build pipeline. See `CLAUDE.md` for the summary.

## Build pipeline

```
src/**            ──▶  Vite (dev: HMR · build: Rollup)  ──▶  dist/**
  ├─ *.html            html-inject resolves <load src>         optimized HTML
  ├─ styles/*.scss     Bootstrap 4.1.3 + marca → Dart Sass → CSS      hashed main.css
  └─ scripts/*.js      ES modules + Bootstrap JS → bundle      hashed main.js
```

- `root` is `src/`, so URLs stay clean (`/scripts/main.js`).
- `publicDir` is `../public` — copied verbatim (favicon, robots…).
- Each deliverable page is a Rollup `input` in `vite.config.js`. **Add new pages there.**
- SCSS uses `quietDeps` (Bootstrap 4.1.3 emits legacy-Sass deprecation noise we silence).

## Styling & Storybook

- **Bootstrap 4.1.3** is the styling base, organised with **ITCSS** (Settings · Tools · Generic ·
  Elements · Components · Trumps). Brand in `styles/settings/`. See `docs/styling.md`.
- **Pages** follow a folder-per-page structure under `src/pages/` (see `src/pages/README.md`).
- **Storybook** (`@storybook/html-vite`) is the component gallery: `npm run storybook`,
  static build `npm run build-storybook` → `storybook-static/`. Config in `.storybook/`.

## Why HTML Inject

Django composes markup server-side with `{% include %}`. During the maqueta we need the
same composition without a Python runtime. `vite-plugin-html-inject` gives us
`<load src="…" />`, a 1:1 mental model for `{% include %}`.

## Aliases

`@`, `@styles`, `@components`, `@layouts`, `@scripts`, `@assets` resolve to `src/*`
(see `vite.config.js`). Prefer them in JS imports for clarity.

_TODO: expand with diagrams and the full dev→Django porting flow._
