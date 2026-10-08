import { describe, expect, it } from 'vitest';
import mission from '../scenarios/mission-01.json';
import { couverture, niveauLeMoinsCouvert } from '../src/game/score';
import { reduce, stateInitial } from '../src/game/store';
import type { Action } from '../src/game/store';
import { silhouetteVisible, vueDuPoi, zonePoi } from '../src/game/rules';
import { statutElement } from '../src/ui/debrief';
import type { GameState, Scenario } from '../src/game/types';
import { validerScenario } from '../src/game/validate';

const sc = mission as unknown as Scenario;
const jouer = (st: GameState, ...actions: Action[]) => actions.reduce((s, a) => reduce(sc, s, a), st);
const demarrer = (v: 'A') => jouer(stateInitial(sc), { type: 'start', variante: v });

describe('brouillard', () => {
  it('démarre sur la façade d\'arrivée, zone traversée, le reste inconnu', () => {
    const st = demarrer('A');
    expect(st.position.zone).toBe('ext_facade_A');
    expect(st.zones.ext_facade_A.etat).toBe('traversee');
    expect(st.zones.ss_parking.etat).toBe('inconnue');
  });

  it('commence toujours à la façade A, sans fumée ni alarme au sous-sol', () => {
    expect(sc.regles.depart_par_variante).toEqual({ A: 'ext_facade_A' });
    expect(sc.variantes_arrivee).toEqual(['A']);
    const ids = sc.poi.map((p) => p.id);
    for (const leurre of ['poi_fumee_rampe', 'poi_detecteur', 'poi_indice_malveillance']) expect(ids).not.toContain(leurre);
  });

  it('une zone devient reconnue quand toutes ses vues sont vues', () => {
    let st = demarrer('A');
    st = jouer(st, { type: 'markSeen', vue: 'ext_facade_A_1' });
    expect(st.zones.ext_facade_A.etat).toBe('traversee');
    st = jouer(st, { type: 'markSeen', vue: 'ext_facade_A_2' });
    expect(st.zones.ext_facade_A.etat).toBe('reconnue');
  });

  it('voir une vue sans être entré ne révèle pas la zone', () => {
    const st = jouer(demarrer('A'), { type: 'markSeen', vue: 'ss_parking_1' });
    expect(st.zones.ss_parking.etat).toBe('inconnue');
  });

  it('une porte fermée bloque le passage jusqu\'à son ouverture', () => {
    let st = demarrer('A');
    st = jouer(st, { type: 'goto', zone: 'rdc_hall' }, { type: 'goto', zone: 'rdc_cage' });
    expect(st.position.zone).toBe('rdc_hall'); // la porte principale est ouverte, celle de la cage est fermée
    st = jouer(st, { type: 'openDoor', porte: 'porte_cage_rdc' }, { type: 'goto', zone: 'rdc_cage' });
    expect(st.position.zone).toBe('rdc_cage');
  });

  it('on ne peut pas aller dans une zone sans passage direct', () => {
    const st = jouer(demarrer('A'), { type: 'goto', zone: 'ss_local_poubelles' });
    expect(st.position.zone).toBe('ext_facade_A');
  });

  it('les silhouettes n\'apparaissent que pour les voisines d\'une zone connue', () => {
    const st = demarrer('A');
    const z = (id: string) => sc.zones.find((x) => x.id === id)!;
    expect(silhouetteVisible(sc, st, z('ext_pignon_D'))).toBe(true);
    expect(silhouetteVisible(sc, st, z('ss_local_poubelles'))).toBe(false);
  });
});

