import { SHEETS_URL } from '../config';
import { chargerResultats, type Resultat } from './resultats';
import { couverture } from './score';
import type { Scenario } from './types';

/**
 * Envoi des parties vers la feuille Google Sheets, avec file d'attente : une partie jouée sans réseau
 * reste sur le poste et repart au retour de la connexion. Le stockage local reste la référence du poste.
 */

const CLE_FILE = 'recon-envoi-attente-v1';
const CLE_CODE = 'recon-code-formateur';

export const enLigneActif = () => !!SHEETS_URL;

function lireFile(): string[] {
  try {
    const l = JSON.parse(localStorage.getItem(CLE_FILE) ?? '[]');
    return Array.isArray(l) ? l : [];
  } catch {
    return [];
  }
}

function ecrireFile(ids: string[]) {
  try { localStorage.setItem(CLE_FILE, JSON.stringify(ids)); } catch { /* sans effet */ }
}

export const enAttente = (id: string) => lireFile().includes(id);

// text/plain : requête « simple », sans pré-vérification CORS, que l'application Web Apps Script accepte
async function poster(corps: unknown): Promise<{ ok: boolean; erreur?: string; [k: string]: unknown }> {
  const rep = await fetch(SHEETS_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(corps) });
  return rep.json();
}

async function envoyer(sc: Scenario, r: Resultat): Promise<boolean> {
  try {
    const releves = [...sc.grille.exterieur, ...sc.grille.interieur].filter((it) => it.poi.some((p) => r.etat.poiTrouves.includes(p))).length;
    const rep = await poster({ action: 'ajouter', resultat: r, resume: { couverture: Math.round(couverture(sc, r.etat).global * 100), releves } });
    return rep.ok;
  } catch {
    return false;
  }
}

/** Envoie la partie ; sans réseau, elle est mise en file pour un renvoi automatique. Renvoie true si elle est en ligne. */
export async function publier(sc: Scenario, r: Resultat): Promise<boolean> {
  if (!enLigneActif()) return false;
  if (await envoyer(sc, r)) {
    void viderFile(sc);
    return true;
  }
  ecrireFile([...new Set([...lireFile(), r.id])]);
  return false;
}

let enCours: Promise<void> | null = null;

/** Renvoie les parties restées en attente (au démarrage, au retour du réseau). */
export function viderFile(sc: Scenario): Promise<void> {
  if (!enLigneActif()) return Promise.resolve();
  enCours ??= (async () => {
    const parId = new Map(chargerResultats().map((r) => [r.id, r]));
    for (const id of lireFile()) {
      const r = parId.get(id);
      // partie supprimée du poste entre-temps : on l'oublie
      if (!r || (await envoyer(sc, r))) ecrireFile(lireFile().filter((x) => x !== id));
    }
  })().finally(() => (enCours = null));
  return enCours;
}

export function codeFormateur(): string {
  try { return localStorage.getItem(CLE_CODE) ?? ''; } catch { return ''; }
}

export function memoriserCode(code: string) {
  try { code ? localStorage.setItem(CLE_CODE, code) : localStorage.removeItem(CLE_CODE); } catch { /* sans effet */ }
}

export class CodeRefuse extends Error {}

/** Toutes les parties de la feuille (code formateur exigé). */
export async function lireEnLigne(code: string): Promise<Resultat[]> {
  // le code part dans le corps de la requête, jamais dans l'adresse
  const json = (await poster({ action: 'lister', code })) as { ok: boolean; erreur?: string; resultats?: Resultat[] };
  if (!json.ok) throw json.erreur === 'code' ? new CodeRefuse('Code formateur refusé.') : new Error('Lecture en ligne impossible.');
  return json.resultats ?? [];
}

export async function supprimerEnLigne(id: string, code: string): Promise<boolean> {
  try {
    return (await poster({ action: 'supprimer', id, code })).ok;
  } catch {
    return false;
  }
}
