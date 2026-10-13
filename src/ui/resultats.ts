import { centroide } from '../game/rules';
import { chargerResultats, frequentationZones, fusionner, sauverResultats, statut, synthese, versCsv, type Resultat } from '../game/resultats';
import { couverture, pct } from '../game/score';
import { createStore } from '../game/store';
import type { GrilleItem, Scenario } from '../game/types';
import { creerCarte, defs } from '../map/map';
import { chronoTexte, h, s } from './dom';

type Onglet = 'comparatif' | 'tableau';

function telecharger(nom: string, contenu: string, type: string) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = h('a', { href: url, download: nom });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Bouton à double clic : le premier arme (« Confirmer ? »), le second agit. Pas de boîte de dialogue du navigateur. */
function boutonConfirme(libelle: string, action: () => void, classe = 'btn') {
  let arme = false;
  let minuterie = 0;
  const b = h('button', {
    class: classe,
    onclick: () => {
      if (arme) { clearTimeout(minuterie); action(); return; }
      arme = true;
      b.textContent = 'Confirmer ?';
      b.classList.add('arme');
      minuterie = window.setTimeout(() => { arme = false; b.textContent = libelle; b.classList.remove('arme'); }, 3000);
    },
  }, libelle);
  return b;
}

const dateCourte = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Page formateur (?mode=resultats) : comparatif par stagiaire et tableau de bord du groupe. */
export function creerPageResultats(parent: HTMLElement, sc: Scenario) {
  let resultats: Resultat[] = [];
  let onglet: Onglet = 'comparatif';
  try { onglet = (sessionStorage.getItem('resultats-onglet') as Onglet) || 'comparatif'; } catch { /* stockage indisponible */ }
  const message = h('span', { class: 'res-message', role: 'status' });
  const corps = h('div', { class: 'res-corps' });
  const onglets = h('div', { class: 'res-onglets', role: 'tablist' });
  const fichier = h('input', { type: 'file', accept: '.json,application/json', class: 'cache' });
  fichier.addEventListener('change', async () => {
    const f = fichier.files?.[0];
    if (!f) return;
    try {
      const tous = chargerResultats();
      const fusion = fusionner(tous, JSON.parse(await f.text()));
      sauverResultats(fusion);
      dire(`${fusion.length - tous.length} partie(s) importée(s).`);
      rendre();
    } catch (e) {
      dire((e as Error).message || 'Fichier illisible.');
    }
    fichier.value = '';
  });

  const dire = (t: string) => { message.textContent = t; setTimeout(() => { if (message.textContent === t) message.textContent = ''; }, 5000); };
  const horodatage = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

  const racine = h(
    'div',
    { class: 'resultats' },
    h(
      'header',
      { class: 'res-entete' },
      h('div', {}, h('p', { class: 'etiquette' }, 'RECON · Résultats formateur'), h('h1', {}, sc.titre)),
      h(
        'div',
        { class: 'res-actions' },
        message,
        h('button', { class: 'btn', onclick: () => telecharger(`recon-resultats-${horodatage()}.csv`, versCsv(sc, resultats), 'text/csv;charset=utf-8') }, 'Exporter CSV (Excel)'),
        h('button', { class: 'btn', onclick: () => telecharger(`recon-resultats-${horodatage()}.json`, JSON.stringify(resultats, null, 1), 'application/json') }, 'Exporter JSON'),
        h('button', { class: 'btn', onclick: () => fichier.click() }, 'Importer JSON'),
        boutonConfirme('Tout effacer', () => { resultats = []; sauverResultats(resultats); dire('Toutes les parties ont été effacées.'); rendre(); }, 'btn danger'),
        h('a', { class: 'btn', href: location.pathname }, 'Ouvrir le jeu'),
        fichier,
      ),
    ),
    onglets,
    corps,
  );
  parent.append(racine);

  function rendreOnglets() {
    onglets.replaceChildren(
      ...([['comparatif', 'Comparatif'], ['tableau', 'Tableau de bord']] as const).map(([id, nom]) =>
        h('button', {
          class: 'onglet' + (onglet === id ? ' actif' : ''), role: 'tab', 'aria-selected': onglet === id,
          onclick: () => { onglet = id; try { sessionStorage.setItem('resultats-onglet', id); } catch { /* sans effet */ } rendre(); },
        }, nom),
      ),
      h('span', { class: 'muted res-compte' }, `${resultats.length} partie${resultats.length > 1 ? 's' : ''} enregistrée${resultats.length > 1 ? 's' : ''} sur ce poste`),
    );
  }

  function rendre() {
    resultats = chargerResultats().filter((r) => r.scenario === sc.id).sort((a, b) => a.date.localeCompare(b.date));
    rendreOnglets();
    if (!resultats.length) {
      corps.replaceChildren(h('div', { class: 'deb-bloc' }, h('h2', {}, 'Aucune partie'), h('p', {}, "Les parties s'enregistrent ici automatiquement à la fin de chaque reconnaissance, avec le nom saisi au bon de départ. Elles restent sur ce poste et dans ce navigateur : pensez à exporter en fin de séance.")));
      return;
    }
    corps.replaceChildren(onglet === 'comparatif' ? comparatif() : tableauDeBord());
  }

  // ───────── Comparatif : le compte rendu individuel, une colonne par stagiaire ─────────
  function comparatif() {
    const n = resultats.length;
    const etats = resultats.map((r) => r.etat);
    const ligneTitre = (titre: string, sous?: string) => h('tr', { class: 'cmp-section' }, h('th', { colspan: n + 2, scope: 'colgroup' }, titre, sous ? h('span', { class: 'muted' }, ` · ${sous}`) : null));
    const ligne = (libelle: Node | string, cellules: (Node | string)[], fin: Node | string = '') =>
      h('tr', {}, h('th', { scope: 'row' }, libelle), ...cellules.map((c) => h('td', {}, c)), h('td', { class: 'cmp-fin' }, fin));

    const cellule = (it: GrilleItem, i: number) => {
      const st = etats[i];
      const { releve, declare } = statut(st, it);
      const existe = it.poi.length > 0;
      if (!existe) return declare ? h('span', { class: 'marque faux', title: 'Coché alors que cet élément n’existe pas' }, '✓ absent') : h('span', { class: 'muted' }, '·');
      // sans compte rendu, un élément vu n'est pas « oublié » : il est seulement relevé
      const cls = releve && declare ? 'ok' : releve ? (st.rapport ? 'vu' : 'releve') : declare ? 'faux' : 'non';
      const titre = { ok: 'Relevé en jeu et coché au compte rendu', vu: 'Relevé en jeu, pas coché au compte rendu', releve: 'Relevé en jeu (pas de compte rendu)', faux: 'Coché sans avoir été relevé', non: 'Pas relevé' }[cls];
      return h('span', { class: 'marque ' + cls, title: titre }, (releve ? '●' : '○') + (declare ? ' ✓' : ''));
    };
    const blocGrille = (titre: string, sous: string, items: GrilleItem[]) => [
      ligneTitre(titre, sous),
      ...items.map((it) => {
        const vus = etats.filter((st) => statut(st, it).releve).length;
        return ligne(it.libelle, etats.map((_, i) => cellule(it, i)), it.poi.length ? jauge(vus, n) : h('span', { class: 'muted' }, 'absent'));
      }),
    ];

    const tete = h(
      'tr',
      {},
      h('th', { class: 'cmp-coin' }, h('span', { class: 'legende' }, h('span', { class: 'marque ok' }, '● ✓'), ' vu et rendu compte · ', h('span', { class: 'marque vu' }, '●'), ' vu, pas rendu compte · ', h('span', { class: 'marque faux' }, '○ ✓'), ' coché sans l’avoir vu · ', h('span', { class: 'marque non' }, '○'), ' pas vu · ', h('span', { class: 'marque releve' }, '●'), ' vu, sans compte rendu')),
      ...resultats.map((r) => {
        const c = couverture(sc, r.etat);
        return h(
          'th',
          { class: 'cmp-stagiaire', scope: 'col' },
          h('strong', {}, r.stagiaire),
          h('span', { class: 'muted petit' }, `${dateCourte(r.date)} · ${chronoTexte(r.etat.chrono)}`),
          h('span', { class: 'muted petit' }, `couverture ${pct(c.global)}`),
          r.etat.rapport ? null : h('span', { class: 'marque faux petit' }, 'sans compte rendu'),
          boutonConfirme('Supprimer', () => { sauverResultats(chargerResultats().filter((x) => x.id !== r.id)); dire(`Partie de ${r.stagiaire} supprimée.`); rendre(); }, 'btn mini'),
        );
      }),
      h('th', { class: 'cmp-fin' }, 'Vu par'),
    );

    const zones = new Map(sc.zones.map((z) => [z.id, z.nom]));
    const liste = (items: string[]) => (items.length ? h('ul', { class: 'cmp-liste' }, ...items.map((t) => h('li', {}, t))) : h('span', { class: 'muted' }, '—'));
    const actions = [
      ligneTitre('Actions'),
      ligne('Compte rendu', etats.map((st) => (st.rapport ? 'rempli' : h('span', { class: 'marque faux' }, 'non rempli')))),
      ligne('Coupures', etats.map((st) => liste(st.coupures.map((k) => `${chronoTexte(k.t)} ${k.cible === 'palier' ? 'gaine palière' : `${k.energie === 'gaz' ? 'gaz' : 'élec.'} ${k.cible === 'immeuble' ? 'immeuble' : `logt ${k.logement}`}`}`)))),
      ligne('Désenfumage cage', etats.map((st) => (st.desenfumage ? 'oui' : h('span', { class: 'muted' }, 'non'))), jauge(etats.filter((st) => st.desenfumage).length, n)),
      ligne('Gaine palière ouverte', etats.map((st) => (st.gaineOuverte ? 'oui' : h('span', { class: 'muted' }, 'non'))), jauge(etats.filter((st) => st.gaineOuverte).length, n)),
      ligne('Actions demandées', etats.map((st) => liste(st.demandes.map((d) => `${chronoTexte(d.t)} ${zones.get(d.zone) ?? ''}${d.texte ? ' : ' + d.texte : ''}`)))),
    ];

    const lecture = [
      ligneTitre('Lecture du feu : BV-FFCOS'),
      ...sc.lecture_feu.map((l) =>
        ligne(
          h('span', {}, h('strong', { class: 'lecture-lettre' }, l.lettre), ` ${l.titre}`),
          etats.map((st) => {
            const t = st.rapport?.lecture[l.id]?.trim();
            return t ? h('p', { class: 'cmp-texte' }, t) : h('span', { class: 'muted' }, 'non renseigné');
          }),
        ),
      ),
    ];

    // Plans : chaque niveau sur une ligne, une colonne par stagiaire, comme au débriefing
    const stores = etats.map((st) => {
      const store = createStore(sc);
      store.dispatch({ type: 'replace', state: st });
      return store;
    });
    const plans = [
      ligneTitre('Plans', 'zones grisées : non reconnues · losange vert : relevé · rouge : manqué'),
      ...sc.niveaux.map((niv) =>
        ligne(
          niv.nom,
          stores.map((store) => {
            const hote = h('div', { class: 'cmp-plan' });
            creerCarte(hote, store, { debrief: true, niveau: niv.id, statique: true });
            return hote;
          }),
          (() => {
            const zs = sc.zones.filter((z) => z.niveau === niv.id);
            const moy = etats.reduce((a, st) => a + couverture(sc, st).parNiveau[niv.id], 0) / n;
            return zs.length ? h('span', { class: 'muted petit' }, `couverture moyenne ${pct(moy)}`) : '';
          })(),
        ),
      ),
    ];

    return h(
      'div',
      { class: 'cmp-defile' },
      h(
        'table',
        { class: 'cmp' },
        h('thead', {}, tete),
        h('tbody', {}, ...blocGrille('Reconnaissance 360°', "tour du bâtiment, vu de l'extérieur", sc.grille.exterieur), ...blocGrille('Reconnaissance intérieure', 'sous-sol, parties communes et logements', sc.grille.interieur), ...actions, ...lecture, ...plans),
      ),
    );
  }

  // ───────── Tableau de bord : ce qui ressort sur le groupe ─────────
  function tableauDeBord() {
    const n = resultats.length;
    const etats = resultats.map((r) => r.etat);
    const syn = synthese(sc, resultats);
    const avecCr = etats.filter((st) => st.rapport).length;
    const durees = etats.map((st) => st.chrono);
    const moy = Math.round(durees.reduce((a, b) => a + b, 0) / n);
    const compte = (f: (k: (typeof etats)[number]['coupures'][number]) => boolean) => etats.filter((st) => st.coupures.some(f)).length;

    const chiffre = (valeur: string, libelle: string) => h('div', { class: 'kpi' }, h('strong', {}, valeur), h('span', {}, libelle));
    const kpis = h(
      'div',
      { class: 'kpis' },
      chiffre(String(n), n > 1 ? 'passages' : 'passage'),
      chiffre(chronoTexte(moy), `durée moyenne (${chronoTexte(Math.min(...durees))} à ${chronoTexte(Math.max(...durees))})`),
      chiffre(`${avecCr}/${n}`, 'comptes rendus remplis'),
      chiffre(`${compte((k) => k.energie === 'gaz' && k.cible === 'immeuble')}/${n}`, 'gaz coupé (immeuble)'),
      chiffre(`${compte((k) => k.energie === 'elec' && k.cible === 'immeuble')}/${n}`, 'électricité coupée (immeuble)'),
      chiffre(`${etats.filter((st) => st.desenfumage).length}/${n}`, 'désenfumage de la cage'),
    );

    const barres = (titre: string, sous: string, lignes: { libelle: string; v: number; total: number; note?: string }[], vide: string) =>
      h(
        'div',
        { class: 'deb-bloc' },
        h('h2', {}, titre),
        h('p', { class: 'muted' }, sous),
        lignes.length
          ? h('ol', { class: 'barres' }, ...lignes.map((l) => h('li', {}, h('span', { class: 'barre-lib' }, l.libelle), jauge(l.v, l.total), l.note ? h('span', { class: 'muted petit' }, l.note) : null)))
          : h('p', { class: 'muted' }, vide),
      );

    const nom = (x: (typeof syn)[number]) => `${x.item.libelle}${x.groupe === 'exterieur' ? ' (360°)' : ''}`;
    const moinsVus = [...syn].sort((a, b) => a.vus - b.vus || a.item.libelle.localeCompare(b.item.libelle)).map((x) => ({
      libelle: nom(x),
      v: x.vus,
      total: n,
      note: `coché par ${x.declares}`,
    }));
    const nonRemontes = syn.filter((x) => x.vusNonDeclares > 0).sort((a, b) => b.vusNonDeclares - a.vusNonDeclares).map((x) => ({ libelle: nom(x), v: x.vusNonDeclares, total: x.vusAvecCr, note: `sur ${x.vusAvecCr} qui l'ont vu et ont rempli le compte rendu` }));
    const absents = [...sc.grille.exterieur, ...sc.grille.interieur].filter((it) => !it.poi.length);
    const faux = [
      ...syn.filter((x) => x.declaresNonVus > 0).map((x) => ({ libelle: nom(x), v: x.declaresNonVus, total: avecCr, note: 'non relevé en jeu' })),
      ...absents.map((it) => ({ libelle: it.libelle, v: etats.filter((st) => st.rapport?.coches.includes(it.id)).length, total: avecCr, note: 'absent du scénario' })).filter((x) => x.v > 0),
    ].sort((a, b) => b.v - a.v);

    const freq = frequentationZones(sc, resultats);
    const cartes = h(
      'div',
      { class: 'deb-bloc' },
      h('h2', {}, 'Zones reconnues par le groupe'),
      h('p', { class: 'muted' }, 'Vert : part des stagiaires qui ont reconnu la zone. Nuage : zone où une partie du groupe n’est jamais entrée, opaque si personne n’y est allé. Chiffres : nombre de stagiaires qui ont reconnu la zone, puis ceux qui l’ont seulement traversée.'),
      h('div', { class: 'chaleurs' }, ...sc.niveaux.map((niv) => h('figure', { class: 'chaleur' }, h('figcaption', {}, niv.nom), carteChaleur(sc, niv.id, freq, n)))),
    );

    return h(
      'div',
      { class: 'tdb' },
      kpis,
      h(
        'div',
        { class: 'tdb-grille' },
        barres('Éléments les moins relevés', 'Du moins vu au plus vu, relevé en jeu. À reprendre en priorité au débriefing collectif.', moinsVus, 'Aucun élément.'),
        h(
          'div',
          { class: 'tdb-col' },
          barres('Vus mais pas remontés', 'Relevés en jeu, mais absents du compte rendu.', nonRemontes, 'Aucun écart : tout ce qui a été vu a été remonté.'),
          barres('Cochés sans avoir été vus', 'Déclarés au compte rendu sans avoir été relevés, ou absents du scénario.', faux, 'Aucun.'),
        ),
      ),
      cartes,
    );
  }

  rendre();
  // Une partie terminée dans un autre onglet du même navigateur apparaît sans recharger
  window.addEventListener('storage', () => rendre());
  return { racine };
}

