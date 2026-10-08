import type { Scenario } from './types';

/** Valide le scénario et renvoie la liste des erreurs (vide si OK). */
export function validerScenario(s: Scenario): string[] {
  const err: string[] = [];
  const zones = new Set(s.zones.map((z) => z.id));
  const niveaux = new Set(s.niveaux.map((n) => n.id));
  const pois = new Set(s.poi.map((p) => p.id));
  const vues = new Set<string>();
  const dupZ = new Set<string>();

  for (const z of s.zones) {
    if (dupZ.has(z.id)) err.push(`Zone en double : ${z.id}`);
    dupZ.add(z.id);
    if (!niveaux.has(z.niveau)) err.push(`Zone ${z.id} : niveau inconnu « ${z.niveau} »`);
    if (z.polygone.length < 3) err.push(`Zone ${z.id} : polygone invalide`);
    if (z.vues.length === 0) err.push(`Zone ${z.id} : aucune vue`);
    for (const v of z.vues) {
      if (vues.has(v.id)) err.push(`Vue en double : ${v.id}`);
      vues.add(v.id);
      for (const h of v.hotspots ?? []) {
        if (h.type === 'poi' && (!h.poi || !pois.has(h.poi))) err.push(`Vue ${v.id} : hotspot vers un POI inexistant « ${h.poi} »`);
        if (h.type === 'passage') {
          if (!h.vers || !zones.has(h.vers)) err.push(`Vue ${v.id} : hotspot de passage vers une zone inexistante « ${h.vers} »`);
          else if (!s.passages.some((p) => (p.de === z.id && p.vers === h.vers) || (p.vers === z.id && p.de === h.vers)))
            err.push(`Vue ${v.id} : aucun passage déclaré entre ${z.id} et ${h.vers}`);
          if (h.poi && !pois.has(h.poi)) err.push(`Vue ${v.id} : POI inexistant « ${h.poi} » sur un passage`);
        }
      }
    }
    for (const n of z.voisines) if (!zones.has(n)) err.push(`Zone ${z.id} : voisine inexistante « ${n} »`);
  }

  for (const p of s.passages) {
    if (!zones.has(p.de)) err.push(`Passage orphelin : zone « ${p.de} » inexistante`);
    if (!zones.has(p.vers)) err.push(`Passage orphelin : zone « ${p.vers} » inexistante`);
  }
  for (const p of s.poi) {
    if (!zones.has(p.zone)) err.push(`POI ${p.id} : zone inexistante « ${p.zone} »`);
    const reference = s.zones.some((z) => z.vues.some((v) => (v.hotspots ?? []).some((h) => h.poi === p.id)));
    if (!reference) err.push(`POI ${p.id} : aucun hotspot ne permet de le découvrir`);
  }
  for (const v of ['A'] as const) {
    if (!zones.has(s.regles.depart_par_variante[v])) err.push(`Départ variante ${v} : zone inexistante`);
    if (s.regles.victime && !zones.has(s.regles.victime.zone_par_variante[v])) err.push(`Placement variante ${v} : zone inexistante`);
  }

  // Grille de méthode et logements
  for (const g of [...s.grille.exterieur, ...s.grille.interieur]) for (const p of g.poi) if (!pois.has(p)) err.push(`Grille « ${g.id} » : POI inexistant « ${p} »`);
  const ids = [...s.grille.exterieur, ...s.grille.interieur].map((g) => g.id);
  if (new Set(ids).size !== ids.length) err.push('Grille : identifiants en double');
  if (!s.logements.liste.includes(s.logements.sinistre)) err.push('Logement sinistré absent de la liste des logements');
  for (const p of s.poi) {
    if (p.action === 'gaine' && !s.zones.some((z) => z.vues.some((v) => v.image_gaine))) err.push(`POI ${p.id} : action « gaine » sans image_gaine`);
  }

  // Navigation : chaque passage doit pouvoir se prendre dans les deux sens avec un hotspot,
  // et les hotspots doivent rester dans l'image.
  const aHotspot = (a: string, b: string) => s.zones.some((z) => z.id === a && z.vues.some((v) => (v.hotspots ?? []).some((h) => h.type === 'passage' && h.vers === b)));
  for (const p of s.passages) {
    if (!aHotspot(p.de, p.vers)) err.push(`Aucun hotspot pour aller de ${p.de} vers ${p.vers}`);
    if (!aHotspot(p.vers, p.de)) err.push(`Aucun hotspot pour aller de ${p.vers} vers ${p.de}`);
  }
  for (const z of s.zones)
    for (const v of z.vues)
      for (const h of v.hotspots ?? []) {
        const [x, y, w, hh] = h.zone_clic;
        if (x < 0 || y < 0 || w <= 0 || hh <= 0 || x + w > 1.001 || y + hh > 1.001) err.push(`Vue ${v.id} : hotspot hors de l'image (${h.poi ?? h.vers})`);
      }

  // Chevauchement : deux zones quasi confondues se gênent. Une petite zone imbriquée dans une grande
  // (moins de 40 % de son aire) reste permise : la plus petite est affichée au-dessus.
  for (const z of s.zones)
    for (const v of z.vues) {
      const H = v.hotspots ?? [];
      for (let a = 0; a < H.length; a++)
        for (let b = a + 1; b < H.length; b++) {
          const A = H[a].zone_clic;
          const B = H[b].zone_clic;
          const ox = Math.max(0, Math.min(A[0] + A[2], B[0] + B[2]) - Math.max(A[0], B[0]));
          const oy = Math.max(0, Math.min(A[1] + A[3], B[1] + B[3]) - Math.max(A[1], B[1]));
          const petit = Math.min(A[2] * A[3], B[2] * B[3]);
          const grand = Math.max(A[2] * A[3], B[2] * B[3]);
          if (petit > 0 && (ox * oy) / petit > 0.6 && petit / grand >= 0.4) err.push(`Vue ${v.id} : hotspots superposés (${H[a].poi ?? H[a].vers} / ${H[b].poi ?? H[b].vers})`);
        }
    }

  // Flèches de déplacement et vues d'arrivée
  const vuesDe = new Map(s.zones.map((z) => [z.id, new Set(z.vues.map((v) => v.id))]));
  for (const z of s.zones)
    for (const v of z.vues)
      for (const h of v.hotspots ?? []) {
        if (h.type === 'vue' && h.vue !== '@retour' && (!h.vue || !vuesDe.get(z.id)!.has(h.vue))) err.push(`Vue ${v.id} : la flèche vise une vue absente de la zone ${z.id} (${h.vue})`);
        if (h.type === 'passage' && h.vue && h.vers && !vuesDe.get(h.vers)?.has(h.vue)) err.push(`Vue ${v.id} : la vue d'arrivée ${h.vue} n'appartient pas à ${h.vers}`);
      }
  // Toute vue d'une zone doit pouvoir être atteinte depuis la première (flèches ou pivot).
  for (const z of s.zones) {
    const planes = z.vues.filter((v) => !v.direction);
    const vus = new Set<string>([planes[0]?.id ?? z.vues[0].id]);
    const pile = [...vus];
    while (pile.length) {
      const idCourant = pile.pop()!;
      const cur = z.vues.find((v) => v.id === idCourant);
      if (!cur) continue;
      const cibles = (cur.hotspots ?? []).filter((h) => h.type === 'vue' && h.vue && h.vue !== '@retour').map((h) => h.vue!);
      if (cur.mouvement === 'pivot') for (const p of z.vues) if (p.mouvement === 'pivot') cibles.push(p.id);
      for (const c of cibles) if (!vus.has(c)) { vus.add(c); pile.push(c); }
    }
    for (const v of z.vues) if (!vus.has(v.id)) err.push(`Vue ${v.id} : inaccessible depuis la première vue de ${z.id}`);
  }

  // Accessibilité : toutes les zones atteignables depuis le départ
  const vus = new Set<string>([s.regles.depart_par_variante.A]);
  const file = [...vus];
  while (file.length) {
    const c = file.pop()!;
    for (const p of s.passages) {
      const o = p.de === c ? p.vers : p.vers === c ? p.de : null;
      if (o && zones.has(o) && !vus.has(o)) {
        vus.add(o);
        file.push(o);
      }
    }
  }
  for (const z of zones) if (!vus.has(z)) err.push(`Zone inaccessible depuis le départ : ${z}`);
  return err;
}

export function validerOuErreur(s: Scenario): Scenario {
  const e = validerScenario(s);
  if (e.length) {
    e.forEach((m) => console.error('[scénario]', m));
    throw new Error(`Scénario invalide (${e.length} erreur(s)) :\n- ${e.join('\n- ')}`);
  }
  return s;
}
