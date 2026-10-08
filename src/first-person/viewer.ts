import { indexer, porteFermee, vuesPlanes, zonePoi } from '../game/rules';
import type { Store } from '../game/store';
import type { GameState, Hotspot, Poi, Vue, Zone } from '../game/types';
import { clear, h } from '../ui/dom';
import { placeholderUrl, teinteZone } from './placeholder';

const BASE = import.meta.env.BASE_URL;
const RATIO_PANORAMA = 21 / 9;
const RATIO_VUE = 16 / 9;

const GLYPHE = { haut: '↑', bas: '↓', gauche: '←', droite: '→' } as const;

export function urlImage(nom: string) {
  return `${BASE}assets/generated/${nom}`;
}

/** Charge une image avec repli : liste de candidats puis placeholder. */
export function chargerImage(img: HTMLImageElement, candidats: string[], repli: () => string, onPlaceholder?: (est: boolean) => void) {
  let i = 0;
  const suivant = () => {
    if (i < candidats.length) {
      img.src = urlImage(candidats[i++]);
    } else {
      img.onerror = null;
      img.src = repli();
      onPlaceholder?.(true);
    }
  };
  img.onload = () => onPlaceholder?.(img.src.startsWith('data:'));
  img.onerror = suivant;
  suivant();
}

