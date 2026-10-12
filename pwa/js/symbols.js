/**
 * Langage de symboles — icônes SVG entièrement originales.
 *
 * Chaque objet est dessiné dans un repère local centré sur (0,0) avec un
 * rayon nominal R = 40 unités glace. Le même balisage sert :
 *   – à la palette d'outils (inséré dans un viewBox -50 -50 100 100) ;
 *   – au canevas (via <g transform="translate(x,y) rotate(r) scale(s)">) ;
 *   – à l'export SVG et à l'impression.
 *
 * Principe d'accessibilité : la FORME distingue les symboles, jamais la seule
 * couleur (WCAG 2.2, critère 1.4.1). Un joueur adverse reste identifiable en
 * noir et blanc.
 */

export const R = 40;

const escText = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* --------------------------------------------------------------------------
   Objets
   -------------------------------------------------------------------------- */

/**
 * Taille de police adaptée à la longueur de l'étiquette.
 * « G » doit remplir le symbole, « D1 » tient encore, « F12 » ne doit pas
 * déborder du cercle ni du triangle.
 */
function fitSize(txt, base) {
  const n = String(txt || '').length;
  if (n <= 1) return base;
  if (n === 2) return base * 0.72;
  if (n === 3) return base * 0.55;
  return base * 0.45;
}

/**
 * Rotation de l'affichage (en degrés) que les textes doivent annuler pour
 * rester lisibles : l'éditeur pivote la glace d'un quart de tour en portrait,
 * mais « P1 » ou une consigne doivent rester à l'endroit.
 */
let textTurn = 0;
export function setTextTurn(deg) { textTurn = deg || 0; }
const upright = (markup) => textTurn ? `<g transform="rotate(${-textTurn})">${markup}</g>` : markup;

/** Texte centré dans un symbole. Le halo blanc garde la lisibilité sur la glace. */
function inner(txt, size = 34, fill = '#12212e') {
  if (!txt) return '';
  return upright(`<text x="0" y="0" fill="${fill}" font-size="${size}" font-weight="700"
    font-family="var(--ff)" text-anchor="middle" dominant-baseline="central"
    paint-order="stroke" stroke="rgba(255,255,255,.9)" stroke-width="${size * 0.16}"
    >${escText(txt)}</text>`);
}

/** Remplissage très clair sous les symboles ouverts : ils restent lisibles
 *  quand ils tombent sur une ligne bleue ou un cercle de mise au jeu. */
const VEIL = 'rgba(255,255,255,.78)';

/**
 * Chaque entrée : { fr, tip, cat, official, draw(o) -> balisage }
 * cat ∈ 'players' | 'equipment' | 'text'
 * official : true si le symbole figure dans la légende Hockey Canada /
 * Hockey Québec ; false pour les compléments ajoutés par l'application.
 */
