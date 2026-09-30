// labels.js — petits utilitaires de mise en forme de libellés, partagés entre
// les vues qui affichent des tâches (Suivi, modal projet).

export function capitaliser(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Normalise un texte pour une recherche insensible à la casse et aux accents
 * (ex: "Réception" et "reception" doivent correspondre à la même recherche). */
export function normaliserTexte(texte) {
  return texte
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

// Correspondance statut -> classe CSS (évite tout souci d'accents dans les sélecteurs).
const SLUGS_STATUT = {
  'à faire': 'a-faire',
  'en cours': 'en-cours',
  bloqué: 'bloque',
  terminé: 'termine',
};

export function slugStatut(texte) {
  return SLUGS_STATUT[texte] || 'inconnu';
}
