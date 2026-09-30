// taskList.js — vue "Vue d'ensemble des tâches" : compteurs de synthèse
// cliquables (filtrent directement la liste ci-dessous), puis filtres et
// tableau des tâches, avec ajout, modification et suppression directement
// depuis cette vue (en plus de la modal dédiée d'un projet, onglet Projets).

import {
  PRIORITES,
  STATUTS,
  getFilters,
  setFilters,
  resetFilters,
  getFilteredSortedTasks,
  getDashboardCounts,
  getProjects,
  getProjectById,
  updateTask,
  deleteTask,
} from '../state.js';
import { el, clear } from '../utils/dom.js';
import { icone } from '../../charte-icones.js';
import { formatDate, formatDaysRemaining, isOverdue, isDueSoon } from '../utils/dates.js';
import { capitaliser, slugStatut } from '../utils/labels.js';
import { openTaskForm } from './taskForm.js';

// Id de la tâche dont le statut est en cours d'édition inline (clic sur le
// badge, voir renderCelluleStatut) ; module-level pour survivre aux
// re-rendus déclenchés par les autres mutations d'état pendant l'édition.
let statutEnEditionId = null;

export function renderTaskList(container) {
  clear(container);
  container.append(renderCompteurs());
  container.append(renderBarreFiltres());

  const taches = getFilteredSortedTasks();
  if (taches.length === 0) {
    container.append(el('p', { className: 'empty-state' }, 'Aucune tâche ne correspond aux filtres actuels.'));
    return;
  }

  const filtres = getFilters();
  const rerender = () => renderTaskList(container);
  let champStatutEnEdition = null;
  const table = el('table', { className: 'task-table' }, [
    el(
      'thead',
      {},
      el('tr', {}, [
        el('th', {}, 'Projet'),
        el('th', {}, 'Tâche'),
        enteteTriable('Priorité', 'priority', filtres),
        enteteTriable('Statut', 'status', filtres),
        enteteTriable('Échéance', 'dueDate', filtres),
        enteteTriable('Jours restants', 'daysRemaining', filtres),
        el('th', {}, 'Notes'),
        el('th', {}, ''),
      ])
    ),
    el(
      'tbody',
      {},
      taches.map((task) => {
        const { ligne, champStatut } = renderLigne(task, rerender);
        if (champStatut) champStatutEnEdition = champStatut;
        return ligne;
      })
    ),
  ]);
  container.append(table);
  if (champStatutEnEdition) champStatutEnEdition.focus();
}

/** Compteurs de synthèse (toutes tâches ouvertes confondues, indépendants
 * des filtres actifs) : cliquer applique directement le filtre correspondant. */
function renderCompteurs() {
  const compteurs = getDashboardCounts();
  return el('div', { className: 'dashboard-grid' }, [
    carteCompteur({ valeur: compteurs.open, label: 'Tâches ouvertes', couleur: 'accent', filtre: {} }),
    carteCompteur({ valeur: compteurs.overdue, label: 'En retard', couleur: 'danger', filtre: { overdueOnly: true } }),
    carteCompteur({ valeur: compteurs.highPriority, label: 'Priorité haute', couleur: 'warning', filtre: { priority: 'haute' } }),
    carteCompteur({ valeur: compteurs.blocked, label: 'Bloquées', couleur: 'blocked', filtre: { status: 'bloqué' } }),
  ]);
}

function carteCompteur({ valeur, label, couleur, filtre }) {
  return el(
    'div',
    {
      className: `dashboard-card dashboard-card--${couleur}`,
      tabindex: '0',
      role: 'button',
      onClick: () => resetFilters(filtre),
      onKeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          resetFilters(filtre);
        }
      },
    },
    [
      el('span', { className: 'dashboard-card__value' }, String(valeur)),
      el('span', { className: 'dashboard-card__label' }, label),
    ]
  );
}

/** Bascule le tri explicite de la vue Suivi : même colonne -> inverse le
 * sens, colonne différente -> nouvelle colonne en ordre croissant. */
function basculerTri(colonne) {
  const filtres = getFilters();
  if (filtres.sortBy === colonne) {
    setFilters({ sortDir: filtres.sortDir === 'asc' ? 'desc' : 'asc' });
  } else {
    setFilters({ sortBy: colonne, sortDir: 'asc' });
  }
}

/** Paire de flèches ▲▼ toujours visible (signale que la colonne est
 * triable) ; la flèche correspondant au tri actif est mise en accent. */
function iconeTri(actif, direction) {
  return el('span', { className: 'th-sort-icon' }, [
    el(
      'span',
      { className: actif && direction === 'asc' ? 'th-sort-icon__arrow th-sort-icon__arrow--active' : 'th-sort-icon__arrow' },
      '▲'
    ),
    el(
      'span',
      { className: actif && direction === 'desc' ? 'th-sort-icon__arrow th-sort-icon__arrow--active' : 'th-sort-icon__arrow' },
      '▼'
    ),
  ]);
}

/** En-tête de colonne cliquable pour trier (flèches toujours visibles). */
function enteteTriable(label, colonne, filtres) {
  const actif = filtres.sortBy === colonne;
  return el(
    'th',
    {},
    el(
      'button',
      {
        type: 'button',
        className: actif ? 'th-sort-button th-sort-button--active' : 'th-sort-button',
        title: `Trier par ${label.toLowerCase()}`,
        onClick: () => basculerTri(colonne),
      },
      [label, iconeTri(actif, filtres.sortDir)]
    )
  );
}

