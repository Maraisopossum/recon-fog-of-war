import type { GrilleItem } from '../game/types';
import type { Store } from '../game/store';
import { h } from './dom';

/** Ordre stable mais sans rapport avec la présence réelle de l'élément (pas d'indice). */
function melange(items: GrilleItem[]): GrilleItem[] {
  const cle = (id: string) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 9973, 7);
  return [...items].sort((a, b) => cle(a.id) - cle(b.id));
}

type Etape = 'elements' | 'lecture' | 'confirmation';

/**
 * « Rendre compte », en fin de reconnaissance :
 *  1. cocher les éléments vus, séparément pour la reconnaissance 360° et la reconnaissance intérieure ;
 *  2. rédiger la lecture du feu BV-FFCOS (Bâtiment, Vent, Fumées, Flammes, Chaleur, Ouvrants, Sons) ;
 *  3. confirmer : la partie se termine, sans retour possible.
 */
export function ouvrirCompteRendu(parent: HTMLElement, store: Store) {
  const sc = store.scenario;
  const coches = new Set<string>();
  const lecture: Record<string, string> = {};
  let etape: Etape = 'elements';
  const fenetre = h('div', { class: 'zoom popup-poi', role: 'dialog', 'aria-label': 'Rendre compte' });

  const groupe = (titre: string, sous: string, items: GrilleItem[]) =>
    h(
      'fieldset',
      { class: 'grille' },
      h('legend', {}, titre),
      h('p', { class: 'muted' }, sous),
      h(
        'div',
        { class: 'grille-liste' },
        ...melange(items).map((it) =>
          h(
            'label',
            { class: 'case' + (coches.has(it.id) ? ' on' : '') },
            h('input', { type: 'checkbox', ...(coches.has(it.id) ? { checked: true } : {}), onchange: (e: Event) => { (e.target as HTMLInputElement).checked ? coches.add(it.id) : coches.delete(it.id); rendre(); } }),
            it.libelle,
          ),
        ),
      ),
    );

  function rendre() {
    if (etape === 'confirmation') {
      const nbTextes = Object.values(lecture).filter((t) => t.trim()).length;
      fenetre.replaceChildren(
        h(
          'div',
          { class: 'zoom-carte rapport' },
          h('h2', {}, 'Confirmer le compte rendu'),
          h('p', {}, `Vous avez coché ${coches.size} élément${coches.size > 1 ? 's' : ''} et rempli ${nbTextes} case${nbTextes > 1 ? 's' : ''} de lecture du feu. Cette action est définitive : la reconnaissance se termine et vous ne pourrez plus revenir en arrière.`),
          h(
            'div',
            { class: 'actions' },
            h('button', { class: 'btn', onclick: () => { etape = 'lecture'; rendre(); } }, 'Revenir en arrière'),
            h('button', { class: 'btn primaire', onclick: () => { fenetre.remove(); store.dispatch({ type: 'report', rapport: { coches: [...coches], lecture: { ...lecture } } }); } }, 'Confirmer et terminer'),
          ),
        ),
      );
      return;
    }
    if (etape === 'lecture') {
      fenetre.replaceChildren(
        h(
          'div',
          { class: 'zoom-carte rapport' },
          h('p', { class: 'etiquette' }, 'Rendre compte · 2/2'),
          h('h2', {}, 'Lecture du feu : BV-FFCOS'),
          h('p', { class: 'muted' }, 'Décrivez ce que vous avez observé, avec vos mots. Vous pouvez laisser une case vide.'),
          ...sc.lecture_feu.map((it) =>
            h(
              'label',
              { class: 'lecture' },
              h('span', { class: 'lecture-titre' }, h('strong', { class: 'lecture-lettre' }, it.lettre), ` ${it.titre}`),
              h('small', {}, it.aide),
              h('textarea', { rows: 2, placeholder: 'Ce que vous avez observé…', maxlength: 600, oninput: (e: Event) => (lecture[it.id] = (e.target as HTMLTextAreaElement).value) }, lecture[it.id] ?? ''),
            ),
          ),
          h(
            'div',
            { class: 'actions' },
            h('button', { class: 'btn', onclick: () => { etape = 'elements'; rendre(); } }, 'Précédent'),
            h('button', { class: 'btn primaire', onclick: () => { etape = 'confirmation'; rendre(); } }, 'Rendre compte'),
          ),
        ),
      );
      return;
    }
    fenetre.replaceChildren(
      h(
        'div',
        { class: 'zoom-carte rapport' },
        h('p', { class: 'etiquette' }, 'Rendre compte · 1/2'),
        h('h2', {}, 'Éléments vus'),
        h('p', { class: 'muted' }, "Cochez les éléments que vous avez vus pendant la reconnaissance. Il n'y a pas de bonne ou de mauvaise réponse."),
        groupe('Reconnaissance 360° (extérieur)', 'Éléments vus en faisant le tour du bâtiment.', sc.grille.exterieur),
        groupe('Reconnaissance intérieure', "Éléments vus à l'intérieur : sous-sol, parties communes, logements.", sc.grille.interieur),
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn', onclick: () => fenetre.remove() }, 'Reprendre la reconnaissance'),
          h('button', { class: 'btn primaire', onclick: () => { etape = 'lecture'; rendre(); } }, 'Suivant'),
        ),
      ),
    );
  }
  rendre();
  parent.append(fenetre);
}
