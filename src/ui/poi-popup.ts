import { chargerImage } from '../first-person/viewer';
import { placeholderUrl, teinteZone } from '../first-person/placeholder';
import { vueDuPoi } from '../game/rules';
import type { Store } from '../game/store';
import { h } from './dom';

/**
 * Débrief : pop-up de la photo de la vue où se trouve un point d'intérêt,
 * avec un cadre sur sa position (rouge : non relevé, vert : relevé).
 */
export function ouvrirPopupPoi(parent: HTMLElement, store: Store, poiId: string, aLaFermeture?: () => void) {
  const sc = store.scenario;
  const st = store.get();
  const p = sc.poi.find((x) => x.id === poiId);
  const lieu = vueDuPoi(sc, poiId);
  if (!p || !lieu) return;
  const trouve = st.poiTrouves.includes(poiId);
  const niveau = sc.niveaux.find((n) => n.id === lieu.zone.niveau)?.nom ?? '';

  const img = h('img', { alt: `${lieu.zone.nom}`, draggable: false });
  const panorama = !!lieu.vue.panorama;
  chargerImage(img, [lieu.vue.image], () => placeholderUrl(lieu.zone.nom, lieu.vue.id, panorama ? 2400 : 1600, panorama ? 1029 : 900, teinteZone(lieu.zone.niveau)));
  const [x, y, w, hh] = lieu.hotspot.zone_clic;
  const marge = 0.01;
  const cadre = h('div', {
    class: 'popup-cadre' + (trouve ? ' trouve' : ''),
    style: `left:${Math.max(0, x - marge) * 100}%;top:${Math.max(0, y - marge) * 100}%;width:${(w + 2 * marge) * 100}%;height:${(hh + 2 * marge) * 100}%`,
  });
  let fenetre: HTMLElement;
  const fermer = () => {
    fenetre.remove();
    document.removeEventListener('keydown', onKey);
    aLaFermeture?.();
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && fermer();
  fenetre = h(
    'div',
    { class: 'zoom popup-poi', role: 'dialog', 'aria-label': p.libelle, onclick: (e: Event) => e.target === fenetre && fermer() },
    h(
      'div',
      { class: 'popup-carte' },
      h('div', { class: 'popup-photo' }, img, cadre),
      h(
        'div',
        { class: 'popup-texte' },
        h('span', { class: 'statut ' + (trouve ? 'trouve' : 'manque') }, trouve ? 'Relevé pendant la reconnaissance' : 'Non relevé'),
        h('h3', {}, p.libelle),
        h('p', { class: 'lieu' }, `${niveau} · ${lieu.zone.nom} · ${p.ou}`),
        h('p', {}, p.texte_revele),
        h('button', { class: 'btn', onclick: fermer }, 'Fermer'),
      ),
    ),
  );
  document.addEventListener('keydown', onKey);
  parent.append(fenetre);
}
