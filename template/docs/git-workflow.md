# Git workflow

> How we work in Git so **two developers (AI agents) can work at the same time and
> never step on each other**. Read this before touching a branch. Summary lives in
> `CLAUDE.md`.

## TL;DR

- **`develop` is the integration branch.** All task PRs target `develop`, never `main`.
- `main` is what the client sees. We release `develop` → `main` when we decide to (typically
  before a demo). **Never commit or push to `main` or `develop` directly** — both only move
  through PRs.
- **One task = one branch = one PR.** The branch name carries the task code.
- Branch from an up-to-date `develop`; **rebase** onto `develop` before opening/merging the PR.
- Keep PRs small and single-purpose. Green build + green linters before review.
- Claim the task (set it `In Progress` + assignee in the backlog) **before** you start.

## Branching model

Two long-lived branches. Short-lived task branches off `develop`.

```
main ──────────●──────────────●──────────▶   (lo que se le enseña al cliente · se publica en pro)
               ↑ release      ↑ release
develop ──●────●────●────●────●──────────▶   (integración · se publica en pre · siempre verde)
           \         \         \
            ● feat/STARTERSLUG-001-…     ● fix/STARTERSLUG-004-…
             (1 task)            (1 task)
```

| Branch | Role | Deploys to |
| --- | --- | --- |
| `develop` | Integration. Every task lands here. | **pre** — `storybook-starterslug-pre.web.app` via `npm run deploy` |
| `main` | Histórico de releases aprobadas. | **pro** — `storybook-starterslug.web.app` (la entrega) via `npm run deploy` (ver `deploy-firebase.md`) |

> **Deploys are manual and decoupled from git** — GitHub Actions is blocked org-wide by IT.
> Merging changes nothing on its own: you run `npm run deploy` by hand.

### Branch naming

```
<type>/<TASK-CODE>-<short-kebab-summary>
```

| `<type>`   | For                              | Example                       |
| ---------- | -------------------------------- | ----------------------------- |
| `feat`     | New component / page / feature   | `feat/STARTERSLUG-012-tariff-card`     |
| `fix`      | Bug fix                          | `fix/STARTERSLUG-031-header-overflow`  |
| `refactor` | Restructure, no behaviour change | `refactor/STARTERSLUG-040-sass-tokens` |
| `chore`    | Tooling, config, deps            | `chore/STARTERSLUG-002-stylelint`      |
| `docs`     | Documentation only               | `docs/STARTERSLUG-050-readme`          |

- `<TASK-CODE>` = the Jira/backlog code (`STARTERSLUG-###`). Always present — it links code ↔ task.
- One branch per task. Do **not** pile unrelated changes onto a branch.

## Commit messages (Conventional Commits + task code)

```
<type>(<scope>): <imperative summary> [STARTERSLUG-###]
```

Examples:

```
feat(tariff-card): add responsive card component [STARTERSLUG-012]
fix(site-header): prevent nav overflow on mobile [STARTERSLUG-031]
chore(vite): add tariffs page entry [STARTERSLUG-018]
```

Keep commits focused. Prefer several small commits over one giant one.

## The parallel-work protocol (never step on each other)

This is the core of working two-at-once. Follow it strictly.

1. **Claim first.** Before writing code, move the task to `In Progress` and set yourself as
   assignee in [`tasks/backlog.md`](../tasks/backlog.md). If it's already `In Progress` under
   someone else, pick another task.
2. **Respect file ownership.** Every task lists **“Files likely touched”**. Do **not** edit a
   file that another `In Progress` task has claimed. If two tasks genuinely need the same file,
   split the work or sequence them with a dependency (`blocked by`).
3. **Small & short-lived.** Merge within a day where possible. The longer a branch lives, the
   worse the divergence.
4. **Sync before you finish.** `git fetch` + `git rebase origin/develop` right before opening the
   PR and again before merging, so you integrate the other dev's merged work.
