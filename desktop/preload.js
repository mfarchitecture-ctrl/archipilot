// preload.js — pont minimal et sûr entre les pages et l'appli Windows (contextIsolation activé).
const { contextBridge, ipcRenderer } = require('electron');

// Page de saisie rapide (chargée depuis le site en ligne)
contextBridge.exposeInMainWorld('archipilotBureau', {
  fermerSaisie: () => ipcRenderer.send('saisie:fermer'),
  tacheAjoutee: () => ipcRenderer.send('saisie:tache-ajoutee'),
  surAffichage: (fn) => ipcRenderer.on('saisie:affichee', () => fn()),
  // Réglages (page locale reglages.html uniquement : ignoré par main.js pour les autres pages)
  lireReglages: () => ipcRenderer.invoke('reglages:lire'),
  enregistrerReglages: (r) => ipcRenderer.invoke('reglages:enregistrer', r),
});
