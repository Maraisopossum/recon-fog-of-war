import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mission from '../scenarios/mission-01.json';
import { enAttente, publier, viderFile } from '../src/game/enligne';
import { ajouterResultat, creerResultat } from '../src/game/resultats';
import { reduce, stateInitial } from '../src/game/store';
import type { Scenario } from '../src/game/types';

const sc = mission as unknown as Scenario;
const partie = () => creerResultat(sc, reduce(sc, stateInitial(sc), { type: 'start', variante: 'A', stagiaire: 'Jean Dupont' }));

describe('envoi en ligne', () => {
  beforeEach(() => {
    const m = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sans réseau, la partie reste en file puis repart au retour de la connexion', async () => {
    const r = partie();
    ajouterResultat(r);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await publier(sc, r)).toBe(false);
    expect(enAttente(r.id)).toBe(true);

    const envoye = vi.fn().mockResolvedValue({ json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', envoye);
    await viderFile(sc);
    expect(enAttente(r.id)).toBe(false);
    const corps = JSON.parse(envoye.mock.calls[0][1].body);
    expect(corps.action).toBe('ajouter');
    expect(corps.resultat.stagiaire).toBe('Jean Dupont');
    // requête « simple » : pas de pré-vérification CORS
    expect(envoye.mock.calls[0][1].headers['Content-Type']).toMatch(/^text\/plain/);
  });

  it('une partie envoyée du premier coup ne reste pas en file', async () => {
    const r = partie();
    ajouterResultat(r);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ ok: true }) }));
    expect(await publier(sc, r)).toBe(true);
    expect(enAttente(r.id)).toBe(false);
  });
});