5. **Shared hotspot files** (append-only rule): `src/styles/main.scss` (the `@use` list) and the
   page HTML entries are edited by many tasks. Only **append** your line in the correct section;
   if you hit a conflict there, **keep both lines** — it's almost never a real conflict.

## Standard flow (step by step)

```bash
# 0. Start from fresh develop
git checkout develop
git pull origin develop

# 1. Create your task branch
git checkout -b feat/STARTERSLUG-012-tariff-card

# 2. Work. Commit in small steps.
git add -A
git commit -m "feat(tariff-card): add markup + styles [STARTERSLUG-012]"

# 3. Before pushing, integrate others' merged work
git fetch origin
git rebase origin/develop       # resolve conflicts locally if any

# 4. Verify green (never push red)
npm run build && npm run lint:css && npm run format:check

# 5. Push and open the PR
git push -u origin feat/STARTERSLUG-012-tariff-card
```

Then open a PR into `develop` (see below). After merge, delete the branch:

```bash
git checkout develop && git pull origin develop
git branch -d feat/STARTERSLUG-012-tariff-card
```

## Pull requests

- **Target:** `develop`. **Title:** `[STARTERSLUG-###] <summary>`.
- **Body:** what changed, how to test, screenshot if visual, and `Closes STARTERSLUG-###`.
- **Checklist (must be true before merge):**
  - [ ] `npm run build` passes (all `<load>` partials resolve)
  - [ ] `npm run lint:css` passes (BEM enforced)
  - [ ] `npm run format:check` passes
  - [ ] Only the task's declared files changed
  - [ ] Backlog task moved to `In Review`
- **Merge strategy:** **Squash and merge**. One tidy commit per task on `develop`.
- **After merge:** delete the branch, move the task to `Done`, and remember pre
  (`storybook-starterslug-pre.web.app`) does **not** update by itself — run `npm run deploy` from an up-to-date `develop`.

## Releases (`develop` → `main`)

`main` holds **whatever we're showing the client**. We cut a release when we decide to —
typically before a Friday demo, or ahead of any presentation. There's no fixed schedule and
no automation: it's a call the team makes.

A release is its own PR from `develop` into `main`. Deliberate, never a side effect of
merging a task.

```bash
# 1. develop verde y al día
git checkout develop && git pull origin develop
npm run build && npm run lint:css && npm run format:check

# 2. PR de release: develop -> main. Merge commit (NO squash: main
#    debe conservar el historial de tareas que ya está en develop).

# 3. Publicar, a mano: desde main, que es lo que va a pro
git checkout main && git pull origin main
npm run deploy
```

**Mergear y publicar son dos pasos distintos.** Puedes mergear cuando quieras; el deploy es una
acción aparte y consciente, porque publica algo que ve el cliente. Ninguna rama despliega sola:
no hay CI, así que `main` por sí solo no publica nada.

**La rama decide el destino** (`scripts/deploy.mjs`): desde `develop` se publica en **pre**
(<https://storybook-starterslug-pre.web.app>), para verificar; desde `main`, en **pro**
(<https://storybook-starterslug.web.app>), que es la entrega. Desde cualquier otra rama aborta.

`main` sigue siendo el histórico de releases aprobadas, y cada publicación desde ahí queda
marcada con un tag `entrega/AAAA-MM-DD` (ver `CLAUDE.md`).

## Conflicts

- Rebase (not merge) onto `develop` to keep history linear: `git rebase origin/develop`.
- Resolve, then `git rebase --continue`. Re-run the green checks.
- If a rebase gets messy, ask before force-pushing. Never force-push `develop` or `main`.

## Golden don'ts

- ❌ No direct commits/pushes to `develop` or `main` — both move only through PRs.
- ❌ No PRs targeting `main` for regular task work. Task PRs go to `develop`.
- ❌ No editing files owned by another `In Progress` task.
- ❌ No pushing red (build/lint failing).
- ❌ No giant multi-task branches.
- ❌ No `git push --force` on shared branches.
