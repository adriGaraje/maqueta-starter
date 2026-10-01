// Alias de compatibilidad: el helper de hooks es `hooks.js`, que habla la sintaxis
// del perfil de hand-off (`config.repo.handoff`), Django o cualquier otra.
// Esto se queda para que los pintores que importan de aquí sigan funcionando;
// lo nuevo, de `hooks.js`.
import { bloqueFor } from './hooks.js'

export {
  sinComentarios,
  mete,
  incluye,
  condicionalesDe,
  resuelveOpcionales,
  exigeResuelto,
} from './hooks.js'

// La firma de antes: `bucle(html, 'x in y', items, pintaItem)`. En `hooks.js`,
// `bucle` ESCRIBE un bucle; resolverlo es `bloqueFor`.
export const bucle = (html, declaracion, items, pintaItem) =>
  bloqueFor(html, declaracion.split(/\s+in\s+/)[1].trim(), items, pintaItem)
