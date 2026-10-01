// Perfiles de hand-off: cómo se escribe y cómo se reconoce un hook del backend
// en cada motor de plantillas. El activo es `config.repo.handoff`.
// ---------------------------------------------------------------------------
// Sin imports a propósito: este fichero lo leen Storybook (`hooks.js`), Node
// (`scripts/hooks-check.mjs`) y el asistente que generó el repo. Lo que cambia
// de un destino a otro vive AQUÍ y en ningún otro sitio.
//
// Cada perfil trae:
//   var / bucle / si / defecto  ESCRIBEN el hook (nombres con puntos: `item.title`).
//   tokens                      lo RECONOCEN al resolverlo (grupos con nombre).
//   ruta                        de la expresión del motor a `item.title` + su valor por defecto.
//   crudo                       lo que nunca puede llegar al DOM publicado (check:hooks).
//   incluye                     la regex del include de un partial concreto.
//
// `html` no tiene nada de eso: es HTML literal, sin hooks que conservar.

const escapa = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ── familia {{ }} / {% %}: Django, Twig, Liquid, Nunjucks ───────────────────

const rutaLlaves = (expr) => {
  const [base, ...filtros] = expr.split('|')
  const d = filtros.join('|').match(/default\s*(?::|\()\s*["']([^"']*)["']/)
  return { ruta: base.trim(), defecto: d?.[1] }
}

const llaves = ({ defecto }) => ({
  var: (n) => `{{ ${n} }}`,
  bucle: (col, item, cuerpo) => `{% for ${item} in ${col} %}${cuerpo}{% endfor %}`,
  si: (cond, cuerpo, sino) =>
    `{% if ${cond} %}${cuerpo}${sino != null ? `{% else %}${sino}` : ''}{% endif %}`,
  defecto: (n, valor) => `{{ ${n}${defecto(valor)} }}`,
  tokens: {
    bucle: /\{%-?\s*for\s+(?<item>\w+)\s+in\s+(?<col>[\w.]+)[^%]*?-?%\}/g,
    finBucle: /\{%-?\s*endfor\s*-?%\}/g,
    si: /\{%-?\s*if\s+(?<cond>[^%]*?)\s*-?%\}/g,
    sino: /\{%-?\s*else\s*-?%\}/g,
    finSi: /\{%-?\s*endif\s*-?%\}/g,
    var: /\{\{-?\s*(?<expr>[\s\S]*?)\s*-?\}\}/g,
  },
  ruta: rutaLlaves,
  crudo: /\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}/g,
  incluye: (p) =>
    new RegExp(`\\{%-?\\s*(?:include|render)\\s+["']${escapa(p)}["'][\\s\\S]*?%\\}`),
})

// ── familia $: Blade y PHP ──────────────────────────────────────────────────

// `item.title` → `$item->title`
const dolar = (n) => `$${n.split('.').join('->')}`

