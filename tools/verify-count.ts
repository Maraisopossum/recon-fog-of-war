/** Vérifie avec Gemini (vision) un nombre d'éléments visibles et régénère l'image jusqu'à obtenir la ligne attendue.
 *  npx tsx tools/verify-count.ts <vue> "<question de comptage>" <nombre attendu> */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { appeler, RACINE as R } from './gemini';

const [id, question, attendu] = process.argv.slice(2);

async function verifier(): Promise<number> {
  const f = `${R}/public/assets/generated/${id}.jpg`;
  const rep = await appeler(
    'gemini-flash-latest',
    [{ inlineData: { mimeType: 'image/jpeg', data: fs.readFileSync(f).toString('base64') } }, { text: `${question}\nRéponds uniquement par un JSON {"ligne": entier} où ligne est le nombre demandé.` }],
    { responseMimeType: 'application/json', temperature: 0 },
    'recon-fog-of-war:verif-niveau',
  );
  const j = JSON.parse(rep.map((p) => p.text ?? '').join(''));
  console.log(id, JSON.stringify(j));
  return j.ligne;
}

(async () => {
  for (let i = 0; i < 5; i++) {
    const ligne = await verifier();
    if (String(ligne) === attendu) return console.log('OK');
    console.log('→ nouvelle génération');
    execSync(`npx tsx tools/generate-images.ts --view ${id}`, { cwd: R, stdio: 'inherit' });
  }
  console.log('ÉCHEC : niveau attendu non obtenu');
})();
