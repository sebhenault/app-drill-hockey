/**
 * DrillBuilder Hockey — Modèles de données
 * ----------------------------------------
 * Source de vérité du format JSON des exercices, des plans de pratique et
 * du contenu du canevas. Le prototype PWA (JavaScript) respecte exactement
 * ces formes ; la version de production (React + TypeScript) importe ce
 * fichier tel quel.
 *
 * Convention : toutes les dates sont des chaînes ISO 8601 UTC.
 * Convention : toutes les coordonnées du canevas sont exprimées en
 * « unités glace » (1 unité = 0,1 pied). Une patinoire complète de la LNH
 * mesure donc 2000 × 850 unités. Ce choix rend les diagrammes indépendants
 * de la résolution d'affichage et exportables sans perte.
 */

/* ==========================================================================
   1. Taxonomies
   ========================================================================== */

/** Catégories d'âge — nomenclature Hockey Canada / Hockey Québec. */
export type AgeGroupId =
  | 'initiation' | 'u7' | 'u9' | 'u11' | 'u13' | 'u15' | 'u18'
  | 'junior' | 'adulte';

/** Habiletés travaillées. */
export type SkillId =
  | 'position-base' | 'equilibre' | 'patinage-avant' | 'patinage-arriere'
  | 'acceleration' | 'depart' | 'freinage' | 'virage' | 'pivot' | 'croisements'
  | 'maniement' | 'protection-rondelle' | 'passe' | 'reception' | 'tir' | 'feinte'
  | 'prise-information' | 'prise-decision' | 'demarquage' | 'marquage'
  | 'approche-porteur' | 'controle-ecart' | 'recuperation' | 'jeu-defensif'
  | 'jeu-offensif' | 'transition' | 'sortie-zone' | 'entree-zone'
  | 'mise-au-jeu' | 'unites-speciales' | 'gardien';

/** Situations de jeu / formats d'exercice. */
export type SituationId =
  | '1c0' | '1c1' | '2c1' | '2c2' | '3c2' | '3c3'
  | 'espace-restreint' | 'station' | 'echauffement' | 'competition' | 'relais'
  | 'jeu-collectif' | 'continu' | 'aleatoire' | 'avantage' | 'desavantage';

/** Espace de glace requis. */
export type IceSpaceId =
  | 'pleine' | 'demi' | 'zone' | 'neutre' | 'quart' | 'sixieme' | 'coin' | 'hors-glace';

/** Niveau de difficulté, 1 (initiation) → 5 (élite). */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

/** Statut de partage. */
export type Visibility = 'prive' | 'partage' | 'public';

/** Langues supportées. `en` est prévu, non traduit dans le MVP. */
export type Locale = 'fr-CA' | 'en';

/* ==========================================================================
   2. Canevas — surfaces, éléments, trajectoires
   ========================================================================== */

/** Type de surface affichée dans l'éditeur. */
export type SurfaceId =
  | 'full'        // glace complète
  | 'half'        // demi-glace (longueur)
  | 'zone-off'    // zone offensive
  | 'zone-def'    // zone défensive
  | 'neutral'     // zone neutre
  | 'quarter'     // quart de glace
  | 'sixth'       // sixième de glace
  | 'blank'       // patinoire vide (bandes seulement)
  | 'grid';       // grille libre, sans marquage

/** Familles d'objets déposables. */
export type ObjectKind =
  | 'player' | 'opponent' | 'forward' | 'defence' | 'center' | 'winger'
  | 'goalie' | 'coach'
  | 'puck' | 'pucks'
  | 'cone' | 'net' | 'mini-net' | 'tire' | 'stick' | 'obstacle'
  | 'zone' | 'text' | 'step';

/** Styles de trajectoire. Le sens fonctionnel suit la convention usuelle
 *  des diagrammes de hockey ; les tracés SVG sont des créations originales. */
export type PathStyle =
  | 'skate'        // patinage avant — trait plein + flèche
  | 'backward'     // patinage arrière — trait à boucles ouvertes
  | 'puck-carry'   // patinage avec rondelle — ondulation
  | 'pass'         // passe — pointillé
  | 'shot'         // tir — trait double
  | 'lateral'      // déplacement latéral — tirets courts + barres
  | 'crossover'    // croisements — hachures obliques
  | 'pivot'        // pivot avant↔arrière
  | 'turn'         // virage serré
  | 'check'        // mise en échec / pression — trait épais en zigzag
  | 'handoff'      // remise / transport de rondelle
  | 'freehand';    // crayon libre (lissé)

/** Extrémité de ligne. */
export type CapStyle = 'none' | 'arrow' | 'stop' | 'pivot' | 'check' | 'tee';

/** Point du canevas, en unités glace. */
export interface Point { x: number; y: number; }

/** Base commune à tout élément du canevas. */
export interface CanvasElementBase {
  id: string;
  /** Ordre d'empilement croissant. */
  z: number;
  color: string;          // #rrggbb
  locked?: boolean;
  /** Étiquette optionnelle affichée dans/à côté de l'objet (F1, D2, G…). */
  label?: string;
}

/** Objet ponctuel (joueur, rondelle, cône, filet…). */
export interface CanvasObject extends CanvasElementBase {
  kind: 'object';
  obj: ObjectKind;
  x: number;
  y: number;
  /** Rotation en degrés, sens horaire. */
  rot: number;
  /** Facteur d'échelle, 1 = taille de référence. */
  scale: number;
  /** Pour `zone` : dimensions du rectangle en unités glace. */
  w?: number;
  h?: number;
  /** Pour `text` : contenu. Toujours inséré via textContent, jamais innerHTML. */
  text?: string;
  /** Pour `text` : taille de police en unités glace. */
  fontSize?: number;
}

