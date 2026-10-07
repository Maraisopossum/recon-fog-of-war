import { chargerImage } from '../first-person/viewer';
import { placeholderUrl, teinteZone } from '../first-person/placeholder';
import { indexer, zonePoi } from '../game/rules';
import { couverture, niveauLeMoinsCouvert, pct } from '../game/score';
import type { Store } from '../game/store';
import { creerCarte } from '../map/map';
import { ouvrirPopupPoi } from './poi-popup';
import { chronoTexte, h, s } from './dom';

function radar(noms: string[], valeurs: number[]): SVGSVGElement {
  const R = 78;
  const c = 100;
  const n = noms.length;
  const pt = (i: number, r: number): [number, number] => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  };
  const svg = s('svg', { viewBox: '0 0 200 200', class: 'radar', role: 'img', 'aria-label': 'Couverture par niveau' });
  for (const k of [0.25, 0.5, 0.75, 1]) svg.append(s('polygon', { points: noms.map((_, i) => pt(i, R * k).join(',')).join(' '), class: 'radar-grille' }));
  noms.forEach((nom, i) => {
    const [x, y] = pt(i, R);
    svg.append(s('line', { x1: c, y1: c, x2: x, y2: y, class: 'radar-axe' }));
    const [lx, ly] = pt(i, R + 14);
    svg.append(s('text', { x: lx, y: ly + 3, 'text-anchor': 'middle', class: 'radar-lib' }, nom));
  });
  svg.append(s('polygon', { points: valeurs.map((v, i) => pt(i, R * Math.max(v, 0.02)).join(',')).join(' '), class: 'radar-forme' }));
  return svg;
}

export function creerDebrief(parent: HTMLElement, store: Store, peutRejouer: boolean) {
  const sc = store.scenario;
  const idx = indexer(sc);
  const racine = h('div', { class: 'ecran debrief cache' });
  parent.append(racine);
  let detruireCarte: (() => void) | null = null;

  function rendre() {
    const st = store.get();
    const cov = couverture(sc, st);
    const pire = niveauLeMoinsCouvert(sc, cov);
    racine.replaceChildren();

    const colCarte = h('div', { class: 'deb-carte' }, h('h2', {}, 'Plan final'), h('p', { class: 'muted' }, 'Ce qui reste sous le nuage n\'a pas été reconnu.'));
    colCarte.append(h('div', { class: 'deb-carte-hote' }));
    detruireCarte?.();
    let carte: ReturnType<typeof creerCarte> | null = null;
    // Un clic sur un point (carte ou liste) oriente le plan vers lui et montre la photo de la vue concernée.
    const ouvrir = (id: string) => {
      carte?.voir(id);
      ouvrirPopupPoi(document.getElementById('app') ?? document.body, store, id);
    };

    const pois = sc.poi.map((p) => {
      const trouve = st.poiTrouves.includes(p.id);
      const z = idx.zones.get(zonePoi(sc, p, st.variante))!;
      const img = h('img', { class: 'deb-vignette', alt: p.libelle });
      chargerImage(img, [p.image_zoom ?? `${p.id}.jpg`], () => placeholderUrl(p.libelle, '', 480, 300, teinteZone(z.niveau)));
      return h(
        'li',
        { class: 'deb-poi ' + (trouve ? 'trouve' : 'manque'), role: 'button', tabindex: 0, title: 'Voir la photo', onclick: () => ouvrir(p.id) },
        img,
        h('div', {}, h('strong', {}, p.libelle), h('p', {}, `Emplacement : ${p.ou}.`), h('span', { class: 'etat' }, trouve ? 'Trouvé' : 'Non trouvé')),
      );
    });
    const nbTrouves = st.poiTrouves.length;

    const barres = sc.niveaux.map((n) =>
      h('div', { class: 'barre-ligne' }, h('span', {}, n.nom), h('div', { class: 'barre' }, h('div', { class: 'barre-val', style: `width:${Math.round(cov.parNiveau[n.id] * 100)}%` })), h('span', { class: 'val' }, pct(cov.parNiveau[n.id]))),
    );

    const rapport = st.rapport
      ? h('div', { class: 'deb-bloc' }, h('h2', {}, 'Compte rendu transmis'), h('p', {}, `Lieu présumé : ${st.rapport.lieu}`), h('p', {}, `Victime(s) : ${st.rapport.victimes}`), h('p', {}, `Moyens demandés : ${st.rapport.moyens.join(', ') || 'aucun'}`))
      : null;

    const colInfos = h(
      'div',
      { class: 'deb-infos' },
      h('div', { class: 'deb-bloc score' }, h('p', { class: 'etiquette' }, 'Couverture globale'), h('p', { class: 'gros' }, pct(cov.global)), h('p', { class: 'muted' }, `Durée : ${chronoTexte(st.chrono)} (non notée) · Arrivée côté ${st.variante}`)),
      h('div', { class: 'deb-bloc' }, h('h2', {}, 'Couverture par niveau'), h('div', { class: 'deb-niveaux' }, radar(sc.niveaux.map((n) => n.nom), sc.niveaux.map((n) => cov.parNiveau[n.id])), h('div', { class: 'barres' }, ...barres))),
      h('div', { class: 'deb-bloc axe' }, h('h2', {}, 'Axe de progression'), h('p', {}, `Reconnaissance du niveau « ${pire.nom} » (couverture ${pct(pire.valeur)}).`)),
      rapport,
      h('div', { class: 'deb-bloc' }, h('h2', {}, `Éléments factuels (${nbTrouves}/${sc.poi.length} trouvés)`), h('ul', { class: 'deb-pois' }, ...pois)),
      h('div', { class: 'deb-bloc' }, h('h2', {}, 'Chronologie'), h('ol', { class: 'chrono' }, ...st.chronologie.map((c) => h('li', {}, h('span', { class: 't' }, chronoTexte(c.t)), idx.zones.get(c.zone)!.nom)))),
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
