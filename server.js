// server.js
// Serveur HTTP local en Node.js pur (aucune dépendance externe). Sert les
// fichiers du dossier public/, expose une petite API pour lire/écrire le
// fichier de données JSON directement sur disque (plus de permission
// navigateur à revalider : Node a un accès disque direct) et ouvre
// automatiquement une fenêtre "app" au démarrage.

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, spawn, execFile } = require('child_process');

const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT_INITIAL = 5173;
const PORT_MAX_ESSAIS = 20; // si le port est occupé, on tente les 20 suivants

const DOSSIER_LOCAL = path.join(process.env['LocalAppData'] || __dirname, 'ARCHIPILOT');
const FICHIER_CONFIG = path.join(DOSSIER_LOCAL, 'config.json');
const STRUCTURE_INITIALE = { projects: [], tasks: [] };

// Table de correspondance extension -> type MIME.
// Volontairement limitée aux types réellement utilisés par l'app.
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

/**
 * Résout le chemin demandé vers un fichier sous PUBLIC_DIR,
 * en empêchant toute sortie du dossier (protection path traversal).
 * Retourne null si le chemin résolu sort de PUBLIC_DIR.
 */
function resoudreCheminFichier(urlPath) {
  // On ignore la query string éventuelle et on décode les caractères encodés.
  const chemin = decodeURIComponent(urlPath.split('?')[0]);
  const cheminRelatif = chemin === '/' ? '/index.html' : chemin;
  const cheminAbsolu = path.normalize(path.join(PUBLIC_DIR, cheminRelatif));

  if (!cheminAbsolu.startsWith(PUBLIC_DIR)) {
    return null; // tentative de sortie du dossier public (ex: ../../secret)
  }
  return cheminAbsolu;
}

function servirFichier(res, cheminAbsolu) {
  fs.readFile(cheminAbsolu, (erreur, contenu) => {
    if (erreur) {
      if (erreur.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 - Fichier non trouvé');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 - Erreur serveur');
      }
      return;
    }

    const extension = path.extname(cheminAbsolu).toLowerCase();
    const typeMime = MIME_TYPES[extension] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': typeMime });
    res.end(contenu);
  });
}

// --- Configuration locale (chemin du fichier de données choisi) ------------------
// Stockée dans un dossier local à ce PC (comme node.exe et le profil
// navigateur), indépendamment de l'emplacement du fichier de données —
// donc pas de conflit si chaque PC y accède via un chemin différent.

/** Retire un éventuel BOM UTF-8 en tête de fichier (ex: fichier créé/édité
 * dans un éditeur qui en ajoute un), que JSON.parse ne tolère pas. */
function sansBOM(texte) {
  return texte.charCodeAt(0) === 0xfeff ? texte.slice(1) : texte;
}

function lireConfig() {
  try {
    return JSON.parse(sansBOM(fs.readFileSync(FICHIER_CONFIG, 'utf8')));
  } catch {
    return { dataFilePath: null };
  }
}

function ecrireConfig(config) {
  fs.mkdirSync(DOSSIER_LOCAL, { recursive: true });
  fs.writeFileSync(FICHIER_CONFIG, JSON.stringify(config, null, 2));
}

function repondreJSON(res, status, corps) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corps));
}

