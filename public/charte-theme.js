// charte-theme.js — interrupteur de thème clair/sombre commun (Version 1.3.0).
//
// Même comportement que KELZONE : sans choix enregistré, l'appli suit la préférence du système
// (le CSS s'en charge, sans JS) ; le bouton force un choix manuel, mémorisé dans localStorage
// sous la clé donnée. L'attribut data-theme de <html> est la source de vérité de l'affichage.
//
// Balisage du bouton (à copier tel quel) :
//   <button type="button" id="bouton-theme" class="bouton-theme"
//           aria-label="Changer de thème clair/sombre" aria-pressed="false">
//     <span class="toggle-piste"><span class="toggle-bouton"></span></span>
//   </button>
// Usage :
//   import { initialiserTheme } from './charte-theme.js';
//   initialiserTheme(document.getElementById('bouton-theme'), 'monappli-theme');
// Valeurs stockées : 'dark' ou 'light'.

export function initialiserTheme(bouton, cle) {
  const racine = document.documentElement;
  const systemeSombre = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  function enregistre() {
    try {
      const v = localStorage.getItem(cle);
      if (v === 'dark' || v === 'light') return v;
    } catch (e) { /* stockage indisponible */ }
    return null;
  }

  function actuel() {
    const attribut = racine.getAttribute('data-theme');
    if (attribut === 'dark' || attribut === 'light') return attribut;
    return systemeSombre && systemeSombre.matches ? 'dark' : 'light';
  }

  function actualiser() {
    const sombre = actuel() === 'dark';
    bouton.classList.toggle('actif', sombre);
    bouton.setAttribute('aria-pressed', sombre ? 'true' : 'false');
  }

  const initial = enregistre();
  if (initial) racine.setAttribute('data-theme', initial);
  actualiser();

  bouton.addEventListener('click', () => {
    const nouveau = actuel() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem(cle, nouveau); } catch (e) { /* stockage indisponible */ }
    racine.setAttribute('data-theme', nouveau);
    actualiser();
  });

  if (systemeSombre && systemeSombre.addEventListener) systemeSombre.addEventListener('change', actualiser);
}
