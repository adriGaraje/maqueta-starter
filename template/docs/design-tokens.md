# Design tokens — Figma → SCSS

> **Figma es la fuente de verdad** de color y tipografía. Este doc dice dónde vive cada token
> en el repo y cómo se comprueba que no se ha desviado del archivo.

## Dónde está cada cosa

| Fichero                                            | Qué contiene                                                                                           |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/styles/settings/_tokens.scss`                 | **Capa RAW** — un `$color-*` / `$gradient-*` por cada style de Figma, con `// Figma: <Grupo>/<Nombre>` |
| `src/styles/settings/_colors.scss`                 | **Capa SEMÁNTICA** — alias de uso diario (`$brand-primary`, `$brand-ink`…) sobre los raw               |
| `src/styles/settings/_bootstrap.scss`              | los alias mapeados a Bootstrap (`$primary`, `$secondary`…)                                             |
| `src/styles/settings/_typography.scss`             | `$type-scale`: una entrada por style de texto, con `// Figma <Style> · size/line-height`               |
| `docs/starterslug-harness/figma-tokens.snapshot.json` | la última foto de Figma, para ver qué ha cambiado                                                      |

## Modelo de dos capas

```
Figma styles ──► _tokens.scss (raw) ──► _colors.scss (alias) ──► _bootstrap.scss ──► componentes
```

- **Usa el alias semántico** para el día a día. El raw solo para un color que no tiene alias.
- **No edites valores a ojo ni desde capturas.** Si Figma cambia, se regeneran con el chequeo.
- Tipografía: `@include text-style('h1')`. Las claves de móvil son aparte (`mobile-h1`…), no
  una escala responsive: se nombra solo lo que Figma define.

## El chequeo (en el arranque)

1. **Vuelca los styles frescos por MCP.** Por cada nodo de `config.json → figma.files.<fichero>.nodos`,
   `get_variable_defs` con el `fileKey` del archivo marcado `scanned: true`, fundido en un JSON plano
   (`{ "Primarios/Principal": "#0D6EFD", "Desktop/H1": "Font(…)" }`). No uses `use_figma`: lee del
   archivo abierto en el escritorio, no del de la config.
2. **Compara:** `npm run tokens:diff -- <fresh.json>`

   | Exit | Qué significa                            | Qué haces                               |
   | ---- | ---------------------------------------- | --------------------------------------- |
   | 0    | Alineado                                 | una línea en el parte                   |
   | 1    | Valores que no coinciden                 | alínealos (paso 3)                      |
   | 3    | Figma tiene styles que el repo no adopta | **pregunta**, no lo metas por tu cuenta |
   | 2    | Falta el vuelco                          | error de uso                            |

3. **Si exit 1:** actualiza los tokens afectados cuidando su comentario `// Figma …` (el script lo
   parsea), regenera el snapshot con `--write-snapshot` y déjalo en la rama de la tarea.
4. **Avisa** en el parte y en el PR: style, valor antes → después, y qué componentes lo usan.

### Lo que este chequeo NO puede decirte

El barrido va nodo a nodo: prueba presencia, no ausencia. Un style que no aparece puede ser que
ningún nodo barrido lo use, así que el script nunca reporta bajas y lista aparte los «sin
comprobar». Apunta a instancias o frames de página, no a sets de componente: los sets se mueven
cuando diseño reordena, y un nodo que ya no existe puede seguir contestando 200 por REST.
