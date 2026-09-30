# ARCHIPILOT — Contexte projet pour Claude

Ce fichier est lu automatiquement par Claude Code à l'ouverture d'une session
dans ce dossier (le projet vit dans `C:\Users\laxim\ARCHIPILOT`, hors Dropbox,
synchronisé entre postes par GitHub).
Il remplace le besoin de recoller l'historique de conversation : il résume
l'état du projet, les décisions prises et les préférences de l'utilisateur.

## Git et branches — à lire en PREMIER

Méthode de travail détaillée : `METHODE-DE-TRAVAIL-KELZONE.md` (à lire en
entier seulement si besoin de détail). Résumé :
- Dépôt GitHub **privé** : `https://github.com/mfarchitecture-ctrl/archipilot`.
- Première commande de session : `git branch --show-current` → on doit être
  sur `preprod`, puis `git pull`.
- `preprod` = tout le travail ; `main` = production, **fusionnée seulement
  sur demande explicite** de l'utilisateur. Jamais de commit direct sur
  `main`, jamais de `push --force`.
- **Une question est une question, pas une demande de code** : répondre, ne
  rien modifier tant que l'utilisateur ne l'a pas demandé.
- Toujours dire ce qui a été testé en réel et ce qui l'a été en simulé.
- `.gitignore` : `runtime/win/node.exe` et `archipilot-data/` (données
  clients réelles) ne sont **jamais** commités.
- Les identifiants GitHub sont gérés par l'utilisateur ; je ne crée aucun
  compte. Les `git push` sont faits après accord.
- Le dossier Dropbox d'origine (`E:\Dropbox\ARCHIPILOT`) a été abandonné
  (2026-09-30) : git dans Dropbox est fragile.

## Décision en cours (2026-09-30) : passage à une appli hébergée

L'utilisateur veut **remplacer complètement l'usage local par une appli
web hébergée**, **protégée par mot de passe**. Les sections "Architecture" et
"Lancement" ci-dessous décrivent l'état **actuel** (local Windows : accès
disque direct, fenêtre app, boîtes de dialogue natives, `/api/pin-window`) ;
ces parties devront être repensées (stockage des données hébergé, plus de
`start.bat`/fenêtre app). Plateforme, stockage et authentification **pas
encore choisis** : à discuter, une étape à la fois, sans coder avant accord.

Décisions du 2026-09-30 sur ce chantier :
- Le **principe de fichier de données disparaîtra** (écran de connexion au
  fichier, « Changer de fichier », sélecteur Windows, nom de sidebar tiré du
  fichier), remplacé par une **connexion par mot de passe**. On le fait
  **en même temps que l'hébergement** (pas de mot de passe local
  provisoire, il faudrait le refaire) : choisir d'abord plateforme +
  stockage + authentification. En attendant on continue l'esthétique en
  local, sans toucher au mécanisme de fichier.
- **Deux utilisateurs prévus** : l'utilisateur et sa compagne.
  `archipilot-data/STUDIO CYMA.json` est le fichier de sa compagne : **à
  conserver tel quel** (jamais commité, jamais modifié) ; ses données seront
  remises dans l'appli hébergée plus tard. L'hébergement doit donc séparer
  deux jeux de données (deux comptes/espaces, chacun son mot de passe).

**Maintenance : à la fin d'une session avec des changements notables,
mets à jour ce fichier** (section "État actuel" si l'architecture a changé,
et ajoute une entrée dans "Journal des sessions"). Reste concis : l'objectif
est de transmettre l'essentiel, pas de dupliquer la conversation.

## Qu'est-ce qu'ARCHIPILOT

App locale de suivi de tâches multi-chantiers pour un architecte. Pas de
base de données ni d'hébergement : un unique fichier JSON
(`archipilot-data.json` par défaut) contenu de projets/tâches, que
l'utilisateur place où il veut (localement ou dans un dossier synchronisé).
Zéro dépendance npm, JS vanilla, aucun build.

