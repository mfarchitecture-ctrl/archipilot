// state.js
// -----------------------------------------------------------------------------
// État de l'application en mémoire (projets, tâches, filtres, vue courante).
// Toute mutation de données passe par les fonctions exportées ici : chacune
// met à jour l'état, déclenche l'écriture immédiate sur disque (via la
// fonction de persistance fournie par main.js à l'initialisation) puis
// notifie les abonnés pour déclencher un re-rendu de l'UI.
//
// Ce module ne connaît rien du DOM ni de storage.js directement — il reçoit
// juste une fonction `persistFn(data)` à appeler après chaque mutation.
// -----------------------------------------------------------------------------

import { daysRemaining, isOverdue } from './utils/dates.js';
import { normaliserTexte } from './utils/labels.js';

export const PRIORITES = ['haute', 'moyenne', 'basse'];
export const STATUTS = ['à faire', 'en cours', 'bloqué', 'terminé'];
// Phases d'un projet d'architecture, dans l'ordre chronologique habituel :
// État des lieux, Esquisse, Avant-projet, Dossier de consultation des
// entreprises, Fabrication, Direction de l'exécution des travaux,
// Assistance aux opérations de réception.
export const PHASES = ['EDL', 'ESQ', 'AVP', 'DCE', 'FAB', 'DET', 'AOR'];

const FILTRES_PAR_DEFAUT = Object.freeze({
  search: '',
  projectId: '',
  priority: '',
  status: '',
  showDone: false,
  overdueOnly: false,
  // Tri explicite (vue Suivi) : sortBy vide = tri par défaut
  // (priorité > urgence > projet). Sinon, une des colonnes triables.
  sortBy: '',
  sortDir: 'asc',
});

const ORDRE_PRIORITE = { haute: 0, moyenne: 1, basse: 2 };
const ORDRE_STATUT = { 'à faire': 0, 'en cours': 1, bloqué: 2, terminé: 3 };

function cleEcheance(task) {
  return task.dueDate ? new Date(task.dueDate).getTime() : null;
}

/** Compare deux tâches selon une colonne triable explicite (voir setFilters
 * sortBy/sortDir). Les tâches sans échéance restent toujours en fin de
 * liste, quel que soit le sens du tri. Pour Échéance/Jours restants, à
 * date égale (ou absente des deux côtés) on départage par priorité
 * (haute en premier) plutôt que de laisser un ordre arbitraire. */
function comparerTaches(a, b, sortBy, direction) {
  const sens = direction === 'desc' ? -1 : 1;
  switch (sortBy) {
    case 'priority':
      return (ORDRE_PRIORITE[a.priority] - ORDRE_PRIORITE[b.priority]) * sens;
    case 'status':
      return (ORDRE_STATUT[a.status] - ORDRE_STATUT[b.status]) * sens;
    case 'dueDate':
    case 'daysRemaining': {
      const da = cleEcheance(a);
      const db = cleEcheance(b);
      if (da === null && db === null) return ORDRE_PRIORITE[a.priority] - ORDRE_PRIORITE[b.priority];
      if (da === null) return 1;
      if (db === null) return -1;
      if (da === db) return ORDRE_PRIORITE[a.priority] - ORDRE_PRIORITE[b.priority];
      return (da - db) * sens;
    }
    default:
      return 0;
  }
}

let projects = [];
let tasks = [];
let filters = { ...FILTRES_PAR_DEFAUT };
let currentView = 'tasks';
let persistHandler = null;
const subscribers = new Set();

/** À appeler une seule fois par main.js, avec la fonction d'écriture sur disque. */
export function init(persistFn) {
  persistHandler = persistFn;
}

/** S'abonne aux changements d'état. Retourne une fonction de désabonnement. */
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

function notify() {
  subscribers.forEach((fn) => fn());
}

async function persist() {
  if (persistHandler) {
    await persistHandler({ projects, tasks });
  }
}

export function setData(data) {
  projects = data.projects || [];
  tasks = data.tasks || [];
  notify();
}

export function getProjects() {
  return projects;
}

export function getTasks() {
  return tasks;
}

export function getProjectById(id) {
  return projects.find((p) => p.id === id) || null;
}

// --- Projets -----------------------------------------------------------------

export async function addProject(name) {
  const project = { id: crypto.randomUUID(), name: name.trim(), info: '', phase: PHASES[0] };
  projects.push(project);
  await persist();
  notify();
  return project;
}

export async function renameProject(id, name) {
  const project = getProjectById(id);
  if (!project) return;
  project.name = name.trim();
  await persist();
  notify();
}

/** Change la phase d'un projet (EDL, ESQ, AVP, DCE, DET, AOR). */
export async function updateProjectPhase(id, phase) {
  const project = getProjectById(id);
  if (!project) return;
  project.phase = phase;
  await persist();
  notify();
}

/** Met à jour les informations libres (accès, contacts, particularités…) d'un projet. */
export async function updateProjectInfo(id, info) {
  const project = getProjectById(id);
  if (!project) return;
  project.info = info;
  await persist();
  notify();
}

export function countTasksForProject(id) {
  return tasks.filter((t) => t.projectId === id).length;
}

