/**
 * Place les hotspots de mission-01.json sur les images générées, avec Gemini (vision).
 *   npm run locate -- --view rdc_cage_2     (une ou plusieurs vues)
 *   npm run locate -- --all
 * Pour chaque vue, Gemini renvoie les boîtes englobantes des cibles décrites dans prompts/views.json ;
 * zone_clic est mis à jour dans le scénario (sauvegarde : scenarios/mission-01.avant-locate.json).
 * Contrôler ensuite le résultat dans le jeu avec la case « Aide ».
 */
import fs from 'node:fs';
import path from 'node:path';
import { appeler, chargerEnv, RACINE } from './gemini';

chargerEnv();
const MODELE = process.env.GEMINI_VISION_MODEL ?? 'gemini-flash-latest';
const SCENARIO = path.join(RACINE, 'scenarios', 'mission-01.json');

interface Cible {
  cle: string;
  description: string;
}
interface VueDef {
  id: string;
  cibles: Cible[];
}
interface Hotspot {
  type: 'poi' | 'passage';
  poi?: string;
  vers?: string;
  zone_clic: number[];
}

const vues: VueDef[] = JSON.parse(fs.readFileSync(path.join(RACINE, 'prompts', 'views.json'), 'utf8'));
const a = process.argv.slice(2);
const i = a.indexOf('--view');
const ids = i >= 0 ? a[i + 1].split(',') : vues.filter((v) => v.cibles.length).map((v) => v.id);

const sauvegarde = SCENARIO.replace('.json', '.avant-locate.json');
if (!fs.existsSync(sauvegarde)) fs.copyFileSync(SCENARIO, sauvegarde);
const scenario = JSON.parse(fs.readFileSync(SCENARIO, 'utf8')) as { zones: { vues: { id: string; hotspots?: Hotspot[] }[] }[] };
const rapport: Record<string, unknown> = {};

const borne = (x: number) => Math.min(1, Math.max(0, x));

async function localiser(def: VueDef) {
  const f = path.join(RACINE, 'public', 'assets', 'generated', def.id + '.jpg');
  if (!fs.existsSync(f)) return console.log(`· ${def.id} : image absente, ignorée`);
  const vue = scenario.zones.flatMap((z) => z.vues).find((v) => v.id === def.id);
  if (!vue) return;
  const octets = fs.readFileSync(f);
  const liste = def.cibles.map((c) => `- "${c.cle}" : ${c.description}`).join('\n');
  const texte = `Tu analyses une photo d'un immeuble pour un jeu de formation. Pour chaque cible ci-dessous, donne la boîte englobante serrée de l'objet dans l'image, au format box_2d = [ymin, xmin, ymax, xmax] avec des entiers de 0 à 1000 (1000 = bord opposé de l'image). Si la cible est absente ou illisible, mets box_2d à null.\nCibles :\n${liste}\nRéponds uniquement par un tableau JSON : [{"cle": "...", "box_2d": [..] ou null}, ...]`;
  process.stdout.write(`→ ${def.id} … `);
  const rep = await appeler(
    MODELE,
    [{ inlineData: { mimeType: 'image/jpeg', data: octets.toString('base64') } }, { text: texte }],
    { responseMimeType: 'application/json', temperature: 0 },
    `recon-fog-of-war:locate:${def.id}`,
  );
  const boites = JSON.parse(rep.map((p) => p.text ?? '').join('')) as { cle: string; box_2d: number[] | null }[];
  let n = 0;
  for (const b of boites) {
    if (!b.box_2d) {
      console.log(`\n  ! ${b.cle} introuvable dans l'image (hotspot inchangé)`);
      continue;
    }
    const [y0, x0, y1, x1] = b.box_2d.map((v) => v / 1000);
    const marge = 0.01;
    const x = borne(x0 - marge);
    const y = borne(y0 - marge);
    const w = Math.max(0.05, borne(x1 + marge) - x);
    const h = Math.max(0.07, borne(y1 + marge) - y);
    const [kind, val] = b.cle.split(':');
    const hs = (vue.hotspots ?? []).find((h2) => (kind === 'poi' ? h2.type === 'poi' && h2.poi === val : h2.type === 'passage' && h2.vers === val));
    if (!hs) continue;
    // Un POI ne doit pas recouvrir une grande partie de l image (il masquerait les passages) : taille plafonnée, centrée.
    let [bx, by, bw, bh] = [x, y, w, h];
    if (hs.type === "poi") {
      const cw = Math.min(bw, 0.3);
      const ch = Math.min(bh, 0.3);
      bx += (bw - cw) / 2;
      by += (bh - ch) / 2;
      bw = cw;
      bh = ch;
    }
    hs.zone_clic = [bx, by, bw, bh].map((v) => Math.round(v * 1000) / 1000);
    n++;
  }
  rapport[def.id] = boites;
  console.log(`${n} hotspot(s) placé(s)`);
}

(async () => {
  for (const id of ids) {
    const def = vues.find((v) => v.id === id);
    if (!def) continue;
    try {
      await localiser(def);
    } catch (e) {
      console.log('ÉCHEC', (e as Error).message);
    }
  }
  fs.writeFileSync(SCENARIO, JSON.stringify(scenario, null, 2));
  fs.writeFileSync(path.join(RACINE, 'prompts', 'hotspots-report.json'), JSON.stringify(rapport, null, 2));
})();