**Ne plus jamais écrire « DODA »** (nom de l'ancienne agence de
l'utilisateur) : ni dans le code, ni dans les textes, ni dans les noms de
fichiers. Demande explicite du 2026-09-30.

## Architecture

- **`server.js`** — serveur Node pur (aucune dépendance npm). Sert
  `public/` en statique, et expose une petite API (`/api/config`,
  `/api/data` GET/PUT, `/api/pick-file`, `/api/create-file`) qui lit/écrit
  le fichier de données **directement sur disque**. C'est un choix
  architectural important : à l'origine l'app utilisait la File System
  Access API du navigateur (`showOpenFilePicker` etc.), mais Chrome ne
  retient l'autorisation d'accès fichier que pour la session en cours dans
  une fenêtre `--app=`, donc l'utilisateur devait ré-autoriser à chaque
  lancement. Le passage au stockage géré par Node (accès disque direct,
  aucune notion de permission navigateur) a réglé ça définitivement.
  Les sélecteurs "Choisir/Créer un fichier" utilisent des boîtes de dialogue
  Windows natives (script PowerShell invisible lancé via `execFile`), pas
  l'API navigateur.
- Le serveur ouvre aussi une **fenêtre "app" Chrome/Edge/Brave** dédiée
  (`--app=url --user-data-dir=<profil propre à ARCHIPILOT>`), sans barre
  d'adresse ni onglets — pas un onglet de navigateur classique. Il surveille
  le PID **et** le nom du process de cette fenêtre (via `tasklist`, pas
  juste le PID seul — Windows peut réattribuer un PID) et s'arrête tout
  seul (`process.exit(0)`) quand la fenêtre se ferme. Ce même PID
  (`pidFenetreApp`) est réutilisé par `/api/pin-window` (voir
  "Épingler la fenêtre" ci-dessous).
- **`/api/pin-window`** (POST `{ pinned: bool }`) — épingle/désépingle la
  fenêtre app au premier plan via l'API Windows (`SetWindowPos` +
  `HWND_TOPMOST`/`HWND_NOTOPMOST`), en P/Invoke depuis PowerShell
  (`definirEpinglageFenetre`, technique `Add-Type -TypeDefinition` avec
  `EnumWindows`/`GetWindowThreadProcessId` pour retrouver le HWND à partir
  du PID). Aucune API web n'existe pour ça, d'où le passage par le serveur.
  **Fonctionnalité confirmée fonctionnelle par l'utilisateur** (2026-09-17)
  — je n'avais pas pu la vérifier visuellement moi-même : mon environnement
  d'exécution (sandbox de l'agent) tourne apparemment sur une session sans
  accès au bureau interactif réel, donc mes propres tests `EnumWindows` ne
  trouvaient aucune fenêtre de premier niveau même pour un vrai Chrome que
  je venais de lancer — un piège à connaître si on doit re-tester ce genre
  de fonctionnalité bas niveau (fenêtres OS) depuis ce même environnement :
  se fier au retour de l'utilisateur plutôt qu'à ses propres tests locaux
  pour ce type de vérification visuelle Windows.
