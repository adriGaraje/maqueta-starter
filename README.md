# maqueta-starter

Un asistente web que genera un **repo de maquetación nuevo** con el harness completo de Claude
Code: Storybook + Vite + SCSS ITCSS sobre Bootstrap, la skill del ritual (`<slug>-flow`), el
agente Ojo (`<slug>-analyst`), hooks, gates, lecciones y la puerta de acceso del Storybook
publicado. Sale configurado con lo que respondas; lo que saltes queda como `TODO`.

## Arrancar

```sh
nvm use        # Node 20
npm i          # solo Prettier: el starter no tiene dependencias de runtime
npm run starter
```

Se abre `http://localhost:4747` (`-- --no-open` para no abrirlo, `-- --puerto 5000` para otro).

## Los pasos

1. **Proyecto** — nombre (lo único obligatorio), slug, carpeta destino (`../<slug>` por defecto), descripción, CMS.
2. **Figma** — fileKey o URL del handoff, nombre, `FIGMA_TOKEN` (a `.env`), viewports.
3. **Jira / Atlassian** — site, cloudId, clave, nombre, boardId, Confluence, email + API token (a `.env`).
4. **GitHub** — remote, ramas de integración y release, patrón de rama, MCP de GitHub (`.mcp.json`).
5. **Equipo** — nombre · alias · email · accountId · usuario de GitHub. La primera fila es el usuario por defecto.
6. **Firebase y puerta** — proyecto y sitios de Hosting (`storybook-<slug>` y `-pre`), claves web y aspecto del login.
7. **Qué llevar** — grupos `figma`, `jira`, `entrega`, `django`, `auth`, y la comprobación final.
8. **Resumen** — tabla, «Probar todo», Finalizar y progreso en vivo.

Cada paso con credenciales tiene **«Probar conexión»**: la llamada la hace el servidor, nunca el
navegador, y nada se escribe en disco hasta Finalizar. El borrador vive en `localStorage`.

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
