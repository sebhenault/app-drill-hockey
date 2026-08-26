/**
 * Rendu d'une séquence en SVG.
 * Une seule fonction sert aux miniatures, à la fiche, à l'aperçu, à
 * l'impression et aux exports PNG/SVG — ce qui garantit qu'ils sont identiques.
 */

import { rinkMarkup, surfaceViewBox, gridMarkup } from './rink.js';
import { drawElement, legendFor } from './symbols.js';
import { esc } from './util.js';

/** Couleurs figées, pour l'export hors du document (pas de variables CSS). */
const INK = {
  '--ice': '#f4f9fd',
  '--ice-line-blue': '#1f5fd0',
  '--ice-line-red': '#d2262c',
  '--ice-crease': '#cfe4fb',
  '--ice-board': '#93a4b4',
  '--ff': 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
};

/** Remplace les var(--x) par des valeurs littérales pour un SVG autonome. */
export function inlineVars(markup) {
  return markup.replace(/var\((--[a-z-]+)\)/g, (m, name) => INK[name] || 'currentColor');
}

let clipSeq = 0;

/**
 * Contenu interne du SVG (sans la balise <svg>).
 *
 * Le contenu est découpé à la fenêtre de la surface choisie : quand on demande
 * « zone défensive », on ne doit pas voir la zone neutre déborder sur les côtés
 * parce que le conteneur est plus large que la fenêtre.
 *
 * @param {object} opts { surface, elements, grid, reveal:Map(idTracé→0..1), extra }
 */
export function sceneMarkup({ surface = 'full', elements = [], grid = false, reveal = null, extra = '' }) {
  const vb = surfaceViewBox(surface);
  let s = rinkMarkup(surface);
  if (grid) s += gridMarkup(vb);
  const sorted = [...elements].sort((a, b) => (a.z || 0) - (b.z || 0));
  for (const el of sorted) {
    const r = reveal && el.kind === 'path' && reveal.has(el.id) ? reveal.get(el.id) : 1;
    if (r <= 0) continue;
    s += `<g data-id="${esc(el.id)}">${drawElement(el, { reveal: r })}</g>`;
  }
  const id = `dbclip${++clipSeq}`;
  return `<defs><clipPath id="${id}"><rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}"/></clipPath></defs>
    <g clip-path="url(#${id})">${s}</g>${extra}`;
}

/** SVG complet et autonome (utilisable en fichier, en <img>, en impression). */
export function standaloneSvg({ surface = 'full', elements = [], width = 1200, title = '', grid = false }) {
  const vb = surfaceViewBox(surface);
  const h = Math.round(width * (vb[3] / vb[2]));
  const body = inlineVars(sceneMarkup({ surface, elements, grid }));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}"
  viewBox="${vb.join(' ')}" role="img" aria-label="${esc(title || 'Diagramme d’exercice')}">
  <title>${esc(title || 'Diagramme d’exercice')}</title>
  <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="${INK['--ice']}"/>
  ${body}
</svg>`;
}

/** Miniature légère pour les cartes de la bibliothèque. */
export function thumbSvg(drill) {
  const s0 = (drill.sequences && drill.sequences[0]) || { elements: [] };
  const vb = surfaceViewBox(drill.surface);
  return `<svg viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
    <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="var(--ice)"/>
    ${sceneMarkup({ surface: drill.surface, elements: s0.elements })}
  </svg>`;
}

/** SVG d'une séquence, dimensionné en largeur, pour la fiche. */
export function sequenceSvg(drill, seqIndex = 0) {
  const s0 = (drill.sequences && drill.sequences[seqIndex]) || { elements: [] };
  const vb = surfaceViewBox(drill.surface);
  return `<svg viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet"
    role="img" aria-label="Diagramme : ${esc(drill.title)}">
    <rect x="${vb[0]}" y="${vb[1]}" width="${vb[2]}" height="${vb[3]}" fill="var(--ice)"/>
    ${sceneMarkup({ surface: drill.surface, elements: s0.elements })}
  </svg>`;
}

/** Légende textuelle des symboles présents dans une séquence. */
export function legendHtml(elements) {
  const l = legendFor(elements);
  if (!l.objects.length && !l.paths.length) return '';
  const items = [
    ...l.objects.map((o) => ({ ...o, kind: 'obj' })),
    ...l.paths.map((o) => ({ ...o, kind: 'path' })),
  ];
  return `<div class="flex wrap gap-1" style="gap:8px">${items.map((it) => `
    <span class="badge" style="padding:4px 10px 4px 4px">
      <span style="width:26px;height:26px;display:inline-flex;color:var(--tx-0)">${
        it.kind === 'obj' ? objIconInline(it.id) : pathIconInline(it.id)
      }</span>${esc(it.fr)}</span>`).join('')}</div>`;
}

// Importations tardives pour éviter un cycle de modules.
import { objectIcon, pathIcon } from './symbols.js';
const objIconInline = (id) => objectIcon(id, 'currentColor');
const pathIconInline = (id) => pathIcon(id, 'currentColor');