/** Trajectoire ou trait libre. */
export interface CanvasPath extends CanvasElementBase {
  kind: 'path';
  style: PathStyle;
  /** Au moins 2 points. Les points intermédiaires produisent une courbe lissée. */
  points: Point[];
  /** Épaisseur du trait en unités glace. */
  width: number;
  startCap: CapStyle;
  endCap: CapStyle;
  /** Identifiant de l'objet qui suit cette trajectoire pendant l'animation. */
  followerId?: string | null;
}

export type CanvasElement = CanvasObject | CanvasPath;

/* ==========================================================================
   3. Séquences
   ========================================================================== */

export interface DrillSequence {
  id: string;
  /** Nom court affiché sur la ligne du temps (« Départ », « Appui »…). */
  name: string;
  /** Durée de lecture de la séquence, en secondes. */
  duration: number;
  /** Note affichée sous le diagramme pour cette séquence. */
  note?: string;
  elements: CanvasElement[];
}

/* ==========================================================================
   4. Vidéo et source
   ========================================================================== */

export type VideoProvider = 'youtube' | 'vimeo' | 'externe';

export interface VideoLink {
  id: string;
  url: string;                 // URL validée : http(s) uniquement
  provider: VideoProvider;
  title?: string;
  /** Nom de la plateforme ou du site d'origine. */
  sourceName?: string;
  /** Miniature — URL https, ou dérivée de l'identifiant de la plateforme. */
  thumbnail?: string;
  /** Minutage de départ pertinent, en secondes. */
  startAt?: number;
  note?: string;
}

export interface Source {
  id: string;
  /** Nom de la source (organisation, site, personne). */
  name: string;
  url?: string;
  /** true si le contenu appartient à un tiers : afficher la mention de droits. */
  external: boolean;
  /** Mention affichée lorsque `external` est vrai. */
  rightsNotice?: string;
}

/* ==========================================================================
   5. Exercice
   ========================================================================== */

export interface Drill {
  id: string;
  schemaVersion: 1;

  // Identification
  title: string;
  summary: string;
  description: string;
  objectives: string[];

  // Classement
  ageGroups: AgeGroupId[];
  difficulty: Difficulty;
  skills: SkillId[];
  situations: SituationId[];

  // Logistique
  playersMin: number;
  playersMax: number;
  goalies: number;
  durationMin: number;         // durée recommandée, en minutes
  iceSpace: IceSpaceId;
  equipment: string[];

  // Contenu pédagogique
  setup: string;
  steps: string[];
  teachingPoints: string[];
  commonErrors: string[];
  variationsEasier: string[];
  variationsHarder: string[];
  safety: string[];
  keywords: string[];

  // Diagramme
  surface: SurfaceId;
  sequences: DrillSequence[];

  // Références
  videos: VideoLink[];
  source?: Source;
  author: string;

  // Métadonnées
  visibility: Visibility;
  /** true pour les 20 exercices de démonstration livrés avec l'application. */
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

/* ==========================================================================
   6. Plans de pratique
   ========================================================================== */

export type PlanItemType = 'drill' | 'warmup' | 'break' | 'conclusion' | 'note';

export interface PracticePlanItem {
  id: string;
  type: PlanItemType;
  /** Renseigné seulement lorsque `type === 'drill'`. */
  drillId?: string;
  /** Titre affiché. Pour un exercice, copié à l'ajout puis modifiable. */
  title: string;
  /** Durée allouée dans la pratique, en minutes. */
  duration: number;
  notes?: string;
}

export interface PracticePlan {
  id: string;
  schemaVersion: 1;
  title: string;
  ageGroup: AgeGroupId;
  /** Date de la pratique, format ISO court AAAA-MM-JJ. */
  date: string;
  /** Durée totale prévue de la séance, en minutes. */
  plannedDuration: number;
  items: PracticePlanItem[];
  equipment: string[];
  coachNotes: string;
  createdAt: string;
  updatedAt: string;
}

/* ==========================================================================
   7. Utilisateur, favoris, réglages
   ========================================================================== */

/**
 * Dans le prototype hors-ligne, un seul utilisateur local implicite existe.
 * Le modèle est conservé pour la version serveur (Supabase auth.users).
 */
export interface User {
  id: string;
  displayName: string;
  email?: string;
  locale: Locale;
  createdAt: string;
}

export interface Favorite {
  drillId: string;
  userId: string;
  createdAt: string;
}

export interface Settings {
  locale: Locale;
  theme: 'dark' | 'light';
  contrast: 'normal' | 'high';
  textSize: 'm' | 'l' | 'xl';
  /** Consentement explicite avant toute analytique. Faux par défaut. */
  analyticsConsent: boolean;
  /** Aimantation à la grille dans l'éditeur. */
  snapToGrid: boolean;
  gridVisible: boolean;
}

/* ==========================================================================
   8. Enveloppe d'export / import
   ========================================================================== */

export interface ExportBundle {
  app: 'drillbuilder-hockey';
  schemaVersion: 1;
  exportedAt: string;
  drills: Drill[];
  plans: PracticePlan[];
  favorites: string[];
  settings?: Settings;
}

/** Options de composition d'un export visuel (PNG, SVG, PDF, impression). */
export interface ExportOptions {
  includeTitle: boolean;
  includeDiagram: boolean;
  includeLegend: boolean;
  includeDescription: boolean;
  includeTeachingPoints: boolean;
  includeDuration: boolean;
  includeEquipment: boolean;
  includeSource: boolean;
  includeQrCode: boolean;
  /** Séquences à inclure ; vide = toutes. */
  sequenceIds: string[];
}
