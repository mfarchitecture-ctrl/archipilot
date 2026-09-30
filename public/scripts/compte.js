// compte.js — mode « compte » (appli hébergée) : connexion, clé de chiffrement, données chiffrées.
//
// Le serveur (worker.js) ne reçoit que le jeton d'accès et des enveloppes chiffrées. La clé de
// chiffrement reste dans le navigateur : en mémoire, et dans IndexedDB si l'utilisateur a coché
// « Rester connecté sur cet appareil » (la clé y est stockée non exportable : le navigateur peut
// s'en servir mais personne ne peut la lire en clair).

import { deriverCles, chiffrer, dechiffrer } from './utils/crypto-donnees.js';

export class ErreurCompte extends Error {
  constructor(message, statut) {
    super(message);
    this.name = 'ErreurCompte';
    this.statut = statut;
  }
}

let identifiantActif = null;
let cleActive = null;
let versionServeur = 0;

async function api(methode, chemin, corps) {
  let reponse;
  try {
    reponse = await fetch(chemin, {
      method: methode,
      headers: corps ? { 'Content-Type': 'application/json' } : {},
      body: corps ? JSON.stringify(corps) : undefined,
      credentials: 'same-origin',
    });
  } catch {
    throw new ErreurCompte('Impossible de joindre le serveur. Vérifiez votre connexion Internet.', 0);
  }
  let json = null;
  try {
    json = await reponse.json();
  } catch {
    // réponse sans corps JSON
  }
  if (!reponse.ok) throw new ErreurCompte(json?.erreur || `Erreur du serveur (${reponse.status}).`, reponse.status);
  return json;
}

// --- Clé mémorisée sur cet appareil (IndexedDB) ------------------------------------------

const NOM_BASE = 'archipilot-cles';
const NOM_STORE = 'cles';
const CLE_ENTREE = 'session';

function ouvrirBase() {
  return new Promise((resolve, reject) => {
    const requete = indexedDB.open(NOM_BASE, 1);
    requete.onupgradeneeded = () => requete.result.createObjectStore(NOM_STORE);
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error);
  });
}

async function operationStore(mode, action) {
  const base = await ouvrirBase();
  try {
    return await new Promise((resolve, reject) => {
      const tx = base.transaction(NOM_STORE, mode);
      const requete = action(tx.objectStore(NOM_STORE));
      tx.oncomplete = () => resolve(requete.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    base.close();
  }
}

const memoriserCle = (identifiant, cle) => operationStore('readwrite', (s) => s.put({ identifiant, cle }, CLE_ENTREE));
const lireCleMemorisee = () => operationStore('readonly', (s) => s.get(CLE_ENTREE));
const oublierCle = () => operationStore('readwrite', (s) => s.delete(CLE_ENTREE)).catch(() => {});

// --- Session -----------------------------------------------------------------------------

export function identifiant() {
  return identifiantActif;
}

/**
 * Au démarrage : y a-t-il une session serveur, et la clé de chiffrement est-elle mémorisée ?
 * Renvoie { identifiant: string|null, deverrouille: boolean }.
 */
export async function reprendreSession() {
  let session;
  try {
    session = await api('GET', '/api/session');
  } catch (e) {
    if (e.statut === 401) {
      await oublierCle();
      return { identifiant: null, deverrouille: false };
    }
    throw e;
  }
  const memo = await lireCleMemorisee().catch(() => null);
  if (memo && memo.identifiant === session.identifiant && memo.cle) {
    identifiantActif = session.identifiant;
    cleActive = memo.cle;
    return { identifiant: session.identifiant, deverrouille: true };
  }
  return { identifiant: session.identifiant, deverrouille: false };
}

async function activer(identifiant, cle, resterConnecte) {
  identifiantActif = identifiant;
  cleActive = cle;
  if (resterConnecte) await memoriserCle(identifiant, cle).catch(() => {});
  else await oublierCle();
}

export async function seConnecter(identifiantSaisi, motDePasse, resterConnecte) {
  const { cleChiffrement, jetonAcces } = await deriverCles(motDePasse, identifiantSaisi);
  const reponse = await api('POST', '/api/connexion', { identifiant: identifiantSaisi, jeton: jetonAcces });
  await activer(reponse.identifiant, cleChiffrement, resterConnecte);
}

export async function creerCompte(identifiantSaisi, motDePasse, code, resterConnecte) {
  const { cleChiffrement, jetonAcces } = await deriverCles(motDePasse, identifiantSaisi);
  const reponse = await api('POST', '/api/inscription', { identifiant: identifiantSaisi, jeton: jetonAcces, code });
  await activer(reponse.identifiant, cleChiffrement, resterConnecte);
}

export async function seDeconnecter() {
  try {
    await api('POST', '/api/deconnexion', {});
  } catch {
    // même hors ligne, on oublie la clé localement
  }
  await oublierCle();
  identifiantActif = null;
  cleActive = null;
}

/** Oublie la clé mémorisée (ex. si elle ne déchiffre plus les données). */
export async function oublierCleMemorisee() {
  cleActive = null;
  await oublierCle();
}

// --- Données -----------------------------------------------------------------------------

/** Charge et déchiffre les données du compte (structure vide si aucune encore). */
export async function chargerDonnees() {
  const reponse = await api('GET', '/api/donnees');
  versionServeur = reponse.version;
  if (!reponse.enveloppe) return { projects: [], tasks: [] };
  return dechiffrer(cleActive, reponse.enveloppe);
}

// File d'enregistrement : une seule écriture à la fois, et si plusieurs modifications arrivent
// pendant un envoi, seule la plus récente est envoyée ensuite (les données sont complètes à
// chaque fois). Évite que deux envois simultanés se refusent mutuellement (conflit de version).
let envoiEnCours = null;
let donneesEnAttente = null;

async function viderFile() {
  try {
    while (donneesEnAttente) {
      const donnees = donneesEnAttente;
      donneesEnAttente = null;
      const enveloppe = await chiffrer(cleActive, donnees);
      const reponse = await api('PUT', '/api/donnees', { enveloppe, versionAttendue: versionServeur });
      versionServeur = reponse.version;
    }
    return new Date();
  } finally {
    envoiEnCours = null;
  }
}

/** Chiffre et envoie les données ; renvoie la date d'enregistrement. */
export function enregistrer(donnees) {
  donneesEnAttente = donnees;
  if (!envoiEnCours) envoiEnCours = viderFile();
  return envoiEnCours;
}