- Écoute uniquement sur `127.0.0.1` (pas d'exposition réseau local).
- **`storage.js`** (front) — appelle l'API du serveur via `fetch`. Pas
  d'IndexedDB, pas de permission à gérer côté navigateur.
- **`appearance.js`** — couleur de fond, image de fond
  (compressée en JPEG côté client, stockée en IndexedDB, 1920px max).
  Réglages **locaux à ce PC** (localStorage + IndexedDB), indépendants du
  fichier de données JSON.
- **`state.js`** — état en mémoire + mutations (projects/tasks), persistées
  via une fonction fournie par `main.js`. Modèle de données :
  `project = { id, name, info, phase }` (phase ∈ EDL/ESQ/AVP/DCE/FAB/DET/AOR,
  peut être absent sur d'anciens projets),
  `task = { id, projectId, title, priority, status, dueDate, notes }`.
  Expose aussi les requêtes dérivées : `getFilteredSortedTasks` (recherche
  insensible accents/casse via `normaliserTexte`, tri par défaut ou colonne
  explicite `filters.sortBy`/`sortDir` ; pour Échéance/Jours restants, à
  date égale — ou absente des deux côtés — on départage toujours par
  priorité, haute en premier, quel que soit le sens du tri : voir
  `comparerTaches`), `getProjectSummaries` (inclut
  `tachesEnRetard` et `prochaineTache` pour le badge et le tooltip sur les
  cartes projet), `getDashboardCounts` (compteurs globaux : open/overdue/
  highPriority/blocked, indépendants des filtres actifs).
- **`main.js`** — orchestration : connexion au fichier, navigation entre
  vues (`tasks` = "Vue d'ensemble des tâches", `projects` = "Projets" ; il
  n'y a que ces deux vues, pas de "dashboard" séparé — voir Journal), thème
  clair/sombre, repli du menu latéral (tout en localStorage, clés
  préfixées `archipilot-`). Vue par défaut au démarrage : `tasks` (voir
  `currentView` dans `state.js`) — l'utilisateur veut arriver directement
  sur "Vue d'ensemble des tâches", pas sur Projets.
- **UI** : `ui/taskList.js` (vue "Vue d'ensemble des tâches" : compteurs de
  synthèse cliquables en haut + filtres + tableau, tri par colonne, statut
  modifiable en un clic directement dans le tableau — voir Préférences UI),
  `ui/projects.js` (vue Projets, cartes ou liste, tri via menu déroulant),
  `ui/projectModal.js` (détail d'un projet : tâches en **lecture seule**
  façon Suivi, édition/ajout via `ui/taskForm.js`), `ui/taskForm.js` (modal
  ajout/édition tâche, réutilisée par Suivi ET par la modal projet, champ
  Projet affiché **au-dessus** du champ Nom de la tâche), `ui/appearanceModal.js`,
  `ui/print.js`.

## Lancement

- **`start.bat`** — lanceur principal, **silencieux par défaut** (se
  relance lui-même en arrière-plan via PowerShell, aucune fenêtre visible).
- **`start-debug.bat`** — variante avec console visible, pour déboguer.
- **`ARCHIPILOT.vbs`** — lance `start.bat` en mode caché garanti (zéro
  flash), équivalent à `start.bat` en pratique.
- **`start.bat` crée automatiquement un raccourci Bureau** (`ARCHIPILOT.lnk`,
  cible `ARCHIPILOT.vbs` pour un lancement silencieux, icône
  `public/favicon.ico`) au tout premier lancement, via une commande
  PowerShell inline (`New-Object -ComObject WScript.Shell` /
  `CreateShortcut`). Ne le recrée pas si déjà présent (`Test-Path`) — propre
  à chaque PC (comme `config.json`), pas synchronisé. **Piège rencontré** :
  la première version utilisait `%USERPROFILE%\Desktop`, qui suppose un
  Bureau à l'emplacement Windows par défaut — faux sur la machine de
  l'utilisateur, où le Bureau est redirigé vers `E:\Bureau` (dossier
  `%USERPROFILE%\Desktop` inexistant). Le chemin doit être résolu
  dynamiquement via `[Environment]::GetFolderPath('Desktop')` en PowerShell
  (lit la redirection Bureau réelle), jamais construit à partir de
  `%USERPROFILE%` en dur.
- Config locale (chemin du fichier de données choisi) dans
  `%LocalAppData%\ARCHIPILOT\config.json`. Profil navigateur dans
  `%LocalAppData%\ARCHIPILOT\profil-app`. Les deux sont propres à chaque
  PC, pas synchronisés.
- `node.exe` portable requis dans `runtime\win\node.exe` (téléchargé
  manuellement par l'utilisateur, pas commité).

## Préférences UI établies (à respecter sans re-demander)

- **Charte graphique commune (2026-09-30).** L'utilisateur développe 5
  applis qui doivent être visuellement cohérentes (KELZONE = référence).
  La charte vit dans son propre dépôt (`C:\Users\laxim\CHARTE`, GitHub
  `mfarchitecture-ctrl/charte`). `public/charte.css` + `public/polices/` en
  sont des **copies** : ne pas les modifier ici, modifier la charte puis
  recopier. `main.css` n'a plus de couleur en dur : ses variables (`--bg`,
  `--text`, `--accent`...) sont des **alias** vers la charte (`--fond`,
  `--noir`...). Règle : **le noir est l'interface, la couleur est une donnée
  ou une erreur** (badges statut/priorité, retard). **Plus d'accent
  violet, plus de dégradé, plus d'accent personnalisable** (supprimé de la
  modale Apparence). Retard/échéance proche = liseré de 3px à gauche de la
  ligne, pas d'aplat de couleur. Pas de soulèvement au survol (pas de
  `translateY`), seulement ombre + bordure. Les composants d'ARCHIPILOT
  (`.btn`, `.badge`, `.input`...) gardent leurs noms ; `charte-composants.css`
  n'est PAS chargé ici (collision de noms), à adopter plus tard si besoin.
  **Icônes et thème (charte v1.3.0)** : `public/charte-icones.js` et
  `public/charte-theme.js` sont aussi des copies de la charte. Toutes les
  icônes passent par `icone('nom')` (au trait, style KELZONE) ; plus de
  glyphe texte (✎ 🗑 ✕) ni d'emoji. Boutons d'action = `.btn-icone` (carré
  36px gris, `--danger` rouge au survol seulement). Le thème clair/sombre
  est l'interrupteur de KELZONE (`.bouton-theme`), valeurs `dark`/`light`
  dans `archipilot-theme` (migration des anciennes valeurs `sombre`/`clair`
  dans `main.js`). Les imports de ces modules depuis `ui/*.js` sont en
  `'../../charte-icones.js'`.
  Le nom affiché en haut de la sidebar est celui du fichier connecté
  (ex. « STUDIO CYMA »), sauf `archipilot-data` qui s'affiche « ARCHIPILOT ».
