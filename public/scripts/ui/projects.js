// projects.js — vue "Projets" : cartes ou liste (au choix), gestion
// (ajout/suppression). Le mode d'affichage choisi est mémorisé
// (localStorage, propre à ce PC) et réappliqué aux prochains lancements.

import {
  PHASES,
  getProjectSummaries,
  addProject,
  deleteProject,
  countTasksForProject,
  updateProjectPhase,
} from '../state.js';
import { el, elSvg, clear } from '../utils/dom.js';
import { formatDate } from '../utils/dates.js';

/** Enrobe un glyphe (✎, 🗑…) pour corriger son centrage optique dans les
 * boutons ronds (voir .btn-icon-outline__glyphe en CSS). */
function glyphe(texte) {
  return el('span', { className: 'btn-icon-outline__glyphe' }, texte);
}

/** Icône calendrier monochrome (hérite de currentColor), utilisée devant l'échéance. */
function iconeCalendrier() {
  return elSvg('svg', { viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' }, [
    elSvg('rect', { x: 3, y: 5, width: 18, height: 16, rx: 2, stroke: 'currentColor', 'stroke-width': 1.9 }),
    elSvg('path', { d: 'M3 9.5h18', stroke: 'currentColor', 'stroke-width': 1.9 }),
    elSvg('path', { d: 'M8 3v4M16 3v4', stroke: 'currentColor', 'stroke-width': 1.9, 'stroke-linecap': 'round' }),
  ]);
}

const CLE_VUE_PROJETS = 'archipilot-projects-view';
const CLE_TRI_PAR = 'archipilot-projects-sort-by';
const CLE_TRI_SENS = 'archipilot-projects-sort-dir';

const OPTIONS_TRI = [
  { value: 'name', label: 'Nom' },
  { value: 'phase', label: 'Phase' },
  { value: 'open', label: 'Tâches ouvertes' },
  { value: 'total', label: 'Tâches au total' },
  { value: 'due', label: 'Échéance' },
];

function lireVueSauvegardee() {
  return localStorage.getItem(CLE_VUE_PROJETS) === 'liste' ? 'liste' : 'cartes';
}

function lireTriSauvegarde() {
  const par = localStorage.getItem(CLE_TRI_PAR);
  return {
    par: OPTIONS_TRI.some((o) => o.value === par) ? par : '',
    sens: localStorage.getItem(CLE_TRI_SENS) === 'desc' ? 'desc' : 'asc',
  };
}

/** Compare deux résumés de projet selon le critère de tri choisi. Comme pour
 * la vue Suivi, les valeurs absentes (phase ou échéance) restent toujours
 * en fin de liste, quel que soit le sens du tri. */
function comparerProjets(a, b, critere, direction) {
  const sens = direction === 'desc' ? -1 : 1;
  switch (critere) {
    case 'name':
      return a.project.name.localeCompare(b.project.name) * sens;
    case 'phase': {
      const ia = a.project.phase ? PHASES.indexOf(a.project.phase) : null;
      const ib = b.project.phase ? PHASES.indexOf(b.project.phase) : null;
      if (ia === null && ib === null) return 0;
      if (ia === null) return 1;
      if (ib === null) return -1;
      return (ia - ib) * sens;
    }
    case 'open':
      return (a.tachesOuvertes - b.tachesOuvertes) * sens;
    case 'total':
      return (a.totalTaches - b.totalTaches) * sens;
    case 'due': {
      const da = a.prochaineEcheance ? new Date(a.prochaineEcheance).getTime() : null;
      const db = b.prochaineEcheance ? new Date(b.prochaineEcheance).getTime() : null;
      if (da === null && db === null) return 0;
      if (da === null) return 1;
      if (db === null) return -1;
      return (da - db) * sens;
    }
    default:
      return 0;
  }
}

