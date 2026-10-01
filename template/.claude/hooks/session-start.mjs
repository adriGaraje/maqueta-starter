#!/usr/bin/env node
// HOOK · SessionStart — contexto barato de arranque para el harness starterslug-flow.
//
// Se ejecuta al abrir/reanudar la sesión. NO hace red ni llamadas a Jira/Figma:
// solo lee git y el state.json local, para que arrancar sea instantáneo. El
// trabajo de verdad lo hace el ritual, y solo cuando el humano saluda.
//
// Contrato: escribe UN JSON en stdout con hookSpecificOutput.additionalContext.
// Pase lo que pase, sale con código 0 — un hook que peta no debe romper la sesión.

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

// ── Instalar los agentes donde Claude Code los busca de verdad ───────────────
//
// Los agentes del harness viven versionados en `<repo>/.claude/agents/`, pero
// **Claude Code no los lee de ahí**. Los skills sí se descubren en subcarpetas;
// los agentes no: se leen solo de la raíz del proyecto y de `~/.claude/agents/`.
//
// En este montaje la raíz del proyecto es la carpeta que CONTIENE el repo — su
// `.claude/settings.json` es el que invoca este hook con `node
// <carpeta-padre>/.claude/hooks/...`. Así que sin este paso el fichero está en git,
// todo el mundo lo tiene, y nadie lo usa: `subagent_type: "starterslug-analyst"` responde
// «agent type not found» y el pipeline se cae al modelo por defecto SIN AVISAR.
// Ese silencio es justo lo que lo hace peligroso.
//
// Se copia en vez de enlazar: un junction necesita permisos que no todo Windows
// da, y una copia que se reescribe en cada arranque no puede quedarse vieja. El
// repo manda siempre; el destino es desechable.
function instalarAgentes() {
  try {
    const origen = resolve(REPO, '.claude', 'agents')
    const destino = resolve(process.cwd(), '.claude', 'agents')

    // Alguien abrió Claude Code dentro del propio repo: ya los encuentra solo.
    if (origen === destino) return []
    if (!existsSync(origen)) return []

    mkdirSync(destino, { recursive: true })

    const puestos = []
    for (const f of readdirSync(origen).filter((x) => x.endsWith('.md'))) {
      const src = readFileSync(join(origen, f))
      let igual = false
      try {
        igual = readFileSync(join(destino, f)).equals(src)
      } catch {
        /* no existe todavía */
      }
      if (!igual) {
        writeFileSync(join(destino, f), src)
        puestos.push(f.replace(/\.md$/, ''))
      }
    }
    return puestos
  } catch {
    // Nunca romper la sesión por esto: sin agentes se trabaja, con la sesión rota no.
    return []
  }
}

