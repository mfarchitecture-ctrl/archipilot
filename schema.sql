-- Base D1 d'ARCHIPILOT hébergé. Le serveur ne stocke que du texte chiffré (enveloppe) :
-- il ne peut pas lire les projets ni les tâches. À exécuter une fois sur la base D1
-- (onglet Console de la base dans Cloudflare, ou `wrangler d1 execute`).

CREATE TABLE IF NOT EXISTS utilisateurs (
  identifiant TEXT PRIMARY KEY,   -- en minuscules
  hash_jeton TEXT NOT NULL,       -- SHA-256 du jeton d'accès (jamais le mot de passe)
  cree_le INTEGER NOT NULL        -- secondes depuis 1970
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY,       -- SHA-256 de l'identifiant de session (le cookie)
  identifiant TEXT NOT NULL,
  expire_le INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expire ON sessions (expire_le);

CREATE TABLE IF NOT EXISTS donnees (
  identifiant TEXT PRIMARY KEY,
  enveloppe TEXT NOT NULL,        -- JSON { v, iv, donnees } chiffré dans le navigateur
  version INTEGER NOT NULL,       -- incrémentée à chaque écriture (évite d'écraser un autre appareil)
  maj_le INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tentatives (
  cle TEXT PRIMARY KEY,           -- « connexion:<identifiant> » ou « inscription »
  nombre INTEGER NOT NULL,
  debut INTEGER NOT NULL
);
