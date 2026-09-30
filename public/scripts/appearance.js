// appearance.js
// -----------------------------------------------------------------------------
// Personnalisation visuelle : couleur d'accentuation, couleur de fond et image
// de fond, en plus du thème clair/sombre (géré dans main.js). Réglage propre à
// ce PC/profil (comme le thème) — pas stocké dans le fichier de données JSON
// partagé, donc non partagé avec le fichier de données.
// -----------------------------------------------------------------------------

import { couleurContraste } from './utils/color.js';

const CLE_ACCENT = 'archipilot-accent-color';
const CLE_BG_COULEUR = 'archipilot-bg-color';
const NOM_BASE = 'archipilot-appearance-db';
const NOM_STORE = 'images';
const CLE_FOND = 'backgroundImage';
const TAILLE_MAX_PX = 1920;
const QUALITE_JPEG = 0.82;

let urlFondCourante = null;

function ouvrirBase() {
  return new Promise((resolve, reject) => {
    const requete = indexedDB.open(NOM_BASE, 1);
    requete.onupgradeneeded = () => {
      const db = requete.result;
      if (!db.objectStoreNames.contains(NOM_STORE)) db.createObjectStore(NOM_STORE);
    };
    requete.onsuccess = () => resolve(requete.result);
    requete.onerror = () => reject(requete.error);
  });
}

async function lireFondStocke() {
  const db = await ouvrirBase();
  const blob = await new Promise((resolve, reject) => {
    const tx = db.transaction(NOM_STORE, 'readonly');
    const requete = tx.objectStore(NOM_STORE).get(CLE_FOND);
    requete.onsuccess = () => resolve(requete.result || null);
    requete.onerror = () => reject(requete.error);
  });
  db.close();
  return blob;
}

async function ecrireFondStocke(blob) {
  const db = await ouvrirBase();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(NOM_STORE, 'readwrite');
    if (blob) tx.objectStore(NOM_STORE).put(blob, CLE_FOND);
    else tx.objectStore(NOM_STORE).delete(CLE_FOND);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

/** Redimensionne/compresse l'image importée pour rester léger en stockage local. */
function redimensionner(fichier) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(fichier);
    image.onload = () => {
      const ratio = Math.min(1, TAILLE_MAX_PX / Math.max(image.width, image.height));
      const largeur = Math.round(image.width * ratio);
      const hauteur = Math.round(image.height * ratio);
      const canvas = document.createElement('canvas');
      canvas.width = largeur;
      canvas.height = hauteur;
      canvas.getContext('2d').drawImage(image, 0, 0, largeur, hauteur);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          if (blob) resolve(blob);
          else reject(new Error('Compression impossible.'));
        },
        'image/jpeg',
        QUALITE_JPEG
      );
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Fichier image invalide.'));
    };
    image.src = url;
  });
}

// --- Couleur d'accentuation ----------------------------------------------------

export function getAccentColor() {
  return localStorage.getItem(CLE_ACCENT);
}

export function applyAccentColor(hex) {
  const racine = document.documentElement.style;
  const proprietes = ['--accent', '--accent-2', '--accent-hover', '--accent-contrast', '--accent-soft', '--accent-ring', '--accent-glow'];

  if (!hex) {
    proprietes.forEach((prop) => racine.removeProperty(prop));
    return;
  }

  // Couleur unique : pas de dégradé, --accent-2 reprend la même teinte que --accent.
  racine.setProperty('--accent', hex);
  racine.setProperty('--accent-2', hex);
  racine.setProperty('--accent-hover', `color-mix(in srgb, ${hex} 88%, white)`);
  racine.setProperty('--accent-contrast', couleurContraste(hex));
  racine.setProperty('--accent-soft', `color-mix(in srgb, ${hex} 16%, var(--bg-elevated))`);
  racine.setProperty('--accent-ring', `color-mix(in srgb, ${hex} 30%, transparent)`);
  racine.setProperty('--accent-glow', `0 8px 24px -8px color-mix(in srgb, ${hex} 55%, transparent)`);
}

export function setAccentColor(hex) {
  localStorage.setItem(CLE_ACCENT, hex);
  applyAccentColor(hex);
}

export function resetAccentColor() {
  localStorage.removeItem(CLE_ACCENT);
  applyAccentColor(null);
}

// --- Couleur de fond ---------------------------------------------------------------
// S'applique au fond de base (--bg) quand aucune image de fond n'est définie ;
// une image de fond reste prioritaire visuellement (voir .has-bg-image, CSS).

export function getBackgroundColor() {
  return localStorage.getItem(CLE_BG_COULEUR);
}

export function applyBackgroundColor(hex) {
  if (!hex) document.documentElement.style.removeProperty('--bg');
  else document.documentElement.style.setProperty('--bg', hex);
}

export function setBackgroundColor(hex) {
  localStorage.setItem(CLE_BG_COULEUR, hex);
  applyBackgroundColor(hex);
}

export function resetBackgroundColor() {
  localStorage.removeItem(CLE_BG_COULEUR);
  applyBackgroundColor(null);
}

// --- Image de fond ---------------------------------------------------------------

function appliquerUrlFond(url) {
  const calque = document.getElementById('app-background');
  if (urlFondCourante) URL.revokeObjectURL(urlFondCourante);
  urlFondCourante = url;
  if (url) {
    calque.style.backgroundImage = `url("${url}")`;
    document.body.classList.add('has-bg-image');
  } else {
    calque.style.backgroundImage = '';
    document.body.classList.remove('has-bg-image');
  }
}

/** URL objet temporaire pour prévisualiser le fond actuel (à révoquer par l'appelant). */
export async function getBackgroundImageURL() {
  const blob = await lireFondStocke();
  return blob ? URL.createObjectURL(blob) : null;
}

export async function setBackgroundImage(fichier) {
  const blob = await redimensionner(fichier);
  await ecrireFondStocke(blob);
  appliquerUrlFond(URL.createObjectURL(blob));
}

export async function clearBackgroundImage() {
  await ecrireFondStocke(null);
  appliquerUrlFond(null);
}

// --- Initialisation --------------------------------------------------------------

/** À appeler une fois au démarrage : applique la couleur et le fond déjà enregistrés. */
export async function init() {
  applyAccentColor(getAccentColor());
  applyBackgroundColor(getBackgroundColor());
  try {
    const blob = await lireFondStocke();
    if (blob) appliquerUrlFond(URL.createObjectURL(blob));
  } catch {
    // Pas de fond personnalisé disponible (IndexedDB indisponible, etc.) : tant pis.
  }
}
