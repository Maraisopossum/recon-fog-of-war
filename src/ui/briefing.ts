import type { Store } from '../game/store';
import { h } from './dom';
import { ouvrirTutoriel, tutorielDejaVu } from './tutoriel';

/** Écran d'accueil : bon de départ, puis tutoriel avant le départ du chrono. La reconnaissance commence à la façade A. */
export function creerBriefing(parent: HTMLElement, store: Store) {
  const sc = store.scenario;
  const b = sc.briefing;
  const ligne = (etiquette: string, valeur: string) => h('div', { class: 'depart-ligne' }, h('span', { class: 'depart-etiq' }, etiquette), h('strong', {}, valeur));

  const demarrer = () => store.dispatch({ type: 'start', variante: 'A' });
  const racine = h(
    'div',
    { class: 'ecran briefing' },
    h(
      'div',
      { class: 'briefing-carte' },
      h('p', { class: 'etiquette' }, 'RECON · Fog of War'),
      h('h1', {}, 'Bon de départ'),
      h('div', { class: 'depart' }, ligne('Motif de départ', b.motif), ligne('Adresse', b.adresse), ligne('Information complémentaire', b.info)),
      h('p', { class: 'consigne' }, 'Vous arrivez devant la façade A, accès des secours.'),
      h(
        'label',
        { class: 'option-aide' },
        h('input', { type: 'checkbox', onchange: (e: Event) => store.dispatch({ type: 'aide', valeur: (e.target as HTMLInputElement).checked }) }),
        h('span', {}, "Option : afficher l'aide", h('small', {}, "Entoure les zones cliquables. À réserver à la prise en main, pas à l'entraînement.")),
      ),
      h(
        'button',
        { class: 'btn primaire grand', onclick: () => (tutorielDejaVu() ? demarrer() : ouvrirTutoriel(parent, demarrer)) },
        'Commencer la reconnaissance',
      ),
      tutorielDejaVu() ? h('button', { class: 'btn lien', onclick: () => ouvrirTutoriel(parent, demarrer) }, "Revoir le tutoriel avant de commencer") : null,
    ),
  );
  parent.append(racine);

  const maj = () => racine.classList.toggle('cache', store.get().phase !== 'briefing');
  store.subscribe(maj);
  maj();
  return { racine };
}
