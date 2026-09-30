// crypto-donnees.js — chiffrement de bout en bout des données (WebCrypto, aucune dépendance).
//
// Principe : les données de l'utilisateur sont chiffrées DANS le navigateur ; le serveur ne voit
// jamais que du texte chiffré. À partir du mot de passe on dérive DEUX valeurs indépendantes :
//   - une clé de chiffrement (AES-GCM, non exportable) qui ne quitte jamais le navigateur ;
//   - un jeton d'accès, envoyé au serveur pour prouver qu'on connaît le mot de passe (le serveur
//     n'en garde qu'un hachage). Le jeton ne permet pas de retrouver la clé de chiffrement.
// Mot de passe perdu = données irrécupérables (prévoir l'export de sauvegarde).
//
// Dérivation : PBKDF2-SHA256 (600 000 itérations, recommandation OWASP 2023), sel dérivé de
// l'identifiant, puis HKDF pour séparer les deux usages. Enveloppe chiffrée versionnée (v: 1)
// pour pouvoir changer d'algorithme plus tard sans perdre les anciennes données.

const ITERATIONS = 600000;
const VERSION_ENVELOPPE = 1;
const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

export class ErreurDechiffrement extends Error {
  constructor() {
    super('Mot de passe incorrect, ou données altérées.');
    this.name = 'ErreurDechiffrement';
  }
}

function enBase64(octets) {
  let texte = '';
  for (const o of new Uint8Array(octets)) texte += String.fromCharCode(o);
  return btoa(texte);
}

function enBase64Url(octets) {
  return enBase64(octets).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function depuisBase64(texte) {
  const brut = atob(texte);
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i);
  return octets;
}

async function selDepuisIdentifiant(identifiant) {
  const normalise = identifiant.trim().toLowerCase();
  return crypto.subtle.digest('SHA-256', encodeur.encode('archipilot:v1:' + normalise));
}

/**
 * Dérive, à partir du mot de passe et de l'identifiant :
 *  - cleChiffrement : CryptoKey AES-GCM 256 bits (non exportable) ;
 *  - jetonAcces : chaîne base64url à envoyer au serveur pour s'authentifier.
 */
export async function deriverCles(motDePasse, identifiant) {
  if (!motDePasse || !identifiant || !identifiant.trim()) {
    throw new Error('Identifiant et mot de passe requis.');
  }
  const matiere = await crypto.subtle.importKey('raw', encodeur.encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
  const maitre = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: await selDepuisIdentifiant(identifiant), iterations: ITERATIONS },
    matiere,
    256
  );
  const hkdf = await crypto.subtle.importKey('raw', maitre, 'HKDF', false, ['deriveKey', 'deriveBits']);
  const sel = new Uint8Array(0);

  const cleChiffrement = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: sel, info: encodeur.encode('archipilot-chiffrement-v1') },
    hkdf,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  const octetsJeton = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: sel, info: encodeur.encode('archipilot-acces-v1') },
    hkdf,
    256
  );
  return { cleChiffrement, jetonAcces: enBase64Url(octetsJeton) };
}

/** Chiffre un objet JSON ; renvoie une enveloppe sérialisable { v, iv, donnees }. */
export async function chiffrer(cleChiffrement, objet) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const chiffre = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cleChiffrement,
    encodeur.encode(JSON.stringify(objet))
  );
  return { v: VERSION_ENVELOPPE, iv: enBase64(iv), donnees: enBase64(chiffre) };
}

/** Déchiffre une enveloppe ; lève ErreurDechiffrement si la clé est mauvaise ou les données altérées. */
export async function dechiffrer(cleChiffrement, enveloppe) {
  if (!enveloppe || enveloppe.v !== VERSION_ENVELOPPE) {
    throw new Error("Format de données chiffrées inconnu (version " + (enveloppe && enveloppe.v) + ').');
  }
  try {
    const clair = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: depuisBase64(enveloppe.iv) },
      cleChiffrement,
      depuisBase64(enveloppe.donnees)
    );
    return JSON.parse(decodeur.decode(clair));
  } catch {
    throw new ErreurDechiffrement();
  }
}
