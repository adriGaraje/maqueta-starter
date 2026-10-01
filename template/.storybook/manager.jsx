import React, { useState, useEffect } from 'react'
import { addons, types, useChannel, useParameter, useStorybookApi } from 'storybook/manager-api'
import { AddonPanel, SyntaxHighlighter } from 'storybook/internal/components'
import { create } from 'storybook/theming/create'
import { limpiaFuente } from './limpia-fuente.js'

// ── estado de entrega en la barra lateral ───────────────────────────────────
//
// Cada pieza lleva delante una marca que dice cómo llega a esta entrega: nueva,
// modificada o sin tocar desde la anterior; y si sigue en curso. La leyenda se
// explica en «Release Notes».
//
// EL ESTADO NO VA EN EL TÍTULO DE LA STORY, y es deliberado. El título es el
// nombre del fichero en Title Case (regla 4 del CLAUDE.md) y de él sale el `id`
// con el que se construyen las URL: meterle un icono cambiaría el enlace de cada
// pieza en cada entrega, rompería los que ya están repartidos y obligaría a tocar
// 32 ficheros por release. Aquí se PINTA, que es un problema de presentación.
//
// El dato viene inline desde `main.js` (`window.STARTERSLUG_ESTADO`) y no por fetch:
// `renderLabel` es síncrono y se llama al pintar cada fila.
const ESTADO = typeof window !== 'undefined' ? window.STARTERSLUG_ESTADO : null

// EL RÓTULO «EN CURSO» NO VIAJA A PRO. Esa marca es
// para nosotros —local y pre—, no para quien recibe la entrega.
// ---------------------------------------------------------------------------
// Se apaga el RÓTULO, no el dato: `estado.json` sigue trayendo `enCurso` porque
// Release Notes cuenta las piezas en curso, y vaciarlo le haría decir «nada en
// curso», que es falso. Aquí solo se decide qué se pinta.
// ---------------------------------------------------------------------------
// El destino lo inyecta `main.js` desde la variable que pone `deploy.mjs`. En
// local está vacío, así que el rótulo se ve — que es donde se trabaja.
const A_PRO = typeof window !== 'undefined' && window.STARTERSLUG_DESTINO === 'entrega'

const POR_ID = new Map((ESTADO?.piezas ?? []).map((p) => [p.id, p]))

// «Nueva» va en sólido y «modificada» en suave, y no es capricho: en esta entrega
// hay 6 nuevas y 14 modificadas. Si las veinte pesaran igual, la barra lateral se
// convierte en una fila de puntos y deja de destacar nada. Lo excepcional se ve
// primero; lo frecuente acompaña.
const MARCAS = {
  nuevo: {
    color: '#fff',
    fondo: '#00805a',
    signo: '+',
    que: 'Nueva en esta entrega',
  },
  modificado: {
    color: '#0050ff',
    fondo: '#dbe6ff',
    signo: '~',
    que: 'Modificada desde la entrega anterior',
  },
}

// Punto de color con el signo dentro. Lleva signo y no solo color porque el color
// solo no es accesible, y no lleva emoji porque cambian de forma entre Windows y
// Mac — esto lo lee el cliente en su equipo, no en el nuestro.
const Marca = ({ tipo }) => {
  const m = MARCAS[tipo]
  return (
    <span
      title={m.que}
      aria-label={m.que}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 15,
        height: 15,
        marginRight: 7,
        borderRadius: '50%',
        background: m.fondo,
        color: m.color,
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1,
        flex: '0 0 auto',
      }}
    >
      {m.signo}
    </span>
  )
}

const EnCurso = () => (
  <span
    title="En curso — se está trabajando para la siguiente entrega"
    style={{
      marginLeft: 6,
      padding: '1px 5px',
      borderRadius: 4,
      background: '#fbf4d0',
      color: '#7d6a00',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
      flex: '0 0 auto',
    }}
  >
    EN CURSO
  </span>
)

// Se marca el nodo de la PIEZA (el plegable), no cada una de sus stories: el
// estado es de la pieza entera y repetirlo en cada variante sería ruido.
const renderLabel = (item) => {
  const info = item.type === 'component' || item.type === 'docs' ? POR_ID.get(item.id) : null

  const enCursoVisible = info?.enCurso && !A_PRO
  if (!info || (info.cambio !== 'nuevo' && info.cambio !== 'modificado' && !enCursoVisible)) {
    return item.name
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
      {MARCAS[info.cambio] ? <Marca tipo={info.cambio} /> : null}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</span>
      {info.enCurso && !A_PRO ? <EnCurso /> : null}
    </span>
  )
}

