import type { EtatZone, GameState, Hotspot, Passage, Poi, Scenario, Variante, Vue, Zone } from './types';

export interface Index {
  zones: Map<string, Zone>;
  poi: Map<string, Poi>;
  vueZone: Map<string, string>;
}

const cache = new WeakMap<Scenario, Index>();

export function indexer(s: Scenario): Index {
  let idx = cache.get(s);
  if (!idx) {
    idx = {
      zones: new Map(s.zones.map((z) => [z.id, z])),
      poi: new Map(s.poi.map((p) => [p.id, p])),
      vueZone: new Map(s.zones.flatMap((z) => z.vues.map((v) => [v.id, z.id] as [string, string]))),
    };
    cache.set(s, idx);
  }
  return idx;
}

/** Zone effective d'un POI (la victime dépend de la variante d'arrivée). */
export function zonePoi(s: Scenario, p: Poi, variante: Variante): string {
  const v = s.regles.victime;
  return v && p.placement === v.placement ? v.zone_par_variante[variante] : p.zone;
}

export function trouverPassage(s: Scenario, a: string, b: string): Passage | undefined {
  return s.passages.find((p) => (p.de === a && p.vers === b) || (p.de === b && p.vers === a));
}

/** Renvoie le passage s'il est fermé (porte non ouverte), sinon undefined. */
export function porteFermee(s: Scenario, st: GameState, a: string, b: string): Passage | undefined {
  const p = trouverPassage(s, a, b);
  return p && p.porte && p.ferme_au_depart && !st.portesOuvertes.includes(p.porte) ? p : undefined;
}

/** Vues de navigation « normales » d'une zone (hors regards haut/bas). */
export function vuesPlanes(z: Zone) {
  return z.vues.filter((v) => !v.direction);
}

export function etatInitial(s: Scenario): Record<string, { etat: EtatZone }> {
  return Object.fromEntries(s.zones.map((z) => [z.id, { etat: 'inconnue' as EtatZone }]));
}

/** Recalcule l'état d'une zone : reconnue si toutes ses vues ont été vues. */
export function etatZone(z: Zone, vuesVues: string[], dejaEntree: boolean): EtatZone {
  if (!dejaEntree) return 'inconnue';
  const exigees = z.vues.filter((v) => !v.facultative);
  return exigees.length > 0 && exigees.every((v) => vuesVues.includes(v.id)) ? 'reconnue' : 'traversee';
}

/** Silhouette : zone inconnue dont une voisine a été entrée. */
export function silhouetteVisible(s: Scenario, st: GameState, z: Zone): boolean {
  if (st.zones[z.id].etat !== 'inconnue') return false;
  const idx = indexer(s);
  return z.voisines.some((v) => idx.zones.has(v) && st.zones[v].etat !== 'inconnue');
}

/** Première vue où l'on peut relever un POI (hotspot de POI, ou passage qui le porte). */
export function vueDuPoi(s: Scenario, poiId: string): { zone: Zone; vue: Vue; hotspot: Hotspot } | undefined {
  for (const z of s.zones)
    for (const v of z.vues) {
      const h = (v.hotspots ?? []).find((x) => x.poi === poiId);
      if (h) return { zone: z, vue: v, hotspot: h };
    }
  return undefined;
}

export function centroide(poly: [number, number][]): [number, number] {
  const n = poly.length;
  return [poly.reduce((a, p) => a + p[0], 0) / n, poly.reduce((a, p) => a + p[1], 0) / n];
}