function lireCorpsJSON(req) {
  return new Promise((resolve, reject) => {
    let donnees = '';
    req.on('data', (morceau) => {
      donnees += morceau;
    });
    req.on('end', () => {
      if (!donnees) return resolve(null);
      try {
        resolve(JSON.parse(donnees));
      } catch (erreur) {
        reject(erreur);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Ouvre un sélecteur de fichier natif Windows (Ouvrir ou Enregistrer sous)
 * via un script PowerShell WinForms, sans dépendance npm. Le PowerShell
 * lui-même reste invisible (-WindowStyle Hidden) ; seule la boîte de
 * dialogue native s'affiche.
 */
function ouvrirSelecteurNatif({ mode, suggestedName }) {
  const lignes = ['Add-Type -AssemblyName System.Windows.Forms', '$owner = New-Object System.Windows.Forms.Form', '$owner.TopMost = $true'];

  if (mode === 'save') {
    lignes.push(
      '$f = New-Object System.Windows.Forms.SaveFileDialog',
      "$f.Title = 'Créer le fichier de données ARCHIPILOT'",
      "$f.Filter = 'Fichier de données ARCHIPILOT (*.json)|*.json'",
      `$f.FileName = '${suggestedName}'`
    );
  } else {
    lignes.push(
      '$f = New-Object System.Windows.Forms.OpenFileDialog',
      "$f.Title = 'Choisir le fichier de données ARCHIPILOT'",
      "$f.Filter = 'Fichier de données ARCHIPILOT (*.json)|*.json|Tous les fichiers (*.*)|*.*'",
      '$f.CheckFileExists = $true'
    );
  }
  lignes.push(
    "if ($f.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.FileName }",
    '$owner.Dispose()'
  );

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', lignes.join('; ')],
      { windowsHide: true },
      (erreur, stdout) => {
        if (erreur) return reject(erreur);
        resolve(stdout.trim() || null);
      }
    );
  });
}

// --- Serveur HTTP : API de données + fichiers statiques ---------------------------

const serveur = http.createServer(async (req, res) => {
  try {
    if (req.url === '/api/config' && req.method === 'GET') {
      return repondreJSON(res, 200, lireConfig());
    }

    if (req.url === '/api/data' && req.method === 'GET') {
      const { dataFilePath } = lireConfig();
      if (!dataFilePath) {
        return repondreJSON(res, 404, { code: 'FICHIER_INTROUVABLE', message: 'Aucun fichier de données configuré.' });
      }
      let texte;
      try {
        texte = sansBOM(fs.readFileSync(dataFilePath, 'utf8'));
      } catch {
        return repondreJSON(res, 404, {
          code: 'FICHIER_INTROUVABLE',
          message: 'Le fichier de données est introuvable (a-t-il été déplacé ou supprimé ?).',
        });
      }
      if (texte.trim() === '') return repondreJSON(res, 200, STRUCTURE_INITIALE);
      try {
        const donnees = JSON.parse(texte);
        if (!Array.isArray(donnees.projects) || !Array.isArray(donnees.tasks)) throw new Error('forme inattendue');
        return repondreJSON(res, 200, donnees);
      } catch {
        return repondreJSON(res, 400, {
          code: 'JSON_INVALIDE',
          message:
            'Le fichier de données contient du JSON invalide ou corrompu. Corrigez-le manuellement ou restaurez une sauvegarde.',
        });
      }
    }

    if (req.url === '/api/data' && req.method === 'PUT') {
      const { dataFilePath } = lireConfig();
      if (!dataFilePath) {
        return repondreJSON(res, 400, { code: 'FICHIER_INTROUVABLE', message: 'Aucun fichier de données configuré.' });
      }
      let donnees;
      try {
        donnees = await lireCorpsJSON(req);
      } catch {
        return repondreJSON(res, 400, { code: 'INCONNU', message: 'Corps de requête invalide.' });
      }
      try {
        fs.writeFileSync(dataFilePath, JSON.stringify(donnees, null, 2));
      } catch {
        return repondreJSON(res, 500, {
          code: 'ECRITURE_ECHOUEE',
          message: "Échec de l'écriture du fichier de données. Vérifiez que le fichier n'est pas ouvert/verrouillé ailleurs.",
        });
      }
      return repondreJSON(res, 200, { writtenAt: new Date().toISOString() });
    }

    if (req.url === '/api/pick-file' && req.method === 'POST') {
      const chemin = await ouvrirSelecteurNatif({ mode: 'open' });
      if (chemin) ecrireConfig({ dataFilePath: chemin });
      return repondreJSON(res, 200, { path: chemin });
    }

    if (req.url === '/api/create-file' && req.method === 'POST') {
      const chemin = await ouvrirSelecteurNatif({ mode: 'save', suggestedName: 'archipilot-data.json' });
      if (chemin) {
        if (!fs.existsSync(chemin)) fs.writeFileSync(chemin, JSON.stringify(STRUCTURE_INITIALE, null, 2));
        ecrireConfig({ dataFilePath: chemin });
      }
      return repondreJSON(res, 200, { path: chemin });
    }

    if (req.url === '/api/pin-window' && req.method === 'POST') {
      if (!pidFenetreApp) {
        return repondreJSON(res, 400, {
          code: 'FENETRE_INTROUVABLE',
          message: "Impossible de localiser la fenêtre ARCHIPILOT (aucun navigateur dédié détecté au démarrage).",
        });
      }
      let corps;
      try {
        corps = await lireCorpsJSON(req);
      } catch {
        return repondreJSON(res, 400, { code: 'INCONNU', message: 'Corps de requête invalide.' });
      }
      const epingle = Boolean(corps?.pinned);
      const resultat = await definirEpinglageFenetre(pidFenetreApp, epingle);
      if (resultat !== 'OK') {
        return repondreJSON(res, 404, {
          code: 'FENETRE_INTROUVABLE',
          message: 'Fenêtre ARCHIPILOT introuvable (a-t-elle été fermée depuis ?).',
        });
      }
      return repondreJSON(res, 200, { pinned: epingle });
    }
  } catch (erreur) {
    return repondreJSON(res, 500, { code: 'INCONNU', message: erreur.message });
  }

  // Rien ne correspond à l'API : on sert les fichiers statiques de public/.
  const cheminAbsolu = resoudreCheminFichier(req.url);

  if (!cheminAbsolu) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 - Accès refusé');
    return;
  }

  fs.stat(cheminAbsolu, (erreur, stats) => {
    if (!erreur && stats.isDirectory()) {
      servirFichier(res, path.join(cheminAbsolu, 'index.html'));
    } else {
      servirFichier(res, cheminAbsolu);
    }
  });
});

/**
 * Épingle ou désépingle (au premier plan / normal) la fenêtre du processus
 * `pid` via l'API Windows (SetWindowPos + HWND_TOPMOST/HWND_NOTOPMOST), en
 * P/Invoke depuis PowerShell : il n'existe aucune API web pour ça, la
 * fenêtre app Chromium n'exposant rien de tel au JS de la page.
 * Retourne 'OK' si une fenêtre visible de ce process a été trouvée et
 * modifiée, 'INTROUVABLE' sinon (ex: fenêtre fermée entre-temps).
 */
function definirEpinglageFenetre(pid, epingle) {
  const script = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class ArchipilotWin32 {
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
}
"@
$cible = ${pid}
$trouve = $false
$after = New-Object IntPtr(${epingle ? -1 : -2})
$callback = {
  param($hWnd, $lParam)
  $procId = 0
  [void][ArchipilotWin32]::GetWindowThreadProcessId($hWnd, [ref]$procId)
  if ($procId -eq $cible -and [ArchipilotWin32]::IsWindowVisible($hWnd)) {
    [void][ArchipilotWin32]::SetWindowPos($hWnd, $after, 0, 0, 0, 0, 0x0003)
    $script:trouve = $true
  }
  return $true
}
[void][ArchipilotWin32]::EnumWindows($callback, [IntPtr]::Zero)
if ($trouve) { Write-Output 'OK' } else { Write-Output 'INTROUVABLE' }
`;

  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script],
      { windowsHide: true },
      (erreur, stdout) => {
        if (erreur) return reject(erreur);
        resolve(stdout.trim());
      }
    );
  });
}

// --- Fenêtre "app" (navigateur Chromium en mode fenêtre dédiée) -------------------

// Chemins usuels des navigateurs Chromium sous Windows, par ordre de
// préférence. On les utilise en mode "app" (fenêtre dédiée sans barre
// d'adresse ni onglets) pour qu'ARCHIPILOT se comporte comme une application
// autonome plutôt que comme un site ouvert dans un onglet de navigateur.
function candidatsNavigateurs() {
  const pf = process.env['ProgramFiles'];
  const pf86 = process.env['ProgramFiles(x86)'];
  const local = process.env['LocalAppData'];

  return [
    pf && path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    pf86 && path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    local && path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    pf && path.join(pf, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    pf86 && path.join(pf86, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    local && path.join(local, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    pf86 && path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    pf && path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter(Boolean);
}

function trouverNavigateur() {
  return candidatsNavigateurs().find((chemin) => fs.existsSync(chemin)) || null;
}

// PID de la fenêtre app couramment ouverte (voir ouvrirFenetreApp), utilisé
// par /api/pin-window pour la retrouver côté Windows. Null si aucun
// navigateur Chromium dédié n'a été lancé (repli navigateur par défaut).
let pidFenetreApp = null;

/**
 * Surveille la fenêtre app (PID + nom du navigateur lancé) et arrête le
 * serveur dès qu'elle se ferme, pour qu'il n'y ait rien à fermer
 * manuellement. On vérifie le PID *et* le nom du processus (via tasklist)
 * plutôt que le PID seul : Windows peut réattribuer un PID à un tout autre
 * processus une fois l'original terminé, ce qui ferait croire à tort que la
 * fenêtre est toujours ouverte.
 */
function arreterQuandFenetreFerme(pid, nomImage) {
  const intervalle = setInterval(() => {
    exec(`tasklist /FI "PID eq ${pid}" /FI "IMAGENAME eq ${nomImage}" /NH`, (erreur, stdout) => {
      const encoreOuverte = !erreur && stdout.toLowerCase().includes(nomImage.toLowerCase());
      if (!encoreOuverte) {
        clearInterval(intervalle);
        console.log('Fenêtre ARCHIPILOT fermée : arrêt du serveur.');
        process.exit(0);
      }
    });
  }, 4000);
}

/**
 * Ouvre l'URL dans une fenêtre "app" dédiée (Chrome/Brave/Edge, sans barre
 * d'adresse ni onglets) plutôt que dans un onglet de navigateur classique.
 * Un profil dédié (propre à ce PC, indépendant de l'emplacement du fichier
 * de données) est utilisé pour ne pas interférer avec le profil de
 * navigation habituel de l'utilisateur.
 * Si aucun navigateur Chromium n'est trouvé, on retombe sur le navigateur
 * par défaut (comportement historique, sans arrêt automatique du serveur).
 */
function ouvrirFenetreApp(url) {
  const navigateur = trouverNavigateur();

  if (!navigateur) {
    console.warn(
      "Aucun navigateur Chromium (Chrome/Brave/Edge) trouvé : ouverture dans " +
        'le navigateur par défaut (mode onglet classique).'
    );
    exec(`start "" "${url}"`, (erreur) => {
      if (erreur) {
        console.warn("Impossible d'ouvrir automatiquement le navigateur. " + `Ouvrez manuellement : ${url}`);
      }
    });
    return;
  }

  const profil = path.join(process.env['LocalAppData'] || __dirname, 'ARCHIPILOT', 'profil-app');
  fs.mkdirSync(profil, { recursive: true });

  const enfant = spawn(
    navigateur,
    [`--app=${url}`, `--user-data-dir=${profil}`, '--window-size=1320,860', '--no-first-run', '--no-default-browser-check'],
    { detached: true, stdio: 'ignore' }
  );

  enfant.on('error', () => {
    console.warn("Impossible d'ouvrir automatiquement la fenêtre app. " + `Ouvrez manuellement : ${url}`);
  });

  enfant.unref();
  pidFenetreApp = enfant.pid;
  arreterQuandFenetreFerme(enfant.pid, path.basename(navigateur));
}

/**
 * Tente de démarrer le serveur sur le port donné ; si le port est occupé,
 * réessaie sur le port suivant jusqu'à PORT_MAX_ESSAIS tentatives.
 * Écoute sur 127.0.0.1 uniquement (pas d'exposition sur le réseau local).
 */
function demarrer(port) {
  serveur.listen(port, '127.0.0.1', () => {
    const url = `http://localhost:${port}`;
    console.log(`ARCHIPILOT est lancé : ${url}`);
    console.log('Cette fenêtre se fermera automatiquement avec la fenêtre ARCHIPILOT.');
    ouvrirFenetreApp(url);
  });
}

serveur.on('error', (erreur) => {
  if (erreur.code === 'EADDRINUSE') {
    const portActuel = serveur._portActuel || PORT_INITIAL;
    const portSuivant = portActuel + 1;
    if (portSuivant < PORT_INITIAL + PORT_MAX_ESSAIS) {
      serveur._portActuel = portSuivant;
      demarrer(portSuivant);
      return;
    }
  }
  console.error('Impossible de démarrer le serveur :', erreur.message);
});

demarrer(PORT_INITIAL);