describe('score', () => {
  it('vaut 0 au départ de la partie sauf la zone traversée (0,5)', () => {
    const c = couverture(sc, demarrer('A'));
    expect(c.global).toBeCloseTo(0.5 / sc.zones.length);
    expect(c.parNiveau.sous_sol).toBe(0);
  });

  it('ne dépend pas des POI', () => {
    const a = demarrer('A');
    const b = jouer(a, { type: 'poi', poi: 'poi_coupure_gaz' });
    expect(couverture(sc, b).global).toBe(couverture(sc, a).global);
  });

  it('atteint 1 quand tout est reconnu et désigne le niveau le moins couvert', () => {
    let st = demarrer('A');
    for (const z of sc.zones) st = jouer(st, ...z.vues.map((v) => ({ type: 'markSeen', vue: v.id }) as Action));
    // voir des vues sans entrer dans leur zone ne révèle rien : seule la zone de départ est reconnue
    expect(couverture(sc, st).global).toBe(1 / sc.zones.length);
    const partiel = { ...st, zones: Object.fromEntries(sc.zones.map((z) => [z.id, { etat: z.niveau === 'etage' ? ('inconnue' as const) : ('reconnue' as const) }])) };
    const c = couverture(sc, partiel);
    expect(niveauLeMoinsCouvert(sc, c).id).toBe('etage');
    expect(c.parNiveau.rdc).toBe(1);
  });
});

describe('sinistre', () => {
  it('place le feu en façade B, la propagation et la victime en façade C', () => {
    const zone = (id: string) => zonePoi(sc, sc.poi.find((p) => p.id === id)!, 'A');
    expect(zone('poi_feu_facade_B')).toBe('ext_pignon_B');
    expect(zone('poi_propagation_C')).toBe('ext_facade_C');
    expect(zone('poi_victime')).toBe('ext_facade_C');
  });

  it('permet d\'entrer dans le hall sans clé : la porte principale est ouverte au départ', () => {
    const st = jouer(demarrer('A'), { type: 'goto', zone: 'rdc_hall' });
    expect(st.position.zone).toBe('rdc_hall');
  });

  it('ne rejoint la façade C qu\'en contournant le bâtiment', () => {
    let st = jouer(demarrer('A'), { type: 'goto', zone: 'ext_facade_C' });
    expect(st.position.zone).toBe('ext_facade_A');
    st = jouer(st, { type: 'goto', zone: 'ext_pignon_B' }, { type: 'goto', zone: 'ext_facade_C' });
    expect(st.position.zone).toBe('ext_facade_C');
  });
});

describe('validation du scénario', () => {
  it('accepte mission-01', () => {
    expect(validerScenario(sc)).toEqual([]);
  });

  it('détecte un passage orphelin, un POI sans zone et un hotspot cassé', () => {
    const casse = JSON.parse(JSON.stringify(sc)) as Scenario;
    casse.passages.push({ de: 'ss_parking', vers: 'zone_fantome' });
    casse.poi[0].zone = 'nulle_part';
    casse.zones[0].vues[0].hotspots!.push({ type: 'poi', poi: 'poi_inconnu', zone_clic: [0, 0, 0.1, 0.1] });
    const e = validerScenario(casse).join('\n');
    expect(e).toContain('Passage orphelin');
    expect(e).toContain('POI poi_feu_facade_B : zone inexistante');
    expect(e).toContain('POI inexistant « poi_inconnu »');
  });

  it('détecte une zone inaccessible', () => {
    const casse = JSON.parse(JSON.stringify(sc)) as Scenario;
    casse.passages = casse.passages.filter((p) => p.de !== 'et_palier' && p.vers !== 'et_logement');
    expect(validerScenario(casse).join('\n')).toContain('Zone inaccessible depuis le départ : et_logement');
  });
});

describe('rejouer', () => {
  it('remet tout à zéro', () => {
    let st = demarrer('A');
    st = jouer(st, { type: 'markSeen', vue: 'ext_facade_A_1' }, { type: 'poi', poi: 'poi_voie_engins' }, { type: 'restart' });
    expect(st.phase).toBe('briefing');
    expect(st.vuesVues).toEqual([]);
    expect(st.poiTrouves).toEqual([]);
    expect(couverture(sc, st).global).toBe(0);
  });
});

