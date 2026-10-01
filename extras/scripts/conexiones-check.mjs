#!/usr/bin/env node
// =============================================================================
//  conexiones-check — prueba las credenciales del proyecto: Figma, Jira, GitHub
//  y Firebase. Lee `docs/<slug>-harness/config.json` y `.env` (o el entorno).
//
//  Uso: npm run check:conexiones
//  Sale con 1 si alguna conexión falla; lo que no tiene datos se omite.
//  Mismo código que el botón «Probar conexión» del asistente (scripts/lib/conexiones.mjs).
// =============================================================================
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { probarTodo } from './lib/conexiones.mjs'

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)))

const dirHarness = readdirSync(join(RAIZ, 'docs')).find((d) =>
  existsSync(join(RAIZ, 'docs', d, 'config.json'))
)
if (!dirHarness) {
  console.error('✖ No encuentro docs/<slug>-harness/config.json.')
  process.exit(1)
}
const C = JSON.parse(readFileSync(join(RAIZ, 'docs', dirHarness, 'config.json'), 'utf8'))

// .env sin dependencias: KEY="value" / KEY=value; el entorno manda sobre el fichero.
const env = {}
try {
  for (const l of readFileSync(join(RAIZ, '.env'), 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/)
    if (m) env[m[1]] = m[2]
  }
} catch {}
const e = (k) => process.env[k] || env[k] || ''

const figmaFile = C.figma?.files?.[C.figma?.primaryFile]?.fileKey
const T = C.deploy?.targets ?? {}

const resultados = await probarTodo(
  {
    figma: { fileKey: e('FIGMA_FILE_KEY') || figmaFile, token: e('FIGMA_TOKEN') },
    jira: {
      site: C.atlassian?.site,
      projectKey: C.atlassian?.jira?.projectKey,
      email: e('ATLASSIAN_EMAIL') || e('JIRA_EMAIL'),
      token: e('ATLASSIAN_API_TOKEN') || e('JIRA_API_TOKEN'),
    },
    github: { remote: C.repo?.remote, token: e('GITHUB_TOKEN') },
    firebase: { proyecto: C.deploy?.firebaseProject, sitios: [T.entrega?.site, T.pre?.site] },
  },
  RAIZ
)

const marca = { ok: '✔', error: '✖', omitido: '–' }
for (const r of resultados) console.log(`${marca[r.estado]} ${r.servicio.padEnd(8)} ${r.mensaje}`)
const fallos = resultados.filter((r) => r.estado === 'error').length
console.log(
  fallos
    ? `\n✖ ${fallos} ${fallos === 1 ? 'conexión' : 'conexiones'} con problemas.`
    : '\n✔ Todo lo que tiene datos conecta.'
)
process.exit(fallos ? 1 : 0)
