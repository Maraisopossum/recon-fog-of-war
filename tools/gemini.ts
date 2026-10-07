import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Charge .env (sans dépendance) ; la variable d'environnement GEMINI_API_KEY reste prioritaire. */
export function chargerEnv() {
  const f = path.join(RACINE, '.env');
  if (!fs.existsSync(f)) return;
  for (const l of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function cle(): string {
  chargerEnv();
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error('GEMINI_API_KEY absente (variable d\'environnement ou .env). Ne jamais committer la clé.');
  return k;
}

const SUIVI = process.env.SUIVI_USAGE ?? 'C:/Users/benoi/Documents/Claude/suivi_api/usage.jsonl';

/** Journalise l'usage au format de suivi_api/usage.jsonl (si le fichier existe). */
export function journaliser(model: string, usage: { promptTokenCount?: number; candidatesTokenCount?: number } | undefined, status: string, latence: number, note: string) {
  try {
    if (!fs.existsSync(SUIVI)) return;
    const l = { ts: new Date().toISOString(), provider: 'gemini', model, in: usage?.promptTokenCount ?? 0, out: usage?.candidatesTokenCount ?? 0, status, latency: Math.round(latence * 100) / 100, note };
    fs.appendFileSync(SUIVI, JSON.stringify(l) + '\n');
  } catch {
    /* le suivi ne doit jamais bloquer la génération */
  }
}

export interface Partie {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export async function appeler(model: string, parts: unknown[], generationConfig: unknown, note: string, essais = 3) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  let derniere = '';
  for (let i = 0; i < essais; i++) {
    const t0 = Date.now();
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cle() }, body: JSON.stringify({ contents: [{ parts }], generationConfig }) });
    const j = (await r.json()) as { candidates?: { content?: { parts?: Partie[] }; finishReason?: string }[]; usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }; error?: { message: string } };
    const dt = (Date.now() - t0) / 1000;
    if (r.ok && j.candidates?.[0]?.content?.parts) {
      journaliser(model, j.usageMetadata, 'ok', dt, note);
      return j.candidates[0].content.parts;
    }
    derniere = j.error?.message ?? `réponse sans contenu (${j.candidates?.[0]?.finishReason ?? r.status})`;
    journaliser(model, j.usageMetadata, `err ${r.status}`, dt, note);
    if (r.status === 400 || r.status === 403) break;
    await new Promise((res) => setTimeout(res, 2500 * (i + 1)));
  }
  throw new Error(derniere);
}
