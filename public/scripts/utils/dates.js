// dates.js — calcul des jours restants et formatage des dates pour l'UI.

const MS_PAR_JOUR = 24 * 60 * 60 * 1000;

function debutDeJournee(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Nombre de jours entre aujourd'hui et l'échéance (négatif = en retard). */
export function daysRemaining(dueDate) {
  if (!dueDate) return null;
  const aujourdHui = debutDeJournee(new Date());
  const echeance = debutDeJournee(dueDate);
  return Math.round((echeance - aujourdHui) / MS_PAR_JOUR);
}

/** Formate une date ISO (YYYY-MM-DD) au format français JJ/MM/AAAA. */
export function formatDate(dueDate) {
  if (!dueDate) return '—';
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Une tâche terminée n'est jamais considérée en retard, même si sa date est passée. */
export function isOverdue(task) {
  if (!task.dueDate || task.status === 'terminé') return false;
  return daysRemaining(task.dueDate) < 0;
}

/** Tâche dont l'échéance approche (mais pas encore dépassée), sous un seuil de jours. */
export function isDueSoon(task, seuil = 3) {
  if (!task.dueDate || task.status === 'terminé') return false;
  const jours = daysRemaining(task.dueDate);
  return jours >= 0 && jours <= seuil;
}

/** Texte lisible pour la colonne "jours restants" du tableau de suivi. */
export function formatDaysRemaining(dueDate) {
  const jours = daysRemaining(dueDate);
  if (jours === null) return '—';
  if (jours < 0) return `Retard de ${Math.abs(jours)} j`;
  if (jours === 0) return "Aujourd'hui";
  return `${jours} j`;
}
