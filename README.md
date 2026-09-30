# ARCHIPILOT — Suivi de tâches multi-chantiers

Application locale, sans base de données ni hébergement, pour suivre les
tâches de plusieurs projets ("chantiers"). Les données sont stockées dans un
unique fichier JSON (`archipilot-data.json`) que vous placez où vous le souhaitez :
un dossier local, ou un dossier synchronisé (Dropbox, OneDrive, un lecteur
réseau...) si vous voulez retrouver le même fichier sur plusieurs PC.

L'application tourne entièrement en local, via un petit serveur Node.js
embarqué (aucune installation requise). Elle s'ouvre dans sa **propre fenêtre
d'application** (sans barre d'adresse ni onglets, détectée automatiquement
parmi Chrome, Edge ou Brave) — pas besoin d'ouvrir un navigateur ni de taper
une URL.

## Installation (une seule fois par PC)

### 1. Récupérer Node.js portable

ARCHIPILOT a besoin d'un exécutable Node.js pour démarrer son serveur local.
Il n'est **pas** installé sur votre système — vous le téléchargez une fois et
le placez dans le dossier du projet.

1. Allez sur **https://nodejs.org/en/download**.
2. Choisissez **Windows**, **x64**, format **.zip** (pas le `.msi`
   installeur). Vous pouvez aussi aller directement sur
   `https://nodejs.org/dist/` et prendre la dernière version LTS, par
   exemple `node-v22.x.x-win-x64.zip`.
3. Extrayez le zip téléchargé.
4. Dans le dossier extrait, repérez le fichier **`node.exe`** (à la racine
   du dossier extrait).
5. Copiez ce fichier `node.exe` dans le dossier du projet, à cet emplacement
   exact :

   ```
   archipilot\runtime\win\node.exe
   ```

   Un fichier `PLACEZ_NODE_EXE_ICI.txt` se trouve déjà dans ce dossier pour
   vous le rappeler ; vous pouvez le supprimer une fois `node.exe` en place
   (ou le laisser, cela n'a pas d'impact).

Les autres fichiers du zip (npm, npx, licences...) ne sont pas nécessaires :
ARCHIPILOT n'utilise que `node.exe` lui-même.

### 2. Vérifier l'arborescence

Après cette étape, le dossier du projet doit ressembler à ceci :

```
archipilot/
├── server.js
├── start.bat
├── start-debug.bat
├── ARCHIPILOT.vbs
├── runtime/
│   └── win/
│       └── node.exe        <-- doit être présent
├── public/
│   └── ...
└── README.md
```

## Premier lancement

1. **Double-cliquez sur `start.bat`.** Aucune fenêtre ne reste visible : le
   serveur local démarre silencieusement en arrière-plan, puis une fenêtre
   d'application ARCHIPILOT s'ouvre automatiquement (sans barre d'adresse ni
   onglets : ce n'est pas un onglet de navigateur classique). `ARCHIPILOT.vbs`
   fait exactement la même chose (utilisez l'un ou l'autre, au choix).
   - Fermer la fenêtre ARCHIPILOT suffit : le serveur en arrière-plan
     s'arrête tout seul avec elle, rien d'autre à fermer.
   - Si aucun Chrome, Edge ou Brave n'est installé sur le PC, ARCHIPILOT
     retombe sur le navigateur par défaut et ouvre un onglet classique à
     l'URL `http://localhost:5173`.
   - Besoin de voir les messages d'erreur (ex. si rien ne se lance) ?
     Utilisez `start-debug.bat` à la place : il fait la même chose mais
     garde une fenêtre de console visible avec les messages détaillés.

2. **Connectez votre fichier de référence.** Au premier lancement,
   ARCHIPILOT vous propose deux options :
   - **« Choisir le fichier de données »** : si vous avez déjà un fichier
     `archipilot-data.json` quelque part (par exemple parce qu'un autre PC l'a
     déjà créé), sélectionnez-le.
   - **« Créer un nouveau fichier »** : si c'est la toute première fois,
     choisissez l'emplacement et le nom (`archipilot-data.json` par défaut) —
     un dossier synchronisé si vous voulez le retrouver sur plusieurs PC,
     sinon n'importe quel dossier local. ARCHIPILOT l'initialise avec une
     structure vide.

3. Une fois le fichier connecté, l'application s'ouvre sur le Dashboard.
   Vous pouvez commencer par créer vos projets (onglet **Projets**), puis
   ajouter des tâches (onglet **Suivi**, bouton **+ Nouvelle tâche**).

### Sur un deuxième PC

Répétez l'installation (étapes 1 et 2 ci-dessus — `node.exe` doit être copié
sur **chaque** PC, il n'est pas partagé automatiquement). Si votre fichier
`archipilot-data.json` vit dans un dossier synchronisé (Dropbox, OneDrive...), au
premier lancement sur ce PC choisissez **« Choisir le fichier de données »**
et sélectionnez ce même fichier une fois qu'il est synchronisé sur ce PC :
les deux PC partageront alors les mêmes projets et tâches.

### Lancements suivants

Double-cliquez simplement sur `start.bat`. ARCHIPILOT se souvient du fichier
choisi (le chemin est mémorisé localement sur ce PC) : vous n'avez plus
jamais à le re-sélectionner ni à autoriser quoi que ce soit, tant que vous ne
cliquez pas sur « Changer de fichier ».

## Utilisation

- **Dashboard** : compteurs de synthèse (tâches ouvertes, en retard,
  priorité haute, bloquées). Cliquer sur une carte filtre directement la
  vue Suivi correspondante.
- **Suivi** : liste complète des tâches, avec recherche, filtres (projet,
  priorité, statut, afficher les terminées) et tri automatique
  (priorité → urgence → projet). Ajout/édition/suppression via le bouton
  **+ Nouvelle tâche** ou l'icône crayon sur chaque ligne.
- **Projets** : une carte par projet (tâches ouvertes, total, prochaine
  échéance, phase). Cliquer sur la carte ouvre le détail du projet. Chaque
  projet a une **phase** (menu déroulant : EDL, ESQ, AVP, DCE, DET, AOR),
  modifiable directement depuis la carte ou la liste ; les icônes crayon et
  corbeille permettent de renommer ou supprimer le projet. Le bouton
  **Cartes / Liste** en haut à droite bascule entre l'affichage en cartes et
  une liste compacte ; le choix est mémorisé sur ce PC.
- **Personnaliser l'apparence** (icône palette, en bas de la barre latérale) :
  choisissez une couleur d'accentuation unique (remplace le violet par défaut
  partout dans l'interface), une couleur de fond, et/ou importez une image de
  fond (JPG, PNG ou WebP, toute taille — redimensionnée et compressée
  automatiquement à 1920 px de large maximum ; une image importée remplace la
  couleur de fond). Sans couleur ni image personnalisées, le fond reste sobre
  et suit le thème clair/sombre. Ces réglages sont propres à cet ordinateur,
  comme le thème clair/sombre.
- **Réduire le menu latéral** : la flèche à côté du logo ARCHIPILOT replie la
  barre latérale en bandeau d'icônes (plus d'espace pour le contenu). Le
  choix est mémorisé sur ce PC.