function jauge(v: number, total: number) {
  const r = total ? v / total : 0;
  return h('span', { class: 'jauge', title: `${v} sur ${total}` }, h('span', { class: 'jauge-barre' }, h('span', { style: `width:${Math.round(r * 100)}%` })), h('span', { class: 'jauge-txt' }, `${v}/${total}`));
}

/** Plan d'un niveau, chaque zone teintée selon la part des stagiaires qui l'ont reconnue. */
function carteChaleur(sc: Scenario, niveau: string, freq: Record<string, { reconnue: number; traversee: number }>, n: number) {
  const niv = sc.niveaux.find((x) => x.id === niveau)!;
  const pts = (p: [number, number][]) => p.map((q) => q.join(',')).join(' ');
  const svg = s('svg', { viewBox: '15 22 360 262', class: 'carte-svg', role: 'img', 'aria-label': `Zones reconnues, ${niv.nom}` });
  svg.append(defs(true));
  for (const d of niv.decor) svg.append(s('polygon', { points: pts(d.polygone), class: 'decor' }));
  const nuages = s('g', {});
  const textes = s('g', {});
  for (const z of sc.zones.filter((x) => x.niveau === niveau)) {
    const f = freq[z.id];
    const r = n ? f.reconnue / n : 0;
    // nuage de guerre : d'autant plus épais que peu de stagiaires sont entrés dans la zone ; complet si personne
    const jamais = n ? (n - f.reconnue - f.traversee) / n : 1;
    const [cx, cy] = centroide(z.polygone);
    svg.append(s('polygon', { points: pts(z.polygone), class: 'chaleur-zone', style: `fill-opacity:${(0.08 + r * 0.82).toFixed(2)}` }));
    if (jamais > 0) nuages.append(s('polygon', { points: pts(z.polygone), class: 'fog', filter: 'url(#nuage)', fill: '#9fb0c4', style: `opacity:${(jamais === 1 ? 0.97 : 0.25 + jamais * 0.6).toFixed(2)}` }));
    textes.append(
      s('polygon', { points: pts(z.polygone), class: 'chaleur-contour' }, s('title', {}, `${z.nom} : reconnue par ${f.reconnue}/${n}, traversée par ${f.traversee}, jamais visitée par ${Math.round(jamais * n)}`)),
      s('text', { x: cx, y: cy - 2, class: 'zone-nom', 'text-anchor': 'middle' }, z.nom),
      s('text', { x: cx, y: cy + 9, class: 'chaleur-chiffre', 'text-anchor': 'middle' }, `${f.reconnue}/${n} reconnue${f.reconnue > 1 ? 's' : ''}`),
      f.traversee ? s('text', { x: cx, y: cy + 18, class: 'chaleur-chiffre secondaire', 'text-anchor': 'middle' }, `${f.traversee} traversée${f.traversee > 1 ? 's' : ''} sans reconnaître`) : '',
    );
  }
  svg.append(nuages, textes);
  return svg;
}
