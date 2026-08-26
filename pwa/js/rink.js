/**
 * Géométrie de la patinoire et rendu SVG de la surface.
 *
 * Unité de travail : 1 unité = 0,1 pied. Une patinoire de dimensions
 * nord-américaines (200 pi × 85 pi) occupe donc 2000 × 850 unités.
 * Toutes les surfaces sont des fenêtres (viewBox) découpées dans ce même
 * dessin : un seul balisage, neuf cadrages.
 */

export const RINK_W = 2000;
export const RINK_H = 850;
const R_CORNER = 280;        // rayon des coins, 28 pi
const GOAL_LINE_L = 110;     // ligne des buts, 11 pi de la bande
const GOAL_LINE_R = RINK_W - GOAL_LINE_L;
const BLUE_L = 750;          // lignes bleues, 75 pi des bandes
const BLUE_R = RINK_W - BLUE_L;
const CENTER_X = RINK_W / 2;
const MID_Y = RINK_H / 2;
const FO_R = 150;            // rayon des cercles de mise au jeu, 15 pi
const FO_DY = 220;           // écart latéral des points, 22 pi
const FO_END_X_L = 310;      // points en zone, 20 pi de la ligne des buts
const FO_END_X_R = RINK_W - FO_END_X_L;
const NZ_X_L = 800;          // points en zone neutre, 5 pi de la ligne bleue
const NZ_X_R = RINK_W - NZ_X_L;

/** Fenêtres de cadrage. `label` sert au sélecteur de l'éditeur. */
export const SURFACES = [
  { id: 'full',     fr: 'Glace complète', vb: [0, 0, 2000, 850],   markings: true },
  { id: 'half',     fr: 'Demi-glace',     vb: [0, 0, 1000, 850],   markings: true },
  { id: 'zone-def', fr: 'Zone défensive', vb: [0, 0, 760, 850],    markings: true },
  { id: 'zone-off', fr: 'Zone offensive', vb: [1240, 0, 760, 850], markings: true },
  { id: 'neutral',  fr: 'Zone neutre',    vb: [740, 0, 520, 850],  markings: true },
  { id: 'quarter',  fr: 'Quart de glace', vb: [0, 0, 1000, 425],   markings: true },
  { id: 'sixth',    fr: 'Sixième de glace', vb: [0, 0, 670, 425],  markings: true },
  { id: 'blank',    fr: 'Patinoire vide', vb: [0, 0, 2000, 850],   markings: false },
  { id: 'grid',     fr: 'Grille libre',   vb: [0, 0, 2000, 850],   markings: false, boards: false },
];

export const SURFACE_BY_ID = Object.fromEntries(SURFACES.map((s) => [s.id, s]));

export function surfaceViewBox(id) {
  const s = SURFACE_BY_ID[id] || SURFACE_BY_ID.full;
  return s.vb.slice();
}
export function surfaceRatio(id) {
  const vb = surfaceViewBox(id);
  return vb[2] / vb[3];
}

/** Contour arrondi des bandes. */
function boardsPath() {
  const r = R_CORNER, W = RINK_W, H = RINK_H;
  return [
    `M ${r} 0`, `H ${W - r}`, `A ${r} ${r} 0 0 1 ${W} ${r}`,
    `V ${H - r}`, `A ${r} ${r} 0 0 1 ${W - r} ${H}`,
    `H ${r}`, `A ${r} ${r} 0 0 1 0 ${H - r}`,
    `V ${r}`, `A ${r} ${r} 0 0 1 ${r} 0`, 'Z',
  ].join(' ');
}

/** Longueur verticale d'une ligne de but selon la courbure des coins. */
function goalLineHalfHeight(x) {
  // Distance horizontale entre le centre du coin (r,r) et x.
  const dx = R_CORNER - x;
  if (dx <= 0) return RINK_H / 2;
  const dy = Math.sqrt(Math.max(0, R_CORNER * R_CORNER - dx * dx));
  return RINK_H / 2 - (R_CORNER - dy);
}

function faceoffCircle(cx, cy) {
  return `<circle cx="${cx}" cy="${cy}" r="${FO_R}" fill="none" stroke="var(--ice-line-red)" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="15" fill="var(--ice-line-red)"/>
    <line x1="${cx - 60}" y1="${cy - 22}" x2="${cx - 20}" y2="${cy - 22}" stroke="var(--ice-line-red)" stroke-width="3"/>
    <line x1="${cx + 20}" y1="${cy - 22}" x2="${cx + 60}" y2="${cy - 22}" stroke="var(--ice-line-red)" stroke-width="3"/>
    <line x1="${cx - 60}" y1="${cy + 22}" x2="${cx - 20}" y2="${cy + 22}" stroke="var(--ice-line-red)" stroke-width="3"/>
    <line x1="${cx + 20}" y1="${cy + 22}" x2="${cx + 60}" y2="${cy + 22}" stroke="var(--ice-line-red)" stroke-width="3"/>`;
}

function dot(cx, cy) {
  return `<circle cx="${cx}" cy="${cy}" r="12" fill="var(--ice-line-red)"/>`;
}

/**
 * Filet et territoire de but.
 *
 * Le territoire n'est pas un simple demi-cercle : c'est un arc de 6 pi de rayon
 * centré sur le milieu de la ligne des buts, tronqué à 4 pi de part et d'autre,
 * relié à la ligne par deux courts segments droits. Tracer l'arc directement
 * entre les deux extrémités donne une bosse de 1,5 pi au lieu de 6 — le
 * territoire disparaît alors visuellement.
 */
