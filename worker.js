// worker.js — API d'ARCHIPILOT hébergé (Cloudflare Worker + base D1 « DB »).
//
// Les fichiers de public/ sont servis directement par Cloudflare (assets) ; ce Worker ne répond
// qu'aux adresses /api/*. Il ne voit jamais les données en clair : le navigateur chiffre tout
// avant l'envoi (voir public/scripts/utils/crypto-donnees.js) et ne transmet, pour se connecter,
// qu'un « jeton d'accès » dérivé du mot de passe, dont la base ne garde que le hachage.
//
// Variables d'environnement :
//   DB               base D1 (tables : schema.sql)
//   CODE_INVITATION  secret facultatif : s'il est défini, il est exigé pour créer un compte ;
//                    absent = inscription libre (choix du 2026-10-01, ~5 utilisateurs prévus)

const DUREE_SESSION_S = 30 * 24 * 3600;
const MAX_TENTATIVES = 10;
const FENETRE_TENTATIVES_S = 15 * 60;
const TAILLE_MAX_OCTETS = 5 * 1024 * 1024;
const NOM_COOKIE = 'archipilot_session';
const IDENTIFIANT_VALIDE = /^[a-z0-9._-]{2,64}$/;
const JETON_VALIDE = /^[A-Za-z0-9_-]{43}$/;

export default {
  async fetch(requete, env) {
    const url = new URL(requete.url);
    if (!url.pathname.startsWith('/api/')) {
      return env.ASSETS ? env.ASSETS.fetch(requete) : new Response('Introuvable', { status: 404 });
    }
    try {
      return await router(requete, env, url);
    } catch (e) {
      console.error(e);
      return json({ erreur: 'Erreur interne du serveur.' }, 500);
    }
  },
};

async function router(requete, env, url) {
  const route = requete.method + ' ' + url.pathname;

  // Les requêtes qui modifient quelque chose doivent venir de l'appli elle-même.
  if (requete.method !== 'GET' && !origineAutorisee(requete, url)) {
    return json({ erreur: 'Origine refusée.' }, 403);
  }

  switch (route) {
    case 'GET /api/config':
      return json({ mode: 'compte', codeInvitation: Boolean(env.CODE_INVITATION) });
    case 'POST /api/inscription':
      return inscription(requete, env);
    case 'POST /api/connexion':
      return connexion(requete, env);
    case 'POST /api/deconnexion':
      return deconnexion(requete, env);
    case 'GET /api/session': {
      const identifiant = await utilisateurConnecte(requete, env);
      return identifiant ? json({ identifiant }) : json({ erreur: 'Non connecté.' }, 401);
    }
    case 'GET /api/donnees':
      return lireDonnees(requete, env);
    case 'PUT /api/donnees':
      return ecrireDonnees(requete, env);
    default:
      return json({ erreur: 'Adresse inconnue.' }, 404);
  }
}

// --- Comptes -----------------------------------------------------------------------------

async function inscription(requete, env) {
  const corps = await lireCorps(requete);
  if (!corps) return json({ erreur: 'Requête invalide.' }, 400);

  const identifiant = normaliserIdentifiant(corps.identifiant);
  if (!IDENTIFIANT_VALIDE.test(identifiant)) {
    return json({ erreur: 'Identifiant invalide : 2 à 64 caractères, lettres, chiffres, point, tiret.' }, 400);
  }
  if (typeof corps.jeton !== 'string' || !JETON_VALIDE.test(corps.jeton)) return json({ erreur: 'Requête invalide.' }, 400);

  if (env.CODE_INVITATION) {
    const limite = await verifierLimite(env, 'inscription');
    if (limite) return limite;
    const codeOk = egaliteConstante(await sha256(String(corps.code || '')), await sha256(env.CODE_INVITATION));
    if (!codeOk) {
      await noterEchec(env, 'inscription');
      return json({ erreur: "Code d'invitation incorrect." }, 403);
    }
  }

  const existe = await env.DB.prepare('SELECT 1 AS x FROM utilisateurs WHERE identifiant = ?').bind(identifiant).first();
  if (existe) return json({ erreur: 'Cet identifiant est déjà utilisé.' }, 409);

  await env.DB.prepare('INSERT INTO utilisateurs (identifiant, hash_jeton, cree_le) VALUES (?, ?, ?)')
    .bind(identifiant, await sha256(corps.jeton), maintenant())
    .run();
  return ouvrirSession(env, identifiant, 201);
}

