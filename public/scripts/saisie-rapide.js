// saisie-rapide.js — ajout express d'une tâche (projet avec autocomplétion + titre + priorité + échéance).
// Page autonome : ouverte par l'appli Windows (raccourci global) ou directement dans un navigateur.
// Elle réutilise compte.js : même session, même clé de chiffrement mémorisée, mêmes données.

import * as compte from './compte.js';
import { estPreprod, connexionAutomatique } from './preprod-auto.js';
import { normaliserTexte } from './utils/labels.js';

const $ = (id) => document.getElementById(id);
const bureau = window.archipilotBureau || null; // exposé par l'appli Windows (preload), absent dans un navigateur

try {
  const theme = localStorage.getItem('archipilot-theme');
  if (theme === 'dark' || theme === 'light') document.documentElement.setAttribute('data-theme', theme);
} catch {
  // thème du système
}

const formulaire = $('sr-form');
const message = $('sr-message');
const champProjet = $('sr-projet');
const champTitre = $('sr-titre');
const champPriorite = $('sr-priorite');
const champEcheance = $('sr-echeance');
const liste = $('sr-liste');
const erreur = $('sr-erreur');

let donnees = { projects: [], tasks: [] };
let projetChoisi = null; // projet retenu dans l'autocomplétion
let suggestions = [];
let indexActif = -1;
let envoiEnCours = false;

function fermer() {
  if (bureau) bureau.fermerSaisie();
  else window.close();
}

function montrerMessage(texte) {
  message.textContent = texte;
  message.hidden = !texte;
  formulaire.hidden = Boolean(texte);
}

function montrerErreur(texte) {
  erreur.textContent = texte;
  erreur.hidden = !texte;
}

// --- Autocomplétion du projet ---------------------------------------------------------

function fermerListe() {
  liste.hidden = true;
  champProjet.setAttribute('aria-expanded', 'false');
}

function choisirProjet(projet) {
  projetChoisi = projet;
  champProjet.value = projet.name;
  fermerListe();
  champTitre.focus();
}

function afficherSuggestions() {
  const saisie = normaliserTexte(champProjet.value.trim());
  suggestions = donnees.projects
    .filter((p) => !saisie || normaliserTexte(p.name).includes(saisie))
    .sort((a, b) => {
      const debutA = normaliserTexte(a.name).startsWith(saisie) ? 0 : 1;
      const debutB = normaliserTexte(b.name).startsWith(saisie) ? 0 : 1;
      return debutA - debutB || a.name.localeCompare(b.name, 'fr');
    })
    .slice(0, 8);
  indexActif = suggestions.length ? 0 : -1;
  liste.replaceChildren(
    ...suggestions.map((p, i) => {
      const li = document.createElement('li');
      li.textContent = p.name;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(i === indexActif));
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        choisirProjet(p);
      });
      return li;
    }),
  );
  liste.hidden = !suggestions.length;
  champProjet.setAttribute('aria-expanded', String(suggestions.length > 0));
}

function deplacerSelection(delta) {
  if (!suggestions.length) return;
  indexActif = (indexActif + delta + suggestions.length) % suggestions.length;
  [...liste.children].forEach((li, i) => li.setAttribute('aria-selected', String(i === indexActif)));
  liste.children[indexActif].scrollIntoView({ block: 'nearest' });
}

champProjet.addEventListener('input', () => {
  projetChoisi = null;
  afficherSuggestions();
});
champProjet.addEventListener('focus', afficherSuggestions);
champProjet.addEventListener('blur', () => {
  // Si le texte correspond exactement à un projet, on le retient sans exiger de clic.
  const exact = donnees.projects.find((p) => normaliserTexte(p.name) === normaliserTexte(champProjet.value.trim()));
  if (exact) projetChoisi = exact;
  fermerListe();
});
champProjet.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (liste.hidden) afficherSuggestions();
    else deplacerSelection(1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    deplacerSelection(-1);
  } else if ((e.key === 'Enter' || e.key === 'Tab') && !liste.hidden && suggestions[indexActif]) {
    e.preventDefault();
    choisirProjet(suggestions[indexActif]);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    champTitre.focus();
  }
});

// --- Enregistrement -------------------------------------------------------------------

async function ajouterTache(tache) {
  // Si un autre appareil a enregistré entre-temps (409), on recharge les données et on réessaie.
  for (let essai = 0; essai < 3; essai++) {
    donnees.tasks.push(tache);
    try {
      await compte.enregistrer({ projects: donnees.projects, tasks: donnees.tasks });
      return;
    } catch (e) {
      donnees.tasks = donnees.tasks.filter((t) => t.id !== tache.id);
      if (e.statut !== 409 || essai === 2) throw e;
      donnees = await compte.chargerDonnees();
    }
  }
}

formulaire.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (envoiEnCours) return;
  const titre = champTitre.value.trim();
  if (!projetChoisi) {
    const exact = donnees.projects.find((p) => normaliserTexte(p.name) === normaliserTexte(champProjet.value.trim()));
    if (exact) projetChoisi = exact;
  }
  if (!projetChoisi) {
    montrerErreur('Choisissez un projet existant dans la liste.');
    champProjet.focus();
    return;
  }
  if (!titre) {
    montrerErreur('Saisissez la tâche.');
    champTitre.focus();
    return;
  }
  montrerErreur('');
  envoiEnCours = true;
  try {
    await ajouterTache({
      id: crypto.randomUUID(),
      title: titre,
      projectId: projetChoisi.id,
      priority: champPriorite.value,
      status: 'à faire',
      dueDate: champEcheance.value || null,
      notes: '',
    });
  } catch (err) {
    envoiEnCours = false;
    montrerErreur(err.statut === 401 ? 'Session expirée : ouvrez ARCHIPILOT et reconnectez-vous.' : err.message);
    return;
  }
  envoiEnCours = false;
  if (bureau) {
    bureau.tacheAjoutee();
    fermer();
  } else {
    montrerMessage(`Tâche ajoutée à « ${projetChoisi.name} ». Vous pouvez fermer cette page.`);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!liste.hidden) fermerListe();
    else fermer();
  }
});

// --- Démarrage (appelé aussi à chaque ré-affichage de la fenêtre par l'appli Windows) ------

async function preparer() {
  montrerMessage('Chargement…');
  try {
    let reprise = await compte.reprendreSession();
    if (!reprise.deverrouille && estPreprod()) {
      await connexionAutomatique();
      reprise = { deverrouille: true };
    }
    if (!reprise.deverrouille) {
      montrerMessage('Ouvrez ARCHIPILOT et connectez-vous (case « Rester connecté » cochée), puis réessayez.');
      return;
    }
    donnees = await compte.chargerDonnees();
  } catch (err) {
    montrerMessage(err.message);
    return;
  }
  montrerMessage('');
  projetChoisi = null;
  formulaire.reset();
  montrerErreur('');
  champPriorite.value = 'moyenne';
  champProjet.focus();
}

if (bureau) bureau.surAffichage(preparer);
preparer();
