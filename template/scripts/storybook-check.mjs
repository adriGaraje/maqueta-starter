#!/usr/bin/env node
// =============================================================================
//  storybook-check — compila TODAS las stories, incluidas las WIP.
//
//  `npm run build-storybook` construye solo la entrega, así que una story en WIP
//  puede estar rota —un import a un fichero que no existe, un partial que se
//  quedó en otra rama— y los green gates pasan igual. Pasó de verdad: los paneles
//  importaban una cabecera que no estaba en la rama y build, lint, format y
//  build-storybook dieron verde los cuatro.
//
//  Esto no publica nada: compila a un directorio aparte y solo mira si revienta.
//
//  Uso: npm run check:stories
// =============================================================================
import { spawn } from 'node:child_process'
import { rmSync } from 'node:fs'

const SALIDA = 'storybook-static-check'

rmSync(SALIDA, { recursive: true, force: true })

// `shell: true` porque en Windows `npx` es un .cmd y spawn sin shell da EINVAL.
const hijo = spawn(`npx storybook build -o ${SALIDA} --quiet`, {
  stdio: 'inherit',
  shell: true,
  // El modo local de .storybook/main.js: todas las stories, no solo la entrega.
  env: { ...process.env, STARTERSLUG_STORYBOOK_TODO: '1' },
})

hijo.on('exit', (code) => {
  if (code === 0) {
    rmSync(SALIDA, { recursive: true, force: true })
    console.log('\n✔ Todas las stories compilan, WIP incluidas.')
  } else {
    console.error('\n✖ Alguna story no compila. Arriba está el error.')
  }
  process.exit(code ?? 1)
})