addons.setConfig({
  theme: create({
    base: 'light',
    // Sin «WIP»: esto se lee en la barra lateral del sitio que recibe el cliente.
    brandTitle: 'STARTERNOMBRE',
    brandUrl: './',
  }),
  sidebar: {
    renderLabel,
    // Plegadas en la ENTREGA, abiertas en local. Las calcula `main.js` a partir de
    // los títulos, así que una sección nueva entra sola. En local llega vacío.
    //
    // Es solo el estado INICIAL: Storybook recuerda lo que abre cada persona, así
    // que quien despliegue una sección la encuentra abierta la próxima vez.
    collapsedRoots: typeof window !== 'undefined' ? (window.STARTERSLUG_RAICES_PLEGADAS ?? []) : [],
  },
})

const SNIPPET_RENDERED = 'storybook/docs/snippet-rendered'

const aviso = { padding: 15, color: '#73737d', lineHeight: 1.5 }

// ── Code · el marcado ───────────────────────────────────────────────────────

// El nombre de la pieza sale del fichero de la story. Lo usan los tres paneles.
const piezaDe = (importPath, override) => {
  if (override) return override
  const m = /([^/\\]+)\.stories\.[jt]sx?$/.exec(importPath ?? '')
  return m ? m[1] : null
}

// Una landing NO enseña aquí su marcado suelto: enseña el ENTREGABLE entero, del
// `<!DOCTYPE html>` al `</html>`, con su CSS dentro. Es lo que se le pasa al
// equipo de contribución de Django, y lo que abre esta pestaña viene a copiarlo.
// El resto de piezas —componentes, snippets, páginas— no cambian.
// ---------------------------------------------------------------------------
// Se sirve de `public/entrega/landings/<slug>.html`, que escribe
// `scripts/build-landing.mjs` a la vez que el entregable de verdad y copiando el
// MISMO fichero. Dos fuentes acabarían enseñando cosas distintas.
const esLanding = (datos) => Boolean(datos?.importPath?.includes('/landings/'))

const CodePanel = ({ active }) => {
  const api = useStorybookApi()
  const datos = api.getCurrentStoryData()
  const landing = esLanding(datos) ? piezaDe(datos?.importPath) : null

  const [code, setCode] = useState('')
  const [entregable, setEntregable] = useState({ cargando: false })

  // El filtro va aquí, en el último paso antes de que se vea, y no solo en
  // `docs.source.transform`: este panel lee el evento del canal directamente, así
  // que es el único sitio que garantiza que lo que se copia está limpio.
  useChannel({ [SNIPPET_RENDERED]: ({ source }) => setCode(limpiaFuente(source)) })

  useEffect(() => {
    if (!landing) {
      setEntregable({ cargando: false })
      return
    }

    let vigente = true
    setEntregable({ cargando: true })

    fetch(`./entrega/landings/${landing}.html`)
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null)
      .then((texto) => {
        // El truco de `FicheroPanel` —«si empieza por `<`, es el index.html de
        // Storybook»— aquí no vale: el entregable TAMBIÉN es HTML.
        //   ---
        // LO QUE LO DISTINGUE ES EL `<!DOCTYPE`, y no lo que se miraba antes. Antes
        // era la marca `INICIO SNIPPET`, que el empaquetador escribía como
        // comentario; desde el 14-09 el entregable no lleva NI UN comentario
        //, así que esa señal desapareció. El `<!DOCTYPE` sirve
        // igual y es más difícil de perder: el marcado de una story es un fragmento
        // y no lo tiene nunca, y un `index.html` de Storybook que se colara por un
        // 404 mal servido tampoco pasa este filtro, porque antes hay que acertar la
        // ruta de la landing.
        const hay = texto?.trimStart().startsWith('<!DOCTYPE')
        if (vigente) setEntregable({ cargando: false, codigo: hay ? texto : null })
      })

    return () => {
      vigente = false
    }
  }, [landing])

  // El entregable NO pasa por `limpiaFuente`, y ya no hace falta que pase: desde
  // el 14-09 sale sin un solo comentario del empaquetador.
  const fuente = entregable.codigo ?? code
  const esEntregable = Boolean(entregable.codigo)

  return (
    <AddonPanel active={active}>
      {landing && entregable.cargando ? (
        <div style={aviso}>Cargando el entregable…</div>
      ) : fuente ? (
        <>
          {landing && !esEntregable ? (
            <div style={aviso}>
              Esto es el marcado de la story, <strong>no el entregable</strong>: todavía no se ha
              empaquetado. Genéralo con <code>npm run build:landing {landing}</code>.
            </div>
          ) : null}
          <SyntaxHighlighter language="html" copyable padded wrapLongLines={esEntregable}>
            {fuente}
          </SyntaxHighlighter>
        </>
      ) : (
        <div style={aviso}>Esta story no expone código.</div>
      )}
    </AddonPanel>
  )
}

