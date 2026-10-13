# Product

<!-- impeccable:product-schema 1 -->

Périmètre de ce document : la **page formateur** (`?mode=resultats`) de RECON : Fog of War. Le jeu lui-même (vue du chef, carte, briefing, débriefing individuel) n'est pas couvert ici.

## Platform

web

## Users

- **Utilisateur principal : le formateur** (Benoit Degove, formateur-accompagnateur SDIS du Nord) qui conduit une séance d'APP « chef d'agrès tout engin ». Il fait passer les stagiaires l'un après l'autre sur le jeu, puis utilise la page pour comparer leurs reconnaissances.
- **Public secondaire : le groupe de stagiaires**, qui voit la page projetée pendant le débriefing collectif.

## Product Purpose

Compiler les parties jouées pendant une séance pour montrer ce que chaque stagiaire a vu, ce qu'il a coché en fin de reco, et ce que le groupe a manqué. La page réussit quand le formateur peut, en quelques secondes devant le groupe, désigner les éléments les moins relevés, les écarts entre « vu » et « déclaré », et les zones du bâtiment où personne n'est allé.

## Positioning

La comparaison ne porte pas sur une note mais sur la méthode de reconnaissance : chaque élément est relevé (ou non) pendant le jeu et déclaré (ou non) en fin de reco, et le brouillard de guerre du plan montre directement ce qui n'a pas été parcouru. La couverture en pourcentage reste secondaire, pour ne pas devenir la note.

## Operating Context

- **Séance** : 4 à 6 stagiaires par séance, qui jouent l'un après l'autre sur un seul poste et un seul navigateur.
- **Débriefing collectif** : la page est projetée au vidéoprojecteur devant tout le groupe. Les noms complets des stagiaires sont affichés tels quels, la comparaison nominative fait partie du débriefing.
- **Après la séance** : les résultats sont exportés (CSV pour Excel, JSON pour l'archive) ou imprimés pour le dossier de formation.
- Deux onglets : **Comparatif** (fin de reco de chaque stagiaire en colonnes, actions, lecture du feu BV-FFCOS, plans de chaque niveau empilés) et **Tableau de bord** (chiffres clés, éléments les moins relevés, vus mais pas remontés, cochés sans avoir été vus, plan du groupe avec nuage de guerre).

## Capabilities and Constraints

- Données stockées sur le poste (`localStorage`) **et** dans une feuille Google Sheets du formateur (Apps Script), lue avec un code formateur ; une partie jouée hors ligne repart automatiquement. Les noms complets des stagiaires sont stockés en ligne, choix confirmé par le formateur.
- Publié sur GitHub Pages (dépôt public) ; aucune donnée de stagiaire n'est dans le dépôt.
- Vocabulaire métier à conserver : reconnaissance 360°, reconnaissance intérieure, « Fin de reco » (étape finale du jeu, choisie à la place de « Rendre compte » pour faire moins examen), lecture du feu BV-FFCOS (Bâtiment, Vent, Fumées, Flammes, Chaleur, Ouvrants, Sons), façades A-B-C-D, zone reconnue / traversée / inconnue, nuage (brouillard) de guerre.
- Le plan et le brouillard réutilisent le rendu du jeu (`src/map/map.ts`) : la page formateur doit rester lisible avec ce rendu.
- Pas de boîte de dialogue du navigateur : les actions destructives (supprimer, tout effacer) se confirment par un second clic.

## Brand Commitments

- Nom : **RECON · Fog of War**. Interface et textes en français.
- La page appartient au même univers que le jeu (thème sombre opérationnel, accent ambre, police condensée) ; c'est l'identité existante du projet.

## Evidence on Hand

- Scénario réel : `scenarios/mission-01.json` (grille d'éléments, zones, niveaux, POI).
- Aucune donnée réelle de stagiaire dans le dépôt ; les captures et tests utilisent des noms fictifs, à ne pas présenter comme de vrais résultats.

## Product Principles

1. **Lisible de loin** : projetée, la page doit se lire du fond de la salle ; ce qui compte pour le débriefing collectif ressort sans explication.
2. **Montrer la méthode, pas une note** : relevé / déclaré et zones parcourues avant tout pourcentage.
3. **Les écarts d'abord** : manqués par le groupe, vus mais pas remontés, déclarés sans avoir été vus.
4. **Rien ne se perd** : export simple et fiable en fin de séance, impression propre pour le dossier.
5. **Le vocabulaire du métier** : les libellés reprennent ceux du GDO et de la fin de reco du jeu.

## Accessibility & Inclusion

- Projection en salle : contraste fort et tailles de texte suffisantes pour une lecture à plusieurs mètres, y compris sur un vidéoprojecteur peu lumineux.
- L'impression doit rester lisible sur papier blanc, même si l'écran est sombre.
- Les états relevé / déclaré ne doivent pas reposer sur la seule couleur (symboles ● ○ ✓ déjà utilisés).
