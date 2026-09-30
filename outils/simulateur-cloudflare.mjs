// simulateur-cloudflare.mjs — fait tourner worker.js en local, comme sur Cloudflare, pour tester.
// Outil de développement uniquement (ce n'est pas un mode d'utilisation de l'appli).
//
//   node outils/simulateur-cloudflare.mjs          → http://localhost:8787
//
// - Les fichiers de public/ sont servis comme les « assets » de Cloudflare.
// - La base D1 est simulée par SQLite (intégré à Node 24), fichier .dev/archipilot-local.sqlite.
// - Comme en production : pas de CODE_INVITATION (inscription libre), sauf si la variable
//   d'environnement CODE_INVITATION est définie avant le lancement.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker.js';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RACINE, 'public');
const PORT = Number(process.env.PORT || 8787);

fs.mkdirSync(path.join(RACINE, '.dev'), { recursive: true });
const base = new DatabaseSync(path.join(RACINE, '.dev', 'archipilot-local.sqlite'));
base.exec(fs.readFileSync(path.join(RACINE, 'schema.sql'), 'utf8'));

// Sous-ensemble de l'API D1 utilisé par worker.js : prepare().bind().first()/all()/run().
const D1 = {
  prepare(sql) {
    const instruction = base.prepare(sql);
    let valeurs = [];
    const lien = {
      bind(...v) { valeurs = v; return lien; },
      async first() { const ligne = instruction.get(...valeurs); return ligne ? { ...ligne } : null; },
      async all() { return { results: instruction.all(...valeurs).map((l) => ({ ...l })) }; },
      async run() { const r = instruction.run(...valeurs); return { success: true, meta: { changes: Number(r.changes) } }; },
    };
    return lien;
  },
};

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png',
};

// En-têtes de public/_headers (bloc « /* » uniquement), appliqués comme le fait Cloudflare.
function lireEntetesGlobaux() {
  const fichier = path.join(PUBLIC, '_headers');
  if (!fs.existsSync(fichier)) return {};
  const entetes = {};
  let dansBlocGlobal = false;
  for (const ligne of fs.readFileSync(fichier, 'utf8').split(/\r?\n/)) {
    if (!ligne.trim() || ligne.trim().startsWith('#')) continue;
    if (!/^\s/.test(ligne)) {
      dansBlocGlobal = ligne.trim() === '/*';
      continue;
    }
    if (dansBlocGlobal) {
      const i = ligne.indexOf(':');
      entetes[ligne.slice(0, i).trim()] = ligne.slice(i + 1).trim();
    }
  }
  return entetes;
}

const ASSETS = {
  async fetch(requete) {
    let chemin = decodeURIComponent(new URL(requete.url).pathname);
    if (chemin.endsWith('/')) chemin += 'index.html';
    const fichier = path.join(PUBLIC, chemin);
    const interdit = path.basename(fichier) === '_headers';
    if (interdit || !fichier.startsWith(PUBLIC) || !fs.existsSync(fichier) || fs.statSync(fichier).isDirectory()) {
      return new Response('Introuvable', { status: 404 });
    }
    return new Response(fs.readFileSync(fichier), {
      headers: {
        ...lireEntetesGlobaux(),
        'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream',
        'Cache-Control': 'no-store',
      },
    });
  },
};

const env = { DB: D1, ASSETS, CODE_INVITATION: process.env.CODE_INVITATION || undefined };

http.createServer(async (req, res) => {
  try {
    const avecCorps = req.method !== 'GET' && req.method !== 'HEAD';
    const requete = new Request('http://' + (req.headers.host || 'localhost:' + PORT) + req.url, {
      method: req.method,
      headers: req.headers,
      body: avecCorps ? req : undefined,
      duplex: avecCorps ? 'half' : undefined,
    });
    const reponse = await worker.fetch(requete, env);
    const entetes = {};
    reponse.headers.forEach((valeur, cle) => { if (cle !== 'set-cookie') entetes[cle] = valeur; });
    const cookies = reponse.headers.getSetCookie();
    if (cookies.length) entetes['set-cookie'] = cookies;
    res.writeHead(reponse.status, entetes);
    res.end(Buffer.from(await reponse.arrayBuffer()));
  } catch (e) {
    console.error(e);
    res.writeHead(500);
    res.end('Erreur du simulateur');
  }
}).listen(PORT, '127.0.0.1', () => console.log('Simulateur Cloudflare : http://localhost:' + PORT));