export function creerVueChef(parent: HTMLElement, store: Store) {
  const sc = store.scenario;
  const idx = indexer(sc);

  const racine = h('section', { class: 'chef', 'aria-label': 'Vue du chef' });
  const scene = h('div', { class: 'chef-scene' });
  const barre = h('div', { class: 'chef-barre' });
  const toasts = h('div', { class: 'toasts', 'aria-live': 'polite' });
  racine.append(scene, barre, toasts);
  parent.append(racine);

  let vueCourante = '';
  let varianteCourante = '';
  let nettoyer: (() => void) | null = null;
  let timer: number | undefined;
  let nbEvenements = 0;
  let hotspotsEl: HTMLElement | null = null;
  let zoneOverlay: HTMLElement | null = null;

  function toast(texte: string) {
    const t = h('div', { class: 'toast' }, texte);
    toasts.append(t);
    setTimeout(() => t.classList.add('sort'), 3800);
    setTimeout(() => t.remove(), 4400);
  }

  function fermerZoom() {
    zoneOverlay?.remove();
    zoneOverlay = null;
  }

  function ouvrirZoom(p: Poi) {
    fermerZoom();
    const img = h('img', { alt: p.libelle, class: 'zoom-img' });
    const nom = p.image_zoom ?? `${p.id}.jpg`;
    const z = idx.zones.get(p.zone)!;
    chargerImage(img, [nom], () => placeholderUrl(p.libelle, 'zoom', 1280, 800, teinteZone(z.niveau)));
    const zoneActions = h('div', { class: 'actions' });
    const panneau = h('div', { class: 'panneau-compteurs' });

    // Boutons « Couper » : gaz et électricité (immeuble ou logement), sans jugement pendant la partie
    const couper = (energie: 'gaz' | 'elec', cible: 'immeuble' | 'logement', logement?: string, etiquette?: string) => {
      const fait = store.get().coupures.some((c) => c.energie === energie && c.cible === cible && c.logement === logement);
      return h(
        'button',
        {
          class: 'btn couper' + (fait ? ' fait' : ''),
          ...(fait ? { disabled: true } : {}),
          onclick: () => {
            store.dispatch({ type: 'couper', energie, cible, logement });
            majActions();
          },
        },
        fait ? 'Coupé' : etiquette ?? 'Couper',
      );
    };

    function majActions() {
      clear(zoneActions);
      clear(panneau);
      const st = store.get();
      if (p.action === 'gaine') {
        for (const l of sc.logements.liste) {
          panneau.append(h('div', { class: 'compteur' }, h('strong', {}, `Logement ${l}`), h('span', {}, 'Gaz'), couper('gaz', 'logement', l), h('span', {}, 'Électricité'), couper('elec', 'logement', l)));
        }
      }
      if (p.action === 'coupure_gaz_immeuble') zoneActions.append(couper('gaz', 'immeuble', undefined, "Couper le gaz de l'immeuble"));
      if (p.action === 'coupure_elec_immeuble') zoneActions.append(couper('elec', 'immeuble', undefined, "Couper l'électricité de l'immeuble"));
      if (p.action === 'desenfumer') {
        zoneActions.append(
          h(
            'button',
            {
              class: 'btn primaire',
              ...(st.desenfumage ? { disabled: true } : {}),
              onclick: () => {
                store.dispatch({ type: 'desenfumer' });
                fermerZoom();
              },
            },
            st.desenfumage ? 'Désenfumage déjà actionné' : 'Actionner la commande de désenfumage',
          ),
        );
      }
      zoneActions.append(
        h('button', { class: 'btn', onclick: () => { store.dispatch({ type: 'demande' }); toast('Action demandée notée'); } }, 'Action demandée'),
        h('button', { class: 'btn', onclick: fermerZoom }, 'Fermer'),
      );
    }
    majActions();

    zoneOverlay = h(
      'div',
      { class: 'zoom', role: 'dialog', 'aria-label': p.libelle, onclick: (e: Event) => e.target === zoneOverlay && fermerZoom() },
      h('div', { class: 'zoom-carte' }, img, h('div', { class: 'zoom-texte' }, h('h3', {}, p.libelle), h('p', {}, p.texte_revele), panneau, zoneActions)),
    );
    racine.append(zoneOverlay);
  }

  function nomDestination(st: GameState, id: string): string {
    const z = idx.zones.get(id)!;
    return st.zones[id].etat === 'inconnue' ? 'Passage' : z.nom;
  }

  function clicHotspot(hs: Hotspot) {
    const st = store.get();
    // Se servir d'une porte, d'un passage ou d'une flèche de la vue montre qu'on l'a regardée
    // (un panorama reste soumis au tour d'horizon complet).
    if (hs.type !== 'poi') {
      const courante = idx.zones.get(st.position.zone)?.vues.find((v) => v.id === st.position.vue);
      if (courante && !courante.panorama) store.dispatch({ type: 'markSeen', vue: courante.id });
    }
    if (hs.type === 'poi' && hs.poi) {
      const p = idx.poi.get(hs.poi)!;
      store.dispatch({ type: 'poi', poi: p.id });
      if (p.action === 'gaine') store.dispatch({ type: 'ouvrirGaine' });
      ouvrirZoom(p);
      return;
    }
    if (hs.type === 'passage' && hs.vers) {
      if (hs.poi) store.dispatch({ type: 'poi', poi: hs.poi });
      const ferme = porteFermee(sc, st, st.position.zone, hs.vers);
      // Un seul clic : on ouvre la porte puis on passe.
      if (ferme?.porte) store.dispatch({ type: 'openDoor', porte: ferme.porte });
      store.dispatch({ type: 'goto', zone: hs.vers, vue: hs.vue });
    }
    if (hs.type === 'vue' && hs.vue) {
      // « @retour » : revenir à la vue d'où l'on a levé les yeux
      const premiere = vuesPlanes(idx.zones.get(st.position.zone)!)[0]?.id;
      store.dispatch({ type: 'vue', vue: hs.vue === '@retour' ? (st.vueRetour ?? premiere) : hs.vue });
    }
  }

  function dessinerHotspots(st: GameState, vue: Vue, zone: Zone, toile: HTMLElement) {
    hotspotsEl?.remove();
    hotspotsEl = h('div', { class: 'hotspots' });
    // Les plus petites zones sont ajoutées en dernier, donc au-dessus : une grande zone ne masque jamais une petite.
    const triees = [...(vue.hotspots ?? [])].sort((a, b) => b.zone_clic[2] * b.zone_clic[3] - a.zone_clic[2] * a.zone_clic[3]);
    for (const hs of triees) {
      let libelle = '';
      let trouve = false;
      let ferme = false;
      if (hs.type === 'poi') {
        const p = idx.poi.get(hs.poi!)!;
        if (zonePoi(sc, p, st.variante) !== zone.id) continue;
        libelle = p.libelle;
        trouve = st.poiTrouves.includes(p.id);
      } else if (hs.type === 'vue') {
        libelle = 'Se déplacer';
      } else {
        ferme = !!porteFermee(sc, st, zone.id, hs.vers!);
        libelle = ferme ? 'Porte fermée : ouvrir' : nomDestination(st, hs.vers!);
        if (hs.poi) trouve = st.poiTrouves.includes(hs.poi);
      }
      const [x, y, w, hh] = hs.zone_clic;
      const b = h(
        'button',
        {
          class: `hotspot ${hs.type}${hs.type === 'vue' ? ' passage' : ''}${trouve ? ' trouve' : ''}${ferme ? ' ferme' : ''}${x < 0.1 && w <= 0.07 ? ' bord-g' : ''}${x > 0.9 ? ' bord-d' : ''}`,
          style: `left:${x * 100}%;top:${y * 100}%;width:${w * 100}%;height:${hh * 100}%`,
          title: libelle,
          'aria-label': libelle,
          'data-libelle': libelle,
          onclick: () => clicHotspot(hs),
        },
        hs.type !== 'poi' ? h('span', { class: 'fleche' }, hs.fleche ? GLYPHE[hs.fleche] : hs.type === 'vue' ? '↑' : ferme ? '⌂' : x < 0.1 && w <= 0.07 ? '‹' : x > 0.9 ? '›' : '➤') : null,
      );
      hotspotsEl.append(b);
    }
    // Vues « pivot » : flèches sur les côtés pour faire tourner le joueur
    const planes = vuesPlanes(zone);
    if (vue.mouvement === 'pivot' && planes.length === 2) {
      const autre = planes.find((v) => v.id !== vue.id)!;
      const fl = (cote: 'g' | 'd', texte: string, titre: string) =>
        h('button', { class: `pivot pivot-${cote}`, title: titre, 'aria-label': titre, onclick: () => store.dispatch({ type: 'vue', vue: autre.id }) }, texte);
      hotspotsEl.append(fl('g', '‹', 'Pivoter à gauche'), fl('d', '›', 'Pivoter à droite'));
    }
    toile.append(hotspotsEl);
  }

  function navBarre(st: GameState, zone: Zone, vue: Vue) {
    clear(barre);
    const planes = vuesPlanes(zone);
    const i = planes.findIndex((v) => v.id === vue.id);
    // Les déplacements se font avec les flèches de l'image. Le nom des vues n'est pas affiché : il guiderait le joueur.
    barre.append(h('div', { class: 'chef-titre' }, h('strong', {}, zone.nom), h('span', { class: 'muted' }, vue.direction ? (vue.direction === 'haut' ? 'Vers le haut' : 'Vers le bas') : `Vue ${i + 1}/${planes.length}`)));
  }

  function afficherVue(st: GameState) {
    nettoyer?.();
    nettoyer = null;
    clearTimeout(timer);
    fermerZoom();
    clear(scene);
    hotspotsEl = null;
    const zone = idx.zones.get(st.position.zone)!;
    const vue = zone.vues.find((v) => v.id === st.position.vue)!;
    vueCourante = vue.id;
    varianteCourante = st.variante;
    const panorama = !!vue.panorama;
    const stage = h('div', { class: 'stage' + (panorama ? ' pano' : '') });
    const defile = h('div', { class: 'defile' });
    const toile = h('div', { class: 'toile' });
    toile.style.aspectRatio = String(panorama ? RATIO_PANORAMA : RATIO_VUE);
    const img = h('img', { class: 'vue-img', alt: `${zone.nom}`, draggable: false });
    const cand = [st.desenfumage ? vue.image_desenfumage : undefined, st.gaineOuverte ? vue.image_gaine : undefined, vue.variantes_image?.[st.variante] ?? vue.image, vue.image].filter((x): x is string => !!x).filter((x, i, a) => a.indexOf(x) === i);
    const w = panorama ? 2400 : 1600;
    const hh = Math.round(w / (panorama ? RATIO_PANORAMA : RATIO_VUE));
    chargerImage(img, cand, () => placeholderUrl(zone.nom, vue.id, w, hh, teinteZone(zone.niveau)), (est) => {
      stage.classList.toggle('placeholder', est);
    });
    toile.append(img);
    defile.append(toile);
    stage.append(defile);
    scene.append(stage);
    dessinerHotspots(st, vue, zone, toile);
    navBarre(st, zone, vue);

    if (st.vuesVues.includes(vue.id)) return;
    if (panorama) suivrePanorama(defile, vue, stage);
    else timer = window.setTimeout(() => store.dispatch({ type: 'markSeen', vue: vue.id }), sc.regles.maintien_vue_ms);
  }

  function suivrePanorama(defile: HTMLElement, vue: Vue, stage: HTMLElement) {
    const jauge = h('div', { class: 'tour' }, h('div', { class: 'tour-barre' }), h('span', {}, 'Tour d\'horizon'));
    stage.append(jauge);
    const barreEl = jauge.firstElementChild as HTMLElement;
    let gauche = Infinity;
    let droite = -Infinity;
    const mesure = () => {
      const W = defile.scrollWidth;
      if (W <= 0) return;
      const l = defile.scrollLeft / W;
      const r = (defile.scrollLeft + defile.clientWidth) / W;
      gauche = Math.min(gauche, l);
      droite = Math.max(droite, r);
      const cov = Math.min(1, droite - gauche);
      barreEl.style.width = `${Math.round(cov * 100)}%`;
      if (cov >= sc.regles.couverture_panorama - 1e-6) {
        store.dispatch({ type: 'markSeen', vue: vue.id });
        jauge.classList.add('fini');
      }
    };
    let drag = false;
    let x0 = 0;
    let s0 = 0;
    let bouge = 0;
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      drag = true;
      bouge = 0;
      x0 = e.clientX;
      s0 = defile.scrollLeft;
      defile.classList.add('drag');
    };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      bouge = Math.max(bouge, Math.abs(e.clientX - x0));
      defile.scrollLeft = s0 - (e.clientX - x0);
    };
    const up = () => {
      drag = false;
      defile.classList.remove('drag');
    };
    const clicCapture = (e: Event) => {
      if (bouge > 5) {
        e.stopPropagation();
        e.preventDefault();
        bouge = 0;
      }
    };
    const roue = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        defile.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    };
    defile.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    defile.addEventListener('click', clicCapture, true);
    defile.addEventListener('wheel', roue, { passive: false });
    defile.addEventListener('scroll', mesure);
    requestAnimationFrame(() => {
      defile.scrollLeft = (defile.scrollWidth - defile.clientWidth) / 2;
      mesure();
    });
    nettoyer = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }

  function maj(st: GameState, prev?: GameState) {
    if (st.phase !== 'jeu') {
      nettoyer?.();
      clearTimeout(timer);
      if (st.phase === 'briefing') vueCourante = '';
      clear(scene);
      clear(barre);
      return;
    }
    if (prev && (prev.desenfumage !== st.desenfumage || prev.gaineOuverte !== st.gaineOuverte)) vueCourante = '';
    if (st.position.vue !== vueCourante || st.variante !== varianteCourante) {
      afficherVue(st);
    } else if (hotspotsEl && prev && (prev.portesOuvertes !== st.portesOuvertes || prev.poiTrouves !== st.poiTrouves || prev.zones !== st.zones || prev.aide !== st.aide)) {
      const zone = idx.zones.get(st.position.zone)!;
      const vue = zone.vues.find((v) => v.id === st.position.vue)!;
      const toile = hotspotsEl.parentElement as HTMLElement;
      dessinerHotspots(st, vue, zone, toile);
      if (prev && prev.aide !== st.aide) navBarre(st, zone, vue);
    }
    const stage = scene.querySelector('.stage');
    stage?.classList.toggle('aide-on', st.aide);
    if (st.evenements.length < nbEvenements) nbEvenements = 0;
    for (const e of st.evenements.slice(nbEvenements)) {
      if (e.type === 'poi') toast('Repéré : ' + e.texte.split(' : ')[0]);
      if (e.type === 'porte' || e.type === 'action') toast(e.texte);
    }
    nbEvenements = st.evenements.length;
  }

  store.subscribe(maj);
  return { racine };
}
