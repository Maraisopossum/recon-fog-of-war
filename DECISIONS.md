# Décisions de conception

Choix non couverts (ou précisés) par le brief, pris selon la règle « solution la plus simple ».

## Reconnaissance
- **Une vue est « vue »** quand elle reste affichée `maintien_vue_ms` (1,5 s, dans `regles`), pour que « j'ai ouvert la porte » ≠ « j'ai regardé ». Pour un **panorama**, il faut avoir balayé au moins 90 % de la largeur (`couverture_panorama`) : sans cela, une zone extérieure à une seule vue serait reconnue dès l'entrée.
- Une zone ne peut être **reconnue** que si le joueur y est entré.
- Les vues « regarder en haut / en bas » (`direction`) comptent comme vues de la zone : les ignorer laisse la zone « traversée ».
- **Ouvrir une porte** est une action séparée du passage : un premier clic ouvre, le suivant traverse.
- Un hotspot de passage peut porter un POI (`poi` sur le hotspot) : regarder une porte la révèle (portes de cage, portes coupe-feu, porte palière).
- La **porte palière** est placée dans la zone `et_palier` (et non `et_logement`) : elle se voit depuis le palier, avant d'entrer.
- La **porte de communication parking / cage** est placée dans `ss_parking`.
- Pas d'événement différé : la situation est figée au lancement. L'ascenseur est un simple passage (aucune sanction, aucun message « bon / mauvais »).

## Scénario et façades
- **Convention A-B-C-D** du Guide SDIS 59 : A = façade d'accès (entrée principale), puis B, C, D dans le sens horaire vu du dessus. B et D sont les pignons, C est la façade arrière. Devant une façade, l'extrémité gauche mène à la suivante (A vers B) et l'extrémité droite à la précédente.
- **Sinistre fixe** : feu dans le logement du R+2 côté façade B (flammes visibles au pignon B), propagation visible en façade C, victime à une fenêtre du R+2 en façade C avec de la fumée au-dessus. Il faut faire le tour du bâtiment pour le voir.
- **Pas de leurre, pas de fumée sous le feu** : le feu est au R+2. Le sous-sol, le RDC et le R+1 sont sans fumée. La cage d'escalier reste claire (portes de cage fermées) ; la fumée n'apparaît qu'au R+2, sur le palier, puis dans le logement en feu, et en panache à l'extérieur (pignon B, façade C, au-dessus du toit). Le requérant a entendu l'alarme générale sans savoir d'où elle vient.
- **Montée jusqu'au sinistre** : RDC, R+1 (clair), puis R+2. L'escalier se prend par la cage ; l'ascenseur mène directement au palier du R+2. Un clic sur une porte fermée l'ouvre et la franchit.
- **Départ unique** : la reconnaissance commence toujours en façade A (plus de variante d'arrivée ni de tirage).
- **Carte hors écran unique** : la carte, le brouillard et les indications de position ne sont affichés que sur le second écran (`?mode=carte`). En écran unique, le joueur n'a que la vue du chef ; la carte n'apparaît qu'au débriefing. Le nom des zones reste visible dans la vue du chef, mais « Logement sinistré » est devenu « Logement ».
- L'entrée du hall est **ouverte au départ** (pas de clé à chercher) et accessible depuis le panorama de la façade A. Les autres portes sont fermées : un clic ouvre, le suivant traverse.
- Le bâtiment est un **R+4** (5 niveaux) : c'est ce que Gemini rend de façon fiable. La ligne du feu et de la victime est vérifiée par Gemini en vision (R+2 = 3ᵉ ligne de fenêtres en partant du sol), avec régénération si besoin.

- **Pas de toit** : la reconnaissance s'arrête au R+2, étage du sinistre. Le lanterneau de désenfumage se voit en haut de la cage (« regarder en haut »), sans élément à repérer ; on l'ouvre depuis la commande de désenfumage de la cage du RDC (bouton dans le zoom), ce qui change l'image et écrit au journal. Aucune note.
- **Cage d'escalier** : une seule volée visible par vue, mêmes matériaux d'un étage à l'autre (images retouchées à partir d'une référence). À chaque palier de cage : une vue vers la volée qui monte et la porte, une vue (flèches de pivot) vers la volée qui descend.
- **Flèches de pivot** sur les bords de l'image pour tourner dans le hall et dans les cages ; les déplacements en profondeur gardent un bouton (Avancer, Reculer).
- **Zones cliquables** : la plus petite est toujours affichée au-dessus ; une zone de POI est plafonnée à 30 % de l'image ; la validation refuse deux zones quasi confondues.
- **Gros plans de l'extérieur** : recadrage du panorama affiné par Gemini (`tools/make-zoom.ts`), pour que le zoom montre la même scène.
- **Palier du R+2** : voile de fumée très léger ; l'intensité n'augmente que dans le logement.

