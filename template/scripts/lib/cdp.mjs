// Driver de Chrome por DevTools Protocol.
// ---------------------------------------------------------------------------
// POR QUÉ EXISTE. `--screenshot` + `--virtual-time-budget` no permiten decirle a
// Chrome «captura AHORA, que ya he esperado»: la captura cae cuando se agota el
// presupuesto, haya resuelto el decodificado de las imágenes o no. Con CDP la
// captura la pedimos nosotros, DESPUÉS de que los `decode()` hayan cerrado.
//
// Y de propina resuelve L-008: `Emulation.setDeviceMetricsOverride` fija un
// viewport REAL de cualquier ancho, 390 incluido. Chrome headless no baja de
// ~500 px de VENTANA, pero el viewport emulado no es la ventana. Eso quita el
// iframe con el que `pixel-shot` esquivaba el problema — y el iframe, a su vez,
// era lo que rompía los `play` que dependen del foco (L-063). Un solo cambio
// cierra los dos.
//
// SIN DEPENDENCIAS NUEVAS. Node 20 no trae `WebSocket` global y este repo no
// carga librerías externas, así que abajo va un cliente de WebSocket mínimo:
// handshake por `Upgrade` de HTTP y trama a mano. Es lo justo para CDP —
// mensajes de texto, sin extensiones, sin compresión.

import { createHash, randomBytes } from 'node:crypto'
import { request as httpRequest, get as httpGet } from 'node:http'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const CHROME = [
  process.env.STARTERSLUG_CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find((r) => r && existsSync(r))

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms))

// --- WebSocket mínimo -------------------------------------------------------

class SocketWeb {
  constructor(socket) {
    this.socket = socket
    this.buffer = Buffer.alloc(0)
    this.trozos = []
    this.alMensaje = () => {}
    this.alCierre = () => {}
    socket.on('data', (d) => {
      this.buffer = Buffer.concat([this.buffer, d])
      this.consume()
    })
    socket.on('close', () => this.alCierre())
    socket.on('error', () => this.alCierre())
  }

  // Las tramas del servidor vienen SIN máscara. Pueden llegar partidas entre
  // varios `data` —una captura en base64 son megas— así que se acumula y solo se
  // consume cuando la trama está entera.
  consume() {
    for (;;) {
      const b = this.buffer
      if (b.length < 2) return
      const fin = (b[0] & 0x80) !== 0
      const opcode = b[0] & 0x0f
      const largoBase = b[1] & 0x7f
      let off = 2
      let largo = largoBase
      if (largoBase === 126) {
        if (b.length < 4) return
        largo = b.readUInt16BE(2)
        off = 4
      } else if (largoBase === 127) {
        if (b.length < 10) return
        const grande = b.readBigUInt64BE(2)
        if (grande > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('trama descomunal')
        largo = Number(grande)
        off = 10
      }
      if (b.length < off + largo) return
      const carga = b.subarray(off, off + largo)
      this.buffer = b.subarray(off + largo)

      if (opcode === 0x8) {
        this.socket.end()
        return
      }
      if (opcode === 0x9) {
        this.envia(carga, 0xa) // pong
        continue
      }
      if (opcode === 0xa) continue

      this.trozos.push(carga)
      if (fin) {
        const texto = Buffer.concat(this.trozos).toString('utf8')
        this.trozos = []
        this.alMensaje(texto)
      }
    }
  }

  envia(datos, opcode = 0x1) {
    const carga = Buffer.isBuffer(datos) ? datos : Buffer.from(datos, 'utf8')
    const mascara = randomBytes(4)
    const n = carga.length
    let cabecera
    if (n < 126) {
      cabecera = Buffer.alloc(2)
      cabecera[1] = 0x80 | n
    } else if (n < 65536) {
      cabecera = Buffer.alloc(4)
      cabecera[1] = 0x80 | 126
      cabecera.writeUInt16BE(n, 2)
    } else {
      cabecera = Buffer.alloc(10)
      cabecera[1] = 0x80 | 127
      cabecera.writeBigUInt64BE(BigInt(n), 2)
    }
    cabecera[0] = 0x80 | opcode
    const enmascarada = Buffer.allocUnsafe(n)
    for (let i = 0; i < n; i++) enmascarada[i] = carga[i] ^ mascara[i & 3]
    this.socket.write(Buffer.concat([cabecera, mascara, enmascarada]))
  }

  cierra() {
    try {
      this.envia(Buffer.alloc(0), 0x8)
    } catch {
      /* ya estaba cerrado */
    }
    this.socket.destroy()
  }
}

const conecta = (url) =>
  new Promise((ok, mal) => {
    const u = new URL(url)
    const clave = randomBytes(16).toString('base64')
    const req = httpRequest({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Key': clave,
        'Sec-WebSocket-Version': '13',
      },
    })
    req.on('upgrade', (res, socket) => {
      const esperado = createHash('sha1')
        .update(clave + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
        .digest('base64')
      if (res.headers['sec-websocket-accept'] !== esperado) {
        socket.destroy()
        return mal(new Error('el servidor no completó el handshake de WebSocket'))
      }
      socket.setNoDelay(true)
      ok(new SocketWeb(socket))
    })
    req.on('response', (res) => mal(new Error(`esperaba un 101 y llegó un ${res.statusCode}`)))
    req.on('error', mal)
    req.end()
  })

// --- Sesión CDP -------------------------------------------------------------

class Sesion {
  constructor(ws) {
    this.ws = ws
    this.n = 0
    this.pendientes = new Map()
    this.oyentes = new Map()
    this.muerta = null
    ws.alMensaje = (texto) => {
      let m
      try {
        m = JSON.parse(texto)
      } catch {
        return
      }
      if (m.id != null && this.pendientes.has(m.id)) {
        const { ok, mal } = this.pendientes.get(m.id)
        this.pendientes.delete(m.id)
        if (m.error) mal(new Error(`${m.error.message} (${m.method ?? 'CDP'})`))
        else ok(m.result)
        return
      }
      if (m.method) for (const cb of this.oyentes.get(m.method) ?? []) cb(m.params)
    }
    ws.alCierre = () => {
      this.muerta = new Error('la conexión con Chrome se cerró')
      for (const { mal } of this.pendientes.values()) mal(this.muerta)
      this.pendientes.clear()
    }
  }