describe('navigation par hotspots', () => {
  it('chaque passage a un hotspot dans les deux sens, dans l\'image', () => {
    const e = validerScenario(sc).filter((m) => m.includes('hotspot'));
    expect(e).toEqual([]);
  });

  it('détecte un sens de passage sans hotspot', () => {
    const casse = JSON.parse(JSON.stringify(sc)) as Scenario;
    for (const z of casse.zones) for (const v of z.vues) v.hotspots = (v.hotspots ?? []).filter((h) => !(z.id === 'rdc_cage' && h.vers === 'r1_cage'));
    expect(validerScenario(casse).join('\n')).toContain('Aucun hotspot pour aller de rdc_cage vers r1_cage');
  });
});

describe('lanterneau et zones superposées', () => {
  it('actionne le désenfumage une seule fois, avec une entrée au journal', () => {
    let st = demarrer('A');
    expect(st.desenfumage).toBe(false);
    st = jouer(st, { type: 'desenfumer' }, { type: 'desenfumer' });
    expect(st.desenfumage).toBe(true);
    expect(st.evenements.filter((e) => e.type === 'action')).toHaveLength(1);
    st = jouer(st, { type: 'restart' });
    expect(st.desenfumage).toBe(false);
  });

  it('n\'a plus de toit et garde la seule commande de désenfumage', () => {
    expect(sc.zones.some((z) => z.niveau === 'toiture')).toBe(false);
    const ids = sc.poi.map((p) => p.id);
    expect(ids).not.toContain('poi_exutoire');
    expect(sc.poi.find((p) => p.id === 'poi_commande_exutoire')?.action).toBe('desenfumer');
  });

  it('refuse deux zones cliquables quasi confondues', () => {
    const casse = JSON.parse(JSON.stringify(sc)) as Scenario;
    const v = casse.zones.flatMap((z) => z.vues).find((x) => x.id === 'et_palier_2')!;
    const porte = v.hotspots!.find((h) => h.vers === 'et_logement')!;
    v.hotspots!.push({ type: 'poi', poi: 'poi_fumee_palier', zone_clic: [...porte.zone_clic] as [number, number, number, number] });
    expect(validerScenario(casse).join('\n')).toContain('hotspots superposés');
  });

  it('mission-01 n\'a aucune zone cliquable superposée', () => {
    expect(validerScenario(sc).filter((m) => m.includes('superposés'))).toEqual([]);
  });
});

