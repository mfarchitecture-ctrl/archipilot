// storage.js
// -----------------------------------------------------------------------------
// Toute la logique d'accès au fichier de données JSON est isolée ici. Elle
// passe par la petite API du serveur local (server.js), qui lit/écrit le
// fichier directement sur disque : pas de permission navigateur à
// (re)valider, contrairement à la File System Access API utilisée
// auparavant — Node a un accès disque direct et permanent.
//
// Convention d'erreur : aucune fonction publique ne laisse fuiter une
// exception JS brute. Chaque fonction async retourne soit la donnée attendue,
// soit lève une StorageError (avec un message déjà en français, prêt à être
// affiché à l'utilisateur) que l'appelant attrape avec try/catch.
// -----------------------------------------------------------------------------

/** Erreur métier de stockage, avec un message déjà destiné à l'affichage. */
export class StorageError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'StorageError';
    this.code = code; // ex: 'PERMISSION_REFUSEE' | 'JSON_INVALIDE' | 'FICHIER_INTROUVABLE' | 'ANNULE' | 'INCONNU'
  }
}

async function requeteJSON(url, options) {
  let reponse;
  try {
    reponse = await fetch(url, options);
  } catch {
    throw new StorageError(
      'Impossible de contacter le serveur local ARCHIPILOT. Relancez ARCHIPILOT.vbs (ou start.bat).',
      'INCONNU'
    );
  }

  let corps = null;
  try {
    corps = await reponse.json();
  } catch {
    // Corps vide ou non-JSON : tant pis, on retombe sur le statut HTTP seul.
  }

  if (!reponse.ok) {
    throw new StorageError(corps?.message || 'Erreur du serveur local.', corps?.code || 'INCONNU');
  }
  return corps;
}

/** Chemin du fichier précédemment configuré (ou null si aucun). */
export async function getConfig() {
  return requeteJSON('/api/config');
}

/** Ouvre le sélecteur de fichier natif pour choisir un fichier archipilot-data.json
 *  existant. Le chemin choisi est mémorisé côté serveur (dans un fichier de
 *  config propre à ce PC) pour les prochains lancements. */
export async function pickDataFile() {
  const resultat = await requeteJSON('/api/pick-file', { method: 'POST' });
  if (!resultat.path) throw new StorageError('Sélection annulée.', 'ANNULE');
  return resultat.path;
}

/** Propose de créer un nouveau fichier archipilot-data.json à l'emplacement de son
 *  choix, et l'initialise avec la structure vide. */
export async function createDataFile() {
  const resultat = await requeteJSON('/api/create-file', { method: 'POST' });
  if (!resultat.path) throw new StorageError('Création annulée.', 'ANNULE');
  return resultat.path;
}

/** Lit et parse le contenu JSON du fichier actuellement configuré. */
export async function readData() {
  return requeteJSON('/api/data');
}

/** Écrit immédiatement l'objet de données sur disque et renvoie la date/heure
 *  de l'écriture (utilisée par l'UI pour afficher "dernière écriture à HH:MM"). */
export async function writeData(donnees) {
  const resultat = await requeteJSON('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(donnees),
  });
  return new Date(resultat.writtenAt);
}

/** Épingle ou désépingle la fenêtre ARCHIPILOT au premier plan (au-dessus des
 *  autres applications). Passe par le serveur car aucune API web ne permet
 *  ça depuis la page elle-même : c'est Windows (SetWindowPos) qui s'en charge. */
export async function setWindowPinned(pinned) {
  return requeteJSON('/api/pin-window', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pinned }),
  });
}