/**
 * Supprime un projet et, en cascade, toutes ses tâches. L'UI doit avoir
 * obtenu une confirmation explicite de l'utilisateur au préalable si le
 * projet contient encore des tâches (voir ui/projects.js).
 */
export async function deleteProject(id) {
  projects = projects.filter((p) => p.id !== id);
  tasks = tasks.filter((t) => t.projectId !== id);
  await persist();
  notify();
}

// --- Tâches --------------------------------------------------------------------

export async function addTask(taskData) {
  const task = { id: crypto.randomUUID(), ...taskData };
  tasks.push(task);
  await persist();
  notify();
  return task;
}

export async function updateTask(id, patch) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  Object.assign(task, patch);
  await persist();
  notify();
}

export async function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  await persist();
  notify();
}

// --- Filtres / vue courante ------------------------------------------------------

export function setFilters(partial) {
  filters = { ...filters, ...partial };
  notify();
}

/** Réinitialise tous les filtres puis en applique éventuellement de nouveaux. */
export function resetFilters(partial = {}) {
  filters = { ...FILTRES_PAR_DEFAUT, ...partial };
  notify();
}

export function getFilters() {
  return filters;
}

export function setView(view) {
  currentView = view;
  notify();
}

export function getView() {
  return currentView;
}

// --- Requêtes dérivées -----------------------------------------------------------

/** Applique les filtres actifs puis trie : par défaut priorité > urgence
 * (jours restants) > projet, sauf si un tri explicite est actif
 * (sortBy/sortDir, voir setFilters) sur une des colonnes triables. */
export function getFilteredSortedTasks() {
  const { search, projectId, priority, status, showDone, overdueOnly, sortBy, sortDir } = filters;
  const texte = normaliserTexte(search.trim());

  const resultat = tasks.filter((task) => {
    if (!showDone && task.status === 'terminé') return false;
    if (projectId && task.projectId !== projectId) return false;
    if (priority && task.priority !== priority) return false;
    if (status && task.status !== status) return false;
    if (overdueOnly && !isOverdue(task)) return false;
    if (texte) {
      const projet = getProjectById(task.projectId);
      const cible = normaliserTexte(`${task.title} ${projet ? projet.name : ''} ${task.notes || ''}`);
      if (!cible.includes(texte)) return false;
    }
    return true;
  });

  if (sortBy) {
    resultat.sort((a, b) => comparerTaches(a, b, sortBy, sortDir));
  } else {
    const ordrePriorite = { haute: 0, moyenne: 1, basse: 2 };
    resultat.sort((a, b) => {
      const diffPriorite = ordrePriorite[a.priority] - ordrePriorite[b.priority];
      if (diffPriorite !== 0) return diffPriorite;

      const joursA = a.dueDate ? daysRemaining(a.dueDate) : Infinity;
      const joursB = b.dueDate ? daysRemaining(b.dueDate) : Infinity;
      if (joursA !== joursB) return joursA - joursB;

      const projetA = getProjectById(a.projectId)?.name || '';
      const projetB = getProjectById(b.projectId)?.name || '';
      return projetA.localeCompare(projetB);
    });
  }

  return resultat;
}

/** Tâches d'un projet donné, triées comme la vue Suivi (priorité > urgence). */
export function getTasksForProject(projectId) {
  const ordrePriorite = { haute: 0, moyenne: 1, basse: 2 };
  return tasks
    .filter((t) => t.projectId === projectId)
    .sort((a, b) => {
      const diffPriorite = ordrePriorite[a.priority] - ordrePriorite[b.priority];
      if (diffPriorite !== 0) return diffPriorite;

      const joursA = a.dueDate ? daysRemaining(a.dueDate) : Infinity;
      const joursB = b.dueDate ? daysRemaining(b.dueDate) : Infinity;
      return joursA - joursB;
    });
}

/** Résumé par projet (tâches ouvertes, total, en retard, prochaine échéance) pour la vue Projets. */
export function getProjectSummaries() {
  return projects.map((project) => {
    const tachesProjet = tasks.filter((t) => t.projectId === project.id);
    const ouvertes = tachesProjet.filter((t) => t.status !== 'terminé');
    const prochaine = ouvertes
      .filter((t) => t.dueDate)
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))[0];
    return {
      project,
      totalTaches: tachesProjet.length,
      tachesOuvertes: ouvertes.length,
      tachesEnRetard: ouvertes.filter((t) => isOverdue(t)).length,
      prochaineEcheance: prochaine ? prochaine.dueDate : null,
      prochaineTache: prochaine ? prochaine.title : null,
    };
  });
}

/** Compteurs globaux (toutes tâches ouvertes, tous projets confondus) pour le tableau de bord. */
export function getDashboardCounts() {
  const ouvertes = tasks.filter((t) => t.status !== 'terminé');
  return {
    open: ouvertes.length,
    overdue: ouvertes.filter((t) => isOverdue(t)).length,
    highPriority: ouvertes.filter((t) => t.priority === 'haute').length,
    blocked: ouvertes.filter((t) => t.status === 'bloqué').length,
  };
}
