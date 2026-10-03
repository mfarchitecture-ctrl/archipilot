# ARCHIPILOT pour Windows (Electron)

Fenêtre qui affiche la version **en ligne** d'ARCHIPILOT (mêmes comptes et mêmes données chiffrées que
dans le navigateur : rien n'est stocké en local). Elle ajoute :

- un raccourci global pour ramener la fenêtre au premier plan (défaut : `Ctrl+Alt+A`) ;
- un raccourci global de **saisie rapide** (défaut : `Ctrl+Alt+Espace`) : petite fenêtre flottante
  (projet avec autocomplétion, tâche, priorité, échéance) ; Entrée ajoute, Échap ferme ;
- une icône dans la zone de notification (clic droit : Afficher, Saisie rapide, Réglages, Quitter) ;
  fermer la fenêtre la cache, l'appli reste active pour que les raccourcis marchent.

Raccourcis, adresse du site et lancement au démarrage se changent dans **Réglages** (menu de l'icône).

## Essayer

```
cd desktop
npm install
npm start
```

## Fabriquer l'installateur

```
npm run build
```

L'installateur `.exe` est créé dans `desktop/dist/`. Sans certificat de signature, Windows affiche un
avertissement SmartScreen à l'installation.

La page de saisie rapide est `public/saisie-rapide.html` (elle marche aussi dans un navigateur).
