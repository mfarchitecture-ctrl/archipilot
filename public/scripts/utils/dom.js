// dom.js — petits utilitaires DOM pour éviter de répéter document.createElement
// partout dans les modules d'UI. Pas de framework, juste des helpers minces.

/**
 * Crée un élément DOM.
 * @param {string} tag - nom de la balise (ex: 'div', 'button')
 * @param {object} attrs - attributs. Cas spéciaux :
 *   - className: raccourci pour node.className
 *   - dataset: objet fusionné dans node.dataset
 *   - onXxx (fonction): ajouté comme écouteur d'événement 'xxx'
 *   - valeur booléenne true: attribut présent sans valeur (ex: required, hidden)
 *   - valeur false/null/undefined: attribut omis
 * @param {Node|string|Array<Node|string>} children
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);

  for (const [cle, valeur] of Object.entries(attrs)) {
    if (cle === 'className') {
      node.className = valeur;
    } else if (cle === 'dataset') {
      Object.assign(node.dataset, valeur);
    } else if (cle.startsWith('on') && typeof valeur === 'function') {
      node.addEventListener(cle.slice(2).toLowerCase(), valeur);
    } else if (valeur === true) {
      node.setAttribute(cle, '');
    } else if (valeur === false || valeur === null || valeur === undefined) {
      // attribut omis volontairement
    } else {
      // Propriétés directes utiles (value, checked) plutôt que setAttribute,
      // pour que les mises à jour ultérieures via JS restent cohérentes.
      if (cle === 'value' || cle === 'checked') {
        node[cle] = valeur;
      } else {
        node.setAttribute(cle, String(valeur));
      }
    }
  }

  const liste = Array.isArray(children) ? children : [children];
  for (const enfant of liste) {
    if (enfant === null || enfant === undefined || enfant === false) continue;
    node.append(enfant instanceof Node ? enfant : document.createTextNode(String(enfant)));
  }

  return node;
}

/**
 * Crée un élément SVG (namespace obligatoire, contrairement à `el`).
 * Attributs posés via setAttribute (pas de raccourci className/value ici :
 * les propriétés SVG correspondantes ne sont pas de simples chaînes).
 * @param {string} tag - nom de la balise SVG (ex: 'svg', 'path', 'rect')
 * @param {object} attrs
 * @param {Node|Node[]} children
 */
export function elSvg(tag, attrs = {}, children = []) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);

  for (const [cle, valeur] of Object.entries(attrs)) {
    if (valeur !== null && valeur !== undefined && valeur !== false) {
      node.setAttribute(cle, valeur === true ? '' : String(valeur));
    }
  }

  const liste = Array.isArray(children) ? children : [children];
  for (const enfant of liste) {
    if (enfant !== null && enfant !== undefined && enfant !== false) node.append(enfant);
  }

  return node;
}

export function qs(selecteur, parent = document) {
  return parent.querySelector(selecteur);
}

export function qsa(selecteur, parent = document) {
  return Array.from(parent.querySelectorAll(selecteur));
}

export function clear(node) {
  node.innerHTML = '';
}

/**
 * Exécute renderFn() (qui vide et reconstruit `container`) en conservant
 * le focus et la position du curseur si l'élément actif se trouvait dans
 * ce conteneur. Utile car l'app re-rend toute la vue courante à chaque
 * mutation d'état (pas de diff DOM) — sans ça, taper dans le champ de
 * recherche perdrait le focus à chaque caractère.
 */
export function withFocusPreserved(container, renderFn) {
  const actif = document.activeElement;
  const etaitDansConteneur = actif && container.contains(actif) && actif.id;
  const id = etaitDansConteneur ? actif.id : null;
  const debutSelection = id && 'selectionStart' in actif ? actif.selectionStart : null;
  const finSelection = id && 'selectionEnd' in actif ? actif.selectionEnd : null;

  renderFn();

  if (id) {
    const nouvelElement = container.querySelector(`#${CSS.escape(id)}`);
    if (nouvelElement) {
      nouvelElement.focus();
      if (debutSelection !== null && 'setSelectionRange' in nouvelElement) {
        try {
          nouvelElement.setSelectionRange(debutSelection, finSelection);
        } catch {
          // certains types d'input (ex: number) ne supportent pas setSelectionRange
        }
      }
    }
  }
}
