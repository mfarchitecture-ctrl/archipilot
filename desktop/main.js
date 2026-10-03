// main.js — ARCHIPILOT pour Windows (Electron).
// Ne stocke aucune donnée métier : la fenêtre affiche la version EN LIGNE (mêmes comptes, mêmes
// données chiffrées que dans le navigateur). L'appli apporte seulement :
//   - un raccourci global pour ramener la fenêtre au premier plan,
//   - un raccourci global pour la saisie rapide d'une tâche (petite fenêtre flottante),
//   - une icône dans la zone de notification (l'appli reste active quand on ferme la fenêtre).

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

const REGLAGES_PAR_DEFAUT = {
  url: 'https://preprod-archipilot.mf-archi.workers.dev', // à remplacer par l'adresse de production le moment venu
  raccourciAfficher: 'Control+Alt+A',
  raccourciSaisie: 'Control+Alt+Space',
  lancerAuDemarrage: false,
};

let reglages = { ...REGLAGES_PAR_DEFAUT };
let fenetrePrincipale = null;
let fenetreSaisie = null;
let fenetreReglages = null;
let tray = null;
let quitter = false;

const fichierReglages = () => path.join(app.getPath('userData'), 'reglages.json');

function lireReglages() {
  try {
    reglages = { ...REGLAGES_PAR_DEFAUT, ...JSON.parse(fs.readFileSync(fichierReglages(), 'utf8')) };
  } catch {
    reglages = { ...REGLAGES_PAR_DEFAUT };
  }
}

function ecrireReglages() {
  fs.mkdirSync(path.dirname(fichierReglages()), { recursive: true });
  fs.writeFileSync(fichierReglages(), JSON.stringify(reglages, null, 2));
}

const origine = () => new URL(reglages.url).origin;
const cheminIcone = () => path.join(__dirname, 'AP.ico');

// --- Fenêtres ----------------------------------------------------------------------------

function ouvrirFenetrePrincipale() {
  if (fenetrePrincipale && !fenetrePrincipale.isDestroyed()) {
    if (fenetrePrincipale.isMinimized()) fenetrePrincipale.restore();
    fenetrePrincipale.show();
    fenetrePrincipale.focus();
    return;
  }
  fenetrePrincipale = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'ARCHIPILOT',
    icon: cheminIcone(),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') },
  });
  fenetrePrincipale.loadURL(reglages.url);
  // Liens externes : dans le vrai navigateur, jamais dans l'appli.
  fenetrePrincipale.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  fenetrePrincipale.webContents.on('will-navigate', (e, url) => {
    if (new URL(url).origin !== origine()) {
      e.preventDefault();
      if (url.startsWith('https://')) shell.openExternal(url);
    }
  });
  // Fermer la fenêtre = la cacher : l'appli reste active pour que les raccourcis continuent de marcher.
  fenetrePrincipale.on('close', (e) => {
    if (!quitter) {
      e.preventDefault();
      fenetrePrincipale.hide();
    }
  });
}

function creerFenetreSaisie() {
  fenetreSaisie = new BrowserWindow({
    width: 480,
    height: 320,
    show: false,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    title: 'ARCHIPILOT — Saisie rapide',
    icon: cheminIcone(),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') },
  });
  fenetreSaisie.loadURL(reglages.url.replace(/\/+$/, '') + '/saisie-rapide.html');
  fenetreSaisie.on('closed', () => {
    fenetreSaisie = null;
  });
}

function basculerSaisie() {
  if (!fenetreSaisie || fenetreSaisie.isDestroyed()) creerFenetreSaisie();
  if (fenetreSaisie.isVisible()) {
    fenetreSaisie.hide();
    return;
  }
  fenetreSaisie.center();
  fenetreSaisie.show();
  fenetreSaisie.focus();
  fenetreSaisie.webContents.send('saisie:affichee');
}

function ouvrirReglages() {
  if (fenetreReglages && !fenetreReglages.isDestroyed()) {
    fenetreReglages.focus();
    return;
  }
  fenetreReglages = new BrowserWindow({
    width: 520,
    height: 470,
    title: 'ARCHIPILOT — Réglages',
    icon: cheminIcone(),
    autoHideMenuBar: true,
    resizable: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, preload: path.join(__dirname, 'preload.js') },
  });
  fenetreReglages.loadFile(path.join(__dirname, 'reglages.html'));
  fenetreReglages.on('closed', () => {
    fenetreReglages = null;
  });
}

