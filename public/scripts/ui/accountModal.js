// accountModal.js — « Mon compte » (mode hébergé) : exporter une sauvegarde, importer des
// données (ex. l'ancien fichier archipilot-data.json), se déconnecter.

import { el } from '../utils/dom.js';
import { icone } from '../../charte-icones.js';
import { getProjects, getTasks } from '../state.js';

function donneesValides(d) {
  return (
    d &&
    Array.isArray(d.projects) &&
    Array.isArray(d.tasks) &&
    d.projects.every((p) => p && typeof p.id === 'string' && typeof p.name === 'string') &&
    d.tasks.every((t) => t && typeof t.id === 'string' && typeof t.projectId === 'string' && typeof t.title === 'string')
  );
}

function dateDuJour() {
  const d = new Date();
  const deux = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
}

export function openAccountModal({ identifiant, onImporter, onDeconnecter }) {
  const racine = document.getElementById('modal-root');

  const fermer = () => {
    racine.innerHTML = '';
    document.removeEventListener('keydown', surEchap);
  };
  function surEchap(e) {
    if (e.key === 'Escape') fermer();
  }

  const statut = el('p', { className: 'appearance-hint', role: 'status' });

  function exporter() {
    const donnees = { projects: getProjects(), tasks: getTasks() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(donnees, null, 2)], { type: 'application/json' }));
    const lien = el('a', { href: url, download: `archipilot-sauvegarde-${dateDuJour()}.json` });
    document.body.append(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    statut.textContent = 'Sauvegarde téléchargée. Ce fichier n’est pas chiffré : rangez-le en lieu sûr.';
  }

  const champFichier = el('input', {
    type: 'file',
    accept: '.json,application/json',
    id: 'champ-import-donnees',
    hidden: true,
    onChange: async (e) => {
      const fichier = e.target.files[0];
      e.target.value = '';
      if (!fichier) return;
      let donnees;
      try {
        donnees = JSON.parse(await fichier.text());
      } catch {
        statut.textContent = 'Ce fichier n’est pas un fichier JSON valide.';
        return;
      }
      if (!donneesValides(donnees)) {
        statut.textContent = 'Ce fichier ne contient pas de données ARCHIPILOT (projets et tâches).';
        return;
      }
      const ok = window.confirm(
        `Remplacer toutes les données de votre compte par celles de « ${fichier.name} » ` +
          `(${donnees.projects.length} projets, ${donnees.tasks.length} tâches) ?\n\n` +
          'Les données actuelles du compte seront écrasées. Exportez une sauvegarde avant si besoin.'
      );
      if (!ok) return;
      statut.textContent = 'Import et chiffrement en cours…';
      try {
        await onImporter({ projects: donnees.projects, tasks: donnees.tasks });
        statut.textContent = `Import terminé : ${donnees.projects.length} projets, ${donnees.tasks.length} tâches.`;
      } catch (err) {
        statut.textContent = err.message;
      }
    },
  });

  const overlay = el('div', { className: 'modal-overlay' });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fermer();
  });

  const modal = el('div', { className: 'modal modal--appearance' }, [
    el('div', { className: 'modal-header' }, [
      el('h2', {}, 'Mon compte'),
      el('button', { type: 'button', className: 'btn-icone', title: 'Fermer', 'aria-label': 'Fermer', onClick: fermer }, icone('fermer')),
    ]),
    el('div', { className: 'modal-body' }, [
      el('div', { className: 'appearance-section' }, [
        el('span', { className: 'form-field__label' }, 'Identifiant'),
        el('p', { className: 'compte-identifiant' }, identifiant),
      ]),
      el('div', { className: 'appearance-section' }, [
        el('span', { className: 'form-field__label' }, 'Sauvegarde'),
        el('div', { className: 'appearance-row' }, [
          el('button', { type: 'button', className: 'btn btn-secondary btn-small', onClick: exporter }, [
            icone('telecharger', { taille: 15, classe: 'btn__icon' }),
            'Exporter mes données',
          ]),
          el('label', { className: 'btn btn-secondary btn-small', for: 'champ-import-donnees' }, [
            icone('importer', { taille: 15, classe: 'btn__icon' }),
            'Importer un fichier',
          ]),
          champFichier,
        ]),
        el(
          'p',
          { className: 'appearance-hint' },
          'Exportez régulièrement : sans votre mot de passe, les données chiffrées sont irrécupérables. ' +
            'L’import remplace tout le contenu du compte (utile pour reprendre un ancien fichier archipilot-data.json).'
        ),
        statut,
      ]),
      el('div', { className: 'appearance-row' }, [
        el('button', { type: 'button', className: 'btn btn-ghost btn-small', onClick: onDeconnecter }, [
          icone('deconnexion', { taille: 15, classe: 'btn__icon' }),
          'Se déconnecter',
        ]),
      ]),
    ]),
  ]);

  overlay.append(modal);
  racine.append(overlay);
  document.addEventListener('keydown', surEchap);
}
