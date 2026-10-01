# Styling — ITCSS + Bootstrap 4.1.3

> Bootstrap primero; CSS propio solo cuando Bootstrap no llega. Tokens: [`design-tokens.md`](design-tokens.md).

## ITCSS layers

```
src/styles/
├── settings/
│   ├── _tokens.scss     # raw: un token por style de Figma
│   ├── _colors.scss     # alias semánticos ($brand-primary/ink/surface)
│   ├── _typography.scss # $type-scale y familia
│   └── _bootstrap.scss  # marca → variables de Bootstrap ($primary/$secondary…)
├── tools/_mixins.scss   # wrap, text-style (sin salida CSS)
├── generic/             # @font-face y resets sobre Reboot
├── elements/            # elementos HTML sin clase
├── components/_index.scss # registra el SCSS de cada pieza (append-only)
├── trumps/_utilities.scss # utilidades; ganan al final
└── main.scss            # orquesta el orden
```

`main.scss` importa `bootstrap/scss/functions`, los settings, los tools, **Bootstrap entero** y
después generic → elements → components → trumps. Todo lo anterior a Bootstrap emite cero CSS.

## ¿Qué capa toco?

| Quiero…                               | Capa                                                     |
| ------------------------------------- | -------------------------------------------------------- |
| cambiar un color o un tamaño de marca | `settings/` (y solo si Figma cambió)                     |
| un mixin o función                    | `tools/`                                                 |
| estilar una pieza                     | su `<name>.scss`, registrado en `components/_index.scss` |
| una utilidad que Bootstrap 4 no trae  | `trumps/`                                                |

## Cómo se estila

1. Marcado con clases de Bootstrap (rejilla, espaciado, display, flex).
2. Si hace falta más, `<name>.scss` junto a la pieza, leyendo solo de `settings/`, `tools/` y
   Bootstrap (nunca variables de otra pieza).
3. Responsive con `@include media-breakpoint-up(md)`; los cortes de un mismo eje tienen que casar
   (`up(lg)` con `down(md)`).
4. Un snippet lleva su propio envoltorio (`@include wrap`): se pega sin `<div>` alrededor.

## Naming — BEM (la regla de las clases propias)

`.block__element--modifier`, en kebab-case. Stylelint lo exige (`selector-class-pattern`).

- **Block** = la pieza (`.card`). **Element** = una parte que no existe fuera del bloque
  (`.card__title`). **Modifier** = una variante (`.card--compact`).
- No anides elementos en el nombre (`.card__body__title` ✖ → `.card__title` ✔).
- Las clases de Bootstrap conviven en el marcado; las propias no imitan su nombre.
- Un enlace propio repite `color` y `text-decoration` en su `:hover`: el `a:hover` de Bootstrap pisa.

## JS

Vanilla, sin frameworks. El JS de cada pieza se declara en `src/scripts/main.js` bajo «POR PIEZA»;
lo que necesita cualquier página va en `globals.js`.
