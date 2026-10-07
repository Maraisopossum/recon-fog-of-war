import { etatInitial, etatZone, indexer, porteFermee, trouverPassage, vuesPlanes } from './rules';
import type { GameState, Rapport, Scenario, Variante } from './types';

export type Action =
  | { type: 'start'; variante: Variante }
  | { type: 'goto'; zone: string; vue?: string }
  | { type: 'vue'; vue: string }
  | { type: 'markSeen'; vue: string }
  | { type: 'openDoor'; porte: string }
  | { type: 'poi'; poi: string }
  | { type: 'tick' }
  | { type: 'desenfumer' }
  | { type: 'aide'; valeur: boolean }
  | { type: 'report'; rapport: Rapport }
  | { type: 'terminer' }
  | { type: 'restart' }
  | { type: 'replace'; state: GameState };

export function stateInitial(s: Scenario): GameState {
  const z0 = s.zones[0];
  return {
    phase: 'briefing',
    position: { zone: z0.id, vue: z0.vues[0].id },
    zones: etatInitial(s),
    vuesVues: [],
    poiTrouves: [],
    portesOuvertes: [],
    variante: 'A',
    chrono: 0,
    chronologie: [],
    rapport: null,
    aide: false,
    desenfumage: false,
    vueRetour: null,
    evenements: [],
  };
}

function log(st: GameState, type: 'poi' | 'porte' | 'zone' | 'action', texte: string): GameState {
  return { ...st, evenements: [...st.evenements, { id: st.evenements.length + 1, t: st.chrono, type, texte }] };
}

function entrer(s: Scenario, st: GameState, zone: string, vueCible?: string): GameState {
  const idx = indexer(s);
  const z = idx.zones.get(zone)!;
  const etat = etatZone(z, st.vuesVues, true);
  const premiere = z.vues.find((v) => v.id === vueCible) ?? vuesPlanes(z)[0] ?? z.vues[0];
  const dernier = st.chronologie[st.chronologie.length - 1];
  let n: GameState = {
    ...st,
    position: { zone, vue: premiere.id },
    vueRetour: null,
    zones: { ...st.zones, [zone]: { etat } },
    chronologie: dernier?.zone === zone ? st.chronologie : [...st.chronologie, { zone, t: st.chrono }],
  };
  if (dernier?.zone !== zone) n = log(n, 'zone', z.nom);
  return n;
}

export function reduce(s: Scenario, st: GameState, a: Action): GameState {
  const idx = indexer(s);
  switch (a.type) {
    case 'start': {
      const depart = s.regles.depart_par_variante[a.variante];
      const base: GameState = { ...stateInitial(s), phase: 'jeu', variante: a.variante, aide: st.aide };
      return entrer(s, base, depart);
    }
    case 'goto': {
      if (st.phase !== 'jeu' || !idx.zones.has(a.zone)) return st;
      const pass = trouverPassage(s, st.position.zone, a.zone);
      if (!pass || porteFermee(s, st, st.position.zone, a.zone)) return st;
      return entrer(s, st, a.zone, a.vue);
    }
    case 'vue': {
      const z = idx.zones.get(st.position.zone)!;
      const cible = z.vues.find((v) => v.id === a.vue);
      if (!cible) return st;
      // On retient la vue d'où l'on lève les yeux pour y revenir (et pas toujours à la première vue)
      const courante = z.vues.find((v) => v.id === st.position.vue);
      const vueRetour = cible.direction ? (courante && !courante.direction ? courante.id : st.vueRetour) : null;
      return { ...st, position: { zone: z.id, vue: a.vue }, vueRetour };
    }
    case 'markSeen': {
      const zid = idx.vueZone.get(a.vue);
      if (!zid || st.vuesVues.includes(a.vue)) return st;
      const vuesVues = [...st.vuesVues, a.vue];
      const etat = etatZone(idx.zones.get(zid)!, vuesVues, st.zones[zid].etat !== 'inconnue');
      return { ...st, vuesVues, zones: { ...st.zones, [zid]: { etat } } };
    }
    case 'openDoor': {
      if (st.portesOuvertes.includes(a.porte)) return st;
      return log({ ...st, portesOuvertes: [...st.portesOuvertes, a.porte] }, 'porte', `Porte ouverte : ${a.porte.replace(/^porte_/, '').replace(/_/g, ' ')}`);
    }
    case 'poi': {
      const p = idx.poi.get(a.poi);
      if (!p || st.poiTrouves.includes(a.poi)) return st;
      return log({ ...st, poiTrouves: [...st.poiTrouves, a.poi] }, 'poi', `${p.libelle} : ${p.texte_revele}`);
    }
    case 'tick':
      return st.phase === 'jeu' ? { ...st, chrono: st.chrono + 1 } : st;
    case 'desenfumer':
      if (st.phase !== 'jeu' || st.desenfumage) return st;
      return log({ ...st, desenfumage: true }, 'action', 'Désenfumage de la cage actionné (lanterneau ouvert)');
    case 'aide':
      return { ...st, aide: a.valeur };
    case 'report':
      return { ...st, rapport: a.rapport, phase: 'debrief' };
    case 'terminer':
      // Fin de partie sans compte rendu : on passe directement au débriefing
      return st.phase === 'jeu' ? { ...st, phase: 'debrief' } : st;
    case 'restart':
      return { ...stateInitial(s), aide: st.aide };
    case 'replace':
      return a.state;
  }
}

export interface Store {
  scenario: Scenario;
  get(): GameState;
  dispatch(a: Action): void;
  subscribe(fn: (st: GameState, prev: GameState) => void): () => void;
}

export function createStore(scenario: Scenario): Store {
  let state = stateInitial(scenario);
  const subs = new Set<(st: GameState, prev: GameState) => void>();
  return {
    scenario,
    get: () => state,
    dispatch(a) {
      const prev = state;
      state = reduce(scenario, state, a);
      if (state !== prev) subs.forEach((f) => f(state, prev));
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}

export type { Rapport, Variante };
