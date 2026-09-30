// color.js — petits utilitaires de manipulation de couleur pour la couleur
// d'accentuation personnalisable (pas de dépendance externe).

function hexToRgb(hex) {
  const nettoye = hex.replace('#', '');
  const complet = nettoye.length === 3 ? nettoye.split('').map((c) => c + c).join('') : nettoye;
  const entier = parseInt(complet, 16);
  return { r: (entier >> 16) & 255, g: (entier >> 8) & 255, b: entier & 255 };
}

/** Blanc ou noir (déjà utilisés ailleurs dans la palette) selon la luminance
 * relative de `hex`, pour garder un texte lisible dessus. */
export function couleurContraste(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#16161d' : '#ffffff';
}
