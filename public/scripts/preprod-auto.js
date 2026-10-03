// preprod-auto.js — connexion automatique, UNIQUEMENT sur la préprod (adresse « preprod-… »).
//
// Pourquoi : on travaille sur la préprod avec une base D1 de test séparée de la production ; devoir
// ressaisir le mot de passe à chaque F5 fait perdre du temps. Ce compte de test ne protège que des
// données d'essai. Sur la production (autre adresse), rien de tout ça n'est actif.

import * as compte from './compte.js';

const IDENTIFIANT_TEST = 'preprod';
const MOT_DE_PASSE_TEST = 'preprod-archipilot-essais-2026';

export function estPreprod() {
  return location.hostname.startsWith('preprod-');
}

/** Se connecte au compte de test (le crée au tout premier passage). */
export async function connexionAutomatique(code) {
  try {
    await compte.seConnecter(IDENTIFIANT_TEST, MOT_DE_PASSE_TEST, true);
  } catch (e) {
    if (e.statut !== 401) throw e;
    await compte.creerCompte(IDENTIFIANT_TEST, MOT_DE_PASSE_TEST, code || '', true);
  }
}
