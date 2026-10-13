/**
 * RECON · Fog of War : stockage en ligne des parties dans une feuille Google Sheets.
 *
 * Installation (une fois) : feuille Google Sheets > Extensions > Apps Script, coller ce fichier,
 * remplacer CODE_FORMATEUR, puis Déployer > Nouveau déploiement > Application Web
 * (Exécuter en tant que : moi ; Qui a accès : tout le monde). L'adresse /exec obtenue va dans
 * src/config.ts (SHEETS_URL).
 *
 * - POST {action: 'ajouter', resultat}           : n'importe quel poste du jeu ajoute une partie (sans doublon).
 * - POST {action: 'lister', code}                : la page formateur relit toutes les parties.
 * - POST {action: 'supprimer', id, code}         : la page formateur supprime une partie.
 * Lecture et suppression exigent le code formateur, qui n'est jamais dans le code public du jeu
 * et circule dans le corps des requêtes, jamais dans l'adresse.
 */
const CODE_FORMATEUR = 'A_REMPLACER';
const FEUILLE = 'Parties';
const ENTETE = ['Identifiant', 'Date', 'Stagiaire', 'Scénario', 'Durée (s)', 'Fin de reco', 'Couverture (%)', 'Éléments relevés', 'Données'];
/** une cellule Google Sheets contient au plus 50 000 caractères : l'état de partie est découpé */
const MORCEAU = 45000;

function feuille_() {
  const classeur = SpreadsheetApp.getActiveSpreadsheet();
  let f = classeur.getSheetByName(FEUILLE);
  if (!f) {
    f = classeur.insertSheet(FEUILLE);
    f.appendRow(ENTETE);
    f.setFrozenRows(1);
    f.getRange(1, 1, 1, ENTETE.length).setFontWeight('bold');
  }
  return f;
}

function reponse_(objet) {
  return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON);
}

function lister_(f) {
  const n = f.getLastRow() - 1;
  if (n < 1) return [];
  const lignes = f.getRange(2, 1, n, f.getLastColumn()).getValues();
  const resultats = [];
  for (const l of lignes) {
    const json = l.slice(ENTETE.length - 1).join('');
    if (!json) continue;
    try { resultats.push(JSON.parse(json)); } catch (err) { /* ligne abîmée : ignorée */ }
  }
  return resultats;
}

function doGet() {
  return reponse_({ ok: true, service: 'RECON · Fog of War' });
}

function doPost(e) {
  let corps;
  try { corps = JSON.parse(e.postData.contents); } catch (err) { return reponse_({ ok: false, erreur: 'json' }); }
  const verrou = LockService.getScriptLock();
  verrou.waitLock(20000);
  try {
    const f = feuille_();
    const ids = f.getLastRow() > 1 ? f.getRange(2, 1, f.getLastRow() - 1, 1).getValues().map(function (l) { return String(l[0]); }) : [];

    if (corps.action === 'ajouter') {
      const r = corps.resultat;
      if (!r || typeof r.id !== 'string' || !r.etat || typeof r.stagiaire !== 'string') return reponse_({ ok: false, erreur: 'resultat' });
      if (ids.indexOf(r.id) >= 0) return reponse_({ ok: true, doublon: true });
      const json = JSON.stringify(r);
      const morceaux = [];
      for (let i = 0; i < json.length; i += MORCEAU) morceaux.push(json.slice(i, i + MORCEAU));
      const resume = corps.resume || {};
      // l'apostrophe initiale empêche Sheets d'interpréter un texte comme une formule
      f.appendRow([r.id, new Date(r.date), "'" + r.stagiaire, r.scenario, r.etat.chrono, r.etat.rapport ? 'faite' : 'non faite', resume.couverture, resume.releves].concat(morceaux));
      return reponse_({ ok: true });
    }

    if (corps.action === 'lister') {
      if (corps.code !== CODE_FORMATEUR) return reponse_({ ok: false, erreur: 'code' });
      return reponse_({ ok: true, resultats: lister_(f) });
    }

    if (corps.action === 'supprimer') {
      if (corps.code !== CODE_FORMATEUR) return reponse_({ ok: false, erreur: 'code' });
      const i = ids.indexOf(String(corps.id));
      if (i >= 0) f.deleteRow(i + 2);
      return reponse_({ ok: true });
    }

    return reponse_({ ok: false, erreur: 'action' });
  } finally {
    verrou.releaseLock();
  }
}
