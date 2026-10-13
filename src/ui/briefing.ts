import type { Store } from '../game/store';
import { h } from './dom';
import { ouvrirTutoriel, tutorielDejaVu } from './tutoriel';

/** Écran d'accueil : bon de départ, puis tutoriel avant le départ du chrono. La reconnaissance commence à la façade A. */
export function creerBriefing(parent: HTMLElement, store: Store) {
  const sc = store.scenario;
  const b = sc.briefing;
  const ligne = (etiquette: string, valeur: string) => h('div', { class: 'depart-ligne' }, h('span', { class: 'depart-etiq' }, etiquette), h('strong', {}, valeur));

  // Nom du stagiaire : obligatoire, il identifie la partie dans les résultats formateur (?mode=resultats)
  const nom = h('input', { type: 'text', class: 'champ-nom', placeholder: 'Prénom et nom', autocomplete: 'off', maxlength: 60, 'aria-label': 'Nom du stagiaire' });
  const alerte = h('p', { class: 'alerte-nom cache' }, 'Saisissez votre nom pour commencer.');
  nom.addEventListener('input', () => alerte.classList.add('cache'));
  const nomValide = () => {
    if (nom.value.trim()) return true;
    alerte.classList.remove('cache');
    nom.focus();
    return false;
  };
  const demarrer = () => store.dispatch({ type: 'start', variante: 'A', stagiaire: nom.value });
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
      h('label', { class: 'bloc-nom' }, h('span', {}, 'Stagiaire'), nom),
      alerte,
      h(
        'label',
        { class: 'option-aide' },
        h('input', { type: 'checkbox', onchange: (e: Event) => store.dispatch({ type: 'aide', valeur: (e.target as HTMLInputElement).checked }) }),
        h('span', {}, "Option : afficher l'aide", h('small', {}, "Entoure les zones cliquables. À réserver à la prise en main, pas à l'entraînement.")),
      ),
      h(
        'button',
        { class: 'btn primaire grand', onclick: () => nomValide() && (tutorielDejaVu() ? demarrer() : ouvrirTutoriel(parent, demarrer)) },
        'Commencer la reconnaissance',
      ),
      tutorielDejaVu() ? h('button', { class: 'btn lien', onclick: () => nomValide() && ouvrirTutoriel(parent, demarrer) }, "Revoir le tutoriel avant de commencer") : null,
    ),
  );
  parent.append(racine);

  // Nouveau passage : le champ se vide pour le stagiaire suivant
  const maj = () => {
    const actif = store.get().phase === 'briefing';
    if (actif && racine.classList.contains('cache')) nom.value = '';
    racine.classList.toggle('cache', !actif);
  };
  store.subscribe(maj);
  maj();
  return { racine };
}
