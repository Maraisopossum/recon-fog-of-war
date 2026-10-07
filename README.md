# RECON : Fog of War

Serious game web pour la formation APP chef d'agrès tout engin : la qualité de la reconnaissance se mesure à la couverture d'un brouillard sur le plan tactique.

## Lancer

```
npm install
npm run dev          # http://localhost:5173
npm test             # règles de brouillard, score, validation du scénario
npm run build
```

Paramètres d'URL :

| Paramètre | Effet |
|---|---|
| `?mode=single` (défaut) | écran unique : vue du chef seule, **sans carte** (la carte guiderait le joueur) |
| `?mode=chef` | vue du chef, qui diffuse l'état en direct vers l'écran carte |
| `?mode=carte` | second écran : plan tactique et brouillard en direct (lecture seule) |

Le jeu fonctionne sans aucune image : un placeholder est affiché quand `public/assets/generated/<id>.jpg` est absent.

## Double écran (carte sur un autre écran)

- Même machine : ouvrir `?mode=chef` et `?mode=carte` dans deux fenêtres (BroadcastChannel).
- Deux appareils : `npm run sync-server`, puis `?mode=chef&ws=ws://IP:8787` et `?mode=carte&ws=ws://IP:8787`.

## Publier sur GitHub Pages

Le workflow `.github/workflows/deploy.yml` lance les tests, construit le site et le publie à chaque push sur `main`.

1. Créer le dépôt GitHub (public : GitHub Pages gratuit n'accepte pas les dépôts privés) et pousser le dossier. `.env` et `node_modules` sont ignorés par git ; la clé Gemini n'est jamais dans le dépôt.
2. Dans le dépôt : Settings > Pages > Source : **GitHub Actions**.
3. L'adresse est `https://<compte>.github.io/<dépôt>/`. Le site utilise des chemins relatifs et fonctionne dans ce sous-dossier.

Double écran sur GitHub Pages : deux fenêtres du même navigateur fonctionnent telles quelles (`?mode=chef` et `?mode=carte`). Pour deux appareils, il faut un relais WebSocket hébergé ailleurs (`tools/sync-server.mjs`, par exemple sur Render), puis `?mode=chef&ws=wss://…` et `?mode=carte&ws=wss://…`.

## Images (Gemini)

La clé est lue dans la variable d'environnement `GEMINI_API_KEY` (ou un fichier `.env` local, ignoré par git). Ne jamais la committer.

```
npm run gen -- --list-models         # modèles capables de produire des images
npm run gen -- --test                # 3 vues pour valider le style
npm run gen -- --all                 # tout ce qui manque
npm run gen -- --view rdc_cage_2     # régénérer une seule vue
npm run locate -- --all              # Gemini (vision) place les hotspots sur les images
npm run zoom -- --all                # gros plans = recadrages des vues, affinés sans rien changer
```

Les prompts sont dans `prompts/` : `style-guide.md` et `building-bible.md` sont injectés dans chaque prompt, `views.json` décrit chaque vue (référence, cibles à localiser). L'usage est journalisé au format de `suivi_api/usage.jsonl` quand ce fichier existe.

**Relecture obligatoire** : l'IA invente des détails techniques faux (coffret gaz, tableau électrique, colonne sèche, exutoire). Faire valider les images et les textes par un formateur ou un préventionniste avant toute diffusion. Les POI marqués `a_valider` dans le scénario ne sont pas couverts par le Guide incendie SDIS 59.

## Ajouter une mission

1. Copier `scenarios/mission-01.json` en `mission-02.json` et l'adapter (zones, vues, passages, POI, règles).
2. Changer l'import dans `src/main.ts`. Le scénario est validé au démarrage : les erreurs (zone inexistante, passage orphelin, POI sans hotspot, zone inaccessible) s'affichent dans la console et à l'écran.
3. Décrire les vues dans `prompts/views.json`, puis `npm run gen -- --all` et `npm run locate -- --all`.

## Structure

```
src/game       store, règles, score, validation
src/first-person  vue chef (image, hotspots, panorama)
src/map        plan SVG et brouillard
src/ui         briefing, journal, compte rendu, débrief
src/sync       double écran (BroadcastChannel / WebSocket)
scenarios      mission-01.json
prompts        style, bâtiment, vues
tools          génération d'images, placement des hotspots, relais WebSocket
```
