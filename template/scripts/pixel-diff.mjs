#!/usr/bin/env node
// =============================================================================
//  pixel-diff — compara dos PNG del mismo tamaño y dice cuánto y dónde difieren.
//
//  Nació para auditar la migración a Bootstrap 4: el repo guarda las
//  capturas de cada pieza de ANTES, así que regenerarlas y compararlas es la
//  prueba más directa de «¿se ha roto algo?». Más fiable que mirarlas al lado:
//  un botón 2 px más alto no se ve, y aquí sale.
//
//  Uso:
//    node scripts/pixel-diff.mjs <antes.png> <despues.png> [umbral]
//
//  El umbral (0-255, por defecto 8) es la diferencia por canal a partir de la
//  cual un píxel cuenta como distinto — por debajo es antialiasing.
// =============================================================================
import { readFileSync } from 'node:fs'
import zlib from 'node:zlib'

const decodifica = (f) => {
  const b = readFileSync(f)
  let o = 8
  const idat = []
  let w, h, ct
  while (o < b.length) {
    const len = b.readUInt32BE(o)
    const t = b.toString('ascii', o + 4, o + 8)
    if (t === 'IHDR') {
      w = b.readUInt32BE(o + 8)
      h = b.readUInt32BE(o + 12)
      ct = b[o + 17]
    }
    if (t === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + len))
    o += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const ch = ct === 6 ? 4 : 3
  const stride = w * ch + 1
  const prev = Buffer.alloc(w * ch)
  let cur = Buffer.alloc(w * ch)
  const filas = []
  for (let y = 0; y < h; y++) {
    const f2 = raw[y * stride]
    const line = raw.subarray(y * stride + 1, (y + 1) * stride)
    for (let i = 0; i < w * ch; i++) {
      const a = i >= ch ? cur[i - ch] : 0
      const bb = prev[i]
      const c = i >= ch ? prev[i - ch] : 0
      let v = line[i]
      if (f2 === 1) v += a
      else if (f2 === 2) v += bb
      else if (f2 === 3) v += (a + bb) >> 1
      else if (f2 === 4) {
        const p = a + bb - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - bb)
        const pc = Math.abs(p - c)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? bb : c
      }
      cur[i] = v & 255
    }
    filas.push(Buffer.from(cur))
    cur.copy(prev)
  }
  return { w, h, ch, filas }
}

const [f1, f2, umbralArg] = process.argv.slice(2)
const UMBRAL = Number(umbralArg) || 8
const A = decodifica(f1)
const B = decodifica(f2)

if (A.w !== B.w || A.h !== B.h) {
  console.log(`✗ tamaños distintos: ${A.w}×${A.h} vs ${B.w}×${B.h}`)
  process.exit(1)
}

let distintos = 0
let peor = 0
const bandas = new Array(20).fill(0) // en qué franja vertical están las diferencias
for (let y = 0; y < A.h; y++) {
  for (let x = 0; x < A.w; x++) {
    let d = 0
    for (let k = 0; k < 3; k++)
      d = Math.max(d, Math.abs(A.filas[y][x * A.ch + k] - B.filas[y][x * B.ch + k]))
    if (d > UMBRAL) {
      distintos++
      if (d > peor) peor = d
      bandas[Math.min(19, Math.floor((y / A.h) * 20))]++
    }
  }
}
const total = A.w * A.h
const pct = (distintos / total) * 100
console.log(`${distintos} px distintos de ${total}  (${pct.toFixed(3)} %)  ·  peor canal ${peor}`)
if (distintos) {
  const max = Math.max(...bandas)
  console.log('reparto por franjas (de arriba abajo):')
  bandas.forEach((n, i) => {
    if (!n) return
    const y0 = Math.round((i / 20) * A.h)
    console.log(
      `  y ${String(y0).padStart(5)}  ${String(n).padStart(7)}  ${'█'.repeat(Math.max(1, Math.round((n / max) * 40)))}`
    )
  })
}
