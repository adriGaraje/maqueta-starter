#!/usr/bin/env node
// HOOK · UserPromptSubmit — detecta el saludo y dispara el ritual de starterslug-flow.
//
// Lee el JSON del hook por stdin, mira el prompt del humano y, si parece un
// saludo de arranque (o una despedida), inyecta la instrucción correspondiente.
// Si no casa, no inyecta nada y el prompt sigue su curso normal.
//
// Pase lo que pase, sale con código 0.
//
// El hook se puede enganchar desde la carpeta padre además de desde
// el propio repo. En ese caso el cwd NO es la raíz del harness, así que la
// inyección lleva un ancla con la ruta real y dónde vive la skill.

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const desdeFuera = resolve(process.cwd()) !== ROOT

const readJson = (rel) => {
  try {
    return JSON.parse(readFileSync(resolve(ROOT, rel), 'utf8'))
  } catch {
    return null
  }
}

// Una persona puede firmar con más de un correo (el de la empresa y el noreply de
// GitHub): `team[].emailsAlternativos` los recoge para que no caiga al usuario por defecto.
const casaEmail = (p, email) =>
  [p.email, ...(p.emailsAlternativos ?? [])].some((e) => (e ?? '').toLowerCase() === email)

// ¿Es el primer saludo de esta persona? Mismo criterio que el hook de SessionStart:
// quién eres sale del `git config user.email`, y si tu alias no está en
// `state.json → onboarding.hechoPor`, nadie te ha montado las conexiones todavía.
// Ante la duda NO se dispara el onboarding: colárselo a quien ya está al día es
// más molesto que no ofrecérselo a quien lo necesita, que lo puede pedir.
const quienNecesitaOnboarding = () => {
  try {
    const equipo = readJson('docs/starterslug-harness/config.json')?.team ?? []
    const hechoPor = readJson('docs/starterslug-harness/state.json')?.onboarding?.hechoPor ?? []
    const email = execSync('git config user.email', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .toLowerCase()
    const yo = equipo.find((p) => casaEmail(p, email))
    return yo && !hechoPor.includes(yo.alias) ? yo : null
  } catch {
    return null
  }
}

// ¿Es el último día de quien cierra? `config.json → team[].salida` lo programa con
// antelación, y el cierre de ese día hace el traspaso a su relevo. Vale también si la
// fecha ya pasó y nadie lo hizo: mejor tarde que un equipo con tareas huérfanas.
const hoyLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const traspasoDeHoy = () => {
  try {
    const equipo = readJson('docs/starterslug-harness/config.json')?.team ?? []
    const email = execSync('git config user.email', {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .toLowerCase()
    const yo = equipo.find((p) => casaEmail(p, email))
    const s = yo?.salida
    if (!s?.ultimoDia || s.traspasoHecho || hoyLocal() < s.ultimoDia) return null
    // `relevo` puede ser un alias o una lista: p. ej. un traspaso repartido entre dos personas.
    const relevos = []
      .concat(s.relevo ?? [])
      .map((alias) => equipo.find((p) => p.alias === alias))
      .filter(Boolean)
    return relevos.length ? { yo, relevos, ultimoDia: s.ultimoDia } : null
  } catch {
    return null
  }
}

const ancla = () =>
  desdeFuera
    ? [
        '',
        `**Ojo: tu cwd no es la raíz del harness.** El repo es \`${ROOT}\``,
        `(desde aquí, \`${relative(process.cwd(), ROOT).replace(/\\/g, '/') || '.'}/\`). Todo el flujo —git, npm, rutas de`,
        '`docs/starterslug-harness/`— va con esa carpeta como raíz.',
        'Si la skill `starterslug-flow` no te aparece cargada, léela a mano:',
        `\`${relative(process.cwd(), ROOT).replace(/\\/g, '/')}/.claude/skills/starterslug-flow/SKILL.md\` y sus \`references/\`.`,
      ].join('\n')
    : ''

let raw = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (c) => (raw += c))
process.stdin.on('end', () => {
  try {
    const prompt = (JSON.parse(raw || '{}').prompt ?? '').trim()

    // Solo saludos "en seco". Si el humano escribe "buenos días, arregla el header",
    // eso es una petición concreta y no queremos secuestrarla con el ritual entero.
    const corto = prompt.length <= 40

    const ARRANQUE =
      /^\s*(buenos?\s*d[ií]as|buenas(\s+tardes)?|hola|gm|a\s+currar|arranca(mos)?|empezamos|dale\s+ca[ñn]a|vamos\s+all[áa])\b/i
    const TURBO = /\b(a\s+saco|turbo|sin\s+preguntar|modo\s+bestia)\b/i
    const CIERRE =
      /^\s*(me\s+voy|cerramos|buenas\s+noches|hasta\s+ma[ñn]ana|fin\s+del\s+d[ií]a|terminamos)\b/i

    let additionalContext = null

    if (CIERRE.test(prompt) && corto) {
      const t = traspasoDeHoy()
      additionalContext = [
        t
          ? `<starterslug-flow trigger="cierre" traspaso="${t.yo.alias}→${t.relevos.map((r) => r.alias).join('+')}">`
          : '<starterslug-flow trigger="cierre">',
        'El humano se despide. Ejecuta el **M5 · Cierre** de la skill `starterslug-flow`',
        '(ver `references/cierre.md`): sincroniza backlog↔Jira, registra hitos y lecciones,',
        'actualiza `state.json` con dónde se queda la cosa, y ofrece deploy si hay verde sin publicar.',
        'No arranques trabajo nuevo.',
        t
          ? [
              '',
              `**Y ES EL ÚLTIMO CIERRE DE ${t.yo.displayName.toUpperCase()}** (último día: ${t.ultimoDia}).`,
              `Después del cierre normal, ejecuta el **traspaso** a ${t.relevos.map((r) => r.displayName).join(' y ')}`,
              'siguiendo `references/traspaso.md` paso a paso. Está autorizado de antemano:',
              'reasignar sus tareas, volcar su memoria al repo, commit, PR y merge a `develop`.',
              'Enseña el inventario antes de tocar nada, y si hay trabajo sin subir, para y pregunta.',
            ].join('\n')
          : '',
        ancla(),
        '</starterslug-flow>',
      ].join('\n')
    } else if (ARRANQUE.test(prompt) && corto && quienNecesitaOnboarding()) {
      const novato = quienNecesitaOnboarding()
      additionalContext = [
        '<starterslug-flow trigger="onboarding">',
        `Es el **primer saludo de ${novato.displayName}** con el harness: su alias`,
        `(\`${novato.alias}\`) no está en \`state.json → onboarding.hechoPor\`.`,
        '',
        'Ejecuta el **onboarding** de `docs/starterslug-harness/onboarding.md` EN VEZ del ritual.',
        'No lances M0 ni M1: sin las conexiones montadas, el barrido falla a medias y',
        'parece que el harness está roto cuando lo que falta es un login.',
        '',
        'Va paso a paso y **esperando confirmación en cada uno** — la mitad son cosas que',
        'tiene que hacer la persona en su máquina (autenticar en `/mcp`, reiniciar Claude',
        'Code), no tú. Comprueba cada conexión con una llamada real antes de darla por buena.',
        '',
        'Al terminar, **propón** añadir su alias a `state.json → onboarding.hechoPor` para',
        'que esto no vuelva a saltar. Propón: no lo escribas sin OK, como todo lo demás.',
        ancla(),
        '</starterslug-flow>',
      ].join('\n')
    } else if (ARRANQUE.test(prompt) && corto) {
      const turbo = TURBO.test(prompt)
      additionalContext = [
        `<starterslug-flow trigger="ritual"${turbo ? ' modo="turbo"' : ''}>`,
        'El humano ha saludado. Ejecuta el **ritual de arranque** de la skill `starterslug-flow`:',
        'M0 ingesta → M1 barrido → M2 reporte visual → M3 housekeeping → M4 pregunta.',
        '',
        'Recuerda el nivel de autonomía pactado: **M0 y M3 solo PROPONEN**.',
        'Nada se escribe en Jira sin OK explícito del humano.',
        turbo
          ? 'MODO TURBO: salta M4 y arranca el pipeline con el primero de la cola.'
          : 'Termina en M4 preguntando por dónde empezar. No arranques a maquetar sin confirmación.',
        ancla(),
        '</starterslug-flow>',
      ].join('\n')
    }

    if (additionalContext) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext },
        })
      )
    }
  } catch {
    // Silencio deliberado: nunca bloquear el prompt del humano.
  }
  process.exit(0)
})
