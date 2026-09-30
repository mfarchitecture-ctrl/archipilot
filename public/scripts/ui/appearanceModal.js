// appearanceModal.js — modal de personnalisation : couleur d'accentuation et
// image de fond. Les réglages s'appliquent immédiatement (pas de bouton
// « enregistrer »), comme la bascule clair/sombre.

import { el, clear } from '../utils/dom.js';
import * as appearance from '../appearance.js';

const ACCENT_PAR_DEFAUT = '#6d5ef8';

export function openAppearanceModal() {
  const racine = document.getElementById('modal-root');
  let urlApercuFond = null;

  const fermer = () => {
    racine.innerHTML = '';
    if (urlApercuFond) URL.revokeObjectURL(urlApercuFond);
    document.removeEventListener('keydown', surEchap);
  };

  function surEchap(e) {
    if (e.key === 'Escape') fermer();
  }

  async function dessiner() {
    clear(racine);

    if (urlApercuFond) {
      URL.revokeObjectURL(urlApercuFond);
      urlApercuFond = null;
    }
    urlApercuFond = await appearance.getBackgroundImageURL();

    const couleurActuelle = appearance.getAccentColor() || ACCENT_PAR_DEFAUT;

    const champCouleur = el('input', {
      type: 'color',
      className: 'color-swatch-input',
      value: couleurActuelle,
      onInput: (e) => appearance.setAccentColor(e.target.value),
    });

    const boutonResetCouleur = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-ghost btn-small',
        onClick: () => {
          appearance.resetAccentColor();
          dessiner();
        },
      },
      'Couleur par défaut'
    );

    const couleurFondActuelle =
      appearance.getBackgroundColor() ||
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() ||
      '#f4f5fb';

    const champCouleurFond = el('input', {
      type: 'color',
      className: 'color-swatch-input',
      value: couleurFondActuelle,
      onInput: (e) => appearance.setBackgroundColor(e.target.value),
    });

    const boutonResetCouleurFond = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-ghost btn-small',
        onClick: () => {
          appearance.resetBackgroundColor();
          dessiner();
        },
      },
      'Fond par défaut'
    );

    const apercuFond = el('div', {
      className: 'bg-preview',
      style: urlApercuFond ? `background-image: url("${urlApercuFond}")` : '',
    });

    const champFichier = el('input', {
      type: 'file',
      accept: 'image/*',
      id: 'champ-fond-fichier',
      hidden: true,
      onChange: async (e) => {
        const fichier = e.target.files[0];
        if (!fichier) return;
        try {
          await appearance.setBackgroundImage(fichier);
        } catch {
          window.alert("Impossible d'utiliser cette image.");
        }
        dessiner();
      },
    });

    const boutonImporter = el(
      'label',
      { className: 'btn btn-secondary btn-small', for: 'champ-fond-fichier' },
      'Importer une image'
    );

    const boutonSupprimerFond = el(
      'button',
      {
        type: 'button',
        className: 'btn btn-ghost btn-small btn-danger-text',
        disabled: !urlApercuFond,
        onClick: async () => {
          await appearance.clearBackgroundImage();
          dessiner();
        },
      },
      'Supprimer le fond'
    );

    const overlay = el('div', { className: 'modal-overlay' });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) fermer();
    });

    const modal = el('div', { className: 'modal modal--appearance' }, [
      el('div', { className: 'modal-header' }, [
        el('h2', {}, 'Personnaliser l’apparence'),
        el('button', { type: 'button', className: 'btn btn-icon', onClick: fermer }, '✕'),
      ]),
      el('div', { className: 'modal-body' }, [
        el('div', { className: 'appearance-section' }, [
          el('span', { className: 'form-field__label' }, 'Couleur d’accentuation'),
          el('div', { className: 'appearance-row' }, [champCouleur, boutonResetCouleur]),
        ]),
        el('div', { className: 'appearance-section' }, [
          el('span', { className: 'form-field__label' }, 'Couleur de fond'),
          el('div', { className: 'appearance-row' }, [champCouleurFond, boutonResetCouleurFond]),
          el('p', { className: 'appearance-hint' }, 'Utilisée si aucune image de fond n’est importée ci-dessous.'),
        ]),
        el('div', { className: 'appearance-section' }, [
          el('span', { className: 'form-field__label' }, 'Image de fond'),
          el('div', { className: 'appearance-row' }, [apercuFond, boutonImporter, champFichier, boutonSupprimerFond]),
          el(
            'p',
            { className: 'appearance-hint' },
            'JPG, PNG ou WebP. N’importe quelle taille : l’image est automatiquement redimensionnée et compressée (1920 px de large maximum). Une fois importée, elle remplace la couleur de fond ci-dessus.'
          ),
        ]),
        el('p', { className: 'appearance-hint' }, 'Ces réglages sont propres à cet ordinateur (non partagés avec vos autres appareils).'),
      ]),
    ]);
    overlay.append(modal);
    racine.append(overlay);
  }

  document.addEventListener('keydown', surEchap);
  dessiner();
}
