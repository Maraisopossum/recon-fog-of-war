/**
 * Contrôle une image avec Gemini (vision) et la régénère jusqu'à ce qu'elle respecte les attentes.
 *   npx tsx tools/verify-scene.ts <vue> "<question : réponds en JSON avec les clés…>" '{"ligne":3,"cote":"gauche","personnes":">=3"}'
 * Une attente peut être une valeur exacte ou « >=N ». Cinq essais au plus.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { appeler, RACINE } from './gemini';

const [id, question, attenduBrut] = process.argv.slice(2);
const attendu = JSON.parse(attenduBrut) as Record<string, string | number | boolean>;

function conforme(obtenu: Record<string, unknown>): boolean {
  return Object.entries(attendu).every(([cle, voulu]) => {
    const v = obtenu[cle];
    if (typeof voulu === 'string' && voulu.startsWith('>=')) return Number(v) >= Number(voulu.slice(2));
    return String(v) === String(voulu);
  });
}

async function lire(): Promise<Record<string, unknown>> {
  const f = path.join(RACINE, 'public', 'assets', 'generated', `${id}.jpg`);
  const rep = await appeler(
    'gemini-flash-latest',
    [{ inlineData: { mimeType: 'image/jpeg', data: fs.readFileSync(f).toString('base64') } }, { text: question }],
    { responseMimeType: 'application/json', temperature: 0 },
    'recon-fog-of-war:verif-scene',
  );
  return JSON.parse(rep.map((p) => p.text ?? '').join('')) as Record<string, unknown>;
}

(async () => {
  for (let i = 0; i < 5; i++) {
    const obtenu = await lire();
    console.log(id, JSON.stringify(obtenu));
    if (conforme(obtenu)) return console.log('OK');
    console.log('→ nouvelle génération');
    execSync(`npx tsx tools/generate-images.ts --view ${id}`, { cwd: RACINE, stdio: 'inherit' });
  }
  console.log('ÉCHEC : attentes non obtenues');
})();
