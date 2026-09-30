# Méthode de travail KELZONE — à reprendre pour ARCHIPILOT

Ce document décrit **comment on a travaillé sur KELZONE** (dépôt GitHub, pré-production,
publication, mémoire de travail de Claude, règles d'or), pour pouvoir faire pareil sur ARCHIPILOT.
Rédigé le 2026-09-30 à partir de l'état réel du projet KELZONE (v1.2.7). Rien de secret dedans :
aucun identifiant, aucune clé.

> **À retenir en une phrase** : *un dépôt GitHub privé, deux branches (`preprod` pour tout le
> travail, `main` pour ce qui est public), un fichier `CLAUDE.md` court que Claude relit à chaque
> session, un `JOURNAL.md` pour l'historique, et on ne publie que quand on le demande.*

---

## 1. Les grands principes

1. **GitHub est la source de vérité.** Pas Dropbox, pas une clé USB. Deux postes = deux copies
   complètes du dépôt, synchronisées par `git pull` / `git push`.
2. **Deux branches seulement** : `preprod` (tout le travail en cours) et `main` (la production).
   Personne ne committe directement sur `main`.
3. **Une pré-production** : chaque `git push` sur `preprod` met à jour une adresse de test, pour
   vérifier en vrai avant de publier. Le site public ne bouge pas.
4. **On publie seulement sur demande explicite** (« publie », « mets en ligne », « balance en
   main »). Une validation (« c'est bien ») n'est pas une demande de publication.
5. **Claude a une mémoire écrite**, pas dans la conversation : `CLAUDE.md` (état + règles,
   court, chargé automatiquement) et `JOURNAL.md` (tout l'historique, consulté à la demande).
   *Une consigne qui ne vit que dans la conversation n'existe pas pour la session suivante.*
6. **Une question est une question, pas une demande de code.** Claude répond, et s'arrête. Il ne
   modifie rien tant que tu n'as pas dit de le faire. (Règle née d'une dérive réelle : du code non
   demandé a consommé du budget et provoqué une régression.)
7. **On dit toujours ce qui a été testé en réel et ce qui l'a été en simulé.** Un test simulé
   n'est jamais présenté comme une validation.

---

## 2. Le dépôt GitHub

### Mise en place (une seule fois)

1. Créer un dépôt **privé** sur GitHub (ex. `archipilot`). *Ne jamais le mettre en public par
   défaut : le code contient l'historique de tout ce qui a été décidé.*
2. Dans le dossier du projet :
   ```
   git init
   git branch -M main
   git remote add origin https://github.com/<ton-compte>/archipilot.git
   git add -A
   git commit -m "Premier commit"
   git push -u origin main
   git switch -c preprod
   git push -u origin preprod
   ```
3. **Les identifiants GitHub, c'est toi qui les gères** (connexion dans le navigateur, gestionnaire
   d'identifiants de Windows). Claude ne les manipule jamais, ne crée jamais de compte à ta place.
   Sur ton poste, les `push` peuvent être lancés par toi dans ton terminal ; Claude prépare la
   commande.

### ⚠️ Dropbox et git ne font pas bon ménage

ARCHIPILOT est actuellement dans `E:\Dropbox\ARCHIPILOT`. Un dépôt git **dans** un dossier Dropbox
est fragile : Dropbox synchronise le dossier `.git` fichier par fichier, ce qui peut créer des
conflits et corrompre l'historique. C'est ce qu'on a vécu avec KELZONE : on l'a sorti de Dropbox
(le dépôt vit maintenant sur le disque local, p. ex. `C:\Users\<toi>\KELZONE`) et c'est GitHub qui
synchronise les deux postes.

**Recommandation** : cloner ARCHIPILOT hors de Dropbox, et ne garder dans Dropbox que ce qui n'est
pas du code (documents, exports). Ce fichier-ci, par exemple, peut rester dans Dropbox.

### La routine, sur chaque poste

```
en arrivant :   git branch --show-current     (on doit être sur preprod)
                git pull
en partant  :   git push
```

- **`git pull` avant de commencer ET avant de pousser** (si deux personnes, ou deux postes, ou une
  session Claude sur le web travaillent sur le même dépôt).
- **Jamais de `push --force`.** Un conflit se résout en gardant le travail des deux.
- Si `git pull` refuse à cause de modifications non enregistrées : les committer d'abord
  (`git add -A` puis `git commit`), puis refaire `git pull`. Ne jamais les écraser sans les avoir
  regardées.
- Un changement à annuler se retire par `git revert`, jamais en réécrivant l'historique.

### Messages de commit

Clairs, et qui disent **ce qui change à l'écran** (pas « fix », pas « update ») :
`Carte : contours des couches au-dessus des parcelles, jaune adouci en satellite`.
Claude ajoute en fin de message la ligne de co-signature (`Co-Authored-By: Claude …`).

---

## 3. Pré-production et production (Cloudflare)

KELZONE est un **site statique** hébergé sur **Cloudflare Workers (assets statiques)**, branché
sur le dépôt GitHub :

| Branche | Rôle | Adresse |
|---|---|---|
| `preprod` | tout le travail en cours | `https://preprod-<nom>.<compte>.workers.dev` |
| `main` | production, le site public | `https://<nom>.<compte>.workers.dev` |

- Dans Cloudflare : *Workers & Pages → le projet → Settings → Build → « Builds for non-production
  branches »* activé. Chaque push sur `preprod` déclenche alors un déploiement sur l'adresse
  `<branche>-<nom>.<compte>.workers.dev`. Chaque push sur `main` met le site public à jour.
- **Pas de commande de build** : le dépôt contient déjà le dossier prêt à servir (`public/`), généré
  à la main par un script (voir §4). Cloudflare n'a qu'à le servir.
- `wrangler.jsonc` à la racine dit à Cloudflare quel dossier servir :
  ```jsonc
  { "name": "kelzone",
    "compatibility_date": "2026-09-21",
    "assets": { "directory": "./public" } }
  ```
  (KELZONE y ajoute un petit Worker `worker.js` pour une seule adresse `/api/piece` ; c'est
  l'exception, décidée une fois pour toutes. Tout le reste est statique.)
- Un build peut rester bloqué (« Initializing ») chez Cloudflare : relancer le déploiement.
- **Seul le dossier `public/` est publié**, jamais la racine du dépôt : `CLAUDE.md`, `JOURNAL.md` et
  les notes internes ne sont donc jamais en ligne.

### Ce qui change pour ARCHIPILOT

Si ARCHIPILOT est une **application avec serveur** (il y a un `server.js` dans le dossier), elle
ne se déploie pas comme un site statique. Il faudra d'abord décider *où* elle tourne :
- **en local seulement** (lancée par `start.bat`, comme aujourd'hui) : alors il n'y a pas de
  pré-production en ligne, mais le reste de la méthode (dépôt, branches, `CLAUDE.md`, `JOURNAL.md`,
  règles) s'applique tel quel ; la « pré-prod » devient « la branche `preprod` qu'on teste en local
  avant de fusionner dans `main` » ;
- **hébergée** : choisir un hébergeur adapté à un serveur Node (Cloudflare Workers/Pages Functions,
  Render, Railway, un VPS…). C'est une décision à prendre avec Claude avant de copier la partie
  Cloudflare de ce document.

---

## 4. Fichier de référence et dossier généré

Règle KELZONE : **`index.html` est le fichier de référence** (application tout-en-un). `public/`
en est **généré** — on ne l'édite jamais à la main.

- `preparer-site.ps1` copie `index.html` (et les ressources, p. ex. `polices/`) dans `public/`, puis
  vérifie que la copie est identique à la source (garde-fou). Sans ce script, `public/` reste sur la
  version précédente et le site en ligne ne change pas.
- **À chaque push sur `preprod`, régénérer `public/`** (sinon la pré-prod n'affiche rien de neuf).
- Le script lit et écrit en UTF-8 explicite : PowerShell 5.1 lit en ANSI par défaut et détruirait
  les accents (incident réel).

*Pour ARCHIPILOT* : l'idée à reprendre est « une source de vérité unique + un dossier généré +
un garde-fou », quelle que soit la forme que prendra le projet.

---

## 5. La mémoire de travail de Claude

### `CLAUDE.md` — court, chargé à chaque session

Il ne contient que :
1. les **règles d'économie de contexte** (ne jamais lire un gros fichier en entier : `grep -n` puis
   lire la plage utile) ;
2. **« Pré-prod et prod — à lire en premier »** : les deux branches, la commande de début de session
   (`git branch --show-current`), les règles de publication ;
3. l'**état actuel** (version, ce qui est fait, ce qui reste à vérifier en réel) ;
4. les **chantiers ouverts** et les **idées à discuter** (marquées « ne pas implémenter sans en
   reparler ») ;
5. les **règles qui ne changent jamais** (voir §7) ;
6. la **liste des fichiers du dossier** et le **sommaire du journal**.

Il ne bouge que si l'état actuel ou une règle change. **Volontairement court** : ce fichier est
rechargé à chaque tour de conversation, donc chaque ligne coûte.

### `JOURNAL.md` — tout l'historique

Chaque décision, bug trouvé et corrigé, test réel et son résultat, **depuis le premier jour**.
Claude y ajoute une entrée à la fin après chaque travail (titre daté, ce qui a changé, **ce qui a
été testé en réel, ce qui ne l'a été qu'en simulé**, ce qui reste à vérifier). Il n'est **pas**
chargé automatiquement : on le consulte par section (`grep -n '^## ' JOURNAL.md`).

### Côté utilisateur : économiser le contexte

- **`/clear` quand on change de sujet**, `/compact` seulement pour continuer la même tâche. Une
  session longue renvoie tout l'historique à chaque message et consomme du budget.
- Une réponse courte à une question courte fait partie du travail bien fait.

---

## 6. Publier (la checklist)

Uniquement quand tu le demandes (« publie », « mets en ligne », « balance en main direct »).

1. **Relire le diff complet** : `git fetch` puis `git log origin/main..origin/preprod` et
   `git diff origin/main..origin/preprod`. *Jamais un `grep` sur les seules constantes qu'on
   s'attend à trouver* (règle née d'un oubli réel : une fonctionnalité entière avait été laissée de
   côté). Comparer avec `origin/main`, pas avec la branche `main` locale qui peut être très en
   retard.
2. **Numéro de version** : `VERSION_APP` (incrémenter le dernier chiffre : 1.2.6 → 1.2.7 ; le chiffre
   du milieu seulement si tu le demandes).
3. **Ligne en tête de l'historique des versions** (dans l'appli, visible au clic sur le numéro),
   rédigée pour l'utilisateur : ce qui change **à l'écran**. Compléter la liste des fonctionnalités
   si c'est durable.
   > ⚠️ Piège vécu : une apostrophe droite non échappée dans cette ligne (`d'accueil` dans une
   > chaîne JavaScript entre apostrophes) a **cassé toute la page**. Utiliser l'apostrophe
   > typographique (’) et **recharger la page pour vérifier** après toute modification.
4. **Régénérer `public/`** (`preparer-site.ps1`, le garde-fou doit passer).
5. **Tester le chargement** de la page en local (pas d'erreur console, la version s'affiche).
6. Commit sur `preprod`, `git pull --rebase`, `git push`.
7. **Fusion rapide** `preprod` → `main` (aucun commit direct sur `main`) :
   ```
   git switch main
   git pull --ff-only
   git merge --ff-only preprod
   git push
   git switch preprod
   ```
8. Vérifier que `main` et `preprod` pointent sur le même commit, puis regarder le site en ligne
   après le déploiement (Cloudflare peut mettre une à deux minutes).

---

## 7. Les règles d'or (celles qui ont coûté cher)

**Avant de coder**
- Une question est une question ; une validation porte sur ce qui a été montré, pas au-delà.
- Une idée dans « Idées à discuter » ne se code pas tant que tu n'as pas tranché.
- Avant de proposer quelque chose, vérifier la faisabilité (API accessible depuis le navigateur ?
  CORS ? limites ?) plutôt que de supposer.

**Pendant**
- **Ne jamais lire un gros fichier en entier.** `grep -n 'nomDeLaFonction' fichier`, puis lire la
  plage utile. Idem pour modifier : viser la fonction.
- **Vérifier qu'un nouveau nom de fonction n'existe pas déjà** : deux `function` du même nom dans un
  script, la dernière remplace l'autre **sans aucune erreur** (a cassé toute la recherche une fois).
- **Ne jamais modifier un fichier texte du projet via PowerShell** (`Get-Content | Set-Content`
  détruit l'encodage UTF-8). Passer par l'outil d'édition.
- Vérifier la fermeture des commentaires (`*/`) après toute insertion en CSS/JS.
- Ordre et spécificité CSS : à spécificité égale, la dernière règle gagne ; préférer un sélecteur
  plus spécifique à un déplacement de règle.
- Empilement (z-index) : dans un même conteneur, le dernier élément ajouté passe au-dessus ; les
  calques de la carte ont chacun leur « pane » avec un z-index choisi (les parcelles à 400, les
  couches thématiques à 405, le zonage à 390…).

**Après**
- **Un test d'API ne vaut jamais validation d'un affichage** : « la couche est attachée » n'est
  pas « la couche est visible ». Regarder l'écran (capture), pas seulement les données.
- **Tester en réel** quand c'est possible ; sinon **dire explicitement** que c'est simulé.
- Après toute retouche visuelle, **mesurer** plutôt qu'estimer à l'œil (alignements, tailles,
  opacités relevées sur les éléments).
- Tout chargement qui peut durer doit **se voir** (indicateur), tout échec **se dire à l'écran**,
  avec un bouton « Réessayer » quand ça a un sens.
- **Transparence** : annoncer l'usage de l'IA, assumer les limites, ne jamais inventer une valeur
  qui n'existe pas dans la source.

**Dépendances et données**
- Préférer **aucune dépendance externe** : pas de Google Fonts (une police se télécharge et
  s'héberge sur le site, avec sa licence), pas de service tiers sans décision explicite (RGPD).
- Tout ce qui demande un **backend** est mis de côté sauf exception décidée (ici : un seul relais).
- **Ne jamais créer de compte** (GitHub, Cloudflare, services en ligne…) à ta place, ni saisir des
  identifiants.

---

## 8. Tester en local

- **Serveur local** : `npx http-server . -p 8765 -c-1` (demande Node.js installé) ou, sans rien
  installer de plus, `python -m http.server 8765` dans le dossier du projet. Puis ouvrir
  `http://localhost:8765`.
- **Dans l'application Claude** : un fichier `.claude/launch.json` déclare le serveur et permet
  de l'ouvrir dans le navigateur intégré (aperçu en direct, captures, tests de clic, mesures, tailles
  d'écran simulées — ordinateur, tablette, téléphone).
- Claude peut **mesurer** dans la page (z-index, tailles, opacités, positions) et **comparer
  des captures** ; c'est ce qui permet de valider sans deviner.
- Une **session cloud** (Claude Code sur le web) n'a pas accès aux API externes : on y teste avec des
  réponses simulées, et on le **dit**.

---

## 9. Deux personnes, deux Claude (optionnel)

Sur KELZONE, deux personnes travaillent sur le même dépôt, chacune avec son Claude :
le propriétaire (seul à publier) et une seconde personne qui propose des améliorations.
- Tout le monde pousse sur `preprod` ; **seul le propriétaire publie sur `main`**.
- La seconde personne ajoute dans `JOURNAL.md` une entrée « NZ — … » par proposition, avec ce qui a
  été testé. Le propriétaire la voit sur la pré-prod et décide de la garder ou non (un changement non
  retenu se retire par `git revert`).
- Avant de publier, le propriétaire **relit le travail de l'autre en entier**.

Si ARCHIPILOT reste un projet à une seule personne, ignorer ce paragraphe.

---

## 10. Démarrer ARCHIPILOT — le plan

1. **Décider l'architecture de déploiement** (voir §3) : local seulement, ou hébergé ; avec ou sans
   serveur.
2. **Sortir le projet de Dropbox** (voir §2), puis créer le dépôt GitHub **privé** et les branches
   `main` / `preprod`.
3. **Écrire un `CLAUDE.md` court** (modèle ci-dessous). Il en existe déjà un dans
   `E:\Dropbox\ARCHIPILOT\CLAUDE.md` : demander à Claude de le **réorganiser** selon ce modèle plutôt
   que de repartir de zéro.
4. **Créer `JOURNAL.md`** avec une première entrée : l'état actuel de l'application.
5. **Décider d'un fichier de référence et d'un dossier généré** si l'appli est publiée sur le web.
6. **Premier test** : une petite modification sur `preprod`, vérifier qu'elle s'affiche, puis
   faire une publication à blanc pour roder la procédure du §6.

### Modèle de `CLAUDE.md` (squelette)

```markdown
# ARCHIPILOT — mémoire de travail

Chargé automatiquement à chaque session. Volontairement court. Tout l'historique est dans
JOURNAL.md (à consulter par section, jamais en entier).

## Économie de contexte
- Ne jamais lire un gros fichier en entier : `grep -n` puis lire la plage utile.
- Nouvelles entrées de journal dans JOURNAL.md, à la fin, pas ici.
- Côté utilisateur : /clear en changeant de sujet.

## Branches — à lire en PREMIER
Première commande de chaque session : `git branch --show-current` → on doit être sur `preprod`,
puis `git pull`.
- `preprod` : tout le travail. `main` : production, publiée seulement sur demande explicite.
- Jamais de commit direct sur `main`, jamais de `push --force`.
- Publication = version + ligne d'historique + dossier généré + fusion rapide preprod → main.

## État actuel (date, version)
- ce qui est fait, ce qui est testé en réel / en simulé, ce qui reste à vérifier.

## Chantiers ouverts / Idées à discuter (ne pas coder sans en reparler)

## Règles qui ne changent jamais
- Une question est une question, pas une demande de code.
- Une validation porte sur ce qui a été montré, pas au-delà.
- Ne jamais présenter un test simulé comme une validation réelle.
- Ne jamais manipuler les identifiants de l'utilisateur, ne jamais créer de compte.
- (… les pièges propres à ARCHIPILOT, ajoutés au fil de l'eau)

## Fichiers du dossier
## Sommaire du journal
```

### Premier message à donner à Claude pour ARCHIPILOT

> Lis `E:\Dropbox\ARCHIPILOT\METHODE-DE-TRAVAIL-KELZONE.md`. Je veux travailler sur ARCHIPILOT
> avec la même méthode que KELZONE : dépôt GitHub privé, branches `preprod` / `main`, `CLAUDE.md`
> court, `JOURNAL.md`, publication seulement sur ma demande. Commence par **me poser les questions
> d'architecture** (où tourne l'appli, avec ou sans serveur, hébergement), **sans rien modifier ni
> coder**. Ensuite propose-moi un plan de mise en place en étapes, et on avance une étape à la fois.

---

## 11. Résumé en tableau

| Sujet | Ce qu'on fait sur KELZONE |
|---|---|
| Synchronisation | GitHub (dépôt privé), jamais Dropbox |
| Branches | `preprod` (travail + pré-prod), `main` (production) |
| Publication | Sur demande explicite ; version + historique + `public/` + fusion rapide |
| Hébergement | Cloudflare Workers (assets statiques), builds des branches hors production activés |
| Mémoire de Claude | `CLAUDE.md` (court, état + règles) + `JOURNAL.md` (historique) |
| Questions vs code | Une question appelle une réponse, pas du code |
| Tests | Local (serveur + aperçu Claude) ; réel vs simulé toujours dit |
| Dépendances externes | Aucune par défaut (polices hébergées, pas de Google Fonts) |
| Budget | `/clear` quand on change de sujet ; ne jamais lire un gros fichier en entier |
