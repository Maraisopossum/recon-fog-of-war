import type { Store } from '../game/store';
import { h } from './dom';

/** Quitter la partie en cours : reprendre, terminer avec le débriefing, ou abandonner. */
export function ouvrirQuitter(parent: HTMLElement, store: Store) {
  const fermer = () => {
    fenetre.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && fermer();
  const fenetre: HTMLElement = h(
    'div',
    { class: 'zoom popup-poi', role: 'dialog', 'aria-label': 'Quitter la partie', onclick: (e: Event) => e.target === fenetre && fermer() },
    h(
      'div',
      { class: 'zoom-carte rapport quitter' },
      h('h2', {}, 'Quitter la partie en cours ?'),
      h('p', { class: 'muted' }, 'Choisissez ce que vous voulez faire de cette reconnaissance.'),
      h(
        'div',
        { class: 'quitter-choix' },
        h('button', { class: 'btn primaire', onclick: fermer }, 'Reprendre la reconnaissance'),
        h(
          'button',
          {
            class: 'btn',
            onclick: () => {
              fermer();
              store.dispatch({ type: 'terminer' });
            },
          },
          'Terminer et voir le débriefing',
        ),
        h(
          'button',
          {
            class: 'btn danger',
            onclick: () => {
              fermer();
              store.dispatch({ type: 'restart' });
            },
          },
          'Abandonner et revenir au briefing',
        ),
      ),
    ),
  );
  document.addEventListener('keydown', onKey);
  parent.append(fenetre);
}
