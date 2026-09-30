// print.js — prépare une vue imprimable des tâches actuellement filtrées
// et déclenche l'impression. Le contenu est injecté dans #print-root, que
// print.css affiche uniquement en contexte d'impression (le reste de l'app
// est masqué via @media print).

import { getFilteredSortedTasks, getProjectById } from '../state.js';
import { el, clear } from '../utils/dom.js';
import { formatDate, formatDaysRemaining } from '../utils/dates.js';

function capitaliser(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export function preparerImpression(nomApp = 'ARCHIPILOT') {
  const racine = document.getElementById('print-root');
  clear(racine);

  const taches = getFilteredSortedTasks();

  const entetes = ['Projet', 'Tâche', 'Priorité', 'Statut', 'Échéance', 'Jours restants', 'Notes'];
  const table = el('table', { className: 'print-table' }, [
    el('thead', {}, el('tr', {}, entetes.map((h) => el('th', {}, h)))),
    el(
      'tbody',
      {},
      taches.map((task) => {
        const projet = getProjectById(task.projectId);
        return el('tr', {}, [
          el('td', {}, projet ? projet.name : '—'),
          el('td', {}, task.title),
          el('td', {}, capitaliser(task.priority)),
          el('td', {}, capitaliser(task.status)),
          el('td', {}, formatDate(task.dueDate)),
          el('td', {}, formatDaysRemaining(task.dueDate)),
          el('td', {}, task.notes || ''),
        ]);
      })
    ),
  ]);

  racine.append(
    el('h1', {}, `${nomApp} — Suivi des tâches`),
    el('p', { className: 'print-meta' }, `Généré le ${new Date().toLocaleString('fr-FR')} — ${taches.length} tâche(s)`),
    table
  );

  window.print();
}
