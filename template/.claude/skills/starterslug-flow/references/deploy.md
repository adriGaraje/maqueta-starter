# Deploy a Firebase (parte del pipeline)

El Storybook publicado **es el entregable**: lo que se ve en el target de entrega es lo que recibe
el cliente. Config en `config.deploy` y en `firebase.json` / `.firebaserc`.

> **Importante:** el deploy lo dispara el harness **localmente**, NO por CI — GitHub Actions está
> capado org-wide por IT (ver `lecciones.md`). Requiere una sesión de `firebase-tools`
> autenticada en la máquina.

## Los sitios

- **Proyecto Firebase:** `config.deploy.firebaseProject`.
- **Targets:** `config.deploy.targets` — cada uno con su `site`, `url` y la `rama` que lo publica.
  El de verificación sale de `config.git.integrationBranch`; el de entrega, de
  `config.git.releaseBranch`, y es lo único que ve el cliente.
- **Pasos:**
  ```bash
  git checkout <rama del target> && git pull origin <rama del target>   # el sitio refleja tu carpeta
  npm run deploy                                                        # la rama decide el target
  ```
  Desde cualquier otra rama aborta. `npm run deploy:pre` publica la rama actual en el target de
  verificación, nunca en el de entrega.
- Si `firebase-tools` pide login, el humano debe autenticarse (`npx firebase-tools login`) — es
  interactivo; no lo fuerces desde el agente, pídeselo.

**Qué sale publicado:** lo que decide la etiqueta de cada story. Si a una story le falta la
etiqueta, la build **falla** con su nombre — es el guardarraíl que evita que se cuele algo sin
estado en lo que ve el cliente. No lo esquives etiquetando a lo loco: `production` significa
**tarea entregada**.

> `config.deploy.sitioRetirado` sigue en pie con su última build para no romper enlaces. No lo
> redespliegues.

## Cuándo desplegar (en el flujo starterslug-flow)

1. **Tras cerrar un módulo** (Paso 7 del pipeline): ofrece desplegar para que la pieza recién
   aprobada llegue al entregable. Si la story no está en `production`, **no sale como
   terminada** — dilo, no dejes que parezca que sí.
2. **A demanda**: cuando el humano pida "deploy" o "publica el storybook".
3. Confirma **siempre** antes de desplegar (es una acción hacia fuera) y **verifica green** antes
   (`config.repo.greenGates`), no publiques roto.

Tras el deploy, deja constancia en `hitos.md` (fecha + qué se publicó + URL).

## Una versión congelada, si la piden

No hay un sitio más allá de los targets, a propósito: uno que nadie mira se queda viejo sin
avisar. Si el cliente pide una versión sellada de una fecha, se monta desde
`config.git.releaseBranch`; los pasos están en `config.docs.deployFirebase`.