describe('arrivées précises et flèches', () => {
  const placer = (st: GameState, zone: string, vue: string): GameState => ({ ...st, position: { zone, vue }, zones: { ...st.zones, [zone]: { etat: 'traversee' } } });
  const passage = (vueId: string, vers: string) => sc.zones.flatMap((z) => z.vues).find((v) => v.id === vueId)!.hotspots!.find((h) => h.type === 'passage' && h.vers === vers)!;

  it('arrive sur la vue indiquée par le passage', () => {
    const h = passage('rdc_cage_2', 'ss_parking');
    expect(h.vue).toBe('ss_parking_2');
    let st = placer(demarrer('A'), 'rdc_cage', 'rdc_cage_2');
    st = jouer(st, { type: 'openDoor', porte: 'porte_parking_cage' }, { type: 'goto', zone: 'ss_parking', vue: h.vue });
    expect(st.position).toEqual({ zone: 'ss_parking', vue: 'ss_parking_2' });
    const retour = passage('ss_parking_2', 'rdc_cage');
    st = jouer(st, { type: 'goto', zone: 'rdc_cage', vue: retour.vue });
    expect(st.position).toEqual({ zone: 'rdc_cage', vue: 'rdc_cage_2' });
  });

  it('revient au bout du couloir des caves depuis le local poubelles', () => {
    expect(passage('ss_local_poubelles_1', 'ss_couloir_caves').vue).toBe('ss_couloir_caves_2');
    expect(passage('ss_local_technique_1', 'ss_couloir_caves').vue).toBe('ss_couloir_caves_2');
  });

  it('ignore une vue d\'arrivée étrangère à la zone', () => {
    let st = placer(demarrer('A'), 'ext_facade_A', 'ext_facade_A_1');
    st = jouer(st, { type: 'goto', zone: 'ext_pignon_B', vue: 'ss_parking_2' });
    expect(st.position).toEqual({ zone: 'ext_pignon_B', vue: 'ext_pignon_B_1' });
  });

  it('chaque vue est reliée par une flèche et les flèches demandées existent', () => {
    const fleche = (vueId: string, cible: string) => sc.zones.flatMap((z) => z.vues).find((v) => v.id === vueId)!.hotspots!.find((h) => h.type === 'vue' && h.vue === cible)?.fleche;
    expect(fleche('ss_couloir_caves_1', 'ss_couloir_caves_2')).toBe('haut');
    expect(fleche('ss_couloir_caves_2', 'ss_couloir_caves_1')).toBe('bas');
    expect(fleche('ss_local_poubelles_1', 'ss_local_poubelles_2')).toBe('droite');
    expect(fleche('ss_local_poubelles_2', 'ss_local_poubelles_1')).toBe('gauche');
    expect(fleche('ss_local_technique_1', 'ss_local_technique_2')).toBe('droite');
    expect(fleche('ss_local_technique_2', 'ss_local_technique_1')).toBe('gauche');
    expect(fleche('r1_palier_1', 'r1_palier_2')).toBe('droite');
    expect(fleche('r1_palier_2', 'r1_palier_1')).toBe('gauche');
    expect(fleche('et_logement_2', 'et_logement_1')).toBe('bas');
    expect(passage('et_logement_1', 'et_palier').fleche).toBe('bas');
  });

  it('détecte une vue inaccessible et une flèche vers une vue étrangère', () => {
    const casse = JSON.parse(JSON.stringify(sc)) as Scenario;
    const v = casse.zones.flatMap((z) => z.vues).find((x) => x.id === 'ss_couloir_caves_1')!;
    v.hotspots = v.hotspots!.filter((h) => h.type !== 'vue');
    expect(validerScenario(casse).join('\n')).toContain('Vue ss_couloir_caves_2 : inaccessible');
    const casse2 = JSON.parse(JSON.stringify(sc)) as Scenario;
    casse2.zones.flatMap((z) => z.vues).find((x) => x.id === 'ss_parking_1')!.hotspots!.push({ type: 'vue', vue: 'rdc_cage_2', fleche: 'haut', zone_clic: [0.1, 0.1, 0.09, 0.14] });
    expect(validerScenario(casse2).join('\n')).toContain('la flèche vise une vue absente');
  });
});

describe('débrief : retrouver la photo d\'un point', () => {
  it('trouve la vue du POI, y compris un passage qui le porte', () => {
    expect(vueDuPoi(sc, 'poi_victime')?.vue.id).toBe('ext_facade_C_1');
    expect(vueDuPoi(sc, 'poi_foyer')?.zone.id).toBe('et_logement');
    expect(vueDuPoi(sc, 'poi_porte_palliere')?.vue.id).toBe('et_palier_2');
    expect(vueDuPoi(sc, 'poi_inexistant')).toBeUndefined();
    for (const p of sc.poi) expect(vueDuPoi(sc, p.id), p.id).toBeDefined();
  });
});

