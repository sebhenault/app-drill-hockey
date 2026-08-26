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

/** Texte centré à l'intérieur d'un symbole. */
function inner(txt, size = 34, fill = '#fff') {
  if (!txt) return '';
  return `<text x="0" y="0" fill="${fill}" font-size="${size}" font-weight="700"
    font-family="var(--ff)" text-anchor="middle" dominant-baseline="central"
    style="paint-order:stroke" >${escText(txt)}</text>`;
}

/**
 * Chaque entrée : { id, fr, tip, cat, draw(o) -> markup, defaults }
 * cat ∈ 'players' | 'equipment' | 'text'
 */
export const OBJECTS = {
  player: {
    fr: 'Joueur', tip: 'Joueur de l’équipe — cercle plein',
    cat: 'players', defLabel: 'F1',
    draw: (o) => `<circle r="${R}" fill="${o.color}" stroke="#fff" stroke-width="6"/>
      ${inner(o.label)}`,
  },
  opponent: {
    fr: 'Joueur adverse', tip: 'Joueur adverse — carré plein (forme distincte du coéquipier)',
    cat: 'players', defLabel: 'X',
    draw: (o) => `<rect x="${-R * 0.86}" y="${-R * 0.86}" width="${R * 1.72}" height="${R * 1.72}"
        rx="6" fill="${o.color}" stroke="#fff" stroke-width="6"/>${inner(o.label)}`,
  },
  forward: {
    fr: 'Attaquant', tip: 'Attaquant — triangle pointe vers l’avant',
    cat: 'players', defLabel: 'F',
    draw: (o) => `<path d="M 0 ${-R * 1.05} L ${R} ${R * 0.72} L ${-R} ${R * 0.72} Z"
        fill="${o.color}" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
      <g transform="translate(0,10)">${inner(o.label, 28)}</g>`,
  },
  defence: {
    fr: 'Défenseur', tip: 'Défenseur — losange',
    cat: 'players', defLabel: 'D',
    draw: (o) => `<path d="M 0 ${-R * 1.05} L ${R * 1.05} 0 L 0 ${R * 1.05} L ${-R * 1.05} 0 Z"
        fill="${o.color}" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>${inner(o.label, 30)}`,
  },
  center: {
    fr: 'Centre', tip: 'Centre — cercle avec repère central',
    cat: 'players', defLabel: 'C',
    draw: (o) => `<circle r="${R}" fill="${o.color}" stroke="#fff" stroke-width="6"/>
      <line x1="0" y1="${-R * 0.98}" x2="0" y2="${R * 0.98}" stroke="#fff" stroke-width="5" opacity=".55"/>
      ${inner(o.label)}`,
  },
  winger: {
    fr: 'Ailier', tip: 'Ailier — cercle avec chevron latéral',
    cat: 'players', defLabel: 'A',
    draw: (o) => `<circle r="${R}" fill="${o.color}" stroke="#fff" stroke-width="6"/>
      <path d="M ${-R * 0.55} ${-R * 0.5} L ${R * 0.1} 0 L ${-R * 0.55} ${R * 0.5}"
        fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity=".7"/>
      <g transform="translate(12,0)">${inner(o.label, 28)}</g>`,
  },
  goalie: {
    fr: 'Gardien', tip: 'Gardien — bouclier',
    cat: 'players', defLabel: 'G',
    draw: (o) => `<path d="M 0 ${-R * 1.1} L ${R * 0.95} ${-R * 0.6} L ${R * 0.95} ${R * 0.25}
        Q ${R * 0.95} ${R * 1.05} 0 ${R * 1.2} Q ${-R * 0.95} ${R * 1.05} ${-R * 0.95} ${R * 0.25}
        L ${-R * 0.95} ${-R * 0.6} Z" fill="${o.color}" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
      ${inner(o.label, 30)}`,
  },
  coach: {
    fr: 'Entraîneur', tip: 'Entraîneur — cercle barré d’un sifflet',
    cat: 'players', defLabel: 'E',
    draw: (o) => `<circle r="${R}" fill="none" stroke="${o.color}" stroke-width="9"/>
      <circle r="${R * 0.55}" fill="${o.color}"/>
      ${inner(o.label, 26)}`,
  },

  puck: {
    fr: 'Rondelle', tip: 'Rondelle — disque plein',
    cat: 'equipment',
    draw: (o) => `<ellipse rx="${R * 0.42}" ry="${R * 0.3}" fill="${o.color}" stroke="#fff" stroke-width="3"/>`,
  },
  pucks: {
    fr: 'Groupe de rondelles', tip: 'Réserve de rondelles',
    cat: 'equipment',
    draw: (o) => `<g fill="${o.color}" stroke="#fff" stroke-width="2.5">
      <ellipse cx="${-R * 0.4}" cy="${R * 0.2}" rx="${R * 0.34}" ry="${R * 0.24}"/>
      <ellipse cx="${R * 0.4}" cy="${R * 0.2}" rx="${R * 0.34}" ry="${R * 0.24}"/>
      <ellipse cx="0" cy="${-R * 0.28}" rx="${R * 0.34}" ry="${R * 0.24}"/></g>`,
  },
  cone: {
    fr: 'Cône', tip: 'Cône de repère',
    cat: 'equipment',
    draw: (o) => `<path d="M 0 ${-R * 0.95} L ${R * 0.68} ${R * 0.7} L ${-R * 0.68} ${R * 0.7} Z"
        fill="${o.color}" stroke="#fff" stroke-width="4" stroke-linejoin="round"/>
      <rect x="${-R * 0.86}" y="${R * 0.62}" width="${R * 1.72}" height="${R * 0.26}" rx="4"
        fill="${o.color}" stroke="#fff" stroke-width="3"/>`,
  },
  net: {
    fr: 'Filet', tip: 'But réglementaire',
    cat: 'equipment',
    draw: (o) => `<g stroke="${o.color}" fill="none" stroke-width="6">
      <path d="M ${-R * 0.9} ${-R * 0.75} L ${-R * 0.9} ${R * 0.75} L ${R * 0.55} ${R * 0.5}
        L ${R * 0.55} ${-R * 0.5} Z" stroke-linejoin="round" fill="rgba(255,255,255,.55)"/>
      <g stroke-width="2.5" opacity=".75">
        <line x1="${-R * 0.9}" y1="${-R * 0.25}" x2="${R * 0.55}" y2="${-R * 0.17}"/>
        <line x1="${-R * 0.9}" y1="${R * 0.25}" x2="${R * 0.55}" y2="${R * 0.17}"/>
        <line x1="${-R * 0.3}" y1="${-R * 0.66}" x2="${-R * 0.3}" y2="${R * 0.66}"/>
        <line x1="${R * 0.15}" y1="${-R * 0.56}" x2="${R * 0.15}" y2="${R * 0.56}"/>
      </g></g>`,
  },
  'mini-net': {
    fr: 'Mini-filet', tip: 'Mini-but d’entraînement',
    cat: 'equipment',
    draw: (o) => `<g stroke="${o.color}" fill="none" stroke-width="5">
      <path d="M ${-R * 0.5} ${-R * 0.42} L ${-R * 0.5} ${R * 0.42} L ${R * 0.3} ${R * 0.28}
        L ${R * 0.3} ${-R * 0.28} Z" stroke-linejoin="round" fill="rgba(255,255,255,.55)"/>
      <line x1="${-R * 0.5}" y1="0" x2="${R * 0.3}" y2="0" stroke-width="2.5" opacity=".7"/></g>`,
  },
  tire: {
    fr: 'Pneu', tip: 'Pneu — obstacle bas',
    cat: 'equipment',
    draw: (o) => `<circle r="${R * 0.8}" fill="none" stroke="${o.color}" stroke-width="${R * 0.32}"/>
      <circle r="${R * 0.8}" fill="none" stroke="#fff" stroke-width="2" opacity=".5"/>`,
  },
  stick: {
    fr: 'Bâton', tip: 'Bâton posé sur la glace',
    cat: 'equipment',
    draw: (o) => `<g stroke="${o.color}" stroke-width="7" stroke-linecap="round" fill="none">
      <line x1="${-R * 0.95}" y1="${-R * 0.5}" x2="${R * 0.4}" y2="${R * 0.35}"/>
      <path d="M ${R * 0.4} ${R * 0.35} L ${R * 0.95} ${R * 0.3}" stroke-width="12"/></g>`,
  },
  obstacle: {
    fr: 'Obstacle', tip: 'Obstacle ou barrière',
    cat: 'equipment',
    draw: (o) => `<rect x="${-R}" y="${-R * 0.34}" width="${R * 2}" height="${R * 0.68}" rx="5"
        fill="none" stroke="${o.color}" stroke-width="6"/>
      <g stroke="${o.color}" stroke-width="5" opacity=".8">
        <line x1="${-R * 0.6}" y1="${-R * 0.34}" x2="${-R * 0.95}" y2="${R * 0.34}"/>
        <line x1="${-R * 0.1}" y1="${-R * 0.34}" x2="${-R * 0.45}" y2="${R * 0.34}"/>
        <line x1="${R * 0.4}" y1="${-R * 0.34}" x2="${R * 0.05}" y2="${R * 0.34}"/>
        <line x1="${R * 0.9}" y1="${-R * 0.34}" x2="${R * 0.55}" y2="${R * 0.34}"/></g>`,
  },
  step: {
    fr: 'Numéro de séquence', tip: 'Numéro d’étape à placer sur la glace',
    cat: 'text', defLabel: '1',
    draw: (o) => `<circle r="${R * 0.62}" fill="#fff" stroke="${o.color}" stroke-width="6"/>
      ${inner(o.label || '1', 34, o.color)}`,
  },
  zone: {
    fr: 'Zone surlignée', tip: 'Rectangle de zone — redimensionnable',
    cat: 'text', resizable: true, defW: 400, defH: 300,
    draw: (o) => {
      const w = o.w || 400, h = o.h || 300;
      return `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="10"
        fill="${o.color}" fill-opacity=".16" stroke="${o.color}" stroke-width="5" stroke-dasharray="22 14"/>`;
    },
  },
  text: {
    fr: 'Texte libre', tip: 'Bloc de texte',
    cat: 'text', textual: true,
    draw: (o) => {
      const fs = o.fontSize || 46;
      const lines = String(o.text || 'Texte').split('\n');
      const y0 = -((lines.length - 1) * fs * 0.6);
      return `<text x="0" y="${y0}" fill="${o.color}" font-size="${fs}" font-weight="650"
        font-family="var(--ff)" text-anchor="middle" dominant-baseline="central"
        paint-order="stroke" stroke="rgba(255,255,255,.85)" stroke-width="6">${
        lines.map((l, i) => `<tspan x="0" dy="${i === 0 ? 0 : fs * 1.2}">${escText(l)}</tspan>`).join('')
      }</text>`;
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

export const PATH_STYLES = {
  skate:      { fr: 'Patinage avant',  tip: 'Patinage avant — trait plein', defCap: 'arrow' },
  backward:   { fr: 'Patinage arrière', tip: 'Patinage arrière — trait à arceaux', defCap: 'arrow' },
  'puck-carry': { fr: 'Avec rondelle', tip: 'Patinage avec la rondelle — trait ondulé', defCap: 'arrow' },
  pass:       { fr: 'Passe',           tip: 'Passe — trait pointillé', defCap: 'arrow' },
  shot:       { fr: 'Tir',             tip: 'Tir — trait double', defCap: 'arrow' },
  lateral:    { fr: 'Déplacement latéral', tip: 'Déplacement latéral — tirets barrés', defCap: 'arrow' },
  crossover:  { fr: 'Croisements',     tip: 'Croisements — hachures obliques', defCap: 'arrow' },
  pivot:      { fr: 'Pivot',           tip: 'Pivot avant ↔ arrière', defCap: 'pivot' },
  turn:       { fr: 'Virage',          tip: 'Virage serré', defCap: 'arrow' },
  check:      { fr: 'Mise en échec',   tip: 'Mise en échec ou pression défensive', defCap: 'check' },
  handoff:    { fr: 'Remise',          tip: 'Transport ou remise de rondelle', defCap: 'tee' },
  freehand:   { fr: 'Crayon libre',    tip: 'Tracé libre lissé', defCap: 'none' },
};
export const PATH_STYLE_IDS = Object.keys(PATH_STYLES);

export const CAPS = {
  none:  { fr: 'Aucune', tip: 'Pas d’extrémité' },
  arrow: { fr: 'Flèche', tip: 'Flèche — direction du mouvement' },
  stop:  { fr: 'Arrêt',  tip: 'Arrêt — barre perpendiculaire' },
  pivot: { fr: 'Pivot',  tip: 'Pivot — demi-cercle' },
  check: { fr: 'Mise en échec', tip: 'Mise en échec — double barre' },
  tee:   { fr: 'Remise', tip: 'Remise — té' },
};
export const CAP_IDS = Object.keys(CAPS);

function capMarkup(kind, p, dirX, dirY, w, color) {
  const nx = -dirY, ny = dirX;
  const s = Math.max(w * 2.6, 16);
  switch (kind) {
    case 'arrow':
      return `<path d="M ${p.x} ${p.y} L ${p.x - dirX * s * 1.5 + nx * s} ${p.y - dirY * s * 1.5 + ny * s}
        L ${p.x - dirX * s * 1.5 - nx * s} ${p.y - dirY * s * 1.5 - ny * s} Z" fill="${color}"/>`;
    case 'stop':
      return `<line x1="${p.x + nx * s * 1.3}" y1="${p.y + ny * s * 1.3}"
        x2="${p.x - nx * s * 1.3}" y2="${p.y - ny * s * 1.3}"
        stroke="${color}" stroke-width="${w * 1.5}" stroke-linecap="round"/>`;
    case 'tee':
      return `<line x1="${p.x + nx * s}" y1="${p.y + ny * s}" x2="${p.x - nx * s}" y2="${p.y - ny * s}"
        stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
    case 'check':
      return `<g stroke="${color}" stroke-width="${w * 1.4}" stroke-linecap="round">
        <line x1="${p.x + nx * s * 1.3}" y1="${p.y + ny * s * 1.3}" x2="${p.x - nx * s * 1.3}" y2="${p.y - ny * s * 1.3}"/>
        <line x1="${p.x - dirX * s * 0.9 + nx * s * 1.3}" y1="${p.y - dirY * s * 0.9 + ny * s * 1.3}"
              x2="${p.x - dirX * s * 0.9 - nx * s * 1.3}" y2="${p.y - dirY * s * 0.9 - ny * s * 1.3}"/></g>`;
    case 'pivot':
      return `<path d="M ${p.x + nx * s} ${p.y + ny * s} A ${s} ${s} 0 0 1 ${p.x - nx * s} ${p.y - ny * s}"
        fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
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
    case 'backward': {
      // Trait plein ponctué de demi-cercles ouverts : la corde vaut exactement
      // le diamètre, sinon la bosse est plus mince que le trait et disparaît.
      body = `<path d="${dOf(dense)}" ${attrs()}/>`;
      const r0 = w * 1.9;
      const step = r0 * 3.6;
      for (let d = step * 0.5; d < L - r0 * 1.2; d += step) {
        const s0 = sampleAt(dense, acc, d);
        const ax = s0.x - s0.tx * r0, ay = s0.y - s0.ty * r0;
        const bx = s0.x + s0.tx * r0, by = s0.y + s0.ty * r0;
        body += `<path d="M ${ax} ${ay} A ${r0} ${r0} 0 0 1 ${bx} ${by}" fill="none"
          stroke="${color}" stroke-width="${w * 0.85}" stroke-linecap="round"/>`;
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
    case 'pivot': {
      body = `<path d="${dOf(dense)}" ${attrs()}/>`;
      const m = sampleAt(dense, acc, L / 2);
      body += `<circle cx="${m.x}" cy="${m.y}" r="${w * 2.1}" fill="none" stroke="${color}" stroke-width="${w * 0.8}"/>`;
      break;
    }
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
