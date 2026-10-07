/** Façade d'arrivée de l'engin (convention A-B-C-D : A = façade d'accès). La reconnaissance commence toujours en A. */
export type Variante = 'A';
export type NiveauId = string;
export type EtatZone = 'inconnue' | 'traversee' | 'reconnue';

export type Fleche = 'haut' | 'bas' | 'gauche' | 'droite';

export interface Hotspot {
  /** poi : élément à relever ; passage : autre zone ; vue : flèche vers une autre vue de la même zone */
  type: 'poi' | 'passage' | 'vue';
  poi?: string;
  vers?: string;
  /** vue d'arrivée : pour un passage, dans la zone de destination ; pour une flèche, dans la zone courante */
  vue?: string;
  /** glyphe de la flèche affichée (sinon ➤ pour un passage) */
  fleche?: Fleche;
  /** x, y, largeur, hauteur, normalisés (0..1) */
  zone_clic: [number, number, number, number];
}

export interface Vue {
  id: string;
  /** libellé court affiché dans la navigation */
  nom?: string;
  image: string;
  /** image affichée une fois le désenfumage de la cage actionné */
  image_desenfumage?: string;
  /** vue annexe (regard vers le haut, volée qui descend…) : n'est pas exigée pour reconnaître la zone */
  facultative?: boolean;
  /** pivot : flèches sur les bords de l'image pour tourner */
  mouvement?: 'pivot';
  panorama?: boolean;
  direction?: 'haut' | 'bas';
  variantes_image?: Partial<Record<Variante, string>>;
  hotspots?: Hotspot[];
}

export interface Zone {
  id: string;
  niveau: NiveauId;
  nom: string;
  poids: number;
  polygone: [number, number][];
  voisines: string[];
  cap?: number;
  vues: Vue[];
}

export interface Passage {
  de: string;
  vers: string;
  porte?: string;
  ferme_au_depart?: boolean;
  action?: string;
}

export interface Poi {
  id: string;
  zone: string;
  libelle: string;
  texte_revele: string;
  ou: string;
  cache: boolean;
  image_zoom?: string;
  placement?: string;
  a_valider?: boolean;
  /** action proposée dans le zoom du POI */
  action?: 'desenfumer';
}

export interface Niveau {
  id: NiveauId;
  nom: string;
  /** libellé court de l'indicateur de niveau (RDC, R+1…) */
  court?: string;
  decor: { polygone: [number, number][]; libelle?: string }[];
}

export interface Scenario {
  id: string;
  titre: string;
  briefing: { texte: string; requerant: string };
  variantes_arrivee: Variante[];
  niveaux: Niveau[];
  zones: Zone[];
  passages: Passage[];
  poi: Poi[];
  regles: {
    etats: Record<EtatZone, number>;
    reconnue_si: 'toutes_les_vues_vues';
    maintien_vue_ms: number;
    couverture_panorama: number;
    depart_par_variante: Record<Variante, string>;
    /** Optionnel : placement d'un POI selon la variante d'arrivée */
    victime?: { placement: string; zone_par_variante: Record<Variante, string> };
  };
}

export type Phase = 'briefing' | 'jeu' | 'debrief';

export interface Rapport {
  lieu: string;
  victimes: string;
  moyens: string[];
}

export interface GameState {
  phase: Phase;
  position: { zone: string; vue: string };
  zones: Record<string, { etat: EtatZone }>;
  vuesVues: string[];
  poiTrouves: string[];
  portesOuvertes: string[];
  variante: Variante;
  chrono: number;
  /** ordre des zones visitées */
  chronologie: { zone: string; t: number }[];
  rapport: Rapport | null;
  aide: boolean;
  /** désenfumage de la cage actionné depuis la commande du RDC */
  desenfumage: boolean;
  /** vue d'où l'on a levé les yeux : la flèche « retour » y ramène */
  vueRetour: string | null;
  /** journal des découvertes et actions */
  evenements: Evenement[];
}

export interface Evenement {
  id: number;
  t: number;
  type: 'poi' | 'porte' | 'zone' | 'action';
  texte: string;
}
