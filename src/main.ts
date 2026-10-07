import './style.css';
import { creerVueChef } from './first-person/viewer';
import { createStore } from './game/store';
import { couverture } from './game/score';
import type { Scenario } from './game/types';
import { validerOuErreur } from './game/validate';
import { creerCarte } from './map/map';
import mission from '../scenarios/mission-01.json';
import { brancherCarte, brancherChef, choisirTransport } from './sync/adapter';
import { creerBriefing } from './ui/briefing';
import { creerDebrief } from './ui/debrief';
import { chronoTexte, h } from './ui/dom';
import { creerJournal } from './ui/journal';
import { ouvrirQuitter } from './ui/quitter';
import { ouvrirCompteRendu } from './ui/report';

const app = document.getElementById('app')!;
const params = new URLSearchParams(location.search);
const mode = (['single', 'chef', 'carte'] as const).find((m) => m === params.get('mode')) ?? 'single';

try {
  const scenario = validerOuErreur(mission as unknown as Scenario);
  const store = createStore(scenario);
  app.className = `mode-${mode}`;

  const entete = h('header', { class: 'topbar' });
  const chronoEl = h('span', { class: 'chrono', 'aria-label': 'Chronomètre' }, '00:00');
  const journal = creerJournal(app, store);
  const boutons = h('div', { class: 'topbar-actions' });
  // Indicateur de niveau : où l'on se situe (écran du joueur uniquement ; la carte a ses propres onglets)
  const puces = new Map(scenario.niveaux.map((n) => [n.id, h('span', { class: 'puce-niveau', title: n.nom }, n.court ?? n.nom)]));
  const indicateur = h('div', { class: 'niveaux-ind' + (mode === 'carte' ? ' cache' : ''), role: 'status', 'aria-label': 'Niveau actuel' }, ...puces.values());
  const majNiveau = () => {
    const st = store.get();
    const z = scenario.zones.find((zz) => zz.id === st.position.zone);
    indicateur.classList.toggle('inactif', st.phase !== 'jeu');
    for (const [id, el] of puces) el.classList.toggle('actif', st.phase === 'jeu' && z?.niveau === id);
  };
  store.subscribe(majNiveau);
  majNiveau();
  entete.append(h('span', { class: 'logo' }, 'RECON', h('em', {}, 'Fog of War')), h('span', { class: 'mission' }, scenario.titre), indicateur, chronoEl, boutons);

  boutons.append(h('button', { class: 'btn', id: 'btn-journal', onclick: () => journal.basculer() }, 'Journal'));
  if (mode !== 'carte') {
    const quitter = h('button', { class: 'btn', id: 'btn-quitter', onclick: () => ouvrirQuitter(app, store) }, 'Quitter');
    store.subscribe((st) => quitter.classList.toggle('cache', st.phase !== 'jeu'));
    quitter.classList.add('cache');
    boutons.append(quitter);
    boutons.append(h('button', { class: 'btn primaire', id: 'btn-rendre', onclick: () => ouvrirCompteRendu(app, store) }, 'Rendre compte'));
  }
  app.prepend(entete);

  const zoneJeu = h('main', { class: 'jeu' });
  const colChef = h('div', { class: 'col-chef' });
  const colCarte = h('div', { class: 'col-carte' });
  if (mode !== 'carte') zoneJeu.append(colChef);
  // La carte n'existe que sur le second écran (?mode=carte) : en écran unique, elle guiderait le joueur.
  if (mode === 'carte') zoneJeu.append(colCarte);
  app.append(zoneJeu);

  if (mode !== 'carte') creerVueChef(colChef, store);
  // Téléphone en portrait : suggérer le mode paysage (une seule fois par session)
  if (mode !== 'carte') {
    let vu = false;
    try { vu = sessionStorage.getItem('astuce-paysage') === '1'; } catch { /* stockage indisponible */ }
    if (!vu) {
      const astuce = h('div', { class: 'astuce-paysage', role: 'note' }, h('span', {}, 'Astuce : tournez le téléphone en mode paysage pour agrandir l’image.'), h('button', { onclick: () => { astuce.remove(); try { sessionStorage.setItem('astuce-paysage', '1'); } catch { /* sans effet */ } } }, 'OK'));
      colChef.append(astuce);
    }
  }
  if (mode === 'carte') {
    creerCarte(colCarte, store);
    const attente = h('p', { class: 'attente' }, 'En attente de la mission…');
    colCarte.append(attente);
    store.subscribe((st) => attente.classList.toggle('cache', st.phase !== 'briefing'));
  }

  if (mode !== 'carte') creerBriefing(app, store);
  creerDebrief(app, store, mode !== 'carte');

  // Chronomètre : le chef (ou l'écran unique) fait autorité.
  if (mode !== 'carte') setInterval(() => store.dispatch({ type: 'tick' }), 1000);
  store.subscribe((st) => (chronoEl.textContent = chronoTexte(st.chrono)));

  // Double écran
  if (mode !== 'single') {
    const t = choisirTransport(params);
    if (mode === 'chef') brancherChef(store, t);
    else brancherCarte(store, t);
  }

  // Exposé pour les tests manuels et les captures d'écran
  (window as unknown as { recon: unknown }).recon = { store, couverture: () => couverture(scenario, store.get()) };
} catch (e) {
  app.replaceChildren(h('pre', { class: 'erreur' }, String((e as Error).message)));
  throw e;
}
