// main.js — point d'entrée : orchestre le stockage, l'état et les vues.

import * as storage from './storage.js';
import * as state from './state.js';
import * as appearance from './appearance.js';
import { withFocusPreserved } from './utils/dom.js';
import { initialiserTheme } from '../charte-theme.js';
import { renderTaskList } from './ui/taskList.js';
import { renderProjects } from './ui/projects.js';
import { openProjectModal } from './ui/projectModal.js';
import { openAppearanceModal } from './ui/appearanceModal.js';
import { preparerImpression } from './ui/print.js';

const appRoot = document.getElementById('app');
const connectScreen = document.getElementById('connect-screen');
const connectMessage = document.getElementById('connect-message');
const btnPickFile = document.getElementById('btn-pick-file');
const btnCreateFile = document.getElementById('btn-create-file');
const btnSelectFileHeader = document.getElementById('btn-select-file');
const syncStatus = document.getElementById('sync-status');
const viewTitle = document.getElementById('view-title');
const viewContainer = document.getElementById('view-container');
const nav = document.getElementById('nav');
const btnPrint = document.getElementById('btn-print');
const btnPinWindow = document.getElementById('btn-pin-window');
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const btnAppearance = document.getElementById('btn-appearance');
const btnSidebarToggle = document.getElementById('btn-sidebar-toggle');
const brandWord = document.getElementById('brand-word');
const brandMark = document.getElementById('brand-mark');
const connectBrandWord = document.getElementById('connect-brand-word');
const connectBrandMark = document.getElementById('connect-brand-mark');
const pageTitle = document.getElementById('page-title');

const TITRES_VUES = { tasks: "Vue d'ensemble des tâches", projects: 'Projets' };

let cheminFichierActuel = null;
let nomAppActuel = 'ARCHIPILOT';

/** Nom de fichier (sans dossier) à partir d'un chemin Windows ou POSIX. */
function nomDepuisChemin(chemin) {
  return chemin.split(/[\\/]/).pop();
}

/** Affiche le nom du fichier connecté (sans l'extension .json) comme nom de l'app,
 *  partout où "ARCHIPILOT"/"A" apparaissait auparavant : sidebar, écran de connexion,
 *  titre de l'onglet et en-tête d'impression. */
function majNomApp(nomFichier) {
  const nomBrut = nomFichier ? nomFichier.replace(/\.json$/i, '') : '';
  const nom = !nomBrut || nomBrut.toLowerCase() === 'archipilot-data' ? 'ARCHIPILOT' : nomBrut;
  const lettre = nom.charAt(0).toUpperCase();
  nomAppActuel = nom;

  brandWord.textContent = nom;
  brandWord.title = nom;
  brandMark.textContent = lettre;

  connectBrandWord.textContent = nom;
  connectBrandMark.textContent = lettre;

  pageTitle.textContent = `${nom} — Suivi de chantiers`;
}

// --- Écran de connexion au fichier de données ---------------------------------

function afficherEcranConnexion(message) {
  appRoot.hidden = true;
  connectScreen.hidden = false;
  connectMessage.textContent = message;
}

function afficherApp() {
  connectScreen.hidden = true;
  appRoot.hidden = false;
}

function majStatutSynchro(dateEcriture = null) {
  if (!cheminFichierActuel) {
    syncStatus.textContent = 'Aucun fichier connecté.';
    return;
  }
  const nomFichier = nomDepuisChemin(cheminFichierActuel);
  if (dateEcriture) {
    const heure = dateEcriture.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    syncStatus.textContent = `Fichier connecté : ${nomFichier} — dernière écriture à ${heure}`;
  } else {
    syncStatus.textContent = `Fichier connecté : ${nomFichier}`;
  }
  syncStatus.classList.remove('sync-status--error');
}

/** Fonction de persistance passée à state.js : écrit sur disque après chaque mutation. */
async function persister(donnees) {
  try {
    const dateEcriture = await storage.writeData(donnees);
    majStatutSynchro(dateEcriture);
  } catch (erreur) {
    syncStatus.textContent = `⚠ ${erreur.message}`;
    syncStatus.classList.add('sync-status--error');
  }
}

// --- Navigation entre vues -----------------------------------------------------

function renderCurrentView() {
  const vue = state.getView();
  viewTitle.textContent = TITRES_VUES[vue] || '';
  viewContainer.innerHTML = '';

  Array.from(nav.children).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === vue);
  });

  if (vue === 'tasks') {
    renderTaskList(viewContainer);
  } else if (vue === 'projects') {
    renderProjects(viewContainer, { onOpenProject: openProjectModal });
  }
}