- **Cartes projet en carré fixe (280×280px), non responsive.**
  `grid-template-columns: repeat(auto-fill, 280px)` — pas de `1fr`/`minmax`
  qui étirerait les cartes. Contenu compact en haut (titre, stats,
  échéance), pied de carte (phase + suppression) ancré en bas via
  `margin-top: auto`, pas de `justify-content: space-between` sur toute la
  carte (ça dispersait l'espace de façon inélégante).
- **Titre de carte sur une seule ligne**, tronqué avec ellipsis si trop
  long (jamais de retour à la ligne).
- **Icônes monochromes**, pas d'emoji couleur pour le calendrier (SVG
  `currentColor` via le helper `elSvg` dans `utils/dom.js`). Les glyphes
  texte ✎/🗑 dans les boutons ronds (`.btn-icon-outline`) ont un décalage
  optique vers le haut mesuré (~5%) : corrigé par un `translateY(0.08em)`
  sur `.btn-icon-outline__glyphe`, ne pas le retirer sans comprendre pourquoi
  il est là.
- **Pas de bouton "renommer" sur les cartes/listes de projets** (retiré :
  jugé inutile et buggé — `window.prompt()` ne fonctionne pas bien dans la
  fenêtre `--app`). Le renommage se fait **uniquement en cliquant sur le
  titre dans la modal du projet** (après avoir ouvert la carte), avec un
  champ inline (Entrée/perte de focus = sauvegarde, Échap = annule).
- **Tâches en lecture seule dans la modal projet** (badges/texte, comme
  Suivi), pas d'édition inline (inputs/selects directement dans le tableau)
  — jugé peu lisible. Modifier une tâche passe par le crayon, qui ouvre
  `taskForm.js` (même formulaire que "+ Nouvelle tâche" dans Suivi), avec
  le projet déjà fixé et non modifiable quand on ajoute/édite depuis cette
  modal.
- **Menu latéral repliable** (flèche sous le logo, pas à côté) : le logo ne
  doit jamais changer de position visuelle entre replié/déplié.
- **Filtre statut (vue Suivi) sans "Terminé"** — déjà géré par la case à
  cocher "Afficher les tâches terminées".
- **Formulaire nouvelle tâche** : le champ Projet ne doit jamais être
  présélectionné (option placeholder disabled "Choisir un projet…") —
  évite les erreurs de saisie sur le mauvais projet. Le champ Projet est
  affiché **au-dessus** du champ Nom de la tâche (ordre demandé : "plus
  logique d'avoir le nom du projet tout en haut").
- **Statut modifiable en un clic dans Suivi** (`ui/taskList.js`) : cliquer
  sur le badge Statut le transforme en `<select>` (classe `.badge-select`,
  déjà présente dans `main.css` mais inutilisée avant cette fonctionnalité)
  qui applique le changement immédiatement au `onChange`. C'est **le seul**
  raccourci direct demandé : le reste d'une tâche (titre, priorité,
  échéance, notes) reste modifiable uniquement via le crayon → `taskForm.js`.
  Piège CSS rencontré : la classe `.badge--clickable` (curseur/hover/focus
  du badge non-éditable) ne doit **pas** toucher `font`/`border` — un
  `font: inherit` y avait été ajouté par excès de prudence et écrasait le
  `font-size`/`font-weight` du `.badge` de base (même spécificité, règle
  plus tardive dans la cascade), rendant le badge Statut visuellement
  différent des autres badges (Priorité). Se limiter à `cursor: pointer`
  et aux styles `:hover`/`:focus-visible`.
