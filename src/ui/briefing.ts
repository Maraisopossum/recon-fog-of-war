import type { Store } from '../game/store';
import { h } from './dom';

/** Écran de briefing : la reconnaissance commence toujours à la façade A. */
export function creerBriefing(parent: HTMLElement, store: Store) {
  const sc = store.scenario;
  const racine = h(
    'div',
    { class: 'ecran briefing' },
    h(
      'div',
      { class: 'briefing-carte' },
      h('p', { class: 'etiquette' }, 'RECON · Fog of War'),
      h('h1', {}, sc.titre),
      h('p', { class: 'texte' }, sc.briefing.texte),
      h('p', { class: 'requerant' }, h('span', { class: 'muted' }, 'Requérant : '), sc.briefing.requerant),
      h('p', { class: 'consigne' }, 'Ces informations ne seront pas répétées. Vous arrivez devant la façade A, accès des secours. La qualité de votre reconnaissance sera mesurée sur la carte au débriefing.'),
      h(
        'label',
        { class: 'option-aide' },
        h('input', { type: 'checkbox', onchange: (e: Event) => store.dispatch({ type: 'aide', valeur: (e.target as HTMLInputElement).checked }) }),
        h('span', {}, 'Option : afficher l\'aide', h('small', {}, 'Entoure les zones cliquables. À réserver à la prise en main, pas à l\'entraînement.')),
      ),
      h('button', { class: 'btn primaire grand', onclick: () => store.dispatch({ type: 'start', variante: 'A' }) }, 'Commencer la reconnaissance'),
    ),
  );
  parent.append(racine);

  const maj = () => racine.classList.toggle('cache', store.get().phase !== 'briefing');
  store.subscribe(maj);
  maj();
  return { racine };
}
