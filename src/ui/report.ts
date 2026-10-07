import type { Store } from '../game/store';
import { h } from './dom';

export const LIEUX = [
  'Sous-sol : parking',
  'Sous-sol : local poubelles',
  'Sous-sol : local technique',
  'Hall d\'entrée et RDC',
  'Cage d\'escalier',
  'Logement d\'un étage',
  'Façade (extérieur)',
  'Toiture',
  'Indéterminé',
];
export const VICTIMES = ['Aucune victime', 'Une victime à une fenêtre', 'Une victime dans un logement', 'Plusieurs victimes', 'Indéterminé'];
export const MOYENS = ['VSAV', 'Moyen aérien (échelle)', '2e FPT', 'Renfort incendie', 'GRDF', 'Enedis', 'Police / gendarmerie', 'Aucun moyen supplémentaire'];

/** Écran « Rendre compte » : 3 champs à choix, non noté dans le MVP. */
export function ouvrirCompteRendu(parent: HTMLElement, store: Store) {
  let lieu = '';
  let victimes = '';
  const moyens = new Set<string>();
  const fenetre = h('div', { class: 'zoom', role: 'dialog', 'aria-label': 'Rendre compte' });
  const rendre = () => {
    const radios = (nom: string, valeurs: string[], get: () => string, set: (v: string) => void) =>
      h(
        'div',
        { class: 'choix' },
        ...valeurs.map((v) =>
          h('label', { class: 'radio' + (get() === v ? ' on' : '') }, h('input', { type: 'radio', name: nom, ...(get() === v ? { checked: true } : {}), onchange: () => { set(v); rendre(); } }), v),
        ),
      );
    fenetre.replaceChildren(
      h(
        'div',
        { class: 'zoom-carte rapport' },
        h('h2', {}, 'Rendre compte'),
        h('p', { class: 'muted' }, 'Message d\'ambiance : « Je suis, je vois, je demande ». Ce compte rendu n\'est pas noté ; il sera affiché tel quel au débriefing.'),
        h('h3', {}, 'Lieu du sinistre présumé'),
        radios('lieu', LIEUX, () => lieu, (v) => (lieu = v)),
        h('h3', {}, 'Victime(s)'),
        radios('victimes', VICTIMES, () => victimes, (v) => (victimes = v)),
        h('h3', {}, 'Moyens demandés'),
        h(
          'div',
          { class: 'choix' },
          ...MOYENS.map((m) =>
            h('label', { class: 'radio' + (moyens.has(m) ? ' on' : '') }, h('input', { type: 'checkbox', ...(moyens.has(m) ? { checked: true } : {}), onchange: () => { moyens.has(m) ? moyens.delete(m) : moyens.add(m); rendre(); } }), m),
          ),
        ),
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn', onclick: () => fenetre.remove() }, 'Reprendre la reconnaissance'),
          h(
            'button',
            {
              class: 'btn primaire',
              ...(lieu && victimes ? {} : { disabled: true }),
              onclick: () => {
                fenetre.remove();
                store.dispatch({ type: 'report', rapport: { lieu, victimes, moyens: [...moyens] } });
              },
            },
            'Transmettre et terminer',
          ),
        ),
      ),
    );
  };
  rendre();
  parent.append(fenetre);
}