export const OBJECTS = {
  player: {
    fr: 'Joueur à l’offensive', tip: 'Joueur à l’offensive — cercle ouvert',
    cat: 'players', defLabel: '', official: true,
    draw: (o) => `<circle r="${R}" fill="${VEIL}" stroke="${o.color}" stroke-width="8"/>
      ${inner(o.label, fitSize(o.label, R * 1.05), o.color)}`,
  },
  opponent: {
    fr: 'Joueur à la défensive', tip: 'Joueur à la défensive — triangle ouvert',
    cat: 'players', defLabel: '', official: true,
    draw: (o) => `<path d="M 0 ${-R * 1.12} L ${R * 1.02} ${R * 0.68} L ${-R * 1.02} ${R * 0.68} Z"
        fill="${VEIL}" stroke="${o.color}" stroke-width="8" stroke-linejoin="round"/>
      <g transform="translate(0,${R * 0.3})">${inner(o.label, fitSize(o.label, R * 0.86), o.color)}</g>`,
  },
  forward: {
    fr: 'Avant (F)', tip: 'Avant — lettre F',
    cat: 'players', defLabel: 'F', official: true,
    draw: (o) => inner(o.label || 'F', fitSize(o.label || 'F', R * 1.5), o.color),
  },
  defence: {
    fr: 'Défenseur (D)', tip: 'Défenseur — lettre D',
    cat: 'players', defLabel: 'D', official: true,
    draw: (o) => inner(o.label || 'D', fitSize(o.label || 'D', R * 1.5), o.color),
  },
  center: {
    fr: 'Centre (C)', tip: 'Centre — lettre C',
    cat: 'players', defLabel: 'C', official: true,
    draw: (o) => inner(o.label || 'C', fitSize(o.label || 'C', R * 1.5), o.color),
  },
  winger: {
    fr: 'Ailier (W)', tip: 'Ailier — lettre W',
    cat: 'players', defLabel: 'W', official: true,
    draw: (o) => inner(o.label || 'W', fitSize(o.label || 'W', R * 1.5), o.color),
  },
  goalie: {
    fr: 'Gardien de but (G)', tip: 'Gardien de but — lettre G',
    cat: 'players', defLabel: 'G', official: true,
    draw: (o) => inner(o.label || 'G', fitSize(o.label || 'G', R * 1.5), o.color),
  },
  coach: {
    fr: 'Entraîneur (©)', tip: 'Entraîneur — lettre C entourée',
    cat: 'players', defLabel: 'C', official: true,
    draw: (o) => `<circle r="${R * 0.86}" fill="${VEIL}" stroke="${o.color}" stroke-width="7"/>
      ${inner(o.label || 'C', fitSize(o.label || 'C', R * 0.9), o.color)}`,
  },

  puck: {
    fr: 'Rondelle', tip: 'Rondelle — disque plein',
    cat: 'equipment', official: true,
    draw: (o) => `<circle r="${R * 0.34}" fill="${o.color}"/>`,
  },
  pucks: {
    fr: 'Groupe de rondelles', tip: 'Réserve de rondelles',
    cat: 'equipment', official: false,
    draw: (o) => `<g fill="${o.color}">
      <circle cx="${-R * 0.36}" cy="${R * 0.22}" r="${R * 0.3}"/>
      <circle cx="${R * 0.36}" cy="${R * 0.22}" r="${R * 0.3}"/>
      <circle cx="0" cy="${-R * 0.3}" r="${R * 0.3}"/></g>`,
  },
  cone: {
    fr: 'Cône ou obstacle', tip: 'Cône ou obstacle — triangle plein',
    cat: 'equipment', official: true, defColor: '#d2262c',
    draw: (o) => `<path d="M 0 ${-R * 0.95} L ${R * 0.85} ${R * 0.7} L ${-R * 0.85} ${R * 0.7} Z"
        fill="${o.color}" stroke-linejoin="round"/>`,
  },
  net: {
    fr: 'Filet', tip: 'Filet — ouverture vers la glace',
    cat: 'equipment', official: true,
    draw: (o) => `<path d="M ${R * 0.62} ${-R * 0.78} L ${-R * 0.62} ${-R * 0.78}
        L ${-R * 0.62} ${R * 0.78} L ${R * 0.62} ${R * 0.78}"
        fill="${VEIL}" stroke="${o.color}" stroke-width="8"
        stroke-linejoin="round" stroke-linecap="round"/>`,
  },
  'mini-net': {
    fr: 'Mini-filet', tip: 'Mini-but d’entraînement',
    cat: 'equipment', official: false,
    draw: (o) => `<path d="M ${R * 0.38} ${-R * 0.46} L ${-R * 0.38} ${-R * 0.46}
        L ${-R * 0.38} ${R * 0.46} L ${R * 0.38} ${R * 0.46}"
        fill="${VEIL}" stroke="${o.color}" stroke-width="6"
        stroke-linejoin="round" stroke-linecap="round"/>`,
  },
  stick: {
    fr: 'Position du bâton', tip: 'Position du bâton — palette au sol',
    cat: 'equipment', official: true,
    draw: (o) => `<path d="M ${-R * 0.95} ${-R * 0.45} Q ${R * 0.1} ${R * 0.1} ${R * 0.92} ${R * 0.2}"
      fill="none" stroke="${o.color}" stroke-width="9" stroke-linecap="round"/>`,
  },
  tire: {
    fr: 'Pneu', tip: 'Pneu — obstacle bas',
    cat: 'equipment', official: false,
    draw: (o) => `<circle r="${R * 0.74}" fill="none" stroke="${o.color}" stroke-width="${R * 0.3}"/>`,
  },
  obstacle: {
    fr: 'Barrière', tip: 'Barrière ou obstacle allongé',
    cat: 'equipment', official: false,
    draw: (o) => `<rect x="${-R}" y="${-R * 0.3}" width="${R * 2}" height="${R * 0.6}" rx="5"
        fill="${VEIL}" stroke="${o.color}" stroke-width="6"/>
      <g stroke="${o.color}" stroke-width="5">
        <line x1="${-R * 0.55}" y1="${-R * 0.3}" x2="${-R * 0.9}" y2="${R * 0.3}"/>
        <line x1="${-R * 0.05}" y1="${-R * 0.3}" x2="${-R * 0.4}" y2="${R * 0.3}"/>
        <line x1="${R * 0.45}" y1="${-R * 0.3}" x2="${R * 0.1}" y2="${R * 0.3}"/>
        <line x1="${R * 0.95}" y1="${-R * 0.3}" x2="${R * 0.6}" y2="${R * 0.3}"/></g>`,
  },

  step: {
    fr: 'Numéro d’étape', tip: 'Numéro d’étape à placer sur la glace',
    cat: 'text', defLabel: '1', official: false,
    draw: (o) => `<circle r="${R * 0.6}" fill="#fff" stroke="${o.color}" stroke-width="6"/>
      ${inner(o.label || '1', 34, o.color)}`,
  },
  zone: {
    fr: 'Zone surlignée', tip: 'Rectangle de zone — redimensionnable',
    cat: 'text', resizable: true, defW: 400, defH: 300, official: false,
    draw: (o) => {
      const w = o.w || 400, h = o.h || 300;
      return `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="10"
        fill="${o.color}" fill-opacity=".14" stroke="${o.color}" stroke-width="5" stroke-dasharray="22 14"/>`;
    },
  },
  text: {
    fr: 'Texte libre', tip: 'Bloc de texte',
    cat: 'text', textual: true, official: false,
    draw: (o) => {
      const fs = o.fontSize || 46;
      const lines = String(o.text || 'Texte').split('\n');
      const y0 = -((lines.length - 1) * fs * 0.6);
      return upright(`<text x="0" y="${y0}" fill="${o.color}" font-size="${fs}" font-weight="650"
        font-family="var(--ff)" text-anchor="middle" dominant-baseline="central"
        paint-order="stroke" stroke="rgba(255,255,255,.85)" stroke-width="6">${
        lines.map((l, i) => `<tspan x="0" dy="${i === 0 ? 0 : fs * 1.2}">${escText(l)}</tspan>`).join('')
      }</text>`);
    },
  },
};

