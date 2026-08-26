/**
 * Taxonomies : catégories d'âge, habiletés, situations, espaces de glace,
 * niveaux de difficulté, palettes de couleur. Une seule source de vérité,
 * consommée par les filtres, la fiche d'exercice et l'éditeur.
 */

export const AGE_GROUPS = [
  { id: 'initiation', fr: 'Initiation',  en: 'Initiation',  hint: '4-6 ans' },
  { id: 'u7',   fr: 'U7',      en: 'U7',      hint: '6-7 ans' },
  { id: 'u9',   fr: 'U9',      en: 'U9',      hint: '8-9 ans' },
  { id: 'u11',  fr: 'U11',     en: 'U11',     hint: '10-11 ans' },
  { id: 'u13',  fr: 'U13',     en: 'U13',     hint: '12-13 ans' },
  { id: 'u15',  fr: 'U15',     en: 'U15',     hint: '14-15 ans' },
  { id: 'u18',  fr: 'U18',     en: 'U18',     hint: '16-17 ans' },
  { id: 'junior', fr: 'Junior', en: 'Junior', hint: '' },
  { id: 'adulte', fr: 'Adulte', en: 'Adult',  hint: '' },
];

export const SKILLS = [
  { id: 'position-base',    fr: 'Position de base',        grp: 'Patinage' },
  { id: 'equilibre',        fr: 'Équilibre',               grp: 'Patinage' },
  { id: 'patinage-avant',   fr: 'Patinage avant',          grp: 'Patinage' },
  { id: 'patinage-arriere', fr: 'Patinage arrière',        grp: 'Patinage' },
  { id: 'acceleration',     fr: 'Accélération',            grp: 'Patinage' },
  { id: 'depart',           fr: 'Départ',                  grp: 'Patinage' },
  { id: 'freinage',         fr: 'Freinage et arrêt',       grp: 'Patinage' },
  { id: 'virage',           fr: 'Virage',                  grp: 'Patinage' },
  { id: 'pivot',            fr: 'Pivot',                   grp: 'Patinage' },
  { id: 'croisements',      fr: 'Croisements',             grp: 'Patinage' },
  { id: 'maniement',        fr: 'Maniement de rondelle',   grp: 'Rondelle' },
  { id: 'protection-rondelle', fr: 'Protection de rondelle', grp: 'Rondelle' },
  { id: 'passe',            fr: 'Passe',                   grp: 'Rondelle' },
  { id: 'reception',        fr: 'Réception de passe',      grp: 'Rondelle' },
  { id: 'tir',              fr: 'Tir',                     grp: 'Rondelle' },
  { id: 'feinte',           fr: 'Feinte',                  grp: 'Rondelle' },
  { id: 'prise-information', fr: 'Prise d’information',    grp: 'Tactique' },
  { id: 'prise-decision',   fr: 'Prise de décision',       grp: 'Tactique' },
  { id: 'demarquage',       fr: 'Démarquage',              grp: 'Tactique' },
  { id: 'marquage',         fr: 'Marquage',                grp: 'Tactique' },
  { id: 'approche-porteur', fr: 'Approche au porteur',     grp: 'Tactique' },
  { id: 'controle-ecart',   fr: 'Contrôle de l’écart',     grp: 'Tactique' },
  { id: 'recuperation',     fr: 'Récupération de rondelle', grp: 'Tactique' },
  { id: 'jeu-defensif',     fr: 'Jeu défensif',            grp: 'Tactique' },
  { id: 'jeu-offensif',     fr: 'Jeu offensif',            grp: 'Tactique' },
  { id: 'transition',       fr: 'Transition',              grp: 'Tactique' },
  { id: 'sortie-zone',      fr: 'Sortie de zone',          grp: 'Système' },
  { id: 'entree-zone',      fr: 'Entrée de zone',          grp: 'Système' },
  { id: 'mise-au-jeu',      fr: 'Mise au jeu',             grp: 'Système' },
  { id: 'unites-speciales', fr: 'Unités spéciales',        grp: 'Système' },
  { id: 'gardien',          fr: 'Gardien',                 grp: 'Système' },
];

