# Mantener la plantilla

`template/` no se edita a mano: es la salida del exportador del harness, con **marcadores** en
lugar del proyecto. El starter los sustituye al generar.

| Marcador                          | Se convierte en                                             |
| --------------------------------- | ----------------------------------------------------------- |
| `starterslug`                     | el slug (`acme-web`); pegado a un identificador JS, con `_` |
| `STARTERSLUG_`                    | prefijo de entorno (`ACME_WEB_`)                            |
| `STARTERSLUG`                     | la clave de Jira si la hay; si no, el slug en mayúsculas    |
| `Starterslug`                     | el slug en PascalCase (`AcmeWeb`)                           |
| `Starternombre` / `STARTERNOMBRE` | el nombre del proyecto                                      |

Valen también en nombres de fichero y carpeta (`.claude/skills/starterslug-flow/`…).

## Regenerarla

Desde el repo que tiene el harness vivo y su exportador:

```sh
rm -rf <aquí>/template
npm run harness:export -- <aquí>/template --slug starterslug --name Starternombre --with figma,jira,entrega,django,auth
```

Siempre con **los cinco grupos**: el starter quita los que no se eligen, no los añade.

## Qué comprobar después

1. **Fugas.** Nada del proyecto de origen: `grep -rniI "<cliente>\|<agencia>\|<nombres del equipo>" template`.
   Ojo con los identificadores con el nombre del origen (una vez fue un `id="<origen>-out"`).
2. **Los dos arreglos que el exportador aún no trae**, si siguen faltando:
   - `scripts/deploy.mjs` lee rama → target de `config.deploy.targets` (antes iba fijo a develop/main).
   - El final de `README.md` es una sección `## Grupos` con un `- \`grupo\` — …` por grupo: el
     generador borra las líneas de los grupos que no viajan.
3. **Las claves que rellena el generador** siguen donde las busca (`scripts/generar.mjs`, paso 2):
   `config.json`, `auth/auth-config.js` (`brand`, `subtitle`, `poweredBy`, `accent`, `ink`,
   `surface`), `auth/firebase-config.js`, `const FIGMA = 'TODO'` en `jira-mirror.mjs`, y la línea
   «Generada con `npm run harness:export …`» del README.
4. **Grupos nuevos o ficheros movidos**: actualiza `FICHEROS` y `SCRIPTS` en `scripts/generar.mjs`.
5. **La prueba completa**, que es la que vale:
   ```sh
   npm run generar -- --respuestas respuestas.ejemplo.json   # con destino nuevo
   ```
   Tiene que acabar en `ok`, con `storybook-static/guard.js` y `login/`, `check:stories` verde, y
   en el destino `npm run format:check`, `lint:css` y `build` en verde. Repite con solo `base`.
