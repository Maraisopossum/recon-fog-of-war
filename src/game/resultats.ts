import { couverture } from './score';
import type { GameState, GrilleItem, Scenario } from './types';

/** Une partie terminée, enregistrée sur le poste pour la page formateur (?mode=resultats). */
export interface Resultat {
  id: string;
  /** date de fin, ISO */
  date: string;
  scenario: string;
  stagiaire: string;
  /** état final complet : il suffit à redessiner les plans et le compte rendu */
  etat: GameState;
}

const CLE = 'recon-resultats-v1';

export function creerResultat(sc: Scenario, st: GameState, date = new Date()): Resultat {
  return { id: `${date.getTime()}-${Math.random().toString(36).slice(2, 7)}`, date: date.toISOString(), scenario: sc.id, stagiaire: st.stagiaire || 'Sans nom', etat: st };
}

export function chargerResultats(): Resultat[] {
  try {
    const brut = localStorage.getItem(CLE);
    const liste = brut ? (JSON.parse(brut) as Resultat[]) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

export function sauverResultats(liste: Resultat[]): boolean {
  try {
    localStorage.setItem(CLE, JSON.stringify(liste));
    return true;
  } catch {
    return false;
  }
}

export function ajouterResultat(r: Resultat): boolean {
  return sauverResultats([...chargerResultats(), r]);
}

/** Fusionne une liste importée : les parties déjà présentes (même id) ne sont pas dupliquées. */
export function fusionner(actuels: Resultat[], importes: unknown): Resultat[] {
  if (!Array.isArray(importes)) throw new Error('Fichier invalide : une liste de parties est attendue.');
  const ids = new Set(actuels.map((r) => r.id));
  const valides = importes.filter((r): r is Resultat => !!r && typeof r === 'object' && typeof (r as Resultat).id === 'string' && !!(r as Resultat).etat);
  return [...actuels, ...valides.filter((r) => !ids.has(r.id))].sort((a, b) => a.date.localeCompare(b.date));
}

export interface StatutItem {
  releve: boolean;
  declare: boolean;
}

export function statut(st: GameState, it: GrilleItem): StatutItem {
  return { releve: it.poi.some((p) => st.poiTrouves.includes(p)), declare: !!st.rapport?.coches.includes(it.id) };
}

export interface SyntheseItem {
  item: GrilleItem;
  groupe: 'exterieur' | 'interieur';
  /** relevé en jeu */
  vus: number;
  declares: number;
  /** vu, dans une partie avec compte rendu */
  vusAvecCr: number;
  /** vu mais pas coché au compte rendu */
  vusNonDeclares: number;
  /** coché sans avoir été vu */
  declaresNonVus: number;
}

/** Éléments présents dans le scénario, avec leurs compteurs sur l'ensemble des parties. */
export function synthese(sc: Scenario, rs: Resultat[]): SyntheseItem[] {
  const groupes = [['exterieur', sc.grille.exterieur], ['interieur', sc.grille.interieur]] as const;
  return groupes.flatMap(([groupe, items]) =>
    items
      .filter((it) => it.poi.length > 0)
      .map((item) => {
        const s = rs.map((r) => statut(r.etat, item));
        return {
          item,
          groupe,
          vus: s.filter((x) => x.releve).length,
          declares: s.filter((x) => x.declare).length,
          vusAvecCr: s.filter((x, i) => x.releve && !!rs[i].etat.rapport).length,
          // sans compte rendu, « non déclaré » ne veut rien dire : ces parties ne comptent pas
          vusNonDeclares: s.filter((x, i) => x.releve && !x.declare && !!rs[i].etat.rapport).length,
          declaresNonVus: s.filter((x) => x.declare && !x.releve).length,
        };
      }),
  );
}

/** Nombre de parties où chaque zone est reconnue, ou seulement traversée. */
export function frequentationZones(sc: Scenario, rs: Resultat[]): Record<string, { reconnue: number; traversee: number }> {
  const out: Record<string, { reconnue: number; traversee: number }> = {};
  for (const z of sc.zones) {
    const etats = rs.map((r) => r.etat.zones[z.id]?.etat ?? 'inconnue');
    out[z.id] = { reconnue: etats.filter((e) => e === 'reconnue').length, traversee: etats.filter((e) => e === 'traversee').length };
  }
  return out;
}

const champ = (v: string | number) => {
  const t = String(v);
  return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** CSV pour Excel (séparateur « ; », une ligne par partie, une colonne par indicateur). */
export function versCsv(sc: Scenario, rs: Resultat[]): string {
  const items = [...sc.grille.exterieur, ...sc.grille.interieur].filter((it) => it.poi.length > 0);
  const tete = [
    'Stagiaire', 'Date', 'Durée (s)', 'Compte rendu', 'Couverture globale (%)',
    ...sc.niveaux.map((n) => `Couverture ${n.nom} (%)`),
    ...items.flatMap((it) => [`${it.libelle} : relevé`, `${it.libelle} : déclaré`]),
    ...sc.lecture_feu.map((l) => `Lecture ${l.lettre} ${l.titre}`),
    'Coupures', 'Actions demandées', 'Désenfumage', 'Gaine palière ouverte', 'Zones visitées',
  ];
  const lignes = rs.map((r) => {
    const st = r.etat;
    const c = couverture(sc, st);
    const zones = new Map(sc.zones.map((z) => [z.id, z.nom]));
    return [
      r.stagiaire, new Date(r.date).toLocaleString('fr-FR'), st.chrono, st.rapport ? 'oui' : 'non', Math.round(c.global * 100),
      ...sc.niveaux.map((n) => Math.round((c.parNiveau[n.id] ?? 0) * 100)),
      ...items.flatMap((it) => { const s = statut(st, it); return [s.releve ? 1 : 0, s.declare ? 1 : 0]; }),
      ...sc.lecture_feu.map((l) => st.rapport?.lecture[l.id]?.trim() ?? ''),
      st.coupures.map((k) => `${k.cible === 'palier' ? 'palier' : k.energie} ${k.cible}${k.logement ? ' ' + k.logement : ''}`).join(', '),
      st.demandes.map((d) => d.texte ?? 'sans précision').join(', '),
      st.desenfumage ? 'oui' : 'non', st.gaineOuverte ? 'oui' : 'non',
      st.chronologie.map((z) => zones.get(z.zone) ?? z.zone).join(' > '),
    ].map(champ).join(';');
  });
  // BOM : Excel lit alors les accents correctement
  return '﻿' + [tete.map(champ).join(';'), ...lignes].join('\r\n');
}