state.subscribe(() => {
  withFocusPreserved(viewContainer, renderCurrentView);
});

nav.addEventListener('click', (e) => {
  const btn = e.target.closest('.nav-item');
  if (!btn) return;
  state.setView(btn.dataset.view);
});

btnPrint.addEventListener('click', () => preparerImpression(nomAppActuel));

// --- Épingler la fenêtre au premier plan (état local à la session, non persisté) --

let fenetreEpinglee = false;

function appliquerEtatEpinglage() {
  btnPinWindow.classList.toggle('btn-pin--active', fenetreEpinglee);
  btnPinWindow.setAttribute('aria-pressed', String(fenetreEpinglee));
  btnPinWindow.title = fenetreEpinglee
    ? 'Fenêtre épinglée au premier plan (cliquer pour désépingler)'
    : 'Épingler la fenêtre au premier plan';
}

btnPinWindow.addEventListener('click', async () => {
  const nouvelEtat = !fenetreEpinglee;
  try {
    await storage.setWindowPinned(nouvelEtat);
    fenetreEpinglee = nouvelEtat;
    appliquerEtatEpinglage();
  } catch (erreur) {
    alert(erreur.message);
  }
});

// --- Connexion / (re)sélection du fichier de données ---------------------------

async function connecter(cheminFichier) {
  cheminFichierActuel = cheminFichier;
  state.init(persister);
  try {
    const donnees = await storage.readData();
    state.setData(donnees);
    majStatutSynchro();
    majNomApp(nomDepuisChemin(cheminFichier));
    afficherApp();
    renderCurrentView();
  } catch (erreur) {
    afficherEcranConnexion(erreur.message);
  }
}

async function choisirFichier() {
  try {
    const chemin = await storage.pickDataFile();
    await connecter(chemin);
  } catch (erreur) {
    if (erreur.code !== 'ANNULE') afficherEcranConnexion(erreur.message);
  }
}

async function creerFichier() {
  try {
    const chemin = await storage.createDataFile();
    await connecter(chemin);
  } catch (erreur) {
    if (erreur.code !== 'ANNULE') afficherEcranConnexion(erreur.message);
  }
}

btnPickFile.addEventListener('click', choisirFichier);
btnCreateFile.addEventListener('click', creerFichier);

btnSelectFileHeader.addEventListener('click', () => {
  afficherEcranConnexion('Choisissez un autre fichier de données.');
});

// --- Thème clair / sombre (préférence d'affichage, indépendante des données) -----

const CLE_THEME = 'archipilot-theme';

// Anciennes valeurs ('clair' / 'sombre') -> valeurs de la charte ('light' / 'dark').
try {
  const ancien = localStorage.getItem(CLE_THEME);
  if (ancien === 'sombre') localStorage.setItem(CLE_THEME, 'dark');
  else if (ancien === 'clair') localStorage.setItem(CLE_THEME, 'light');
} catch {
  // stockage indisponible : le thème suivra simplement le système
}

initialiserTheme(btnThemeToggle, CLE_THEME);

btnAppearance.addEventListener('click', openAppearanceModal);
appearance.init();

// --- Menu latéral repliable (préférence d'affichage, indépendante des données) ----

const CLE_SIDEBAR_REPLIE = 'archipilot-sidebar-collapsed';

function appliquerSidebarRepliee(replie) {
  appRoot.classList.toggle('sidebar-collapsed', replie);
  btnSidebarToggle.setAttribute('aria-label', replie ? 'Étendre le menu' : 'Réduire le menu');
  btnSidebarToggle.setAttribute('title', replie ? 'Étendre le menu' : 'Réduire le menu');
}

appliquerSidebarRepliee(localStorage.getItem(CLE_SIDEBAR_REPLIE) === '1');

btnSidebarToggle.addEventListener('click', () => {
  const replie = !appRoot.classList.contains('sidebar-collapsed');
  appliquerSidebarRepliee(replie);
  localStorage.setItem(CLE_SIDEBAR_REPLIE, replie ? '1' : '0');
});

// --- Démarrage -------------------------------------------------------------------

async function initialiser() {
  let config;
  try {
    config = await storage.getConfig();
  } catch (erreur) {
    afficherEcranConnexion(erreur.message);
    return;
  }

  if (!config.dataFilePath) {
    afficherEcranConnexion(
      'Bienvenue ! Choisissez votre fichier de référence (archipilot-data.json), ou créez-en un nouveau.'
    );
    return;
  }

  await connecter(config.dataFilePath);
}

initialiser();