async function connexion(requete, env) {
  const corps = await lireCorps(requete);
  if (!corps) return json({ erreur: 'Requête invalide.' }, 400);
  const identifiant = normaliserIdentifiant(corps.identifiant);
  const jeton = typeof corps.jeton === 'string' ? corps.jeton : '';
  const cle = 'connexion:' + identifiant;

  const limite = await verifierLimite(env, cle);
  if (limite) return limite;

  const utilisateur = IDENTIFIANT_VALIDE.test(identifiant)
    ? await env.DB.prepare('SELECT hash_jeton FROM utilisateurs WHERE identifiant = ?').bind(identifiant).first()
    : null;
  // On compare toujours (même sans compte) pour que la durée ne révèle pas si l'identifiant existe.
  const attendu = utilisateur ? utilisateur.hash_jeton : await sha256('aucun-compte');
  const ok = egaliteConstante(await sha256(jeton), attendu) && utilisateur !== null && JETON_VALIDE.test(jeton);

  if (!ok) {
    await noterEchec(env, cle);
    return json({ erreur: 'Identifiant ou mot de passe incorrect.' }, 401);
  }
  await env.DB.prepare('DELETE FROM tentatives WHERE cle = ?').bind(cle).run();
  return ouvrirSession(env, identifiant, 200);
}

async function deconnexion(requete, env) {
  const id = lireCookie(requete, NOM_COOKIE);
  if (id) await env.DB.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(await sha256(id)).run();
  return json({ ok: true }, 200, { 'Set-Cookie': cookieSession('', 0) });
}

async function ouvrirSession(env, identifiant, statut) {
  const id = aleatoireHex(32);
  const t = maintenant();
  await env.DB.prepare('DELETE FROM sessions WHERE expire_le < ?').bind(t).run();
  await env.DB.prepare('INSERT INTO sessions (id_hash, identifiant, expire_le) VALUES (?, ?, ?)')
    .bind(await sha256(id), identifiant, t + DUREE_SESSION_S)
    .run();
  return json({ identifiant }, statut, { 'Set-Cookie': cookieSession(id, DUREE_SESSION_S) });
}

async function utilisateurConnecte(requete, env) {
  const id = lireCookie(requete, NOM_COOKIE);
  if (!id) return null;
  const ligne = await env.DB.prepare('SELECT identifiant FROM sessions WHERE id_hash = ? AND expire_le > ?')
    .bind(await sha256(id), maintenant())
    .first();
  return ligne ? ligne.identifiant : null;
}

// --- Données (toujours chiffrées) ----------------------------------------------------------

async function lireDonnees(requete, env) {
  const identifiant = await utilisateurConnecte(requete, env);
  if (!identifiant) return json({ erreur: 'Non connecté.' }, 401);
  const ligne = await env.DB.prepare('SELECT enveloppe, version FROM donnees WHERE identifiant = ?').bind(identifiant).first();
  if (!ligne) return json({ enveloppe: null, version: 0 });
  return json({ enveloppe: JSON.parse(ligne.enveloppe), version: ligne.version });
}