describe('retour du regard vers le haut et niveaux', () => {
  const placer = (st: GameState, zone: string, vue: string): GameState => ({ ...st, position: { zone, vue }, zones: { ...st.zones, [zone]: { etat: 'traversee' } } });

  it('retient la vue d\'où l\'on lève les yeux', () => {
    let st = placer(demarrer('A'), 'rdc_cage', 'rdc_cage_2');
    st = jouer(st, { type: 'vue', vue: 'rdc_cage_haut' });
    expect(st.vueRetour).toBe('rdc_cage_2');
    st = jouer(st, { type: 'vue', vue: st.vueRetour! });
    expect(st.position.vue).toBe('rdc_cage_2');
    expect(st.vueRetour).toBeNull();
  });

  it('oublie la vue de retour en changeant de zone', () => {
    let st = placer(demarrer('A'), 'et_cage', 'et_cage_2');
    st = jouer(st, { type: 'vue', vue: 'et_cage_haut' }, { type: 'goto', zone: 'r1_cage' });
    expect(st.vueRetour).toBeNull();
  });

  it('chaque niveau a un libellé court et les flèches « retour » sont acceptées', () => {
    expect(sc.niveaux.map((n) => n.court)).toEqual(['Ext.', 'Sous-sol', 'RDC', 'R+1', 'R+2', 'R+3']);
    const haut = sc.zones.flatMap((z) => z.vues).find((v) => v.id === 'rdc_cage_haut')!;
    expect(haut.hotspots!.find((h) => h.type === 'vue')?.vue).toBe('@retour');
    expect(validerScenario(sc)).toEqual([]);
  });
});

describe('cages d\'escalier traversées', () => {
  const placer = (st: GameState, zone: string, vue: string): GameState => ({ ...st, position: { zone, vue }, zones: { ...st.zones, [zone]: { etat: 'traversee' } } });

  it('une cage est reconnue sans exiger les vues annexes (descente, regard vers le haut)', () => {
    let st = placer(demarrer('A'), 'r1_cage', 'r1_cage_1');
    st = jouer(st, { type: 'markSeen', vue: 'r1_cage_1' });
    expect(st.zones.r1_cage.etat).toBe('reconnue');
    let s2 = placer(demarrer('A'), 'et_cage', 'et_cage_1');
    s2 = jouer(s2, { type: 'markSeen', vue: 'et_cage_1' });
    expect(s2.zones.et_cage.etat).toBe('reconnue');
  });

  it('exige encore les deux vues principales de la cage du RDC', () => {
    let st = placer(demarrer('A'), 'rdc_cage', 'rdc_cage_1');
    st = jouer(st, { type: 'markSeen', vue: 'rdc_cage_1' });
    expect(st.zones.rdc_cage.etat).toBe('traversee');
    st = jouer(st, { type: 'markSeen', vue: 'rdc_cage_2' });
    expect(st.zones.rdc_cage.etat).toBe('reconnue');
  });
});

describe('local vélos', () => {
  it('est reconnu en regardant l\'entrée du local : le fond est facultatif', () => {
    let st = demarrer('A');
    st = { ...st, position: { zone: 'rdc_local_velos', vue: 'rdc_local_velos_1' }, zones: { ...st.zones, rdc_local_velos: { etat: 'traversee' } } };
    st = jouer(st, { type: 'markSeen', vue: 'rdc_local_velos_1' });
    expect(st.zones.rdc_local_velos.etat).toBe('reconnue');
  });
});

describe('quitter la partie', () => {
  it('terminer mène au débriefing sans compte rendu, abandonner remet à zéro', () => {
    let st = jouer(demarrer('A'), { type: 'markSeen', vue: 'ext_facade_A_2' });
    st = jouer(st, { type: 'terminer' });
    expect(st.phase).toBe('debrief');
    expect(st.rapport).toBeNull();
    const ab = jouer(demarrer('A'), { type: 'restart' });
    expect(ab.phase).toBe('briefing');
    expect(ab.vuesVues).toEqual([]);
  });

  it('terminer est sans effet hors partie', () => {
    const st = stateInitial(sc);
    expect(jouer(st, { type: 'terminer' }).phase).toBe('briefing');
  });
});