- **Grille des 4 compteurs (dashboard-grid, en haut de Suivi)** : colonnes
  fixes par media query (4 / 2 / 1 selon la largeur, seuils 860px/480px
  comme le reste du responsive de l'app) plutôt que `auto-fit`. Avec
  exactement 4 cartes, `auto-fit` pouvait laisser la 4e isolée seule sur
  une 2e ligne à certaines largeurs intermédiaires — ne pas revenir à
  `auto-fit`/`auto-fill` ici sans repenser ce cas.
- **Pas de mention de Dropbox comme LA solution** — l'utilisateur pourrait
  changer d'outil de synchro. Rester générique ("dossier synchronisé,
  Dropbox/OneDrive/...") dans les textes utilisateur et le README.
- Logo/icône : la lettre dynamique dans la sidebar (première lettre du
  fichier connecté, ex. "A" pour archipilot-data.json) doit rester. L'icône de
  fenêtre/taskbar (`public/favicon.ico`) est une icône lettre "A" simple
  générée nativement à plusieurs tailles — **ne pas** la remplacer par une
  image détaillée redimensionnée : testé, les visuels fins/détaillés
  deviennent illisibles à 16-32px quelle que soit la qualité de resampling.

## Pièges déjà rencontrés

- Le cache HTTP du navigateur peut servir une version obsolète d'un
  fichier JS après édition ; pour tester dans un onglet déjà ouvert,
  importer avec un cache-buster (`?v=' + Date.now()`).
- Le module `document.hasFocus()` peut être `false` dans un contexte de
  test automatisé (pane caché) : `.focus()`/`.blur()` réels ne déclenchent
  pas toujours les événements — pour tester la logique, dispatcher les
  événements DOM directement (`dispatchEvent(new FocusEvent('blur'))`).
- Un `keydown` Échap dans un champ enfant qui bubble jusqu'à
  `document.addEventListener('keydown', ...)` peut déclencher un handler
  global (ex: fermeture de modal) en plus du handler local — toujours
  `e.stopPropagation()` dans ce genre de cas (le champ n'est pas `document`,
  donc stopPropagation suffit).
- **Modals imbriquées (ex: `taskForm.js` ouvert depuis `projectModal.js`)**
  écoutant chacune Échap sur `document` : `stopImmediatePropagation()` ne
  suffit PAS ici, car les listeners s'exécutent dans l'ordre
  d'enregistrement — celui de la modal la plus ANCIENNE (projet) s'exécute
  EN PREMIER et fermerait tout avant que celui du formulaire (plus récent)
  n'ait sa chance. La vraie solution : la modal appelante **détache son
  propre listener Échap avant d'ouvrir la modal enfant**, et le
  **rattache dans le `onClose`** de celle-ci (voir `ouvrirFormulaireTache`
  dans `projectModal.js`). Un seul listener Échap actif à la fois, donc pas
  d'ambiguïté sur lequel doit réagir.
- Le fichier de données réel de l'utilisateur est `archipilot-data/archipilot-data.json`
  (18 projets ; 18 tâches au 2026-09-16, l'utilisateur l'utilise activement
  entre les sessions — le nombre augmente, c'est normal) — **ne jamais
  écrire dedans pendant des tests**, toujours copier vers un fichier scratch
  et rediriger `config.json` dessus avant de tester l'écriture. Le serveur
  réel de l'utilisateur tourne souvent sur le port 5173 pendant qu'on
  travaille (il utilise l'app en parallèle) : `preview_start` échoue alors
  avec "port in use" — c'est normal, se connecter dessus avec `navigate` en
  lecture seule plutôt que de le tuer.
- Le serveur ARCHIPILOT peut s'arrêter tout seul pendant une session de
  test si la fenêtre app spawnée se ferme/crashe (le watcher l'arrête par
  design) : si `preview_start`/`navigate` échoue soudainement en cours de
  test, vérifier `Get-NetTCPConnection -LocalPort 5173` et relancer
  `preview_start` si besoin.
- **Tester une fonctionnalité de fenêtre OS (EnumWindows, SetWindowPos,
  toujours-au-premier-plan...) depuis l'environnement d'exécution de
  l'agent ne prouve rien visuellement** : ce dernier semble tourner sur une
  session sans accès au vrai bureau interactif de l'utilisateur.
  `EnumWindows` y trouve zéro fenêtre de premier niveau même pour un Chrome
  fraîchement lancé par l'agent lui-même (confirmé en spawnant un vrai
  `chrome.exe --app=...` et en cherchant sa fenêtre : rien trouvé, alors
  que le process existait bien). La logique P/Invoke peut être validée
  syntaxiquement (Add-Type compile, les appels s'exécutent sans erreur),
  mais le résultat visuel réel doit être confirmé par l'utilisateur sur sa
  vraie session. Voir `/api/pin-window` dans Architecture pour le cas
  concret qui a révélé ça.

## Journal des sessions

- **2026-09-15** : Conversion navigateur → fenêtre app dédiée. Refonte
  complète du stockage (File System Access API → API serveur Node,
  suppression définitive des re-demandes de permission). Lancement
  silencieux (`start.bat` auto-caché + arrêt auto à la fermeture).
  Rebranding de l'app en ARCHIPILOT. Personnalisation
  d'apparence (couleur accent unique, couleur de fond, image de fond).
  Menu latéral repliable. Refonte des cartes projet (carré fixe, phase
  EDL/ESQ/AVP/DCE/DET/AOR, icônes). Renommage de projet déplacé dans la
  modal. Divers ajustements UI (filtre statut, formulaire tâche).
- **2026-09-16** : Recherche Suivi insensible aux accents/casse
  (`normaliserTexte`). Tri par colonne dans Suivi (Priorité/Statut/
  Échéance/Jours restants, flèches ▲▼ toujours visibles) et dans Projets
  (menu déroulant Nom/Phase/Tâches ouvertes/Tâches au total/Échéance).
  Ajout de la phase FAB. Badge "en retard" sur les cartes/liste de
  projets + tooltip sur la date d'échéance montrant la tâche concernée.
  Régénération du favicon avec centrage mesuré précisément par balayage de
  pixels (le magic-number précédent n'était pas fiable à toutes les
  tailles). Ajout d'une tâche depuis la modal projet : passe maintenant par
  le même formulaire modal que Suivi (`taskForm.js`) au lieu d'une ligne
  éditable inline, projet fixé ; les tâches existantes y sont affichées en
  lecture seule (badges), modifiables via un crayon qui rouvre ce même
  formulaire (voir "Modals imbriquées" dans Pièges). Tableau de bord
  d'abord ajouté comme onglet séparé, puis **fusionné dans Suivi** sur
  demande de l'utilisateur : Suivi est devenu "Vue d'ensemble des tâches",
  avec les 4 compteurs cliquables en haut de page (pas d'onglet "Dashboard"
  séparé — ne pas le recréer). Puis, dans la suite de la même journée : tri
  Échéance/Jours restants qui départage désormais par priorité à date égale
  (haute en premier). Champ Projet remonté au-dessus du champ Nom de la
  tâche dans `taskForm.js`. Vue par défaut au démarrage passée de Projets à
  "Vue d'ensemble des tâches". Statut d'une tâche modifiable en un clic
  directement dans le tableau de Suivi (badge → select, voir Préférences
  UI), sans passer par le crayon. Grille des 4 compteurs rendue responsive
  par media queries (4/2/1 colonnes) au lieu d'`auto-fit`. Correction d'une
  régression visuelle sur le badge Statut cliquable (voir "Statut
  modifiable en un clic" dans Préférences UI pour le piège CSS exact).
- **2026-09-17** : Ajout d'un bouton "épingler la fenêtre au premier plan"
  (punaise à côté d'Imprimer). Nouvel endpoint `/api/pin-window` côté
  serveur (P/Invoke PowerShell `SetWindowPos`/`EnumWindows` sur le PID de
  la fenêtre app déjà suivi pour l'arrêt automatique — voir Architecture).
  Fonctionnalité confirmée fonctionnelle par l'utilisateur sur sa machine ;
  voir le piège "Tester une fonctionnalité de fenêtre OS..." ci-dessus pour
  la limite de vérification rencontrée côté agent.
- **2026-09-30** : Raccourci Bureau créé automatiquement par `start.bat`
  (chemin du Bureau résolu dynamiquement). Projet sorti de Dropbox vers
  `C:\Users\laxim\ARCHIPILOT`, dépôt git privé créé et poussé sur GitHub
  (`main` + `preprod`). Décision : appli hébergée et protégée par mot de
  passe (voir "Décision en cours"), plan d'hébergement à définir.
  Application de la charte graphique commune (voir Préférences UI) :
  palette monochrome, polices Outfit auto-hébergées, suppression de
  l'accent personnalisable, tableau à liserés de retard.