// --- Raccourcis globaux --------------------------------------------------------------------

/** (Ré)enregistre les raccourcis ; renvoie la liste des raccourcis refusés (déjà pris, invalides). */
function enregistrerRaccourcis() {
  globalShortcut.unregisterAll();
  const refuses = [];
  const essayer = (accelerateur, action, nom) => {
    if (!accelerateur) return;
    let ok = false;
    try {
      ok = globalShortcut.register(accelerateur, action);
    } catch {
      ok = false;
    }
    if (!ok) refuses.push(`${nom} (${accelerateur})`);
  };
  essayer(reglages.raccourciAfficher, ouvrirFenetrePrincipale, 'Afficher ARCHIPILOT');
  essayer(reglages.raccourciSaisie, basculerSaisie, 'Saisie rapide');
  return refuses;
}

// --- Messages des pages -----------------------------------------------------------------------

function estPageDeConfiance(evenement) {
  const url = evenement.senderFrame ? evenement.senderFrame.url : '';
  return url.startsWith('file://') || (url && new URL(url).origin === origine());
}

ipcMain.on('saisie:fermer', (e) => {
  if (estPageDeConfiance(e) && fenetreSaisie && !fenetreSaisie.isDestroyed()) fenetreSaisie.hide();
});

ipcMain.on('saisie:tache-ajoutee', (e) => {
  if (!estPageDeConfiance(e)) return;
  // La fenêtre principale a maintenant des données périmées : on la recharge pour éviter un conflit de version.
  if (fenetrePrincipale && !fenetrePrincipale.isDestroyed()) fenetrePrincipale.webContents.reload();
});

ipcMain.handle('reglages:lire', (e) => {
  if (!e.senderFrame.url.startsWith('file://')) return null;
  return reglages;
});

ipcMain.handle('reglages:enregistrer', (e, nouveaux) => {
  if (!e.senderFrame.url.startsWith('file://')) return { ok: false, erreurs: ['Refusé.'] };
  const ancienneUrl = reglages.url;
  let url = String(nouveaux.url || '').trim();
  try {
    const analysee = new URL(url);
    if (analysee.protocol !== 'https:') throw new Error('http');
    url = analysee.origin;
  } catch {
    return { ok: false, erreurs: ["L'adresse doit commencer par https://"] };
  }
  reglages = {
    url,
    raccourciAfficher: String(nouveaux.raccourciAfficher || '').trim(),
    raccourciSaisie: String(nouveaux.raccourciSaisie || '').trim(),
    lancerAuDemarrage: Boolean(nouveaux.lancerAuDemarrage),
  };
  ecrireReglages();
  app.setLoginItemSettings({ openAtLogin: reglages.lancerAuDemarrage });
  const refuses = enregistrerRaccourcis();
  if (url !== ancienneUrl) {
    if (fenetrePrincipale && !fenetrePrincipale.isDestroyed()) fenetrePrincipale.loadURL(url);
    if (fenetreSaisie && !fenetreSaisie.isDestroyed()) fenetreSaisie.destroy();
  }
  return refuses.length ? { ok: false, erreurs: refuses.map((r) => `Raccourci refusé (déjà utilisé ou invalide) : ${r}`) } : { ok: true };
});

// --- Démarrage ----------------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', ouvrirFenetrePrincipale);

  app.whenReady().then(() => {
    lireReglages();
    ouvrirFenetrePrincipale();

    tray = new Tray(nativeImage.createFromPath(cheminIcone()));
    tray.setToolTip('ARCHIPILOT');
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Afficher ARCHIPILOT', click: ouvrirFenetrePrincipale },
        { label: 'Saisie rapide', click: basculerSaisie },
        { label: 'Réglages…', click: ouvrirReglages },
        { type: 'separator' },
        {
          label: 'Quitter',
          click: () => {
            quitter = true;
            app.quit();
          },
        },
      ]),
    );
    tray.on('click', ouvrirFenetrePrincipale);

    const refuses = enregistrerRaccourcis();
    if (refuses.length) ouvrirReglages(); // un raccourci est pris par autre chose : on laisse l'utilisateur le changer
  });

  app.on('before-quit', () => {
    quitter = true;
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  // Rester actif (zone de notification) quand toutes les fenêtres sont cachées/fermées.
  app.on('window-all-closed', () => {});
}
