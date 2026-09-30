// loginScreen.js — écran de connexion / création de compte (mode hébergé).
// Le mot de passe ne quitte jamais le navigateur : compte.js en dérive la clé de chiffrement
// et le jeton d'accès (voir utils/crypto-donnees.js).

import * as compte from '../compte.js';

const LONGUEUR_MIN_MDP = 12;
const IDENTIFIANT_VALIDE = /^[a-z0-9._-]{3,64}$/;
const MESSAGE_CONNEXION = 'Connectez-vous pour retrouver vos projets.';
const MESSAGE_CREATION =
  'Créez votre compte. Choisissez un mot de passe long (12 caractères minimum) : il sert aussi de clé pour chiffrer vos données.';

/**
 * Affiche l'écran de connexion. `onConnecte` est appelée une fois la connexion réussie
 * (la clé de chiffrement est alors disponible dans compte.js).
 */
export function afficherConnexion({ identifiant = '', message = '', avecCode = false, onConnecte }) {
  const $ = (id) => document.getElementById(id);
  const ecran = $('login-screen');
  const form = $('login-form');
  const champId = $('login-identifiant');
  const champMdp = $('login-mdp');
  const champMdp2 = $('login-mdp2');
  const champCode = $('login-code');
  const blocConfirmation = $('login-champ-confirmation');
  const blocCode = $('login-champ-code');
  const rester = $('login-rester');
  const erreur = $('login-erreur');
  const valider = $('login-valider');
  const bascule = $('login-bascule');
  const texte = $('login-message');

  let modeCreation = false;

  function montrerErreur(msg) {
    erreur.textContent = msg;
    erreur.hidden = !msg;
  }

  function majMode() {
    blocConfirmation.hidden = !modeCreation;
    blocCode.hidden = !modeCreation || !avecCode;
    champMdp.autocomplete = modeCreation ? 'new-password' : 'current-password';
    valider.textContent = modeCreation ? 'Créer mon compte' : 'Se connecter';
    bascule.textContent = modeCreation ? "J'ai déjà un compte" : 'Créer un compte';
    texte.textContent = modeCreation ? MESSAGE_CREATION : message || MESSAGE_CONNEXION;
    montrerErreur('');
  }

  function verifier() {
    const id = champId.value.trim().toLowerCase();
    if (!IDENTIFIANT_VALIDE.test(id)) {
      return 'Identifiant : 3 à 64 caractères (lettres sans accent, chiffres, point, tiret).';
    }
    if (!champMdp.value) return 'Saisissez votre mot de passe.';
    if (modeCreation) {
      if (champMdp.value.length < LONGUEUR_MIN_MDP) return `Le mot de passe doit faire au moins ${LONGUEUR_MIN_MDP} caractères.`;
      if (champMdp.value !== champMdp2.value) return 'Les deux mots de passe ne correspondent pas.';
      if (avecCode && !champCode.value.trim()) return "Saisissez le code d'invitation.";
    }
    return '';
  }

  bascule.onclick = () => {
    modeCreation = !modeCreation;
    majMode();
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const probleme = verifier();
    if (probleme) {
      montrerErreur(probleme);
      return;
    }
    montrerErreur('');
    valider.disabled = true;
    bascule.disabled = true;
    valider.textContent = modeCreation ? 'Création du compte…' : 'Connexion…';
    try {
      if (modeCreation) {
        await compte.creerCompte(champId.value, champMdp.value, champCode.value.trim(), rester.checked);
      } else {
        await compte.seConnecter(champId.value, champMdp.value, rester.checked);
      }
      champMdp.value = '';
      champMdp2.value = '';
      champCode.value = '';
      ecran.hidden = true;
      await onConnecte();
    } catch (err) {
      montrerErreur(err.message);
    } finally {
      valider.disabled = false;
      bascule.disabled = false;
      valider.textContent = modeCreation ? 'Créer mon compte' : 'Se connecter';
    }
  };

  document.getElementById('app').hidden = true;
  document.getElementById('connect-screen').hidden = true;
  ecran.hidden = false;
  champId.value = identifiant;
  modeCreation = false;
  majMode();
  (identifiant ? champMdp : champId).focus();
}
