// charte-icones.js — pictogrammes communs des applications (Version 1.3.0).
//
// Style KELZONE : icônes « au trait », viewBox 24x24, trait de 2, bouts et jointures arrondis,
// couleur = currentColor (elles prennent la couleur du texte, donc celle de l'interface).
// Les tracés viennent de KELZONE (imprimer, fermer, partager, favori, lire, pause, fichier) et de
// Lucide (https://lucide.dev, licence ISC) pour les autres.
//
// Usage (application à modules) :
//   import { icone, iconeHTML } from './charte-icones.js';
//   bouton.append(icone('crayon'));                      // élément SVG
//   element.innerHTML = iconeHTML('poubelle', { taille: 16 });  // chaîne HTML
// Application sans modules : recopier le tracé voulu depuis ICONES dans un <svg> portant les
// mêmes attributs que iconeHTML().
//
// Ajouter une icône : uniquement ici, dans le dépôt « charte », avec le même style (trait de 2).

export const ICONES = {
  crayon: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  poubelle: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  imprimer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  fermer: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  valider: '<path d="M20 6 9 17l-5-5"/>',
  epingler: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  recherche: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  calendrier: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  dossier: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  fichier: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  liste: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  lune: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  'chevron-gauche': '<path d="m15 18-6-6 6-6"/>',
  'chevron-droite': '<path d="m9 18 6-6-6-6"/>',
  'chevron-bas': '<path d="m6 9 6 6 6-6"/>',
  'chevron-haut': '<path d="m18 15-6-6-6 6"/>',
  'fleche-haut': '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  'fleche-bas': '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  partager: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
  favori: '<polygon points="12 2 15.1 8.3 22 9.3 17 14.1 18.2 21 12 17.8 5.8 21 7 14.1 2 9.3 8.9 8.3 12 2"/>',
  lire: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
  pause: '<line x1="9" y1="5" x2="9" y2="19"/><line x1="15" y1="5" x2="15" y2="19"/>',
};

/** Chaîne HTML d'un <svg> prêt à l'emploi. `taille` en px ; `classe` ajoutée à « icone ». */
export function iconeHTML(nom, { taille = 18, classe = '' } = {}) {
  const trace = ICONES[nom];
  if (!trace) throw new Error('Icône inconnue : ' + nom);
  const classes = classe ? 'icone ' + classe : 'icone';
  return '<svg class="' + classes + '" viewBox="0 0 24 24" width="' + taille + '" height="' + taille +
    '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    trace + '</svg>';
}

/** Élément SVG (nœud DOM) d'une icône. */
export function icone(nom, options) {
  const modele = document.createElement('template');
  modele.innerHTML = iconeHTML(nom, options);
  return modele.content.firstElementChild;
}