  on(metodo, cb) {
    if (!this.oyentes.has(metodo)) this.oyentes.set(metodo, [])
    this.oyentes.get(metodo).push(cb)
  }

  una(metodo, tope = 30000) {
    return new Promise((ok, mal) => {
      const t = setTimeout(() => mal(new Error(`no llegó ${metodo} en ${tope} ms`)), tope)
      this.on(metodo, (p) => {
        clearTimeout(t)
        ok(p)
      })
    })
  }

  envia(method, params = {}, tope = 60000) {
    if (this.muerta) return Promise.reject(this.muerta)
    const id = ++this.n
    return new Promise((ok, mal) => {
      const t = setTimeout(() => {
        this.pendientes.delete(id)
        mal(new Error(`${method} no contestó en ${tope} ms`))
      }, tope)
      this.pendientes.set(id, {
        ok: (r) => {
          clearTimeout(t)
          ok(r)
        },
        mal: (e) => {
          clearTimeout(t)
          mal(e)
        },
      })
      this.ws.envia(JSON.stringify({ id, method, params }))
    })
  }
}

const json = (puerto, ruta) =>
  new Promise((ok, mal) => {
    httpGet({ hostname: '127.0.0.1', port: puerto, path: ruta }, (res) => {
      let d = ''
      res.on('data', (c) => (d += c))
      res.on('end', () => {
        try {
          ok(JSON.parse(d))
        } catch (e) {
          mal(e)
        }
      })
    }).on('error', mal)
  })

// Arranca Chrome y devuelve `{ sesion, cierra }`. El puerto se pide a 0 y se lee
// del fichero `DevToolsActivePort` que Chrome escribe en su perfil: pedir un
// puerto fijo se choca con otra instancia sin avisar.
export async function abreChrome({ ancho = 1280, alto = 900 } = {}) {
  if (!CHROME) throw new Error('No encuentro Chrome. Indícalo con STARTERSLUG_CHROME=<ruta>.')

  const perfil = mkdtempSync(join(tmpdir(), 'starterslug-cdp-'))
  const chrome = spawn(
    CHROME,
    [
      '--headless=new',
      '--disable-gpu',
      '--hide-scrollbars',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--remote-debugging-port=0',
      `--user-data-dir=${perfil}`,
      `--window-size=${Math.max(ancho, 520)},${alto}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  )

  const fichero = join(perfil, 'DevToolsActivePort')
  let puerto = null
  for (let i = 0; i < 200 && puerto == null; i++) {
    await espera(50)
    if (!existsSync(fichero)) continue
    const lineas = readFileSync(fichero, 'utf8').split('\n')
    if (lineas[0]?.trim()) puerto = Number(lineas[0].trim())
  }
  const limpia = () => {
    try {
      chrome.kill()
    } catch {
      /* ya estaba muerto */
    }
    try {
      rmSync(perfil, { recursive: true, force: true, maxRetries: 5 })
    } catch {
      /* Windows a veces retiene el perfil; no es del caso */
    }
  }
  if (!puerto) {
    limpia()
    throw new Error('Chrome no publicó su puerto de depuración')
  }

  let objetivos = []
  for (let i = 0; i < 40 && !objetivos.length; i++) {
    objetivos = (await json(puerto, '/json/list')).filter((t) => t.type === 'page')
    if (!objetivos.length) await espera(50)
  }
  if (!objetivos.length) {
    limpia()
    throw new Error('Chrome no expone ninguna pestaña')
  }

  const ws = await conecta(objetivos[0].webSocketDebuggerUrl)
  const sesion = new Sesion(ws)

  return {
    sesion,
    cierra: () => {
      ws.cierra()
      limpia()
    },
  }
}