// ── CSS y JS · los ficheros de entrega ──────────────────────────────────────
//
// Se sirven de `public/entrega/snippets/<pieza>.<ext>`, que genera
// `scripts/build-entrega.mjs` antes de cada `storybook`. Se leen de ahí y no de
// una copia: es EXACTAMENTE el fichero que se entrega, con el CSS ya resuelto y
// arrastrando el de las piezas que compone (el `.btn-pill` del footer, la
// promo-card de Promos). Si fuesen dos fuentes, en dos semanas enseñarían cosas
// distintas y nadie sabría cuál vale.
//
// Se regenera al arrancar, así que tocar un SCSS no se refleja hasta reiniciar.
// Decidido así a propósito: simple, y el fichero es el de la entrega.

// La pieza sale del propio fichero de la story —`hero.stories.js` → `hero`—, que
// es el mismo nombre del que salen los ficheros de entrega, porque los dos vienen
// de la carpeta del componente. Así no hay una lista que mantener.
// `parameters.starterslug.snippet` está para las excepciones: piezas cuya story no se
// llama como su CSS (la línea y el precio de tarifa se pintan con `tariff-card`).
const FicheroPanel = ({ active, ext, lenguaje, queEs }) => {
  const api = useStorybookApi()
  const { snippet } = useParameter('starterslug', {})
  const pieza = piezaDe(api.getCurrentStoryData()?.importPath, snippet)

  const [estado, setEstado] = useState({ cargando: true })

  useEffect(() => {
    if (!pieza) {
      setEstado({ cargando: false })
      return
    }

    let vigente = true
    setEstado({ cargando: true })

    fetch(`./entrega/snippets/${pieza}.${ext}`)
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null)
      .then((texto) => {
        // Storybook devuelve el index.html con 200 para lo que no existe, así que
        // «ha contestado» no basta: si viene HTML, es que no hay fichero.
        const hay = texto && !texto.trimStart().startsWith('<')
        if (vigente) setEstado({ cargando: false, codigo: hay ? texto.trim() : null })
      })

    return () => {
      vigente = false
    }
  }, [pieza, ext])

  return (
    <AddonPanel active={active}>
      {estado.cargando ? (
        <div style={aviso}>Cargando…</div>
      ) : estado.codigo ? (
        // `wrapLongLines` porque estos dos ficheros van comprimidos: sin él, el
        // CSS es una sola línea de miles de caracteres que se sale por la derecha.
        // Se envuelve al pintarlo; el fichero que se copia no se toca.
        <SyntaxHighlighter language={lenguaje} copyable padded wrapLongLines>
          {estado.codigo}
        </SyntaxHighlighter>
      ) : (
        <div style={aviso}>
          Esta pieza no tiene {queEs} propio.
          {ext === 'js' &&
            ' Su comportamiento sale de Bootstrap, que ya va en starterslug-global.js.'}
        </div>
      )}
    </AddonPanel>
  )
}

// ── registro ────────────────────────────────────────────────────────────────
//
// En el orden en que se usan: se prepara el contenido en Controls, se copia el
// marcado de Code, y CSS y JS quedan al lado — sin tener que ir a Docs a por ellos.

const soloStory = ({ viewMode }) => viewMode === 'story'

addons.register('starterslug/paneles', () => {
  addons.add('starterslug/code-panel', {
    type: types.PANEL,
    title: 'Code',
    match: soloStory,
    render: ({ active }) => <CodePanel active={active} />,
  })

  addons.add('starterslug/css-panel', {
    type: types.PANEL,
    title: 'CSS',
    match: soloStory,
    render: ({ active }) => <FicheroPanel active={active} ext="css" lenguaje="css" queEs="CSS" />,
  })

  addons.add('starterslug/js-panel', {
    type: types.PANEL,
    title: 'JS',
    match: soloStory,
    render: ({ active }) => (
      <FicheroPanel active={active} ext="js" lenguaje="javascript" queEs="JS" />
    ),
  })
})