describe('R+3 : étage au-dessus du foyer', () => {
  const placer = (st: GameState, zone: string, vue: string): GameState => ({ ...st, position: { zone, vue }, zones: { ...st.zones, [zone]: { etat: 'traversee' } } });

  it('se rejoint par l\'escalier depuis le R+2, puis porte de cage et porte palière', () => {
    let st = placer(demarrer('A'), 'et_cage', 'et_cage_1');
    st = jouer(st, { type: 'goto', zone: 'r3_cage' });
    expect(st.position.zone).toBe('r3_cage');
    st = jouer(st, { type: 'goto', zone: 'r3_palier' });
    expect(st.position.zone).toBe('r3_cage'); // porte fermée tant qu'on ne l'a pas ouverte
    st = jouer(st, { type: 'openDoor', porte: 'porte_cage_r3' }, { type: 'goto', zone: 'r3_palier' }, { type: 'openDoor', porte: 'porte_palliere_r3' }, { type: 'goto', zone: 'r3_logement' });
    expect(st.position.zone).toBe('r3_logement');
  });

  it('a son niveau, sa fumée vient du logement (pas du palier) et la cage se reconnaît avec la vue 1', () => {
    expect(sc.niveaux.map((n) => n.id)).toContain('r3');
    expect(sc.zones.filter((z) => z.niveau === 'r3')).toHaveLength(3);
    expect(vueDuPoi(sc, 'poi_logement_r3_enfume')?.zone.id).toBe('r3_logement');
    let st = placer(demarrer('A'), 'r3_cage', 'r3_cage_1');
    st = jouer(st, { type: 'markSeen', vue: 'r3_cage_1' });
    expect(st.zones.r3_cage.etat).toBe('reconnue');
  });

  it('le lanterneau s\'ouvre dans les trois vues « haut »', () => {
    for (const id of ['rdc_cage_haut', 'et_cage_haut', 'r3_cage_haut']) {
      const v = sc.zones.flatMap((z) => z.vues).find((x) => x.id === id)!;
      expect(v.image_desenfumage, id).toBe(`${id}_ouvert.jpg`);
    }
  });
});