export const SITUATIONS = [
  { id: '1c0', fr: '1 contre 0' },
  { id: '1c1', fr: '1 contre 1' },
  { id: '2c1', fr: '2 contre 1' },
  { id: '2c2', fr: '2 contre 2' },
  { id: '3c2', fr: '3 contre 2' },
  { id: '3c3', fr: '3 contre 3' },
  { id: 'espace-restreint', fr: 'Jeu en espace restreint' },
  { id: 'station', fr: 'Station' },
  { id: 'echauffement', fr: 'Échauffement' },
  { id: 'competition', fr: 'Compétition' },
  { id: 'relais', fr: 'Relais' },
  { id: 'jeu-collectif', fr: 'Jeu collectif' },
  { id: 'continu', fr: 'Exercice continu' },
  { id: 'aleatoire', fr: 'Situation aléatoire' },
  { id: 'avantage', fr: 'Avantage numérique' },
  { id: 'desavantage', fr: 'Désavantage numérique' },
];

export const ICE_SPACES = [
  { id: 'pleine',  fr: 'Pleine glace' },
  { id: 'demi',    fr: 'Demi-glace' },
  { id: 'zone',    fr: 'Zone (offensive ou défensive)' },
  { id: 'neutre',  fr: 'Zone neutre' },
  { id: 'quart',   fr: 'Quart de glace' },
  { id: 'sixieme', fr: 'Sixième de glace' },
  { id: 'coin',    fr: 'Coin de patinoire' },
  { id: 'hors-glace', fr: 'Hors glace' },
];

export const DIFFICULTIES = [
  { id: 1, fr: 'Découverte' },
  { id: 2, fr: 'Facile' },
  { id: 3, fr: 'Intermédiaire' },
  { id: 4, fr: 'Avancé' },
  { id: 5, fr: 'Élite' },
];

export const VISIBILITIES = [
  { id: 'prive',   fr: 'Privé' },
  { id: 'partage', fr: 'Partagé' },
  { id: 'public',  fr: 'Public' },
];

/** Palette de dessin — contrastée sur glace claire ET à l'impression. */
export const COLORS = [
  { hex: '#12212e', fr: 'Anthracite' },
  { hex: '#d2262c', fr: 'Rouge' },
  { hex: '#1f5fd0', fr: 'Bleu' },
  { hex: '#1a8a4e', fr: 'Vert' },
  { hex: '#c46a00', fr: 'Orange' },
  { hex: '#7b2fbe', fr: 'Violet' },
  { hex: '#00868f', fr: 'Sarcelle' },
  { hex: '#8a6d00', fr: 'Ocre' },
];

const idx = (arr) => Object.fromEntries(arr.map((o) => [o.id, o]));
export const AGE_BY_ID = idx(AGE_GROUPS);
export const SKILL_BY_ID = idx(SKILLS);
export const SITUATION_BY_ID = idx(SITUATIONS);
export const SPACE_BY_ID = idx(ICE_SPACES);
export const DIFF_BY_ID = idx(DIFFICULTIES);

export const labelAge = (id) => (AGE_BY_ID[id] ? AGE_BY_ID[id].fr : id);
export const labelSkill = (id) => (SKILL_BY_ID[id] ? SKILL_BY_ID[id].fr : id);
export const labelSituation = (id) => (SITUATION_BY_ID[id] ? SITUATION_BY_ID[id].fr : id);
export const labelSpace = (id) => (SPACE_BY_ID[id] ? SPACE_BY_ID[id].fr : id);
export const labelDiff = (id) => (DIFF_BY_ID[id] ? DIFF_BY_ID[id].fr : String(id));

/** Habiletés groupées, pour l'affichage en colonnes dans le panneau de filtres. */
export function skillsByGroup() {
  const out = new Map();
  for (const s of SKILLS) {
    if (!out.has(s.grp)) out.set(s.grp, []);
    out.get(s.grp).push(s);
  }
  return out;
}