export function renderProjects(container, { onOpenProject }) {
  clear(container);
  let vue = lireVueSauvegardee();
  let tri = lireTriSauvegarde();

  const barreAjout = el(
    'form',
    {
      className: 'add-project-bar',
      onSubmit: async (e) => {
        e.preventDefault();
        const champ = e.target.elements.nomProjet;
        const nom = champ.value.trim();
        if (!nom) return;
        await addProject(nom);
        champ.value = '';
        champ.focus();
      },
    },
    [
      el('input', {
        id: 'champ-nouveau-projet',
        name: 'nomProjet',
        type: 'text',
        className: 'input',
        placeholder: 'Nom du nouveau projet',
      }),
      el('button', { type: 'submit', className: 'btn btn-primary' }, '+ Ajouter un projet'),
    ]
  );

  const boutonCartes = el(
    'button',
    { type: 'button', onClick: () => choisirVue('cartes') },
    'Cartes'
  );
  const boutonListe = el(
    'button',
    { type: 'button', onClick: () => choisirVue('liste') },
    'Liste'
  );
  const bascule = el('div', { className: 'view-switch' }, [boutonCartes, boutonListe]);

  const selectTri = el(
    'select',
    {
      className: 'input projects-toolbar__sort-select',
      onChange: (e) => {
        tri.par = e.target.value;
        localStorage.setItem(CLE_TRI_PAR, tri.par);
        rafraichir();
      },
    },
    [
      el('option', { value: '', selected: tri.par === '' }, 'Ordre par défaut'),
      ...OPTIONS_TRI.map((o) => el('option', { value: o.value, selected: o.value === tri.par }, o.label)),
    ]
  );

  const boutonSens = el('button', {
    type: 'button',
    className: 'btn-sort-direction',
    onClick: () => {
      tri.sens = tri.sens === 'asc' ? 'desc' : 'asc';
      localStorage.setItem(CLE_TRI_SENS, tri.sens);
      rafraichir();
    },
  });

  const groupeTri = el('div', { className: 'projects-toolbar__sort' }, [
    el('span', { className: 'form-field__label' }, 'Trier par'),
    selectTri,
    boutonSens,
  ]);

  const zoneProjets = el('div', {}, []);

  container.append(el('div', { className: 'projects-toolbar' }, [barreAjout, groupeTri, bascule]), zoneProjets);

  function choisirVue(nouvelleVue) {
    vue = nouvelleVue;
    localStorage.setItem(CLE_VUE_PROJETS, vue);
    rafraichir();
  }

  function rafraichir() {
    boutonCartes.classList.toggle('active', vue === 'cartes');
    boutonListe.classList.toggle('active', vue === 'liste');

    boutonSens.disabled = tri.par === '';
    boutonSens.textContent = tri.sens === 'desc' ? '▼' : '▲';
    boutonSens.title = tri.sens === 'desc' ? 'Ordre décroissant' : 'Ordre croissant';

    clear(zoneProjets);
    let resumes = getProjectSummaries();
    if (resumes.length === 0) {
      zoneProjets.append(el('p', { className: 'empty-state' }, 'Aucun projet. Ajoutez-en un ci-dessus pour commencer.'));
      return;
    }
    if (tri.par) {
      resumes = [...resumes].sort((a, b) => comparerProjets(a, b, tri.par, tri.sens));
    }
    zoneProjets.append(vue === 'liste' ? construireListe(resumes, onOpenProject) : construireGrille(resumes, onOpenProject));
  }

  rafraichir();
}

