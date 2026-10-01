// Medición acotada de una story — sin el Ojo y sin Chrome a mano.
// ---------------------------------------------------------------------------
// EL FALLO. Las remediciones cortas (tres números tras un arreglo) se mandaban
// al Ojo, que para ello montaba build, Chrome por CDP y un informe: 30–40k
// tokens y, el 22-09, tres cuelgues sin dejar rastro. Y los intentos de medir a
// mano con CDP se colgaban también.
//
// QUÉ HACE. Escribe UNA story desechable POR SELECTOR (todas heredan la story
// pedida; el `play` mide la caja y la lanza como aserto), construye Storybook
// UNA sola vez con todas dentro, las pasa por `play-errors.mjs` —el único camino
// que abre Chrome y siempre lo cierra— y recoge cada mensaje. Borra stories y
// build al salir. Nada se versiona.
//
//   node scripts/medir-story.mjs --story src/modules/x/x.stories.js --export Default \
//        --sel '.x__foo' --sel '.x__bar' [--ancho 390] [--ancho 1440] [--rel <sel>]
//
// De cada selector: caja (w×h @ x,y relativos al primer elemento del canvas, o a
// `--rel`), `font-size`, `line-height`, `padding-top/bottom`. Varios `--ancho`
// miden los mismos selectores a cada ancho, con la misma build.
//
// Antes de medir: el elemento se lleva al viewport (las imágenes `loading="lazy"`
// miden 0 hasta cargar), se espera a sus imágenes y 400 ms a las transiciones
// (una tarea anterior: la card medía 624 en vez de 188 por medir a mitad de un `0.3s ease`).
//
// Si la story heredada tiene `play`, se ejecuta ANTES de medir: una story que abre un
// desplegable o un modal se mide abierta.
//
// ⚠️ Un aserto de Storybook trunca el mensaje a ~40 caracteres: por eso una
// story por selector y no una con todos. La primera versión (24-09) aceptaba
// `--dir` para reutilizar una build: no servía, porque la story desechable se
// escribe DESPUÉS y la build no la contiene. Ver L-100.
import { execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const arg = (n, def) => {
  const i = process.argv.indexOf(`--${n}`)
  return i > -1 ? process.argv[i + 1] : def
}
const args = (n) => process.argv.flatMap((a, i) => (a === `--${n}` ? [process.argv[i + 1]] : []))
const story = arg('story')
const exp = arg('export', 'Default')
const sels = args('sel')
const rel = arg('rel', '')
const anchos = args('ancho')
if (!anchos.length) anchos.push('')
if (!story || !sels.length) {
  console.error(
    'uso: --story <ruta.stories.js> --sel <selector> [--sel …] [--export Default] [--ancho 390] [--rel <sel>]'
  )
  process.exit(2)
}

const tmpDir = join(dirname(story), 'tmp-medida')
const dir = '.sb-medida'
const src = relative(tmpDir, story).replace(/\\/g, '/')
const escribe = (sel, i) =>
  writeFileSync(
    join(tmpDir, `medida-${i}.stories.js`),
    `import { expect } from 'storybook/test'
import * as f from '${src.startsWith('.') ? src : './' + src}'
export default { ...f.default, title: 'Tmp/Medida ${i}', tags: ['WIP'] }
export const Default = { ...f['${exp}'], play: async (ctx) => {
  if (f['${exp}'].play) await f['${exp}'].play(ctx) // la story base primero: si abre algo, se mide abierto
  const { canvasElement } = ctx
  const rel = ${JSON.stringify(rel)} ? canvasElement.querySelector(${JSON.stringify(rel)}) : canvasElement.firstElementChild
  const o = rel ? rel.getBoundingClientRect() : { x: 0, y: 0 }
  const el = canvasElement.querySelector(${JSON.stringify(sel)})
  if (!el) { await expect('NO HAY ${sel.replace(/'/g, '')}').toBe('X') }
  el.scrollIntoView({ block: 'center' }) // las imágenes lazy solo cargan cerca del viewport
  const imgs = [el, ...el.querySelectorAll('img')].filter((i) => i.tagName === 'IMG' && !i.complete)
  await Promise.race([Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r }))), new Promise((r) => setTimeout(r, 1500))])
  await new Promise((r) => setTimeout(r, 400)) // transiciones de ≤ 0,3 s terminadas
  const b = el.getBoundingClientRect(); const cs = getComputedStyle(el)
  await expect(\`\${Math.round(b.width)}x\${Math.round(b.height)}@\${Math.round(b.x - o.x)},\${Math.round(b.y - o.y)} fs\${cs.fontSize} lh\${cs.lineHeight} p\${parseInt(cs.paddingTop)}/\${parseInt(cs.paddingBottom)}\`).toBe('X') } }
`
  )
try {
  rmSync(tmpDir, { recursive: true, force: true })
  mkdirSync(tmpDir, { recursive: true })
  sels.forEach(escribe)
  rmSync(dir, { recursive: true, force: true })
  execSync(`STARTERSLUG_STORYBOOK_TODO=1 npx storybook build -o ${dir}`, { stdio: 'ignore' })
  for (const ancho of anchos) {
    if (ancho) console.log(`— ${ancho} —`)
    sels.forEach((sel, i) => {
      let out = ''
      try {
        out = execSync(
          `node scripts/play-errors.mjs --dir ${dir} ${ancho ? `--ancho ${ancho}` : ''} --id tmp-medida-${i}--default`,
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        )
      } catch (e) {
        out = (e.stdout || '') + (e.stderr || '')
      }
      const m = out.match(/expected '([^']*)'/)
      console.log(
        `${sel.padEnd(40)} ${m ? m[1] : '(sin medida: ' + out.trim().split('\n').pop() + ')'}`
      )
    })
  }
} finally {
  rmSync(tmpDir, { recursive: true, force: true })
  rmSync(dir, { recursive: true, force: true })
  try {
    execSync('pkill -f "chrome.*headless"', { stdio: 'ignore' })
  } catch {}
}
