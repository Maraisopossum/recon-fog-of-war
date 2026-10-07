/**
 * Génération / régénération des images avec Gemini.
 *   npm run gen -- --list-models
 *   npm run gen -- --view rdc_cage_1          (une ou plusieurs vues, séparées par des virgules)
 *   npm run gen -- --test                     (3 vues pour valider style et modèle)
 *   npm run gen -- --all [--force]            (tout ce qui manque, ou tout avec --force)
 * Modèle : GEMINI_IMAGE_MODEL (.env), par défaut gemini-3.1-flash-image.
 */
import fs from 'node:fs';
import path from 'node:path';
import { appeler, chargerEnv, cle, RACINE } from './gemini';

chargerEnv();
const MODELE = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image';
const SORTIE = path.join(RACINE, 'public', 'assets', 'generated');
const bible = fs.readFileSync(path.join(RACINE, 'prompts', 'building-bible.md'), 'utf8');
const style = fs.readFileSync(path.join(RACINE, 'prompts', 'style-guide.md'), 'utf8');

interface VueDef {
  id: string;
  zone: string | null;
  aspect: string;
  prompt: string;
  ref?: string;
  edit?: boolean;
  kind?: string;
  crop?: { vue: string; poi: string };
}
const vues: VueDef[] = JSON.parse(fs.readFileSync(path.join(RACINE, 'prompts', 'views.json'), 'utf8'));
const parId = new Map(vues.map((v) => [v.id, v]));
const fichier = (id: string) => path.join(SORTIE, id + '.jpg');

async function listerModeles() {
  const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': cle() } });
  const j = (await r.json()) as { models: { name: string; displayName: string }[] };
  for (const m of j.models) if (/image|imagen/i.test(m.name)) console.log(m.name.replace('models/', ''), '·', m.displayName);
}

async function versJpeg(buf: Buffer): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default;
    return await sharp(buf).jpeg({ quality: 86 }).toBuffer();
  } catch {
    return buf; // sharp absent : on garde les octets d'origine (les navigateurs les lisent quand même)
  }
}

async function generer(id: string, force: boolean, pile: string[] = []): Promise<void> {
  const v = parId.get(id);
  if (!v) throw new Error(`Vue inconnue : ${id}`);
  if (v.kind === 'crop') return void console.log(`· ${id} : zoom par recadrage, utiliser tools/make-zoom.ts`);
  if (!force && fs.existsSync(fichier(id))) return;
  if (pile.includes(id)) throw new Error('Référence circulaire : ' + pile.join(' > '));
  const parts: unknown[] = [];
  if (v.ref) {
    if (!fs.existsSync(fichier(v.ref))) await generer(v.ref, false, [...pile, id]);
    const octets = fs.readFileSync(fichier(v.ref));
    parts.push({ inlineData: { mimeType: octets[0] === 0x89 ? 'image/png' : 'image/jpeg', data: octets.toString('base64') } });
  }
  const texte = v.edit
    ? v.prompt
    : [
        v.ref ? 'L\'image fournie est une vue de référence du MÊME bâtiment : conserve exactement les mêmes matériaux, couleurs, mobilier et éclairage. Génère une AUTRE vue, comme demandé ci-dessous.' : '',
        style,
        bible,
        `VUE À PRODUIRE : ${v.prompt}`,
        `Format ${v.aspect}.`,
      ].join('\n\n');
  parts.push({ text: texte });
  process.stdout.write(`→ ${id} (${MODELE}) … `);
  const rep = await appeler(MODELE, parts, { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: v.aspect } }, `recon-fog-of-war:${id}`);
  const img = rep.find((p) => p.inlineData)?.inlineData;
  if (!img) throw new Error('Aucune image dans la réponse : ' + JSON.stringify(rep).slice(0, 200));
  fs.mkdirSync(SORTIE, { recursive: true });
  fs.writeFileSync(fichier(id), await versJpeg(Buffer.from(img.data, 'base64')));
  console.log('ok');
}

async function main() {
  const a = process.argv.slice(2);
  const force = a.includes('--force');
  if (a.includes('--list-models')) return listerModeles();
  let ids: string[] = [];
  const i = a.indexOf('--view');
  if (i >= 0) ids = a[i + 1].split(',');
  else if (a.includes('--test')) ids = ['ext_facade_A_1', 'ss_local_poubelles_1', 'rdc_cage_2'];
  else if (a.includes('--all')) ids = vues.map((v) => v.id);
  else {
    console.log('Usage : --list-models | --view <id[,id]> | --test | --all [--force]');
    return;
  }
  const echecs: string[] = [];
  for (const id of ids) {
    try {
      await generer(id, force || i >= 0);
    } catch (e) {
      console.log('ÉCHEC', (e as Error).message);
      echecs.push(id);
    }
  }
  if (echecs.length) console.log('\nÀ relancer :', echecs.join(','));
}

main();
