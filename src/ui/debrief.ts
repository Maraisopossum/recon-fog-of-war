import { indexer } from '../game/rules';
import type { Store } from '../game/store';
import type { GameState, GrilleItem, Scenario } from '../game/types';
import { creerCarte } from '../map/map';
import { chronoTexte, h } from './dom';
import { ouvrirPopupPoi } from './poi-popup';

/** Un élément de la grille : existait ? relevé pendant la partie ? déclaré dans le compte rendu ? */
export function statutElement(_sc: Scenario, st: GameState, it: GrilleItem) {
  return {
    existe: it.poi.length > 0,
    releve: it.poi.some((p) => st.poiTrouves.includes(p)),
    declare: !!st.rapport?.coches.includes(it.id),
  };
}

/** Débriefing : la méthode suivie, sans pourcentage ni conclusion. */
export function creerDebrief(parent: HTMLElement, store: Store, peutRejouer: boolean) {
  const sc = store.scenario;
  const idx = indexer(sc);
  const racine = h('div', { class: 'ecran debrief cache' });
  parent.append(racine);
  let detruireCarte: (() => void) | null = null;

  function rendre() {
    const st = store.get();
    racine.replaceChildren();
    detruireCarte?.();
    let carte: ReturnType<typeof creerCarte> | null = null;
    // Un clic sur un élément (plan ou tableau) oriente le plan vers lui et montre la photo de la vue concernée.
    const ouvrir = (id: string) => {
      carte?.voir(id);
      ouvrirPopupPoi(document.getElementById('app') ?? document.body, store, id);
    };

    const oui = (v: boolean, si: string, non: string) => h('span', { class: 'pastille-etat ' + (v ? 'oui' : 'non') }, v ? si : non);
    const tableau = (titre: string, sous: string, items: GrilleItem[]) =>
      h(
        'div',
        { class: 'deb-bloc' },
        h('h2', {}, titre),
        h('p', { class: 'muted' }, sous),
        h(
          'table',
          { class: 'deb-table' },
          h('thead', {}, h('tr', {}, h('th', {}, 'Élément'), h('th', {}, 'Dans le scénario'), h('th', {}, 'Relevé en jeu'), h('th', {}, st.rapport ? 'Coché au compte rendu' : 'Compte rendu'))),
          h(
            'tbody',
            {},
            ...items.map((it) => {
              const s = statutElement(sc, st, it);
              const cible = it.poi.find((p) => st.poiTrouves.includes(p)) ?? it.poi[0];
              return h(
                'tr',
                { class: cible ? 'cliquable' : '', ...(cible ? { tabindex: 0, role: 'button', title: 'Voir la photo', onclick: () => ouvrir(cible) } : {}) },
                h('td', {}, it.libelle),
                h('td', {}, oui(s.existe, 'Oui', 'Absent')),
                h('td', {}, s.existe ? oui(s.releve, 'Oui', 'Non') : h('span', { class: 'muted' }, '—')),
                h('td', {}, st.rapport ? oui(s.declare, 'Oui', 'Non') : h('span', { class: 'muted' }, 'Non rempli')),
              );
            }),
          ),
        ),
      );

    // Lecture du feu BV-FFCOS : texte du joueur, tel quel, avec le rappel de ce qu'il fallait observer
    const lecture = h(
      'div',
      { class: 'deb-bloc' },
      h('h2', {}, 'Lecture du feu : BV-FFCOS'),
      st.rapport ? null : h('p', { class: 'muted' }, 'Compte rendu non rempli.'),
      ...sc.lecture_feu.map((it) => {
        const texte = st.rapport?.lecture[it.id]?.trim();
        return h(
          'div',
          { class: 'lecture-deb' },
          h('p', { class: 'lecture-titre' }, h('strong', { class: 'lecture-lettre' }, it.lettre), ` ${it.titre}`),
          h('p', { class: 'muted petit' }, it.aide),
          st.rapport ? h('p', { class: 'lecture-texte' + (texte ? '' : ' vide') }, texte || 'Non renseigné') : null,
        );
      }),
    );

    // Actions réalisées et demandées, dans l'ordre, sans interprétation
    const actions = st.evenements.filter((e) => e.type === 'action');
    const blocActions = h(
      'div',
      { class: 'deb-bloc' },
      h('h2', {}, 'Actions réalisées et demandées'),
      actions.length
        ? h('ol', { class: 'chrono' }, ...actions.map((e) => h('li', {}, h('span', { class: 't' }, chronoTexte(e.t)), e.texte)))
        : h('p', { class: 'muted' }, 'Aucune action.'),
      h('p', { class: 'muted' }, `Le feu était dans le logement n°${sc.logements.sinistre} (R+2).`),
    );

    const colCarte = h('div', { class: 'deb-carte' }, h('h2', {}, 'Plan final'), h('p', { class: 'muted' }, "Ce qui reste sous le nuage n'a pas été parcouru. Touchez un point pour voir la photo."));
    colCarte.append(h('div', { class: 'deb-carte-hote' }));

    const colInfos = h(
      'div',
      { class: 'deb-infos' },
      h('div', { class: 'deb-bloc' }, h('p', { class: 'etiquette' }, 'Débriefing de la reconnaissance'), h('p', { class: 'muted' }, `Durée : ${chronoTexte(st.chrono)} · Arrivée devant la façade ${st.variante}`)),
      tableau('Reconnaissance 360°', "Tour du bâtiment, vu de l'extérieur.", sc.grille.exterieur),
      tableau('Reconnaissance intérieure', 'Sous-sol, parties communes et logements.', sc.grille.interieur),
      lecture,
      blocActions,
      h('div', { class: 'deb-bloc' }, h('h2', {}, 'Déroulé : zones visitées'), h('ol', { class: 'chrono' }, ...st.chronologie.map((c) => h('li', {}, h('span', { class: 't' }, chronoTexte(c.t)), idx.zones.get(c.zone)!.nom)))),
      peutRejouer ? h('button', { class: 'btn primaire grand', onclick: () => store.dispatch({ type: 'restart' }) }, 'Rejouer la mission') : null,
    );

    racine.append(h('div', { class: 'deb-grille' }, colCarte, colInfos));
    const hote = colCarte.querySelector('.deb-carte-hote') as HTMLElement;
    carte = creerCarte(hote, store, { debrief: true, onPoiClick: ouvrir });
    detruireCarte = carte.detruire;
  }

  store.subscribe((st, prev) => {
    const actif = st.phase === 'debrief';
    racine.classList.toggle('cache', !actif);
    if (actif && prev.phase !== 'debrief') rendre();
    if (!actif) racine.replaceChildren();
  });
  if (store.get().phase === 'debrief') {
    racine.classList.remove('cache');
    rendre();
  }
  return { racine };
}
