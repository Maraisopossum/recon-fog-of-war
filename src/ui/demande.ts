import type { Store } from '../game/store';
import { h } from './dom';

/**
 * « Action demandée » : le joueur peut préciser l'action (champ facultatif) ou valider sans rien écrire.
 * La reconnaissance continue ensuite ; l'action est notée avec l'heure et le lieu.
 */
export function ouvrirDemande(parent: HTMLElement, store: Store, aLaFin?: () => void) {
  let texte = '';
  const fermer = () => {
    fenetre.remove();
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && fermer();
  const champ = h('textarea', {
    rows: 3,
    maxlength: 300,
    placeholder: 'Facultatif : par exemple « sauvetage », « renfort », « échelle »…',
    oninput: (e: Event) => (texte = (e.target as HTMLTextAreaElement).value),
  });
  const fenetre: HTMLElement = h(
    'div',
    { class: 'zoom popup-poi', role: 'dialog', 'aria-label': 'Action demandée', onclick: (e: Event) => e.target === fenetre && fermer() },
    h(
      'div',
      { class: 'zoom-carte rapport demande' },
      h('h2', {}, 'Action demandée'),
      h('p', { class: 'muted' }, "Notez l'action que vous demandez. Vous pouvez valider sans rien écrire : la reconnaissance continue."),
      champ,
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn', onclick: fermer }, 'Annuler'),
        h(
          'button',
          {
            class: 'btn primaire',
            onclick: () => {
              store.dispatch({ type: 'demande', texte: texte.trim() || undefined });
              fermer();
              aLaFin?.();
            },
          },
          'Valider',
        ),
      ),
    ),
  );
  document.addEventListener('keydown', onKey);
  parent.append(fenetre);
  setTimeout(() => champ.focus(), 50);
}
