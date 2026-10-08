import { h } from './dom';

const CLE = 'recon-tutoriel-vu';

export function tutorielDejaVu(): boolean {
  try {
    return localStorage.getItem(CLE) === '1';
  } catch {
    return false;
  }
}

interface Diapo {
  titre: string;
  texte: string;
  /** petite illustration faite avec les mêmes éléments que le jeu */
  schema: () => HTMLElement;
}

const fleche = (glyphe: string) => h('span', { class: 'tuto-fleche' }, glyphe);

const DIAPOS: Diapo[] = [
  {
    titre: 'Se déplacer',
    texte: "Touchez les flèches dans l'image pour avancer, reculer ou passer dans la pièce suivante. Un panorama extérieur se fait défiler du doigt ou de la souris.",
    schema: () => h('div', { class: 'tuto-schema' }, fleche('↑'), fleche('↓'), fleche('←'), fleche('→'), fleche('➤')),
  },
  {
    titre: 'Pivoter et lever les yeux',
    texte: "Les flèches sur les bords de l'image font tourner le regard. La flèche ↑ en haut de l'image permet de regarder vers le haut, par exemple dans la cage d'escalier.",
    schema: () => h('div', { class: 'tuto-schema' }, h('span', { class: 'tuto-pivot' }, '‹'), fleche('↑'), h('span', { class: 'tuto-pivot' }, '›')),
  },
  {
    titre: 'Relever un élément',
    texte: "Touchez un élément de l'image (porte, coffret, personne…) pour l'examiner. Il s'ajoute au journal. Les boutons du zoom permettent d'agir : couper un fluide, actionner le désenfumage.",
    schema: () => h('div', { class: 'tuto-schema' }, h('span', { class: 'tuto-cadre' }, 'élément'), h('span', { class: 'btn couper tuto-btn' }, 'Couper')),
  },
  {
    titre: 'Où suis-je ?',
    texte: "Les puces en haut indiquent le niveau où vous êtes (Ext., Sous-sol, RDC, R+1…). Le journal garde la trace de vos relevés et de vos actions.",
    schema: () => h('div', { class: 'tuto-schema' }, ...['Ext.', 'Sous-sol', 'RDC', 'R+1', 'R+2'].map((n, i) => h('span', { class: 'puce-niveau' + (i === 2 ? ' actif' : '') }, n))),
  },
  {
    titre: 'Action demandée, rendre compte, quitter',
    texte: "« Action demandée » note à l'heure près ce que vous feriez demander (un sauvetage, par exemple) sans interrompre la reconnaissance. « Rendre compte » met fin à la partie : vous cochez ce que vous avez vu, sans retour possible. « Quitter » permet de reprendre, de terminer ou d'abandonner.",
    schema: () => h('div', { class: 'tuto-schema' }, h('span', { class: 'btn tuto-btn' }, 'Action demandée'), h('span', { class: 'btn primaire tuto-btn' }, 'Rendre compte'), h('span', { class: 'btn tuto-btn' }, 'Quitter')),
  },
];

/** Tutoriel en diapositives courtes, passable. `aLaFin` est appelé quand le joueur termine ou passe. */
export function ouvrirTutoriel(parent: HTMLElement, aLaFin: () => void) {
  let i = 0;
  let plusAfficher = false;
  const fenetre: HTMLElement = h('div', { class: 'zoom popup-poi', role: 'dialog', 'aria-label': "Tutoriel d'utilisation" });

  const fin = () => {
    if (plusAfficher) {
      try {
        localStorage.setItem(CLE, '1');
      } catch {
        /* stockage indisponible : le tutoriel sera simplement réaffiché */
      }
    }
    fenetre.remove();
    aLaFin();
  };

  function rendre() {
    const d = DIAPOS[i];
    const dernier = i === DIAPOS.length - 1;
    fenetre.replaceChildren(
      h(
        'div',
        { class: 'zoom-carte rapport tuto' },
        h('p', { class: 'etiquette' }, `Tutoriel · ${i + 1}/${DIAPOS.length}`),
        h('h2', {}, d.titre),
        d.schema(),
        h('p', { class: 'tuto-texte' }, d.texte),
        h('div', { class: 'tuto-points' }, ...DIAPOS.map((_, k) => h('span', { class: 'tuto-point' + (k === i ? ' actif' : '') }))),
        h(
          'label',
          { class: 'tuto-nepas' },
          h('input', { type: 'checkbox', ...(plusAfficher ? { checked: true } : {}), onchange: (e: Event) => (plusAfficher = (e.target as HTMLInputElement).checked) }),
          'Ne plus afficher ce tutoriel',
        ),
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn', onclick: fin }, 'Passer'),
          i > 0 ? h('button', { class: 'btn', onclick: () => { i--; rendre(); } }, 'Précédent') : null,
          h('button', { class: 'btn primaire', onclick: () => (dernier ? fin() : (i++, rendre())) }, dernier ? 'Commencer' : 'Suivant'),
        ),
      ),
    );
  }
  rendre();
  parent.append(fenetre);
}
