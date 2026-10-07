import { centroide, indexer, silhouetteVisible, zonePoi } from '../game/rules';
import type { Store } from '../game/store';
import type { GameState, Scenario } from '../game/types';
import { clear, h, s } from '../ui/dom';

export interface MapOptions {
  /** debrief : tout le plan est lu, le brouillard restant est grisé */
  debrief?: boolean;
  /** débrief : clic sur une icône de point d'intérêt */
  onPoiClick?: (poiId: string) => void;
}

const OPACITE_BROUILLARD = { inconnue: 0.97, traversee: 0.4, reconnue: 0 } as const;
const OPACITE_BROUILLARD_DEBRIEF = { inconnue: 0.62, traversee: 0.3, reconnue: 0 } as const;

function pointsSvg(poly: [number, number][]): string {
  return poly.map((p) => p.join(',')).join(' ');
}

function defs() {
  return s(
    'defs',
    {},
    (() => {
      const f = s('filter', { id: 'nuage', x: '-35%', y: '-35%', width: '170%', height: '170%', 'color-interpolation-filters': 'sRGB' });
      const turb = s('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.014 0.02', numOctaves: 4, seed: 7, result: 'bruit' });
      turb.append(s('animate', { attributeName: 'baseFrequency', values: '0.014 0.02;0.019 0.015;0.014 0.02', dur: '48s', repeatCount: 'indefinite' }));
      f.append(
        turb,
        s('feDisplacementMap', { in: 'SourceGraphic', in2: 'bruit', scale: 34, xChannelSelector: 'R', yChannelSelector: 'G', result: 'forme' }),
        s('feGaussianBlur', { in: 'forme', stdDeviation: 6, result: 'doux' }),
        s('feColorMatrix', { in: 'bruit', type: 'matrix', values: '0.55 0 0 0 0.4  0.55 0 0 0 0.47  0.5 0 0 0 0.58  0 0 0 0 1', result: 'teinte' }),
        s('feComposite', { in: 'teinte', in2: 'doux', operator: 'in' }),
      );
      return f;
    })(),
    (() => {
      const f = s('filter', { id: 'lueur', x: '-20%', y: '-20%', width: '140%', height: '140%' });
      f.append(s('feGaussianBlur', { stdDeviation: 3 }));
      return f;
    })(),
    s('pattern', { id: 'hachure', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, s('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: '#5b6b7a', 'stroke-width': 1.4 })),
  );
}

export function creerCarte(parent: HTMLElement, store: Store, opts: MapOptions = {}) {
  const sc: Scenario = store.scenario;
  const idx = indexer(sc);
  const debrief = !!opts.debrief;
  let niveau = sc.niveaux[0].id;
  let niveauManuel = false;
  let selection = '';
  let derniereZone = '';

  const racine = h('div', { class: 'carte' });
  const onglets = h('div', { class: 'carte-niveaux', role: 'tablist' });
  const cadre = h('div', { class: 'carte-cadre' });
  racine.append(onglets, cadre);
  parent.append(racine);

  let svg: SVGSVGElement;
  let fogs = new Map<string, SVGPolygonElement>();
  let fonds = new Map<string, SVGPolygonElement>();
  let contours = new Map<string, SVGPolygonElement>();
  let etiquettes = new Map<string, SVGTextElement>();
  let marqueur: SVGGElement | null = null;
  let icones: SVGGElement;

  function construire() {
    clear(cadre);
    fogs = new Map();
    fonds = new Map();
    contours = new Map();
    etiquettes = new Map();
    svg = s('svg', { viewBox: '15 22 360 262', class: 'carte-svg', role: 'img', 'aria-label': 'Plan tactique' });
    svg.append(defs());
    const calqueFond = s('g', { class: 'c-fond' });
    const calqueFog = s('g', { class: 'c-fog' });
    const calqueEtiq = s('g', { class: 'c-etiq' });
    icones = s('g', { class: 'c-poi' });
    const niv = sc.niveaux.find((n) => n.id === niveau)!;
    for (const d of niv.decor) {
      calqueFond.append(s('polygon', { points: pointsSvg(d.polygone), class: 'decor' }));
      if (d.libelle) {
        const [cx, cy] = centroide(d.polygone);
        calqueFond.append(s('text', { x: cx, y: cy, class: 'decor-lib', 'text-anchor': 'middle' }, d.libelle));
      }
    }
    for (const z of sc.zones.filter((z) => z.niveau === niveau)) {
      const pts = pointsSvg(z.polygone);
      const fond = s('polygon', { points: pts, class: 'zone-fond' });
      const contour = s('polygon', { points: pts, class: 'zone-contour' });
      const fog = s('polygon', { points: pts, class: 'fog', filter: 'url(#nuage)', fill: '#9fb0c4' });
      const [cx, cy] = centroide(z.polygone);
      const t = s('text', { x: cx, y: cy + 3, class: 'zone-nom', 'text-anchor': 'middle' }, z.nom);
      fonds.set(z.id, fond);
      contours.set(z.id, contour);
      fogs.set(z.id, fog);
      etiquettes.set(z.id, t);
      calqueFond.append(fond);
      calqueFog.append(fog);
      calqueEtiq.append(contour, t);
    }
    svg.append(calqueFond, calqueFog, calqueEtiq, icones);
    marqueur = null;
    cadre.append(svg);
  }

  function majOnglets(st: GameState) {
    clear(onglets);
    for (const n of sc.niveaux) {
      const zs = sc.zones.filter((z) => z.niveau === n.id);
      const exploreAucun = zs.every((z) => st.zones[z.id].etat === 'inconnue');
      const ici = idx.zones.get(st.position.zone)?.niveau === n.id && !debrief;
      onglets.append(
        h(
          'button',
          {
            class: 'onglet' + (n.id === niveau ? ' actif' : '') + (exploreAucun && !debrief ? ' vierge' : ''),
            role: 'tab',
            'aria-selected': n.id === niveau,
            title: exploreAucun && !debrief ? 'Niveau non exploré' : n.nom,
            onclick: () => {
              niveau = n.id;
              niveauManuel = true;
              construire();
              maj(store.get());
            },
          },
          n.nom,
          ici ? h('span', { class: 'pastille ici', 'aria-label': 'Position actuelle' }) : null,
          exploreAucun && !debrief ? h('span', { class: 'pastille vide', 'aria-label': 'Non exploré' }) : null,
        ),
      );
    }
  }

  function majMarqueur(st: GameState) {
    const z = idx.zones.get(st.position.zone);
    if (!z || debrief || z.niveau !== niveau || st.phase !== 'jeu') {
      marqueur?.remove();
      marqueur = null;
      return;
    }
    const [x, y] = centroide(z.polygone);
    if (!marqueur) {
      marqueur = s('g', { class: 'marqueur' });
      const rot = s('g', { class: 'cone' });
      rot.append(s('path', { d: 'M0,0 L-16,-34 A38,38 0 0 1 16,-34 Z', class: 'cone-forme' }));
      marqueur.append(rot, s('circle', { r: 5.5, class: 'marqueur-pt' }), s('circle', { r: 11, class: 'marqueur-halo' }));
      svg.append(marqueur);
      marqueur.style.transition = 'none';
      marqueur.style.transform = `translate(${x}px, ${y}px)`;
      void marqueur.getBoundingClientRect();
      marqueur.style.transition = '';
    }
    marqueur.style.transform = `translate(${x}px, ${y}px)`;
    const cone = marqueur.querySelector('.cone') as SVGGElement;
    cone.style.transform = `rotate(${z.cap ?? 0}deg)`;
  }

  function majIcones(st: GameState) {
    clear(icones);
    const parZone = new Map<string, number>();
    for (const p of sc.poi) {
      const zid = zonePoi(sc, p, st.variante);
      const z = idx.zones.get(zid)!;
      if (z.niveau !== niveau) continue;
      const trouve = st.poiTrouves.includes(p.id);
      if (!trouve && !debrief) continue;
      const n = parZone.get(zid) ?? 0;
      parZone.set(zid, n + 1);
      const [cx, cy] = centroide(z.polygone);
      const col = n % 4;
      const ligne = Math.floor(n / 4);
      const x = cx - 18 + col * 12;
      const y = cy + 8 + ligne * 12;
      const g = s('g', { class: 'poi-ico ' + (debrief ? (trouve ? 'trouve' : 'manque') : 'trouve'), transform: `translate(${x},${y})` });
      if (debrief && opts.onPoiClick) {
        // zone de clic agrandie, curseur main : on peut cliquer aussi bien un point rouge qu'un point vert
        g.append(s('circle', { r: 10, class: 'poi-hit' }));
        g.classList.add('cliquable');
        g.addEventListener('click', () => opts.onPoiClick!(p.id));
      }
      if (selection === p.id) g.classList.add('select');
      g.append(s('path', { d: 'M0,-5 L5,0 L0,5 L-5,0 Z' }), s('title', {}, p.libelle));
      icones.append(g);
    }
  }

  function maj(st: GameState) {
    const zi = idx.zones.get(st.position.zone);
    if (!debrief && zi && zi.id !== derniereZone) {
      derniereZone = zi.id;
      niveauManuel = false;
      if (zi.niveau !== niveau) {
        niveau = zi.niveau;
        construire();
      }
    }
    const opac = debrief ? OPACITE_BROUILLARD_DEBRIEF : OPACITE_BROUILLARD;
    for (const z of sc.zones.filter((z) => z.niveau === niveau)) {
      const etat = st.zones[z.id].etat;
      const sil = silhouetteVisible(sc, st, z);
      fogs.get(z.id)!.style.opacity = String(opac[etat]);
      fonds.get(z.id)!.setAttribute('class', `zone-fond ${etat}` + (debrief && etat !== 'reconnue' ? ' grise' : ''));
      contours.get(z.id)!.setAttribute('class', `zone-contour ${etat}` + (sil ? ' silhouette' : '') + (debrief && etat === 'inconnue' ? ' silhouette' : ''));
      const t = etiquettes.get(z.id)!;
      t.setAttribute('class', 'zone-nom' + (etat === 'inconnue' && !debrief ? ' cache' : '') + (etat === 'traversee' ? ' voile' : ''));
    }
    majOnglets(st);
    majMarqueur(st);
    majIcones(st);
    void niveauManuel;
  }

  construire();
  maj(store.get());
  const off = store.subscribe((st) => maj(st));
  /** Débrief : affiche le niveau du point et le met en évidence sur le plan. */
  function voir(poiId: string) {
    const p = idx.poi.get(poiId);
    if (!p) return;
    const z = idx.zones.get(zonePoi(sc, p, store.get().variante));
    selection = poiId;
    if (z && z.niveau !== niveau) {
      niveau = z.niveau;
      construire();
    }
    maj(store.get());
  }

  return { racine, maj: () => maj(store.get()), voir, detruire: () => { off(); racine.remove(); } };
}