async function ecrireDonnees(requete, env) {
  const identifiant = await utilisateurConnecte(requete, env);
  if (!identifiant) return json({ erreur: 'Non connecté.' }, 401);
  const corps = await lireCorps(requete);
  if (!corps) return json({ erreur: 'Requête invalide ou trop volumineuse.' }, 400);

  const e = corps.enveloppe;
  const enveloppeValide = e && e.v === 1 && typeof e.iv === 'string' && typeof e.donnees === 'string';
  if (!enveloppeValide || !Number.isInteger(corps.versionAttendue)) return json({ erreur: 'Requête invalide.' }, 400);

  const texte = JSON.stringify({ v: e.v, iv: e.iv, donnees: e.donnees });
  const t = maintenant();
  const nouvelle = corps.versionAttendue + 1;
  // Écriture conditionnelle : si un autre appareil a enregistré entre-temps, on refuse (409)
  // plutôt que d'écraser son travail.
  const resultat = corps.versionAttendue === 0
    ? await env.DB.prepare('INSERT OR IGNORE INTO donnees (identifiant, enveloppe, version, maj_le) VALUES (?, ?, 1, ?)')
        .bind(identifiant, texte, t).run()
    : await env.DB.prepare('UPDATE donnees SET enveloppe = ?, version = ?, maj_le = ? WHERE identifiant = ? AND version = ?')
        .bind(texte, nouvelle, t, identifiant, corps.versionAttendue).run();

  if (!resultat.meta || resultat.meta.changes !== 1) {
    const actuelle = await env.DB.prepare('SELECT version FROM donnees WHERE identifiant = ?').bind(identifiant).first();
    return json({ erreur: 'Les données ont été modifiées depuis un autre appareil.', version: actuelle ? actuelle.version : 0 }, 409);
  }
  return json({ version: nouvelle });
}

// --- Limitation des essais ---------------------------------------------------------------

async function verifierLimite(env, cle) {
  const ligne = await env.DB.prepare('SELECT nombre, debut FROM tentatives WHERE cle = ?').bind(cle).first();
  if (ligne && ligne.debut + FENETRE_TENTATIVES_S > maintenant() && ligne.nombre >= MAX_TENTATIVES) {
    return json({ erreur: 'Trop de tentatives. Réessayez dans quelques minutes.' }, 429);
  }
  return null;
}

async function noterEchec(env, cle) {
  const t = maintenant();
  const ligne = await env.DB.prepare('SELECT nombre, debut FROM tentatives WHERE cle = ?').bind(cle).first();
  if (!ligne || ligne.debut + FENETRE_TENTATIVES_S <= t) {
    await env.DB.prepare('INSERT OR REPLACE INTO tentatives (cle, nombre, debut) VALUES (?, 1, ?)').bind(cle, t).run();
  } else {
    await env.DB.prepare('UPDATE tentatives SET nombre = nombre + 1 WHERE cle = ?').bind(cle).run();
  }
}

// --- Utilitaires ---------------------------------------------------------------------------

function json(objet, statut = 200, entetes = {}) {
  return new Response(JSON.stringify(objet), {
    status: statut,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      ...entetes,
    },
  });
}

async function lireCorps(requete) {
  const annonce = Number(requete.headers.get('Content-Length') || 0);
  if (annonce > TAILLE_MAX_OCTETS) return null;
  const texte = await requete.text();
  if (texte.length > TAILLE_MAX_OCTETS) return null;
  try {
    const objet = JSON.parse(texte);
    return objet && typeof objet === 'object' ? objet : null;
  } catch {
    return null;
  }
}

function origineAutorisee(requete, url) {
  const origine = requete.headers.get('Origin');
  return !origine || origine === url.origin;
}

function normaliserIdentifiant(valeur) {
  return typeof valeur === 'string' ? valeur.trim().toLowerCase() : '';
}

function maintenant() {
  return Math.floor(Date.now() / 1000);
}

function aleatoireHex(octets) {
  return [...crypto.getRandomValues(new Uint8Array(octets))].map((o) => o.toString(16).padStart(2, '0')).join('');
}

async function sha256(texte) {
  const empreinte = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texte));
  return [...new Uint8Array(empreinte)].map((o) => o.toString(16).padStart(2, '0')).join('');
}

function egaliteConstante(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

function lireCookie(requete, nom) {
  const entete = requete.headers.get('Cookie') || '';
  for (const morceau of entete.split(';')) {
    const [cle, ...reste] = morceau.trim().split('=');
    if (cle === nom) return reste.join('=');
  }
  return null;
}

function cookieSession(valeur, dureeS) {
  return NOM_COOKIE + '=' + valeur + '; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=' + dureeS;
}
