import type { Store } from '../game/store';
import { chronoTexte, clear, h } from './dom';

const ICONE = { poi: '◆', porte: '▭', zone: '➤', action: '✱' } as const;

export function creerJournal(parent: HTMLElement, store: Store) {
  const liste = h('ol', { class: 'journal-liste' });
  const racine = h('aside', { class: 'journal cache', 'aria-label': 'Journal des découvertes' }, h('h2', {}, 'Journal'), liste);
  parent.append(racine);

  function maj() {
    clear(liste);
    const ev = store.get().evenements;
    if (ev.length === 0) liste.append(h('li', { class: 'muted' }, 'Rien pour le moment.'));
    for (const e of [...ev].reverse()) {
      liste.append(h('li', { class: e.type }, h('span', { class: 'ico' }, ICONE[e.type]), h('span', { class: 't' }, chronoTexte(e.t)), h('span', {}, e.texte)));
    }
  }
  store.subscribe(maj);
  maj();
  return {
    racine,
    basculer: () => racine.classList.toggle('cache'),
  };
}
