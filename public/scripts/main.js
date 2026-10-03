// main.js — point d'entrée : orchestre le stockage, l'état et les vues.

import * as storage from './storage.js';
import * as compte from './compte.js';
import { estPreprod, connexionAutomatique } from './preprod-auto.js';
import { VERSION } from './version.js';

import * as state from './state.js';
import * as appearance from './appearance.js';
import { withFocusPreserved } from './utils/dom.js';
import { initialiserTheme } from '../charte-theme.js';
import { renderTaskList } from './ui/taskList.js';
import { renderProjects } from './ui/projects.js';
import { openProjectModal } from './ui/projectModal.js';
import { openAppearanceModal } from './ui/appearanceModal.js';
import { preparerImpression } from './ui/print.js';
import { afficherConnexion } from './ui/loginScreen.js';
import { openAccountModal } from './ui/accountModal.js';
import { icone } from '../charte-icones.js';

// Numéro de version (menu latéral et écran de connexion).
document.querySelectorAll('[data-version]').forEach((el) => {
  el.textContent = `Version ${VERSION}`;
});

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
// Mode « compte » = appli hébergée (worker.js). Le mode fichier (server.js local) sera supprimé
// une fois l'hébergement en service.
let modeCompte = false;
let inscriptionAvecCode = false;

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

  pageTitle.textContent = `${nom} — Suivi des tâches projets`;
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
  if (modeCompte) {
    const heure = dateEcriture ? dateEcriture.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : null;
    syncStatus.textContent = `Connecté : ${compte.identifiant()}` + (heure ? ` — enregistré à ${heure}` : '');
    syncStatus.classList.remove('sync-status--error');
    return;
  }
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
    const dateEcriture = modeCompte ? await compte.enregistrer(donnees) : await storage.writeData(donnees);
    majStatutSynchro(dateEcriture);
  } catch (erreur) {
    if (modeCompte && erreur.statut === 401) {
      afficherConnexionCompte({
        identifiant: compte.identifiant() || '',
        message: 'Votre session a expiré : reconnectez-vous. La dernière modification n’a pas été enregistrée.',
      });
      return;
    }
    const message =
      modeCompte && erreur.statut === 409
        ? 'Données modifiées depuis un autre appareil : rechargez la page (la dernière modification ici n’est pas enregistrée).'
        : erreur.message;
    syncStatus.textContent = `⚠ ${message}`;
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
  if (modeCompte) {
    openAccountModal({
      identifiant: compte.identifiant(),
      onImporter: async (donnees) => {
        await compte.enregistrer(donnees);
        state.setData(donnees);
        majStatutSynchro(new Date());
      },
      onDeconnecter: async () => {
        await compte.seDeconnecter();
        window.location.reload();
      },
    });
    return;
  }
  afficherEcranConnexion('Choisissez un autre fichier de données.');
});

// --- Mode compte (appli hébergée) -------------------------------------------------

function afficherConnexionCompte({ identifiant = '', message = '' } = {}) {
  appRoot.hidden = true;
  afficherConnexion({ identifiant, message, avecCode: inscriptionAvecCode, onConnecte: ouvrirDonneesCompte });
}

async function ouvrirDonneesCompte() {
  let donnees;
  try {
    donnees = await compte.chargerDonnees();
  } catch (erreur) {
    if (erreur.name === 'ErreurDechiffrement') {
      await compte.oublierCleMemorisee();
      afficherConnexionCompte({
        identifiant: compte.identifiant() || '',
        message: 'Impossible de déchiffrer vos données avec cette clé : saisissez à nouveau votre mot de passe.',
      });
      return;
    }
    afficherConnexionCompte({ identifiant: compte.identifiant() || '', message: erreur.message });
    return;
  }
  state.init(persister);
  state.setData(donnees);
  majStatutSynchro();
  afficherApp();
  renderCurrentView();
}

async function demarrerModeCompte(config) {
  modeCompte = true;
  inscriptionAvecCode = Boolean(config.codeInvitation);
  majNomApp(null);
  btnPinWindow.hidden = true;
  btnSelectFileHeader.replaceChildren(icone('utilisateur', { taille: 15, classe: 'btn__icon' }), 'Mon compte');

  let reprise;
  try {
    reprise = await compte.reprendreSession();
  } catch (erreur) {
    afficherConnexionCompte({ message: erreur.message });
    return;
  }
  if (reprise.deverrouille) {
    await ouvrirDonneesCompte();
    return;
  }
  if (estPreprod()) {
    try {
      await connexionAutomatique();
      await ouvrirDonneesCompte();
      return;
    } catch (erreur) {
      afficherConnexionCompte({ message: erreur.message });
      return;
    }
  }
  afficherConnexionCompte({
    identifiant: reprise.identifiant || '',
    message: reprise.identifiant ? 'Saisissez votre mot de passe pour déverrouiller vos données.' : '',
  });
}

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

initialiserTheme([btnThemeToggle, document.getElementById('login-theme-toggle')], CLE_THEME);

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

  if (config.mode === 'compte') {
    await demarrerModeCompte(config);
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