- **Imprimer** : imprime la liste des tâches actuellement filtrée/visible,
  dans une mise en page tableau propre (sans les boutons ni les filtres).
- **Changer de fichier** (en bas de la barre latérale) : permet de
  sélectionner un autre fichier `archipilot-data.json`, par exemple si vous
  changez d'emplacement de stockage.

Chaque modification (ajout, édition, suppression) est **immédiatement**
réécrite dans le fichier JSON. L'indicateur en bas de la barre latérale
affiche l'état de connexion et l'heure de la dernière écriture.

## Dépannage

- **"Le fichier de données est introuvable"** : le fichier a probablement
  été déplacé, renommé ou supprimé (ou pas encore synchronisé sur ce PC, si
  vous utilisez un dossier synchronisé). Cliquez sur **« Changer de fichier »**
  pour le resélectionner, ou recréez-en un.
- **"Le fichier de données contient du JSON invalide ou corrompu"** :
  quelqu'un (ou un logiciel) a modifié le fichier avec un contenu non
  valide. Ouvrez `archipilot-data.json` avec un éditeur de texte pour corriger
  l'erreur, ou restaurez une version précédente (historique des versions de
  votre service de synchronisation, ou une sauvegarde).
- **"Impossible de contacter le serveur local ARCHIPILOT"** : le serveur
  (lancé par `start.bat`/`ARCHIPILOT.vbs`) ne tourne plus. Relancez-le.
- **Rien ne s'ouvre après un double-clic sur `start.bat` ou `ARCHIPILOT.vbs`** :
  utilisez `start-debug.bat`, qui affiche la console et le message d'erreur
  exact (`node.exe` introuvable, port 5173 déjà utilisé — ARCHIPILOT essaie
  automatiquement jusqu'à 20 ports suivants avant d'abandonner — etc.).

## Notes techniques

- Aucune base de données, aucun serveur distant : toutes les données
  vivent dans le fichier JSON que vous contrôlez.
- `server.js` (Node pur, sans dépendance npm) sert les fichiers statiques,
  lit/écrit **directement sur disque** le fichier de données (plus de
  permission navigateur à revalider : Node a un accès disque direct et
  permanent) et ouvre les sélecteurs de fichiers natifs Windows (via un
  script PowerShell invisible). Il écoute uniquement sur `127.0.0.1`
  (aucune exposition sur le réseau local).
- Le chemin du fichier de données choisi est mémorisé dans
  `%LocalAppData%\ARCHIPILOT\config.json`, propre à ce PC (comme `node.exe`
  et le profil navigateur `%LocalAppData%\ARCHIPILOT\profil-app`) — chaque
  PC garde son propre chemin, indépendamment de l'endroit où vit le fichier
  de données.
- Fermer la fenêtre "app" arrête automatiquement le serveur (`server.js`
  surveille le PID et le nom du processus navigateur, et s'arrête avec lui).
- `start.bat` se relance lui-même en arrière-plan sans fenêtre visible
  (via PowerShell) ; `start-debug.bat` saute cette étape et garde la console
  ouverte, pour le dépannage.
- Le stockage (appels à l'API du serveur local) est isolé dans
  `public/scripts/storage.js`.
- Structure du fichier `archipilot-data.json` :

  ```json
  {
    "projects": [{ "id": "uuid", "name": "CATELIER", "phase": "ESQ" }],
    "tasks": [
      {
        "id": "uuid",
        "projectId": "uuid",
        "title": "Finaliser la réception",
        "priority": "haute",
        "status": "à faire",
        "dueDate": "2026-09-04",
        "notes": "texte libre"
      }
    ]
  }
  ```