function construireGrille(resumes, onOpenProject) {
  return el(
    'div',
    { className: 'project-grid' },
    resumes.map(({ project, totalTaches, tachesOuvertes, tachesEnRetard, prochaineEcheance, prochaineTache }) =>
      el(
        'div',
        {
          className: 'project-card',
          tabindex: '0',
          role: 'button',
          onClick: () => onOpenProject(project.id),
          onKeydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenProject(project.id);
            }
          },
        },
        [
          tachesEnRetard > 0
            ? el(
                'span',
                { className: 'project-card__overdue-badge', title: `${tachesEnRetard} tâche(s) en retard` },
                `${tachesEnRetard} en retard`
              )
            : null,
          el('div', { className: 'project-card__header' }, [el('h3', {}, project.name)]),
          el('div', { className: 'project-card__stats' }, [
            el('div', { className: 'project-card__stat' }, [
              el('span', { className: 'stat-value' }, String(tachesOuvertes)),
              el('span', { className: 'stat-label' }, 'tâche ouverte'),
            ]),
            el('div', { className: 'project-card__stat' }, [
              el('span', { className: 'stat-value' }, String(totalTaches)),
              el('span', { className: 'stat-label' }, 'tâches au total'),
            ]),
          ]),
          el(
            'p',
            { className: 'project-card__due', title: prochaineTache ? `Tâche : ${prochaineTache}` : undefined },
            [
              iconeCalendrier(),
              prochaineEcheance ? `Prochaine échéance : ${formatDate(prochaineEcheance)}` : 'Aucune échéance à venir',
            ]
          ),
          el(
            'div',
            { className: 'project-card__footer', onClick: (e) => e.stopPropagation() },
            [
              construirePhaseSelect(project),
              el('div', { className: 'project-card__footer-actions' }, [
                el(
                  'button',
                  {
                    type: 'button',
                    className: 'btn-icon-outline btn-icon-outline--danger',
                    title: 'Supprimer',
                    onClick: () => supprimer(project),
                  },
                  glyphe('🗑')
                ),
              ]),
            ]
          ),
        ]
      )
    )
  );
}

function construirePhaseSelect(project) {
  return el(
    'select',
    {
      className: 'input project-card__phase',
      title: 'Phase du projet',
      onChange: (e) => updateProjectPhase(project.id, e.target.value),
    },
    [
      el('option', { value: '', selected: !project.phase, hidden: true, disabled: true }, 'Phase'),
      ...PHASES.map((phase) => el('option', { value: phase, selected: phase === project.phase }, phase)),
    ]
  );
}

function construireListe(resumes, onOpenProject) {
  return el(
    'div',
    { className: 'project-list' },
    resumes.map(({ project, totalTaches, tachesOuvertes, tachesEnRetard, prochaineEcheance, prochaineTache }) =>
      el(
        'div',
        {
          className: 'project-list-row',
          tabindex: '0',
          role: 'button',
          onClick: () => onOpenProject(project.id),
          onKeydown: (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpenProject(project.id);
            }
          },
        },
        [
          el('span', { className: 'project-list-row__name' }, project.name),
          tachesEnRetard > 0
            ? el(
                'span',
                { className: 'project-list-row__overdue-badge', title: `${tachesEnRetard} tâche(s) en retard` },
                `${tachesEnRetard} en retard`
              )
            : null,
          el(
            'div',
            { className: 'project-list-row__phase', onClick: (e) => e.stopPropagation() },
            construirePhaseSelect(project)
          ),
          el('div', { className: 'project-list-row__stat' }, [
            el('span', { className: 'stat-value' }, String(tachesOuvertes)),
            el('span', { className: 'stat-label' }, 'ouvertes'),
          ]),
          el('div', { className: 'project-list-row__stat' }, [
            el('span', { className: 'stat-value' }, String(totalTaches)),
            el('span', { className: 'stat-label' }, 'total'),
          ]),
          el(
            'span',
            {
              className: 'project-list-row__due',
              title: prochaineTache ? `Tâche : ${prochaineTache}` : undefined,
            },
            prochaineEcheance ? `Échéance : ${formatDate(prochaineEcheance)}` : 'Aucune échéance à venir'
          ),
          el(
            'div',
            { className: 'project-list-row__actions', onClick: (e) => e.stopPropagation() },
            [
              el(
                'button',
                {
                  type: 'button',
                  className: 'btn-icon-outline btn-icon-outline--danger',
                  title: 'Supprimer',
                  onClick: () => supprimer(project),
                },
                glyphe('🗑')
              ),
            ]
          ),
        ]
      )
    )
  );
}

function supprimer(project) {
  const nbTaches = countTasksForProject(project.id);
  const message =
    nbTaches > 0
      ? `Le projet « ${project.name} » contient ${nbTaches} tâche(s). Confirmer la suppression du projet ET de ses tâches ?`
      : `Supprimer le projet « ${project.name} » ?`;
  const ok = window.confirm(message);
  if (ok) deleteProject(project.id);
}