const sh = (cmd) => {
  try {
    return execSync(cmd, {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

const readJson = (rel) => {
  try {
    return JSON.parse(readFileSync(resolve(REPO, rel), 'utf8'))
  } catch {
    return null
  }
}

try {
  const now = new Date()
  const fecha = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const hora = now.getHours()
  const saludo =
    hora < 6
      ? 'Buenas noches'
      : hora < 13
        ? 'Buenos días'
        : hora < 21
          ? 'Buenas tardes'
          : 'Buenas noches'

  const rama = sh('git branch --show-current')
  const sucio = sh('git status --porcelain').split('\n').filter(Boolean).length
  const state = readJson('docs/starterslug-harness/state.json')
  const modules = readJson('docs/starterslug-harness/modules.json')
  const config = readJson('docs/starterslug-harness/config.json')

  // Una persona puede firmar con más de un correo (el de la empresa y el noreply de
  // GitHub): `team[].emailsAlternativos` los recoge para que no caiga al usuario por defecto.
  const casaEmail = (p, email) =>
    [p.email, ...(p.emailsAlternativos ?? [])].some((e) => (e ?? '').toLowerCase() === email)

  // ── Quién está usando el harness ────────────────────────────────────────────
  // Se resuelve del `git config user.email` contra el equipo. Antes se daba por
  // hecho que era el usuario por defecto (`isDefaultUser`), y con dos personas eso hace que el
  // parte de la mañana enseñe las tareas de otro como tuyas — un fallo que no se
  // ve, porque el reporte sale igual de bonito.
  const equipo = config?.team ?? []
  const email = sh('git config user.email').toLowerCase()
  const yo = equipo.find((p) => casaEmail(p, email)) ?? equipo.find((p) => p.isDefaultUser) ?? null
  const emailDesconocido = Boolean(email) && !equipo.some((p) => casaEmail(p, email))
  const companeros = equipo.filter((p) => p.activo !== false && p.alias !== yo?.alias)

  // ── Salidas del equipo ──────────────────────────────────────────────────────
  // `team[].salida` programa el último día de alguien. El cierre de ese día hace el
  // traspaso; si no se hizo, lo avisa aquí a quien abra la sesión, sea quien sea.
  const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const traspasosPendientes = equipo.filter(
    (p) => p.salida?.ultimoDia && !p.salida.traspasoHecho && hoy > p.salida.ultimoDia
  )
  const miSalida =
    yo?.salida?.ultimoDia && !yo.salida.traspasoHecho && hoy <= yo.salida.ultimoDia
      ? yo.salida
      : null
  const relevoDe = (s) =>
    []
      .concat(s.relevo ?? [])
      .map((alias) => equipo.find((p) => p.alias === alias)?.displayName ?? alias)
      .join(' y ')
  const diasHasta = (fecha) =>
    Math.round((new Date(`${fecha}T12:00:00`) - new Date(`${hoy}T12:00:00`)) / 864e5)

  // Primer arranque de esta persona: nadie la ha pasado por el onboarding.
  const yaOnboardeados = state?.onboarding?.hechoPor ?? []
  const necesitaOnboarding = Boolean(yo) && !yaOnboardeados.includes(yo.alias)

  const cola = (modules?.modules ?? []).filter((m) => m.pipelineState === 'design-ready')
  const enCurso = (modules?.modules ?? []).filter((m) =>
    ['maqueting', 'pixel-check', 'in-review', 'pending-fixes'].includes(m.pipelineState)
  )

  // La sesión se puede abrir desde la carpeta padre. Si el cwd no es
  // la raíz del repo, dilo alto y claro: el flujo entero cuelga de ella.
  const desdeFuera = resolve(process.cwd()) !== REPO

  const agentesPuestos = instalarAgentes()

  const lineas = [
    `# starterslug-flow · contexto de sesión`,
    ``,
    // Solo se dice cuando ha habido que copiar algo, y entonces importa mucho:
    // los agentes se registran AL ARRANCAR, así que los recién instalados no
    // existen en esta sesión todavía. Sin este aviso, `subagent_type` falla y
    // parece un fallo del harness.
    agentesPuestos.length
      ? `- ⚠️ **Agentes instalados en esta sesión:** ${agentesPuestos.map((a) => `\`${a}\``).join(', ')}. Se registran al arrancar, así que **todavía no existen**: reinicia Claude Code antes de usarlos. Si los invocas ahora dirá «agent type not found».`
      : null,
    desdeFuera
      ? `- **Raíz del harness:** \`${REPO}\` — tu cwd es otro; trabaja con esa carpeta como raíz.`
      : null,
    `- **Fecha:** ${fecha} · saludo apropiado ahora mismo: "${saludo}"`,
    yo
      ? `- **Estás con:** ${yo.displayName} (\`${yo.alias}\`)${emailDesconocido ? ' ⚠️ **por defecto, no por coincidencia**: el `git config user.email` de esta máquina no está en `config.json → team`. Si no eres esa persona, dilo antes de que el parte te enseñe tareas ajenas como tuyas.' : ''}${companeros.length ? ` · en el proyecto también: ${companeros.map((p) => p.displayName).join(', ')}` : ' · sin más devs activos ahora mismo'}`
      : `- **Estás con:** sin identificar — \`config.json → team\` no tiene a nadie. Pregunta quién eres antes de dar por tuya ninguna tarea.`,
    yo && yo.activo === false
      ? `- ⚠️ **${yo.displayName} ya no forma parte del proyecto.** Sus tareas las lleva otra persona: no enseñes ninguna como suya ni la toques sin preguntar.`
      : null,
    miSalida
      ? diasHasta(miSalida.ultimoDia) === 0
        ? `- 🧳 **Hoy es el último día de ${yo.displayName}.** El «me voy» de hoy hace el cierre y además el **traspaso** de todo lo suyo a ${relevoDe(miSalida)} (\`references/traspaso.md\`). Antes, repasad el checklist de accesos de ese fichero.`
        : `- 🧳 **Último día de ${yo.displayName}: ${miSalida.ultimoDia}** (quedan ${diasHasta(miSalida.ultimoDia)} días). Ese cierre hace el traspaso a ${relevoDe(miSalida)}. Checklist de accesos de cada relevo en \`references/traspaso.md\`.`
      : null,
    ...traspasosPendientes.map(
      (p) =>
        `- ⚠️ **Traspaso pendiente:** ${p.displayName} dejó el proyecto el ${p.salida.ultimoDia} y su traspaso a ${relevoDe(p.salida)} no se ha hecho. Ejecútalo antes que nada: \`references/traspaso.md\`.`
    ),
    `- **Rama:** \`${rama || 'desconocida'}\`${sucio ? ` · ${sucio} fichero(s) sin commitear` : ' · árbol limpio'}`,
    state?.ultimoArranque
      ? `- **Último arranque:** ${state.ultimoArranque}`
      : `- **Último arranque:** sin registro previo`,
    state?.ultimoFoco ? `- **Dónde lo dejaste:** ${state.ultimoFoco}` : null,
    cola.length
      ? `- **Cola listos para dev:** ${cola.map((m) => m.slug).join(', ')}`
      : `- **Cola listos para dev:** vacía`,
    enCurso.length
      ? `- **En vuelo:** ${enCurso.map((m) => `${m.slug} (${m.pipelineState})`).join(', ')}`
      : null,
    ``,
    necesitaOnboarding
      ? [
          `> ⚠️ **Primer arranque de ${yo.displayName} con el harness.** No aparece en`,
          `> \`state.json → onboarding.hechoPor\`. Si saluda, ejecuta el **onboarding**`,
          `> (\`docs/starterslug-harness/onboarding.md\`) ANTES del ritual: sin las conexiones montadas,`,
          `> M0 y M1 fallan a medias y parece que el harness está roto.`,
          ``,
        ].join('\n')
      : null,
    `> Si el humano saluda ("buenos días", "buenas", "a currar"…), arranca el **ritual**`,
    `> de la skill \`starterslug-flow\` (movimientos M0→M4). No lo arranques por tu cuenta si no saluda:`,
    `> el ritual hace consultas reales a Jira y Figma y cuesta tiempo.`,
  ].filter(Boolean)

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: lineas.join('\n'),
      },
    })
  )
} catch {
  // Silencio deliberado: mejor sesión sin contexto extra que sesión rota.
}

process.exit(0)
