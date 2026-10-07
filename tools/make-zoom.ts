/**
 * Zoom d'un POI = recadrage de la vue où il se trouve, affiné par Gemini sans rien changer :
 * le gros plan montre donc exactement la même scène que le panorama.
 *   npx tsx tools/make-zoom.ts --poi poi_victime       (ou plusieurs, séparés par des virgules)
 *   npx tsx tools/make-zoom.ts --all                   (toutes les entrées kind: "crop" de views.json)
 * Le recadrage brut est conservé dans public/assets/generated/<poi>.crop.jpg pour contrôle.
 */
import fs from 'node:fs';
import path from 'node:path';
import { appeler, RACINE } from './gemini';

const MODELE = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image';
const DIR = path.join(RACINE, 'public', 'assets', 'generated');
const views = JSON.parse(fs.readFileSync(path.join(RACINE, 'prompts', 'views.json'), 'utf8')) as { id: string; kind?: string; crop?: { vue: string; poi: string } }[];
const scenario = JSON.parse(fs.readFileSync(path.join(RACINE, 'scenarios', 'mission-01.json'), 'utf8')) as { zones: { vues: { id: string; hotspots?: { poi?: string; zone_clic: number[] }[] }[] }[] };

const PROMPT =
  "Cette image est un recadrage d'une photographie. Reproduis exactement la même scène, le même élément, la même personne éventuelle, les mêmes couleurs, la même fumée et le même cadrage, en haute résolution et plus nette. N'ajoute, ne retire et ne déplace rien : même pose, mêmes vêtements, même fenêtre, même façade. Aucun texte, aucun logo.";

async function zoom(id: string) {
  const def = views.find((v) => v.id === id);
  if (!def?.crop) throw new Error(`${id} : pas d'entrée crop dans views.json`);
  const vue = scenario.zones.flatMap((z) => z.vues).find((v) => v.id === def.crop!.vue);
  const hs = vue?.hotspots?.find((h) => h.poi === def.crop!.poi);
  if (!vue || !hs) throw new Error(`${id} : hotspot introuvable dans ${def.crop.vue}`);
  const sharp = (await import('sharp')).default;
  const source = path.join(DIR, `${vue.id}.jpg`);
  const meta = await sharp(source).metadata();
  const W = meta.width!;
  const H = meta.height!;
  const [x, y, w, h] = hs.zone_clic;
  const cx = (x + w / 2) * W;
  const cy = (y + h / 2) * H;
  // largeur du recadrage : 2,5 fois la zone, au moins 18 % de l'image, ratio 16:9, borné par l'image
  let cw = Math.min(W, Math.max(w * W * 2.5, 0.18 * W, (h * H * 2.5 * 16) / 9));
  let ch = (cw * 9) / 16;
  if (ch > H) {
    ch = H;
    cw = (ch * 16) / 9;
  }
  const left = Math.round(Math.min(W - cw, Math.max(0, cx - cw / 2)));
  const top = Math.round(Math.min(H - ch, Math.max(0, cy - ch / 2)));
  const brut = await sharp(source).extract({ left, top, width: Math.round(cw), height: Math.round(ch) }).jpeg({ quality: 92 }).toBuffer();
  fs.writeFileSync(path.join(DIR, `${id}.crop.jpg`), brut);
  process.stdout.write(`→ ${id} (recadrage ${Math.round(cw)}×${Math.round(ch)}) … `);
  const rep = await appeler(
    MODELE,
    [{ inlineData: { mimeType: 'image/jpeg', data: brut.toString('base64') } }, { text: PROMPT }],
    { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '16:9' } },
    `recon-fog-of-war:zoom:${id}`,
  );
  const img = rep.find((p) => p.inlineData)?.inlineData;
  if (!img) throw new Error('aucune image dans la réponse');
  fs.writeFileSync(path.join(DIR, `${id}.jpg`), await sharp(Buffer.from(img.data, 'base64')).jpeg({ quality: 88 }).toBuffer());
  console.log('ok');
}

(async () => {
  const a = process.argv.slice(2);
  const i = a.indexOf('--poi');
  const ids = i >= 0 ? a[i + 1].split(',') : a.includes('--all') ? views.filter((v) => v.kind === 'crop').map((v) => v.id) : [];
  if (!ids.length) return console.log('Usage : --poi <id[,id]> | --all');
  for (const id of ids) {
    try {
      await zoom(id);
    } catch (e) {
      console.log('ÉCHEC', (e as Error).message);
    }
  }
})();