function goalAndCrease(x, dir) {
  const r = 60;          // rayon de l'arc, 6 pi
  const half = 40;       // demi-largeur du territoire, 4 pi
  const dx = Math.sqrt(r * r - half * half);   // ≈ 44,7
  const x1 = x + dir * dx;
  const sweep = dir > 0 ? 1 : 0;
  const netW = 60, netD = 40;

  const crease =
    `<path d="M ${x} ${MID_Y - half} L ${x1} ${MID_Y - half}
       A ${r} ${r} 0 0 ${sweep} ${x1} ${MID_Y + half} L ${x} ${MID_Y + half} Z"
       fill="var(--ice-crease)" stroke="var(--ice-line-red)" stroke-width="3"/>`;
  const net =
    `<rect x="${dir > 0 ? x - netD : x}" y="${MID_Y - netW / 2}" width="${netD}" height="${netW}"
       rx="6" fill="rgba(255,255,255,.65)" stroke="var(--ice-line-red)" stroke-width="4"/>`;
  return crease + net;
}

/**
 * Marquages complets de la patinoire, en balisage SVG (chaîne).
 * Les couleurs passent par des variables CSS pour rester correctes en
 * thème clair, en thème sombre et à l'impression.
 */
export function rinkMarkupFull({ boards = true, markings = true } = {}) {
  let s = '';
  if (boards) {
    s += `<path d="${boardsPath()}" fill="var(--ice)" stroke="var(--ice-board)" stroke-width="8"/>`;
  }
  if (!markings) return s;

  const glhL = goalLineHalfHeight(GOAL_LINE_L);
  const glhR = goalLineHalfHeight(RINK_W - GOAL_LINE_R);

  // Lignes de but
  s += `<line x1="${GOAL_LINE_L}" y1="${MID_Y - glhL}" x2="${GOAL_LINE_L}" y2="${MID_Y + glhL}"
          stroke="var(--ice-line-red)" stroke-width="4"/>`;
  s += `<line x1="${GOAL_LINE_R}" y1="${MID_Y - glhR}" x2="${GOAL_LINE_R}" y2="${MID_Y + glhR}"
          stroke="var(--ice-line-red)" stroke-width="4"/>`;

  // Lignes bleues et ligne centrale
  s += `<line x1="${BLUE_L}" y1="0" x2="${BLUE_L}" y2="${RINK_H}" stroke="var(--ice-line-blue)" stroke-width="10"/>`;
  s += `<line x1="${BLUE_R}" y1="0" x2="${BLUE_R}" y2="${RINK_H}" stroke="var(--ice-line-blue)" stroke-width="10"/>`;
  s += `<line x1="${CENTER_X}" y1="0" x2="${CENTER_X}" y2="${RINK_H}" stroke="var(--ice-line-red)" stroke-width="10"/>`;

  // Cercle central
  s += `<circle cx="${CENTER_X}" cy="${MID_Y}" r="${FO_R}" fill="none" stroke="var(--ice-line-blue)" stroke-width="3"/>`;
  s += `<circle cx="${CENTER_X}" cy="${MID_Y}" r="15" fill="var(--ice-line-blue)"/>`;

  // Cercles de mise au jeu en zone
  s += faceoffCircle(FO_END_X_L, MID_Y - FO_DY) + faceoffCircle(FO_END_X_L, MID_Y + FO_DY);
  s += faceoffCircle(FO_END_X_R, MID_Y - FO_DY) + faceoffCircle(FO_END_X_R, MID_Y + FO_DY);

  // Points en zone neutre
  s += dot(NZ_X_L, MID_Y - FO_DY) + dot(NZ_X_L, MID_Y + FO_DY);
  s += dot(NZ_X_R, MID_Y - FO_DY) + dot(NZ_X_R, MID_Y + FO_DY);

  // Territoires de but et filets
  s += goalAndCrease(GOAL_LINE_L, 1) + goalAndCrease(GOAL_LINE_R, -1);

  return s;
}

/** Marquage d'une surface donnée. */
export function rinkMarkup(surfaceId) {
  const s = SURFACE_BY_ID[surfaceId] || SURFACE_BY_ID.full;
  return rinkMarkupFull({ boards: s.boards !== false, markings: s.markings !== false });
}

/** Grille d'aimantation, pas de 50 unités (5 pi). */
export const GRID_STEP = 50;
export function gridMarkup(vb) {
  const [x0, y0, w, h] = vb;
  let s = `<g class="rink-grid" stroke="#9db4c8" stroke-width="1.2" opacity=".45">`;
  const sx = Math.ceil(x0 / GRID_STEP) * GRID_STEP;
  for (let x = sx; x <= x0 + w; x += GRID_STEP) {
    s += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + h}"/>`;
  }
  const sy = Math.ceil(y0 / GRID_STEP) * GRID_STEP;
  for (let y = sy; y <= y0 + h; y += GRID_STEP) {
    s += `<line x1="${x0}" y1="${y}" x2="${x0 + w}" y2="${y}"/>`;
  }
  return s + '</g>';
}

export function snap(v, on) {
  return on ? Math.round(v / (GRID_STEP / 2)) * (GRID_STEP / 2) : v;
}

/** Centre de la fenêtre courante — position par défaut d'un nouvel objet. */
export function surfaceCenter(surfaceId) {
  const vb = surfaceViewBox(surfaceId);
  return { x: vb[0] + vb[2] / 2, y: vb[1] + vb[3] / 2 };
}
