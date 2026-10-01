// Las dos piezas que arman la ficha de un snippet:
//
//   <CodeTabs>   HTML · CSS · JS en pestañas, en vez de tres bloques apilados.
//   <Variables>  la tabla de hooks Django, DEDUCIDA del comentario del partial.
//
// Lo de deducirla no es un truco: es lo que evita que se desalineen. El mapeo
// «{{ hero.title }} → titular» vive en el comentario de cabecera del HTML, que es
// donde lo escribe quien maqueta. Ese comentario no se publica —lo filtra
// `snippet-code.js`— pero de él sale la tabla que sí se publica. Un hook nuevo
// aparece en la tabla solo, y uno que se va, desaparece.
//
// Todo el estilo va EN LÍNEA a propósito. Esta ficha se pinta dentro de la página
// de Docs, que carga `main.scss` entero: cualquier clase que inventemos aquí puede
// chocar con una del design system. Ya pasó con `.tag` (L-014).

import React, { useState } from 'react'
import { Source } from '@storybook/addon-docs/blocks'
import { limpia } from './snippet-code.js'

const AZUL = '#0050FF'
const BORDE = 'rgba(128,128,150,.28)'

const barra = {
  display: 'flex',
  gap: 4,
  borderBottom: `1px solid ${BORDE}`,
  margin: '0 0 -1px',
  padding: 0,
}

const pestana = (activa) => ({
  appearance: 'none',
  background: 'none',
  border: 0,
  borderBottom: `2px solid ${activa ? AZUL : 'transparent'}`,
  color: activa ? AZUL : 'inherit',
  opacity: activa ? 1 : 0.65,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: '.04em',
  padding: '8px 14px',
})

export const CodeTabs = ({ html, css, js }) => {
  const paneles = [
    html && { id: 'HTML', lang: 'html', code: limpia(html, 'html') },
    // Se limpia como SCSS aunque se pinte como CSS: el bloque puede venir de un
    // `.scss` (parallax) y esos llevan comentarios `//` que `css` no quitaría.
    // CSS y JS van envueltos en sus etiquetas y pintados como HTML, no como
    // `css` / `js`: lo que se copia va a un Snippet del CMS, que es MARCADO.
    // Sin las etiquetas, quien lo pega tiene que acordarse de ponerlas — y si se
    // le olvida no salta ningún error: el CSS y el JS aparecen como texto en
    // medio de la página. Es un fallo mudo, y de los caros.
    // Se limpia ANTES de envolver, para que el filtro no vea las etiquetas.
    css && { id: 'CSS', lang: 'html', code: `<style>\n${limpia(css, 'scss')}\n<\/style>` },
    js && { id: 'JS', lang: 'html', code: `<script>\n${limpia(js, 'js')}\n<\/script>` },
  ].filter(Boolean)

  const [activa, setActiva] = useState(paneles[0]?.id)
  const actual = paneles.find((p) => p.id === activa) ?? paneles[0]

  if (!actual) return null

  return (
    <div>
      <div style={barra} role="tablist" aria-label="Código del snippet">
        {paneles.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === actual.id}
            style={pestana(p.id === actual.id)}
            onClick={() => setActiva(p.id)}
          >
            {p.id}
          </button>
        ))}
      </div>

      <Source code={actual.code} language={actual.lang} />
    </div>
  )
}

// ── La tabla de variables ───────────────────────────────────────────────────
// Del comentario de cabecera se sacan las líneas con forma `{{ algo }} → qué es`.

const FILA = /^\s*(\{[{%][\s\S]*?)\s+→\s+(.+?)\s*$/

const filasDe = (html) => {
  const comentario = html.match(/<!--([\s\S]*?)-->/)
  if (!comentario) return []

  return comentario[1]
    .split('\n')
    .map((linea) => linea.match(FILA))
    .filter(Boolean)
    .map((m) => ({ hook: m[1].trim(), significa: m[2].trim() }))
}

const celda = {
  borderBottom: `1px solid ${BORDE}`,
  padding: '8px 12px',
  textAlign: 'left',
  verticalAlign: 'top',
}

export const Variables = ({ html }) => {
  const filas = filasDe(html)
  if (!filas.length) return null

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14 }}>
        <thead>
          <tr>
            <th style={{ ...celda, whiteSpace: 'nowrap', opacity: 0.7 }}>Variable</th>
            <th style={{ ...celda, opacity: 0.7 }}>Qué lleva</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.hook}>
              <td style={{ ...celda, whiteSpace: 'nowrap' }}>
                <code>{f.hook}</code>
              </td>
              <td style={celda}>{f.significa}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