- **Déplacements par flèches dans l'image** : plus de boutons dans la barre du bas. Les flèches (`type: "vue"`, glyphe `fleche`) changent de vue dans la zone ; un passage peut préciser la **vue d'arrivée** (`vue`), par exemple la porte de la cage du RDC mène à « Parking vue 2/2 » et inversement. La validation vérifie que toute vue est atteignable.
- **Débrief** : un clic sur un point de la carte (ou sur sa fiche) ouvre la photo de la vue concernée avec un cadre sur le point (rouge : non relevé, vert : relevé) et dirige le plan vers son niveau.

- **R+3 (étage au-dessus du foyer)** : cage, palier et logement. La fumée du logement vient de la **façade** (ses fenêtres étaient ouvertes), pas de la cage : cage et palier du R+3 restent nets. Le bâtiment compte 5 niveaux (le R+4 existe mais n'est pas accessible).
- **« Regarder en haut »** montre le bon nombre de niveaux jusqu'au lanterneau : 4 depuis le RDC, 2 depuis le R+2, 1 depuis le R+3 (comptage contrôlé par Gemini en vision avec `tools/verify-count.ts`).

## Score et débrief
- Poids de zone : 1 par défaut ; `zone.poids` configurable dans le JSON.
- Axe de progression : niveau le moins couvert (à égalité, premier dans l'ordre des niveaux).
- Les POI sont affichés au débrief avec une phrase factuelle (`ou`), sans points.

## Doctrine (Guide incendie SDIS 59, FORACC)
- Gaz : seul l'organe de coupure du bâtiment est manœuvrable, pas le réseau (convention SDIS / GrDF). Libellé et texte du POI adaptés.
- Électricité : disjoncteur principal « sur ordre », jamais de rétablissement par les sapeurs-pompiers.
- « Colonne montante » du brief renommée **gaine technique palière** pour ne pas la confondre avec la colonne montante gaz ni la colonne sèche.
- Non couverts par le guide, donc `a_valider` dans le JSON : boîte à clés, consignes affichées, détecteur, poteau incendie, voie engins, définition « 3ᵉ famille B ».

## Images
- Modèle : `gemini-3.1-flash-image` (réglable avec `GEMINI_IMAGE_MODEL`). La clé vient de la variable d'environnement `GEMINI_API_KEY`, jamais du code ni du navigateur.
- Les **panoramas** sont des images 21:9 à défilement horizontal, pas des projections sphériques : Gemini ne produit pas d'équirectangulaires fiables.
- Les emplacements des hotspots sont **calculés par Gemini (vision)** sur les images générées (`npm run locate`), puis contrôlables avec la case « Aide ».
- Le réalisme vient d'un style « photo documentaire non retouchée » (`prompts/style-guide.md`) et d'un bâtiment décrit comme vieilli et habité (`building-bible.md`), après comparaison avec des photos réelles de barres HLM et de feux d'appartement trouvées sur Internet (consultées pour s'en inspirer, aucune image copiée ni envoyée à Gemini).
- Gemini compte mal les étages : les images clés (feu du pignon B, victime en façade C) sont contrôlées par Gemini en vision, qui renvoie la ligne de fenêtres, et régénérées jusqu'à tomber sur le R+2.

## Synchronisation double écran
- La carte reçoit l'**état complet** (petit, sérialisable) plutôt que des actions : plus simple et robuste à la reconnexion. Le chef reste l'autorité ; le niveau affiché sur la carte est un choix local.