describe('accueil, coupures, compte rendu', () => {
  it('le bon de départ porte le motif, l\'adresse et l\'information R+2', () => {
    expect(sc.briefing.motif).toBe('Alarme incendie');
    expect(sc.briefing.adresse).toContain('8 rue Dessein Bernier');
    expect(sc.briefing.adresse).toContain('59069 Amour');
    expect(sc.briefing.info).toContain('R+2');
  });

  it('enregistre les coupures sans doublon, par logement ou pour l\'immeuble', () => {
    let st = demarrer('A');
    st = jouer(st, { type: 'couper', energie: 'gaz', cible: 'immeuble' }, { type: 'couper', energie: 'gaz', cible: 'immeuble' }, { type: 'couper', energie: 'gaz', cible: 'logement', logement: '22' }, { type: 'couper', energie: 'elec', cible: 'logement', logement: '22' });
    expect(st.coupures).toHaveLength(3);
    expect(st.evenements.filter((e) => e.type === 'action').map((e) => e.texte)).toContain('Gaz coupé du logement 22');
    expect(sc.logements.liste).toContain(sc.logements.sinistre);
  });

  it('la gaine s\'ouvre une fois et reste ouverte ; l\'action demandée est un marqueur sans contenu', () => {
    let st = jouer(demarrer('A'), { type: 'ouvrirGaine' }, { type: 'ouvrirGaine' }, { type: 'demande' }, { type: 'demande' });
    expect(st.gaineOuverte).toBe(true);
    expect(st.evenements.filter((e) => e.texte.includes('Gaine'))).toHaveLength(1);
    expect(st.demandes).toHaveLength(2);
    st = jouer(st, { type: 'restart' });
    expect(st.gaineOuverte).toBe(false);
    expect(st.coupures).toEqual([]);
    expect(st.demandes).toEqual([]);
  });

  it('la gaine du palier a une image fermée et une image ouverte, et le local vélos n\'a plus qu\'une vue', () => {
    const v = sc.zones.flatMap((z) => z.vues).find((x) => x.id === 'et_palier_2')!;
    expect(v.image_gaine).toBe('et_palier_2_gaine_ouverte.jpg');
    expect(sc.poi.find((p) => p.id === 'poi_colonne_montante')?.action).toBe('gaine');
    expect(sc.zones.find((z) => z.id === 'rdc_local_velos')!.vues).toHaveLength(1);
  });

  it('la façade A n\'a plus de passage direct vers le hall depuis le panorama', () => {
    const v = sc.zones.flatMap((z) => z.vues).find((x) => x.id === 'ext_facade_A_1')!;
    expect(v.hotspots!.some((h) => h.type === 'passage' && h.vers === 'rdc_hall')).toBe(false);
  });

  it('la grille sépare reconnaissance 360° et intérieure, avec des éléments absents du scénario', () => {
    expect(sc.grille.exterieur.length).toBeGreaterThan(5);
    expect(sc.grille.interieur.length).toBeGreaterThan(5);
    expect(sc.grille.exterieur.some((g) => g.poi.length === 0)).toBe(true);
    expect(sc.grille.interieur.some((g) => g.poi.length === 0)).toBe(true);
  });

  it('compare ce qui existait, ce qui a été relevé et ce qui a été coché, sans note', () => {
    const it = sc.grille.exterieur.find((g) => g.id === 'ext_gaz')!;
    let st = jouer(demarrer('A'), { type: 'poi', poi: 'poi_coupure_gaz' });
    st = jouer(st, { type: 'report', rapport: { coches: ['ext_gaz', 'ext_pv'], lecture: { fumees: 'noire, dense' } } });
    expect(statutElement(sc, st, it)).toEqual({ existe: true, releve: true, declare: true });
    const pv = sc.grille.exterieur.find((g) => g.id === 'ext_pv')!;
    expect(statutElement(sc, st, pv)).toEqual({ existe: false, releve: false, declare: true });
    expect(st.phase).toBe('debrief');
    expect(st.rapport?.lecture.fumees).toBe('noire, dense');
  });

  it('demande la lecture du feu BV-FFCOS en sept indicateurs', () => {
    expect(sc.lecture_feu.map((l) => l.lettre).join('')).toBe('BVFFCOS');
    expect(new Set(sc.lecture_feu.map((l) => l.id)).size).toBe(7);
  });
});

describe('gaine palière simplifiée et retour du logement', () => {
  it('une seule coupure à la gaine, sans choix de logement', () => {
    let st = jouer(demarrer('A'), { type: 'couper', energie: 'palier', cible: 'palier' }, { type: 'couper', energie: 'palier', cible: 'palier' });
    expect(st.coupures).toHaveLength(1);
    expect(st.evenements.filter((e) => e.texte === 'Coupure effectuée à la gaine technique palière')).toHaveLength(1);
    st = jouer(st, { type: 'restart' });
    expect(st.coupures).toEqual([]);
  });

  it('le retour du logement arrive sur la vue 2/2 du palier (R+2 et R+3)', () => {
    const passage = (vueId: string, vers: string) => sc.zones.flatMap((z) => z.vues).find((v) => v.id === vueId)!.hotspots!.find((h) => h.type === 'passage' && h.vers === vers)!;
    expect(passage('et_logement_1', 'et_palier').vue).toBe('et_palier_2');
    expect(passage('r3_logement_1', 'r3_palier').vue).toBe('r3_palier_2');
    let st = demarrer('A');
    st = { ...st, position: { zone: 'et_logement', vue: 'et_logement_1' }, zones: { ...st.zones, et_logement: { etat: 'traversee' } }, portesOuvertes: ['porte_palliere'] };
    st = jouer(st, { type: 'goto', zone: 'et_palier', vue: 'et_palier_2' });
    expect(st.position).toEqual({ zone: 'et_palier', vue: 'et_palier_2' });
  });
});
