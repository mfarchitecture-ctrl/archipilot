// taskForm.js — formulaire modal d'ajout/édition d'une tâche.
// En édition (ou en ajout depuis la modal d'un projet), le projet est fixe
// et affiché en lecture seule. En ajout depuis la vue Suivi (aucun projectId
// fourni), un sélecteur de projet apparaît dans le formulaire.

import { PRIORITES, STATUTS, getProjects, getProjectById, addTask, updateTask, deleteTask } from '../state.js';
import { el } from '../utils/dom.js';
import { icone } from '../../charte-icones.js';

function capitaliser(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function champ(label, node) {
  return el('label', { className: 'form-field' }, [el('span', { className: 'form-field__label' }, label), node]);
}

/**
 * Ouvre le formulaire modal.
 * - Passer { task, onClose } pour éditer une tâche existante.
 * - Passer { projectId, onClose } pour en ajouter une nouvelle à ce projet.
 * `onClose` (optionnel) est appelé à la fermeture (annulation ou validation),
 * pour permettre à l'appelant (la modal projet) de revenir à son affichage.
 */
export function openTaskForm({ task = null, projectId = null, onClose = null } = {}) {
  const racine = document.getElementById('modal-root');
  const estEdition = Boolean(task);
  const idProjetFixe = estEdition ? task.projectId : projectId;
  const projet = getProjectById(idProjetFixe);

  const fermer = () => {
    racine.innerHTML = '';
    document.removeEventListener('keydown', surEchap);
    if (onClose) onClose();
  };

  function surEchap(e) {
    if (e.key === 'Escape') {
      // stopImmediatePropagation : ouvert depuis la modal projet, un Échap
      // ne doit fermer que ce formulaire, pas aussi la modal projet en
      // dessous (toutes deux écoutent Échap sur document).
      e.stopImmediatePropagation();
      fermer();
    }
  }

  const champTitre = el('input', {
    id: 'champ-titre-tache',
    type: 'text',
    required: true,
    value: task?.title || '',
    placeholder: 'Nom de la tâche',
    className: 'input',
  });

  const champPriorite = el(
    'select',
    { className: 'input' },
    PRIORITES.map((p) => el('option', { value: p, selected: p === (task?.priority || 'moyenne') }, capitaliser(p)))
  );

  const champStatut = el(
    'select',
    { className: 'input' },
    STATUTS.map((s) => el('option', { value: s, selected: s === (task?.status || 'à faire') }, capitaliser(s)))
  );

  const champProjet = idProjetFixe
    ? el('p', { className: 'form-field__static' }, projet ? projet.name : '—')
    : el(
        'select',
        { id: 'champ-projet-tache', className: 'input', required: true },
        [
          // Pas de projet présélectionné : mieux vaut forcer un choix explicite
          // que de laisser le premier projet de la liste par défaut (source
          // d'erreurs de saisie si on ne le remarque pas).
          el('option', { value: '', selected: true, disabled: true, hidden: true }, 'Choisir un projet…'),
          ...getProjects().map((p) => el('option', { value: p.id }, p.name)),
        ]
      );

  const champEcheance = el('input', { type: 'date', className: 'input', value: task?.dueDate || '' });

  const champNotes = el(
    'textarea',
    { className: 'input', rows: 4, placeholder: 'Notes libres' },
    task?.notes || ''
  );

  const messageErreur = el('p', { className: 'form-error', hidden: true });

  const boutonSupprimer = estEdition
    ? el(
        'button',
        {
          type: 'button',
          className: 'btn btn-ghost btn-danger-text',
          onClick: () => {
            const ok = window.confirm(`Supprimer la tâche « ${task.title} » ? Cette action est irréversible.`);
            if (ok) {
              deleteTask(task.id);
              fermer();
            }
          },
        },
        'Supprimer'
      )
    : el('span', {});

  const formulaire = el('form', { className: 'task-form' }, [
    champ('Projet', champProjet),
    champ('Nom de la tâche', champTitre),
    el('div', { className: 'form-row' }, [champ('Priorité', champPriorite), champ('Statut', champStatut)]),
    champ('Échéance', champEcheance),
    champ('Notes', champNotes),
    messageErreur,
    el('div', { className: 'form-actions' }, [
      boutonSupprimer,
      el('div', { className: 'form-actions-right' }, [
        el('button', { type: 'button', className: 'btn btn-secondary', onClick: fermer }, 'Annuler'),
        el('button', { type: 'submit', className: 'btn btn-primary' }, estEdition ? 'Enregistrer' : 'Ajouter'),
      ]),
    ]),
  ]);

  formulaire.addEventListener('submit', async (e) => {
    e.preventDefault();
    const titre = champTitre.value.trim();
    const idProjet = idProjetFixe || champProjet.value;
    if (!titre || !idProjet) {
      messageErreur.textContent = idProjet
        ? 'Le nom de la tâche est obligatoire.'
        : 'Le nom de la tâche et le projet sont obligatoires.';
      messageErreur.hidden = false;
      return;
    }

    const donnees = {
      title: titre,
      projectId: idProjet,
      priority: champPriorite.value,
      status: champStatut.value,
      dueDate: champEcheance.value || null,
      notes: champNotes.value.trim(),
    };

    if (estEdition) {
      await updateTask(task.id, donnees);
    } else {
      await addTask(donnees);
    }
    fermer();
  });

  const overlay = el('div', { className: 'modal-overlay' });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) fermer();
  });

  const modal = el('div', { className: 'modal' }, [
    el('div', { className: 'modal-header' }, [
      el('h2', {}, estEdition ? 'Modifier la tâche' : 'Nouvelle tâche'),
      el('button', { type: 'button', className: 'btn-icone', title: 'Fermer', 'aria-label': 'Fermer', onClick: fermer }, icone('fermer')),
    ]),
    el('div', { className: 'modal-body' }, formulaire),
  ]);
  overlay.append(modal);

  racine.innerHTML = '';
  racine.append(overlay);
  document.addEventListener('keydown', surEchap);
  champTitre.focus();
}
