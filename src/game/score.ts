import type { GameState, Scenario } from './types';

export interface Couverture {
  global: number;
  parNiveau: Record<string, number>;
}

/** Couverture = moyenne pondérée des états de zone. Les POI ne comptent pas. */
export function couverture(s: Scenario, st: GameState): Couverture {
  const poidsEtat = s.regles.etats;
  const acc = (zones: typeof s.zones) => {
    const total = zones.reduce((a, z) => a + z.poids, 0);
    if (total === 0) return 0;
    return zones.reduce((a, z) => a + z.poids * poidsEtat[st.zones[z.id].etat], 0) / total;
  };
  const parNiveau: Record<string, number> = {};
  for (const n of s.niveaux) parNiveau[n.id] = acc(s.zones.filter((z) => z.niveau === n.id));
  return { global: acc(s.zones), parNiveau };
}

export function niveauLeMoinsCouvert(s: Scenario, c: Couverture): { id: string; nom: string; valeur: number } {
  const [id, valeur] = Object.entries(c.parNiveau).sort((a, b) => a[1] - b[1])[0];
  return { id, nom: s.niveaux.find((n) => n.id === id)!.nom, valeur };
}

export const pct = (x: number) => `${Math.round(x * 100)} %`;
