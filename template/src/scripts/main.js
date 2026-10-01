// Entrada de la maqueta. Dos bloques, y la separación importa: es la misma que
// se entrega. Lo global va una vez en la plantilla base; lo de cada pieza viaja
// con su snippet.

// --- GLOBAL — una sola vez en el sitio ---
import '../styles/main.scss'
import './globals.js'

// --- POR PIEZA — solo si el snippet está en la página ---
// Un import por pieza con JS propio (../components/<name>/<name>.js). build-entrega
// lee este bloque para emitir el JS de cada snippet.