const rutaDolar = (expr) => {
  const [base, defecto] = expr.split('??').map((s) => s.trim())
  const ruta = base
    .replace(/^\w+\(([\s\S]*)\)$/, '$1') // e($x), esc_html($x)
    .trim()
    .replace(/^\$/, '')
    .replace(/->/g, '.')
    .replace(/\[\s*['"]?(\w+)['"]?\s*\]/g, '.$1')
  return { ruta, defecto: defecto?.replace(/^['"]|['"]$/g, '') }
}

const blade = {
  var: (n) => `{{ ${dolar(n)} }}`,
  bucle: (col, item, cuerpo) => `@foreach (${dolar(col)} as $${item})${cuerpo}@endforeach`,
  si: (cond, cuerpo, sino) =>
    `@if (${dolar(cond)})${cuerpo}${sino != null ? `@else${sino}` : ''}@endif`,
  defecto: (n, valor) => `{{ ${dolar(n)} ?? '${valor}' }}`,
  tokens: {
    bucle: /@foreach\s*\(\s*(?<col>\$[^\s)]+)\s+as\s+\$(?<item>\w+)\s*\)/g,
    finBucle: /@endforeach/g,
    si: /@if\s*\((?<cond>[^()]*(?:\([^()]*\)[^()]*)*)\)/g,
    sino: /@else(?!if)/g,
    finSi: /@endif/g,
    var: /\{\{\s*(?<expr>[\s\S]*?)\s*\}\}/g,
  },
  ruta: rutaDolar,
  crudo:
    /\{\{[\s\S]*?\}\}|\{!![\s\S]*?!!\}|@(?:foreach|endforeach|forelse|endforelse|if|elseif|else|endif|isset|endisset|include|php|endphp)\b/g,
  incluye: (p) => new RegExp(`@include\\s*\\(\\s*['"]${escapa(p)}['"][\\s\\S]*?\\)`),
}

const php = {
  var: (n) => `<?= ${dolar(n)} ?>`,
  bucle: (col, item, cuerpo) =>
    `<?php foreach (${dolar(col)} as $${item}): ?>${cuerpo}<?php endforeach; ?>`,
  si: (cond, cuerpo, sino) =>
    `<?php if (${dolar(cond)}): ?>${cuerpo}${sino != null ? `<?php else: ?>${sino}` : ''}<?php endif; ?>`,
  defecto: (n, valor) => `<?= ${dolar(n)} ?? '${valor}' ?>`,
  tokens: {
    bucle: /<\?php\s+foreach\s*\(\s*(?<col>\$[^\s)]+)\s+as\s+\$(?<item>\w+)\s*\)\s*:\s*\?>/g,
    finBucle: /<\?php\s+endforeach\s*;?\s*\?>/g,
    si: /<\?php\s+if\s*\((?<cond>[\s\S]*?)\)\s*:\s*\?>/g,
    sino: /<\?php\s+else\s*:\s*\?>/g,
    finSi: /<\?php\s+endif\s*;?\s*\?>/g,
    var: /<\?=\s*(?<expr>[\s\S]*?)\s*;?\s*\?>/g,
  },
  ruta: rutaDolar,
  // Metido por `innerHTML`, el navegador convierte `<?php … ?>` en un comentario
  // `<!--?php … ?-->`: en el DOM se busca de las dos formas.
  crudo: /<\?[\s\S]*?\?>|<!--\?[\s\S]*?-->/g,
  incluye: (p) =>
    new RegExp(
      `<\\?php\\s+(?:include|require|get_template_part)\\b[^?]*${escapa(p)}[\\s\\S]*?\\?>`
    ),
}

// ── Handlebars / Mustache ───────────────────────────────────────────────────

const handlebars = {
  var: (n) => `{{${n}}}`,
  bucle: (col, item, cuerpo) => `{{#each ${col} as |${item}|}}${cuerpo}{{/each}}`,
  si: (cond, cuerpo, sino) =>
    `{{#if ${cond}}}${cuerpo}${sino != null ? `{{else}}${sino}` : ''}{{/if}}`,
  defecto: (n, valor) => `{{#if ${n}}}{{${n}}}{{else}}${valor}{{/if}}`,
  tokens: {
    bucle: /\{\{#each\s+(?<col>[\w.@/]+)(?:\s+as\s+\|\s*(?<item>\w+)[^|]*\|)?\s*\}\}/g,
    finBucle: /\{\{\/each\s*\}\}/g,
    si: /\{\{#if\s+(?<cond>[^}]+?)\s*\}\}/g,
    sino: /\{\{else\s*\}\}/g,
    finSi: /\{\{\/if\s*\}\}/g,
    var: /\{\{\{?\s*(?<expr>[\w.@/]+)\s*\}?\}\}/g,
  },
  ruta: (expr) => ({ ruta: expr.trim() }),
  crudo: /\{\{[\s\S]*?\}\}/g,
  incluye: (p) => new RegExp(`\\{\\{>\\s*["']?${escapa(p)}["']?[\\s\\S]*?\\}\\}`),
}

// ── la tabla ────────────────────────────────────────────────────────────────

export const PERFILES = {
  django: {
    label: 'Django',
    quien: 'Django, Flask/Jinja2, Pelican',
    ...llaves({ defecto: (v) => `|default:"${v}"` }),
  },
  twig: {
    label: 'Twig',
    quien: 'Symfony, Drupal, Craft',
    ...llaves({ defecto: (v) => `|default('${v}')` }),
  },
  liquid: {
    label: 'Liquid',
    quien: 'Shopify, Jekyll',
    ...llaves({ defecto: (v) => ` | default: "${v}"` }),
  },
  nunjucks: {
    label: 'Nunjucks',
    quien: 'Eleventy',
    ...llaves({ defecto: (v) => `|default('${v}')` }),
  },
  blade: { label: 'Blade', quien: 'Laravel', ...blade },
  handlebars: { label: 'Handlebars', quien: 'Mustache, Ghost', ...handlebars },
  php: { label: 'PHP', quien: 'WordPress a pelo', ...php },
  html: {
    label: 'HTML estático',
    quien: 'sitios estáticos o HTML que se pega en un CMS sin plantillas',
    sinHooks: true,
  },
}

export const PERFIL_POR_DEFECTO = 'django'

// La clave de un perfil, venga como venga: `Django` → `django`; lo desconocido, al de por defecto.
export const clavePerfil = (x) => {
  const k = String(x ?? '')
    .trim()
    .toLowerCase()
  return PERFILES[k] ? k : PERFIL_POR_DEFECTO
}

// Una línea legible de la sintaxis: `{{ x }} · {% for i in xs %}…{% endfor %} · …`.
export const sintaxisDe = (clave) => {
  const p = PERFILES[clave]
  if (p.sinHooks) return 'sin hooks: el texto va literal'
  return [p.var('x'), p.bucle('xs', 'i', '…'), p.si('c', '…')].join(' · ')
}