function renderBarreFiltres() {
  const filtres = getFilters();
  const projets = getProjects();

  const champRecherche = el('input', {
    id: 'filtre-recherche',
    type: 'search',
    className: 'input input--search',
    placeholder: 'Rechercher une tâche, un projet, une note…',
    value: filtres.search,
    onInput: (e) => setFilters({ search: e.target.value }),
  });

  const selectProjet = el(
    'select',
    { className: 'input', onChange: (e) => setFilters({ projectId: e.target.value }) },
    [
      el('option', { value: '', selected: filtres.projectId === '' }, 'Tous les projets'),
      ...projets.map((p) => el('option', { value: p.id, selected: p.id === filtres.projectId }, p.name)),
    ]
  );

  const selectPriorite = el(
    'select',
    { className: 'input', onChange: (e) => setFilters({ priority: e.target.value }) },
    [
      el('option', { value: '', selected: filtres.priority === '' }, 'Toutes priorités'),
      ...PRIORITES.map((p) => el('option', { value: p, selected: p === filtres.priority }, capitaliser(p))),
    ]
  );

  const selectStatut = el(
    'select',
    { className: 'input', onChange: (e) => setFilters({ status: e.target.value }) },
    [
      el('option', { value: '', selected: filtres.status === '' }, 'Tous statuts'),
      // "terminé" est déjà géré par la case "Afficher les tâches terminées" ci-dessous.
      ...STATUTS.filter((s) => s !== 'terminé').map((s) =>
        el('option', { value: s, selected: s === filtres.status }, capitaliser(s))
      ),
    ]
  );

  const caseTerminees = el('label', { className: 'checkbox-label' }, [
    el('input', {
      type: 'checkbox',
      checked: filtres.showDone,
      onChange: (e) => setFilters({ showDone: e.target.checked }),
    }),
    ' Afficher les tâches terminées',
  ]);

  const boutonReinitialiser = el(
    'button',
    {
      type: 'button',
      className: 'btn btn-secondary',
      onClick: () => resetFilters(),
    },
    'Réinitialiser les filtres'
  );

  const boutonNouvelleTache = el(
    'button',
    {
      type: 'button',
      className: 'btn btn-primary',
      disabled: projets.length === 0,
      title: projets.length === 0 ? 'Créez d\'abord un projet (onglet Projets)' : undefined,
      onClick: () => openTaskForm({}),
    },
    '+ Nouvelle tâche'
  );

  return el('div', { className: 'filters-bar no-print' }, [
    champRecherche,
    selectProjet,
    selectPriorite,
    selectStatut,
    caseTerminees,
    boutonReinitialiser,
    boutonNouvelleTache,
  ]);
}

/** Retourne { ligne, champStatut } : `champStatut` est le <select> à focus
 * si cette ligne est celle en cours d'édition de statut, sinon null. */
function renderLigne(task, rerender) {
  const projet = getProjectById(task.projectId);
  const classes = ['task-row'];
  if (isOverdue(task)) classes.push('task-row--overdue');
  else if (isDueSoon(task)) classes.push('task-row--soon');

  const { cellule: celluleStatut, champStatut } = renderCelluleStatut(task, rerender);

  const ligne = el('tr', { className: classes.join(' ') }, [
    el('td', {}, projet ? projet.name : '—'),
    el('td', { className: 'task-title-cell' }, task.title),
    el('td', {}, el('span', { className: `badge badge--priority-${task.priority}` }, capitaliser(task.priority))),
    celluleStatut,
    el('td', {}, formatDate(task.dueDate)),
    el('td', {}, formatDaysRemaining(task.dueDate)),
    el('td', { className: 'task-notes-cell' }, task.notes || ''),
    el('td', { className: 'row-actions no-print' }, [
      el(
        'button',
        { type: 'button', className: 'btn-icone', title: 'Modifier', 'aria-label': 'Modifier', onClick: () => openTaskForm({ task }) },
        icone('crayon')
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'btn-icone btn-icone--danger',
          title: 'Supprimer',
          'aria-label': 'Supprimer',
          onClick: () => confirmerSuppression(task),
        },
        icone('poubelle')
      ),
    ]),
  ]);

  return { ligne, champStatut };
}

/** Cellule Statut : badge cliquable qui se change en <select> pour choisir
 * un nouveau statut sans passer par le formulaire d'édition complet (seule
 * la modification directe du statut a été demandée en accès rapide ; tout
 * le reste de la tâche reste modifiable uniquement via le crayon). */
function renderCelluleStatut(task, rerender) {
  if (statutEnEditionId === task.id) {
    const champStatut = el(
      'select',
      {
        className: `badge-select badge--status-${slugStatut(task.status)}`,
        onChange: async (e) => {
          statutEnEditionId = null;
          await updateTask(task.id, { status: e.target.value });
        },
        onBlur: () => {
          if (statutEnEditionId === task.id) {
            statutEnEditionId = null;
            rerender();
          }
        },
        onKeydown: (e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            statutEnEditionId = null;
            rerender();
          }
        },
      },
      STATUTS.map((s) => el('option', { value: s, selected: s === task.status }, capitaliser(s)))
    );
    return { cellule: el('td', {}, champStatut), champStatut };
  }

  const cellule = el(
    'td',
    {},
    el(
      'span',
      {
        className: `badge badge--status-${slugStatut(task.status)} badge--clickable`,
        tabindex: '0',
        role: 'button',
        title: 'Cliquer pour changer le statut',
        onClick: () => {
          statutEnEditionId = task.id;
          rerender();
        },
        onKeydown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            statutEnEditionId = task.id;
            rerender();
          }
        },
      },
      capitaliser(task.status)
    )
  );
  return { cellule, champStatut: null };
}

function confirmerSuppression(task) {
  const ok = window.confirm(`Supprimer la tâche « ${task.title} » ? Cette action est irréversible.`);
  if (ok) deleteTask(task.id);
}
