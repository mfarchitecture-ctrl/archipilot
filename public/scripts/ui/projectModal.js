// projectModal.js — modal dédiée à un projet, ouverte depuis sa carte dans
// l'onglet Projets. Regroupe les informations libres du projet et la liste
// de ses tâches, affichées en lecture seule (comme dans Suivi) pour rester
// lisibles ; l'ajout et la modification d'une tâche ouvrent tous les deux
// le même formulaire modal que dans Suivi (voir taskForm.js), avec le
// projet déjà fixé et non modifiable.

import { getProjectById, renameProject, updateProjectInfo, getTasksForProject, deleteTask } from '../state.js';
import { el, clear } from '../utils/dom.js';
import { icone } from '../../charte-icones.js';
import { formatDate, formatDaysRemaining, isOverdue, isDueSoon } from '../utils/dates.js';
import { capitaliser, slugStatut } from '../utils/labels.js';
import { openTaskForm } from './taskForm.js';

export function openProjectModal(projectId) {
  const racine = document.getElementById('modal-root');
  let renommageEnCours = false;

  const fermer = () => {
    racine.innerHTML = '';
    document.removeEventListener('keydown', surEchap);
  };

  function surEchap(e) {
    if (e.key === 'Escape') {
      // stopImmediatePropagation : si le formulaire d'ajout de tâche (autre
      // listener Échap sur document) est ouvert par-dessus, un seul Échap
      // ne doit fermer que lui, pas les deux modals d'un coup.
      e.stopImmediatePropagation();
      fermer();
    }
  }

  /** Reconstruit le contenu de la modal à partir de l'état actuel (après toute mutation). */
  function rerender() {
    const project = getProjectById(projectId);
    if (!project) {
      fermer();
      return;
    }
    dessiner(project);
  }

  function dessiner(project) {
    clear(racine);
    const taches = getTasksForProject(project.id);

    async function validerRenommage(valeur) {
      const nom = valeur.trim();
      renommageEnCours = false;
      if (nom && nom !== project.name) {
        await renameProject(project.id, nom);
      }
      rerender();
    }

    const titreProjet = renommageEnCours
      ? el('input', {
          type: 'text',
          className: 'modal-header__title-input',
          value: project.name,
          onBlur: (e) => validerRenommage(e.target.value),
          onKeydown: (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.target.blur();
            } else if (e.key === 'Escape') {
              // stopPropagation : sans ça, l'échap remonte jusqu'au raccourci
              // global qui ferme toute la modal (voir surEchap plus bas).
              e.preventDefault();
              e.stopPropagation();
              renommageEnCours = false;
              rerender();
            }
          },
        })
      : el(
          'h2',
          {
            className: 'project-modal__title',
            tabindex: '0',
            role: 'button',
            title: 'Cliquer pour renommer le projet',
            onClick: () => {
              renommageEnCours = true;
              rerender();
            },
            onKeydown: (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                renommageEnCours = true;
                rerender();
              }
            },
          },
          project.name
        );

    const champInfo = el('textarea', {
      className: 'project-modal__info',
      rows: 1,
      placeholder: 'Informations (accès, contacts, particularités…)',
      onChange: (e) => updateProjectInfo(project.id, e.target.value),
    }, project.info || '');

    /** Ouvre le formulaire modal (ajout ou édition d'une tâche existante
     * selon `options`). On détache notre propre écouteur Échap pendant que
     * le formulaire (qui a le sien) est ouvert par-dessus : les deux
     * modals écoutent Échap sur `document`, et comme le nôtre a été
     * ajouté en premier, il s'exécuterait avant celui du formulaire et
     * fermerait tout. On le rattache à la fermeture du formulaire. */
    function ouvrirFormulaireTache(options) {
      document.removeEventListener('keydown', surEchap);
      openTaskForm({
        ...options,
        onClose: () => {
          document.addEventListener('keydown', surEchap);
          rerender();
        },
      });
    }

    const boutonAjouter = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-primary btn-small',
        title: 'Ajouter une tâche',
        'aria-label': 'Ajouter une tâche',
        onClick: () => ouvrirFormulaireTache({ projectId: project.id }),
      },
      icone('plus', { taille: 16 })
    );

    const lignes = taches.map((task) => renderLigneTache(task, { rerender, ouvrirFormulaireTache }));

    const listeTaches =
      lignes.length === 0
        ? el('p', { className: 'empty-state' }, 'Aucune tâche pour ce projet pour le moment.')
        : el('table', { className: 'task-table' }, [
            el(
              'thead',
              {},
              el(
                'tr',
                {},
                ['Tâche', 'Priorité', 'Statut', 'Échéance', 'Jours restants', ''].map((titre) =>
                  el('th', {}, titre)
                )
              )
            ),
            el('tbody', {}, lignes),
          ]);

    const overlay = el('div', { className: 'modal-overlay' });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fermer();
    });

    const modal = el('div', { className: 'modal modal--project' }, [
      el('div', { className: 'modal-header' }, [
        titreProjet,
        champInfo,
        el('button', { type: 'button', className: 'btn-icone', title: 'Fermer', 'aria-label': 'Fermer', onClick: fermer }, icone('fermer')),
      ]),
      el('div', { className: 'modal-body' }, [
        el('div', { className: 'project-modal__tasks-header' }, [
          el('span', { className: 'form-field__label' }, 'Tâches'),
          boutonAjouter,
        ]),
        listeTaches,
      ]),
    ]);
    overlay.append(modal);
    racine.append(overlay);

    if (renommageEnCours) {
      titreProjet.focus();
      titreProjet.select();
    }
  }

  document.addEventListener('keydown', surEchap);
  rerender();
}

/** Ligne d'une tâche existante, en lecture seule (comme dans Suivi) pour
 * rester lisible : la modification passe par le crayon, qui ouvre le
 * formulaire modal (voir taskForm.js), pas par une édition en ligne. */
function renderLigneTache(task, { rerender, ouvrirFormulaireTache }) {
  const classes = ['task-row'];
  if (isOverdue(task)) classes.push('task-row--overdue');
  else if (isDueSoon(task)) classes.push('task-row--soon');

  return el('tr', { className: classes.join(' ') }, [
    el('td', { className: 'task-title-cell' }, task.title),
    el('td', {}, el('span', { className: `badge badge--priority-${task.priority}` }, capitaliser(task.priority))),
    el('td', {}, el('span', { className: `badge badge--status-${slugStatut(task.status)}` }, capitaliser(task.status))),
    el('td', {}, formatDate(task.dueDate)),
    el('td', {}, formatDaysRemaining(task.dueDate)),
    el('td', { className: 'row-actions no-print' }, [
      el(
        'button',
        {
          type: 'button',
          className: 'btn-icone',
          title: 'Modifier',
          'aria-label': 'Modifier',
          onClick: () => ouvrirFormulaireTache({ task }),
        },
        icone('crayon')
      ),
      el(
        'button',
        {
          type: 'button',
          className: 'btn-icone btn-icone--danger',
          title: 'Supprimer',
          'aria-label': 'Supprimer',
          onClick: () => confirmerSuppression(task, rerender),
        },
        icone('poubelle')
      ),
    ]),
  ]);
}

function confirmerSuppression(task, rerender) {
  const ok = window.confirm(`Supprimer la tâche « ${task.title} » ? Cette action est irréversible.`);
  if (ok) {
    deleteTask(task.id);
    rerender();
  }
}
