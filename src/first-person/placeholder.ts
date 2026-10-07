const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Image de remplacement (dégradé sombre + nom de la zone) quand l'image Gemini est absente. */
export function placeholderUrl(titre: string, sousTitre: string, largeur: number, hauteur: number, teinte = 210): string {
  const lignes: string[] = [];
  for (let x = 0; x < largeur; x += 80) lignes.push(`<line x1="${x}" y1="0" x2="${x}" y2="${hauteur}" stroke="#ffffff" stroke-opacity=".04"/>`);
  for (let y = 0; y < hauteur; y += 80) lignes.push(`<line x1="0" y1="${y}" x2="${largeur}" y2="${y}" stroke="#ffffff" stroke-opacity=".04"/>`);
  const taille = Math.round(Math.min(hauteur / 11, 56));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${teinte},28%,16%)"/><stop offset="1" stop-color="hsl(${teinte + 20},22%,7%)"/></linearGradient></defs>
<rect width="100%" height="100%" fill="url(#g)"/>${lignes.join('')}
<text x="50%" y="46%" text-anchor="middle" font-family="Segoe UI, Arial Narrow, sans-serif" font-size="${taille}" fill="#e8edf2" fill-opacity=".85" letter-spacing="2">${esc(titre.toUpperCase())}</text>
<text x="50%" y="${46 + 8}%" text-anchor="middle" font-family="Consolas, monospace" font-size="${Math.round(taille / 2.4)}" fill="#f2b04a" fill-opacity=".8">${esc(sousTitre)}</text>
</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

export function teinteZone(niveau: string): number {
  return ({ exterieur: 205, sous_sol: 20, rdc: 160, etage: 260, r1: 140, r3: 280, toiture: 190 } as Record<string, number>)[niveau] ?? 210;
}
