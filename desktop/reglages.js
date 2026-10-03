// reglages.js — page de réglages locale : capture des raccourcis (format « accélérateur » d'Electron).
const $ = (id) => document.getElementById(id);
const retour = $('retour');

const TOUCHES_SPECIALES = {
  ' ': 'Space', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Enter: 'Return', Escape: 'Esc', Tab: 'Tab', Insert: 'Insert', Delete: 'Delete',
  '+': 'Plus', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
};

function accelerateurDepuis(e) {
  const touche = TOUCHES_SPECIALES[e.key] || (e.key.length === 1 ? e.key.toUpperCase() : /^F\d{1,2}$/.test(e.key) ? e.key : null);
  if (!touche) return null; // touche de modification seule : on attend la suite
  const modificateurs = [];
  if (e.ctrlKey) modificateurs.push('Control');
  if (e.altKey) modificateurs.push('Alt');
  if (e.shiftKey) modificateurs.push('Shift');
  if (e.metaKey) modificateurs.push('Super');
  const estFonction = /^F\d{1,2}$/.test(touche);
  if (!modificateurs.length && !estFonction) return null; // une lettre seule bloquerait la frappe partout
  return [...modificateurs, touche].join('+');
}

for (const id of ['afficher', 'saisie']) {
  const champ = $(id);
  champ.addEventListener('keydown', (e) => {
    e.preventDefault();
    if (e.key === 'Backspace') {
      champ.value = '';
      return;
    }
    const acc = accelerateurDepuis(e);
    if (acc) champ.value = acc;
  });
}

async function charger() {
  const r = await window.archipilotBureau.lireReglages();
  if (!r) return;
  $('afficher').value = r.raccourciAfficher;
  $('saisie').value = r.raccourciSaisie;
  $('url').value = r.url;
  $('demarrage').checked = r.lancerAuDemarrage;
}

$('enregistrer').addEventListener('click', async () => {
  const resultat = await window.archipilotBureau.enregistrerReglages({
    raccourciAfficher: $('afficher').value,
    raccourciSaisie: $('saisie').value,
    url: $('url').value,
    lancerAuDemarrage: $('demarrage').checked,
  });
  retour.className = resultat.ok ? 'ok' : 'erreur';
  retour.textContent = resultat.ok ? 'Enregistré.' : resultat.erreurs.join('\n');
});

charger();