export const OBJECT_IDS = Object.keys(OBJECTS);

/** Balisage d'un objet placé sur le canevas (avec sa transformation). */
export function drawObject(o) {
  const def = OBJECTS[o.obj];
  if (!def) return '';
  const s = o.scale == null ? 1 : o.scale;
  const rot = o.rot || 0;
  return `<g transform="translate(${o.x} ${o.y}) rotate(${rot}) scale(${s})">${def.draw(o)}</g>`;
}

/** Icône de palette : le même dessin, cadré. */
export function objectIcon(id, color = 'currentColor') {
  const def = OBJECTS[id];
  if (!def) return '';
  const o = { color, label: def.defLabel || '', x: 0, y: 0, rot: 0, scale: 1, w: 84, h: 60, text: 'Aa', fontSize: 52 };
  return `<svg viewBox="-58 -58 116 116" aria-hidden="true" focusable="false">${def.draw(o)}</svg>`;
}

/* --------------------------------------------------------------------------
   Géométrie des tracés
   -------------------------------------------------------------------------- */

/** Échantillonnage dense d'une courbe de Catmull-Rom passant par les points. */
export function densify(pts, perSeg = 14) {
  if (!pts || pts.length === 0) return [];
  if (pts.length === 1) return [{ ...pts[0] }];
  if (pts.length === 2) {
    const out = [];
    for (let i = 0; i <= perSeg; i++) {
      const t = i / perSeg;
      out.push({ x: pts[0].x + (pts[1].x - pts[0].x) * t, y: pts[0].y + (pts[1].y - pts[0].y) * t });
    }
    return out;
  }
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  for (let i = 1; i < p.length - 2; i++) {
    const p0 = p[i - 1], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2];
    for (let j = 0; j < perSeg; j++) {
      const t = j / perSeg, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push({ ...pts[pts.length - 1] });
  return out;
}

/** Longueurs cumulées d'une polyligne. */
export function cumulative(dense) {
  const acc = [0];
  for (let i = 1; i < dense.length; i++) {
    acc.push(acc[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
  }
  return acc;
}

/** Point + tangente à la distance `d` le long de la polyligne. */
export function sampleAt(dense, acc, d) {
  const total = acc[acc.length - 1] || 0;
  const dd = Math.max(0, Math.min(total, d));
  let i = 1;
  while (i < acc.length - 1 && acc[i] < dd) i++;
  const seg = acc[i] - acc[i - 1] || 1;
  const t = (dd - acc[i - 1]) / seg;
  const a = dense[i - 1], b = dense[i];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    tx: (b.x - a.x) / len,
    ty: (b.y - a.y) / len,
  };
}

const dOf = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

/** Décale une polyligne perpendiculairement d'une amplitude variable f(s). */
function offsetPoly(dense, acc, f) {
  const out = [];
  for (let i = 0; i < dense.length; i++) {
    const a = dense[Math.max(0, i - 1)], b = dense[Math.min(dense.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    const amp = f(acc[i]);
    out.push({ x: dense[i].x + nx * amp, y: dense[i].y + ny * amp });
  }
  return out;
}

/* --------------------------------------------------------------------------
   Styles de trajectoire
   -------------------------------------------------------------------------- */

/**
 * Styles de trajectoire.
 *
 * Les six premiers reprennent la légende Hockey Canada / Hockey Québec
 * (`official: true`). Les suivants sont des compléments de l'application :
 * utiles, mais à expliquer en légende si le diagramme sort du club.
 */
export const PATH_STYLES = {
  skate:          { fr: 'Patinage avant', tip: 'Patinage avant sans la rondelle — trait plein et flèche',
                    defCap: 'arrow', official: true },
  'puck-carry':   { fr: 'Patinage avant avec la rondelle', tip: 'Patinage avant avec la rondelle — trait ondulé',
                    defCap: 'arrow', official: true },
  backward:       { fr: 'Patinage arrière', tip: 'Patinage arrière — chaîne de boucles',
                    defCap: 'none', official: true },
  'backward-puck': { fr: 'Patinage arrière avec la rondelle', tip: 'Patinage arrière avec la rondelle — boucles et rondelle au départ',
                    defCap: 'none', official: true },
  pass:           { fr: 'Passe / trajectoire de la rondelle', tip: 'Passe ou trajectoire de la rondelle — trait pointillé',
                    defCap: 'arrow', official: true },
  shot:           { fr: 'Tir', tip: 'Tir — trait double', defCap: 'arrow', official: true },
  pivot:          { fr: 'Pivot', tip: 'Pivot — boucle en fin de tracé', defCap: 'pivot', official: true },

  lateral:        { fr: 'Déplacement latéral', tip: 'Complément — tirets barrés', defCap: 'arrow', official: false },
  crossover:      { fr: 'Croisements', tip: 'Complément — hachures obliques', defCap: 'arrow', official: false },
  turn:           { fr: 'Virage', tip: 'Complément — virage serré', defCap: 'arrow', official: false },
  check:          { fr: 'Mise en échec', tip: 'Complément — pression défensive, trait en zigzag', defCap: 'check', official: false },
  handoff:        { fr: 'Remise', tip: 'Complément — transport ou remise de rondelle', defCap: 'tee', official: false },
  freehand:       { fr: 'Crayon libre', tip: 'Tracé libre lissé', defCap: 'none', official: false },
};
export const PATH_STYLE_IDS = Object.keys(PATH_STYLES);

export const CAPS = {
  none:  { fr: 'Aucune', tip: 'Pas d’extrémité', official: true },
  arrow: { fr: 'Flèche', tip: 'Flèche — direction du mouvement', official: true },
  stop:  { fr: 'Arrêt à deux pieds', tip: 'Arrêt à deux pieds — flèche suivie d’une barre', official: true },
  pivot: { fr: 'Pivot', tip: 'Pivot — boucle', official: true },
  check: { fr: 'Mise en échec', tip: 'Complément — double barre', official: false },
  tee:   { fr: 'Remise', tip: 'Complément — té', official: false },
};
export const CAP_IDS = Object.keys(CAPS);

function capMarkup(kind, p, dirX, dirY, w, color) {
  const nx = -dirY, ny = dirX;
  const s = Math.max(w * 2.6, 16);
  switch (kind) {
    case 'arrow':
      return `<path d="M ${p.x} ${p.y} L ${p.x - dirX * s * 1.5 + nx * s} ${p.y - dirY * s * 1.5 + ny * s}
        L ${p.x - dirX * s * 1.5 - nx * s} ${p.y - dirY * s * 1.5 - ny * s} Z" fill="${color}"/>`;
    case 'stop': {
      // Légende officielle : la flèche du patinage avant, puis la barre
      // perpendiculaire de l'arrêt à deux pieds.
      const head = `<path d="M ${p.x - dirX * s * 0.9} ${p.y - dirY * s * 0.9}
        L ${p.x - dirX * s * 2.4 + nx * s} ${p.y - dirY * s * 2.4 + ny * s}
        L ${p.x - dirX * s * 2.4 - nx * s} ${p.y - dirY * s * 2.4 - ny * s} Z" fill="${color}"/>`;
      const bar = `<line x1="${p.x + nx * s * 1.25}" y1="${p.y + ny * s * 1.25}"
        x2="${p.x - nx * s * 1.25}" y2="${p.y - ny * s * 1.25}"
        stroke="${color}" stroke-width="${w * 1.4}" stroke-linecap="round"/>`;
      return head + bar;
    }
    case 'tee':
      return `<line x1="${p.x + nx * s}" y1="${p.y + ny * s}" x2="${p.x - nx * s}" y2="${p.y - ny * s}"
        stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
    case 'check':
      return `<g stroke="${color}" stroke-width="${w * 1.4}" stroke-linecap="round">
        <line x1="${p.x + nx * s * 1.3}" y1="${p.y + ny * s * 1.3}" x2="${p.x - nx * s * 1.3}" y2="${p.y - ny * s * 1.3}"/>
        <line x1="${p.x - dirX * s * 0.9 + nx * s * 1.3}" y1="${p.y - dirY * s * 0.9 + ny * s * 1.3}"
              x2="${p.x - dirX * s * 0.9 - nx * s * 1.3}" y2="${p.y - dirY * s * 0.9 - ny * s * 1.3}"/></g>`;
    case 'pivot': {
      // Boucle de 300° posée à l'extrémité, comme dans la légende officielle.
      const r = Math.max(w * 2.3, 13);
      const cx = p.x - dirX * r, cy = p.y - dirY * r;
      const a0 = Math.atan2(dirY, dirX);
      const a1 = a0 + (300 * Math.PI) / 180;
      return `<path d="M ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)}
        A ${r} ${r} 0 1 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}"
        fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
    }
    default: return '';
  }
}

/**
 * Rendu complet d'une trajectoire.
 * Renvoie une chaîne SVG. `reveal` ∈ [0,1] permet de ne dessiner qu'une
 * fraction du tracé (utilisé par l'animation).
 */
export function drawPath(p, opts = {}) {
  const reveal = opts.reveal == null ? 1 : Math.max(0, Math.min(1, opts.reveal));
  if (!p.points || p.points.length < 2) return '';
  const w = p.width || 7;
  const color = p.color || '#12212e';
  let dense = densify(p.points, p.style === 'freehand' ? 4 : 14);
  let acc = cumulative(dense);
  const total = acc[acc.length - 1] || 1;

  if (reveal < 1) {
    const cut = total * reveal;
    const kept = [];
    for (let i = 0; i < dense.length; i++) { if (acc[i] <= cut) kept.push(dense[i]); else break; }
    const tip = sampleAt(dense, acc, cut);
    kept.push({ x: tip.x, y: tip.y });
    if (kept.length < 2) return '';
    dense = kept; acc = cumulative(dense);
  }
  const L = acc[acc.length - 1] || 1;
  const end = dense[dense.length - 1];
  const prev = dense[Math.max(0, dense.length - 2)];
  const el = Math.hypot(end.x - prev.x, end.y - prev.y) || 1;
  const ex = (end.x - prev.x) / el, ey = (end.y - prev.y) / el;
  const start = dense[0], nx2 = dense[Math.min(1, dense.length - 1)];
  const sl = Math.hypot(nx2.x - start.x, nx2.y - start.y) || 1;
  const sx = (start.x - nx2.x) / sl, sy = (start.y - nx2.y) / sl;

  const base = { fill: 'none', stroke: color, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  const attrs = (extra = {}) => Object.entries({ ...base, ...extra }).map(([k, v]) => `${k}="${v}"`).join(' ');

  let body = '';
  switch (p.style) {
    case 'pass':
      body = `<path d="${dOf(dense)}" ${attrs({ 'stroke-dasharray': `${w * 3} ${w * 2.6}` })}/>`;
      break;
    case 'lateral':
      body = `<path d="${dOf(dense)}" ${attrs({ 'stroke-dasharray': `${w * 2.2} ${w * 2.2}` })}/>`;
      for (let d = w * 5; d < L; d += w * 8) {
        const s0 = sampleAt(dense, acc, d);
        const a = w * 2.1;
        body += `<line x1="${s0.x - s0.ty * a}" y1="${s0.y + s0.tx * a}" x2="${s0.x + s0.ty * a}" y2="${s0.y - s0.tx * a}"
          stroke="${color}" stroke-width="${w * 0.8}" stroke-linecap="round"/>`;
      }
      break;
    case 'shot': {
      const off = w * 0.95;
      body = `<path d="${dOf(offsetPoly(dense, acc, () => off))}" ${attrs({ 'stroke-width': w * 0.72 })}/>
              <path d="${dOf(offsetPoly(dense, acc, () => -off))}" ${attrs({ 'stroke-width': w * 0.72 })}/>`;
      break;
    }
    case 'puck-carry': {
      const amp = w * 1.15, lam = w * 11;
      body = `<path d="${dOf(offsetPoly(dense, acc, (s) => Math.sin((s / lam) * Math.PI * 2) * amp))}" ${attrs()}/>`;
      break;
    }
    case 'backward':
    case 'backward-puck': {
      // Chaîne de demi-cercles bout à bout, tous du même côté : c'est la
      // boucle continue de la légende, et non un trait droit décoré. Toutes
      // du même côté, sinon le résultat ressemble à l'onde du porteur de
      // rondelle et les deux styles deviennent confondables.
      const r0 = w * 2.7;
      const arcs = [];
      let d = 0;
      while (d + r0 * 2 <= L) {
        const a = sampleAt(dense, acc, d);
        const b = sampleAt(dense, acc, d + r0 * 2);
        arcs.push(`M ${a.x.toFixed(1)} ${a.y.toFixed(1)}
          A ${r0} ${r0} 0 0 1 ${b.x.toFixed(1)} ${b.y.toFixed(1)}`);
        d += r0 * 2;
      }
      if (!arcs.length) {
        body = `<path d="${dOf(dense)}" ${attrs()}/>`;
      } else {
        body = `<path d="${arcs.join(' ')}" ${attrs({ 'stroke-linecap': 'round' })}/>`;
        // Le dernier bout de trajet, trop court pour une boucle complète.
        const tail = sampleAt(dense, acc, d);
        const endPt = dense[dense.length - 1];
        if (Math.hypot(endPt.x - tail.x, endPt.y - tail.y) > w) {
          body += `<path d="M ${tail.x} ${tail.y} L ${endPt.x} ${endPt.y}" ${attrs()}/>`;
        }
      }
      if (p.style === 'backward-puck') {
        const s0 = dense[0];
        body += `<circle cx="${s0.x}" cy="${s0.y}" r="${w * 1.5}" fill="${color}"/>`;
      }
      break;
    }
    case 'crossover': {
      body = `<path d="${dOf(dense)}" ${attrs()}/>`;
      const step = w * 6;
      for (let d = step * 0.5; d < L - w; d += step) {
        const s0 = sampleAt(dense, acc, d);
        const a = w * 1.7;
        const ox = s0.tx * a * 0.7, oy = s0.ty * a * 0.7;
        body += `<line x1="${s0.x - s0.ty * a - ox}" y1="${s0.y + s0.tx * a - oy}"
          x2="${s0.x + s0.ty * a + ox}" y2="${s0.y - s0.tx * a + oy}"
          stroke="${color}" stroke-width="${w * 0.7}" stroke-linecap="round"/>`;
      }
      break;
    }
    case 'check': {
      const amp = w * 1.7, lam = w * 9;
      const tri = (s) => { const u = ((s / lam) % 1 + 1) % 1; return (u < .5 ? u * 4 - 1 : 3 - u * 4) * amp; };
      body = `<path d="${dOf(offsetPoly(dense, acc, tri))}" ${attrs({ 'stroke-width': w * 1.35, 'stroke-linejoin': 'miter' })}/>`;
      break;
    }
    case 'handoff': {
      body = `<path d="${dOf(dense)}" ${attrs({ 'stroke-dasharray': `${w * 4.5} ${w * 1.8} ${w * 0.9} ${w * 1.8}` })}/>`;
      break;
    }
    case 'pivot':
      // Trait plein : la boucle du pivot est portée par l'extrémité de ligne.
      body = `<path d="${dOf(dense)}" ${attrs()}/>`;
      break;
    case 'turn': {
      body = `<path d="${dOf(dense)}" ${attrs()}/>`;
      const m = sampleAt(dense, acc, L * 0.5);
      const a = w * 2.4;
      body += `<path d="M ${m.x - m.tx * a} ${m.y - m.ty * a} A ${a} ${a} 0 1 1 ${m.x + m.tx * a} ${m.y + m.ty * a}"
        fill="none" stroke="${color}" stroke-width="${w * 0.8}"/>`;
      break;
    }
    default: // skate, freehand
      body = `<path d="${dOf(dense)}" ${attrs()}/>`;
  }

  let caps = '';
  if (reveal >= 0.999 && p.endCap && p.endCap !== 'none') caps += capMarkup(p.endCap, end, ex, ey, w, color);
  if (p.startCap && p.startCap !== 'none') caps += capMarkup(p.startCap, start, sx, sy, w, color);
  return body + caps;
}

/** Icône de palette pour un style de trajectoire. */
export function pathIcon(style, color = 'currentColor') {
  const pts = style === 'turn' || style === 'pivot'
    ? [{ x: 8, y: 78 }, { x: 42, y: 24 }, { x: 92, y: 62 }]
    : [{ x: 8, y: 74 }, { x: 40, y: 30 }, { x: 92, y: 46 }];
  const p = {
    style, points: pts, width: 6, color,
    startCap: 'none', endCap: PATH_STYLES[style] ? PATH_STYLES[style].defCap : 'arrow',
  };
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${drawPath(p)}</svg>`;
}

/** Icône de palette pour une extrémité de ligne. */
export function capIcon(cap, color = 'currentColor') {
  const p = { style: 'skate', points: [{ x: 12, y: 62 }, { x: 74, y: 40 }], width: 6, color, startCap: 'none', endCap: cap };
  return `<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">${drawPath(p)}</svg>`;
}

/** Balisage d'un élément quelconque (objet ou tracé). */
export function drawElement(el, opts) {
  return el.kind === 'path' ? drawPath(el, opts) : drawObject(el);
}

/** Boîte englobante approximative, pour la sélection et l'ajustement. */
export function bbox(el) {
  if (el.kind === 'path') {
    const xs = el.points.map((p) => p.x), ys = el.points.map((p) => p.y);
    const pad = (el.width || 7) * 3;
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad,
             w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
  }
  const def = OBJECTS[el.obj] || {};
  const s = el.scale == null ? 1 : el.scale;
  if (el.obj === 'zone') {
    const w = (el.w || 400), h = (el.h || 300);
    return { x: el.x - w / 2 * s, y: el.y - h / 2 * s, w: w * s, h: h * s };
  }
  if (el.obj === 'text') {
    const fs = (el.fontSize || 46) * s;
    const lines = String(el.text || 'Texte').split('\n');
    const w = Math.max(...lines.map((l) => l.length)) * fs * 0.56 + fs * 0.4;
    const h = lines.length * fs * 1.25;
    return { x: el.x - w / 2, y: el.y - h / 2, w, h };
  }
  const r = R * 1.25 * s;
  void def;
  return { x: el.x - r, y: el.y - r, w: r * 2, h: r * 2 };
}

/** Test de survol : l'élément est-il sous le point (x,y) ? */
export function hitTest(el, x, y, tol = 18) {
  if (el.kind === 'path') {
    const dense = densify(el.points, 8);
    const t = tol + (el.width || 7);
    for (let i = 1; i < dense.length; i++) {
      const a = dense[i - 1], b = dense[i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const L2 = dx * dx + dy * dy || 1;
      let u = ((x - a.x) * dx + (y - a.y) * dy) / L2;
      u = Math.max(0, Math.min(1, u));
      if (Math.hypot(x - (a.x + dx * u), y - (a.y + dy * u)) <= t) return true;
    }
    return false;
  }
  const b = bbox(el);
  return x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4;
}

/** Légende : symboles réellement utilisés dans une séquence. */
export function legendFor(elements) {
  const objs = new Set(), paths = new Set();
  for (const el of elements || []) {
    if (el.kind === 'path') paths.add(el.style); else objs.add(el.obj);
  }
  return {
    objects: [...objs].filter((id) => OBJECTS[id]).map((id) => ({ id, fr: OBJECTS[id].fr })),
    paths: [...paths].filter((id) => PATH_STYLES[id]).map((id) => ({ id, fr: PATH_STYLES[id].fr })),
  };
}
