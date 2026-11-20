/** Composants du panneau de réglages : boutons segmentés, lien de partage, sélecteur de couleur. */

const el = (tag, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};
const fire = (input) => input.dispatchEvent(new Event('input', { bubbles: true }));

/**
 * Remplace un `<select>` (masqué mais conservé : valeur et événements) par des boutons segmentés.
 * Les `<option hidden>` (état « personnalisé ») n'ont pas de bouton. Renvoie une fonction de rafraîchissement.
 */
export function segmented(select) {
  // toutes les options ont un bouton ; celui d'une option masquée (`hidden`) est caché, à chaque rafraîchissement
  const options = [...select.options];
  const seg = el('div', 'seg');
  const buttons = options.map((o) => {
    const b = el('button', '', o.textContent);
    b.type = 'button';
    b.addEventListener('click', () => {
      select.value = o.value;
      fire(select);
    });
    seg.append(b);
    return b;
  });
  const refresh = () => {
    buttons.forEach((b, i) => {
      const on = options[i].value === select.value;
      b.hidden = options[i].hidden;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    // 2 boutons : 2 colonnes ; 3 : 3 colonnes ; 4 et plus : 2 colonnes
    const n = options.filter((o) => !o.hidden).length;
    seg.className = n === 3 ? 'seg seg-3' : 'seg seg-2';
  };
  select.classList.add('sr-only');
  select.setAttribute('aria-hidden', 'true');
  select.tabIndex = -1;
  select.after(seg);
  select.addEventListener('input', refresh);
  select.addEventListener('change', refresh);
  refresh();
  return refresh;
}

/** Remplit `o` avec les valeurs de l'adresse : champs texte (`fields`) et cases à cocher (`checks`, « 1 » ou « 0 »). */
export function readQuery(o, fields, checks = []) {
  const q = new URLSearchParams(location.search);
  fields.forEach((f) => q.has(f) && (o[f] = q.get(f)));
  checks.forEach((f) => q.has(f) && (o[f] = q.get(f) === '1'));
  return q;
}

/** Adresse de la page avec les réglages passés en paramètres. */
export function shareUrl(params) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    q.set(k, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return `${location.origin}${location.pathname}?${q}`;
}

/** Bouton « Copier le lien » : `collect()` renvoie les réglages à mettre dans l'adresse. */
export function initShare(button, collect) {
  const label = button.textContent;
  button.addEventListener('click', async () => {
    const url = shareUrl(collect());
    try {
      await navigator.clipboard.writeText(url);
      button.textContent = 'Lien copié';
    } catch {
      prompt('Lien :', url);
    }
    setTimeout(() => (button.textContent = label), 1500);
  });
}

export const COLOR_PRESETS = [
  '#111111',
  '#555555',
  '#9a9a9a',
  '#d62828',
  '#d55e00',
  '#e69f00',
  '#1a8f3c',
  '#009e73',
  '#0072b2',
  '#1d5fd1',
  '#7b2cbf',
  '#cc79a7',
];

/**
 * Remplace un `<input type="color">` par une pastille cliquable : palette de couleurs prêtes à l'emploi
 * et choix libre. L'input reste dans la page (valeur, événements `input`). Renvoie une fonction de rafraîchissement
 * à appeler quand la valeur est changée par le code.
 */
export function colorPicker(input, name) {
  const field = el('div', 'color-field');
  const label = el('span', 'name', name);
  const btn = el('button', 'dot-btn');
  btn.type = 'button';
  btn.setAttribute('aria-haspopup', 'true');
  btn.setAttribute('aria-expanded', 'false');
  const dot = el('i', 'dot');
  const hex = el('span', 'hex');
  btn.append(dot, hex);
  const pop = el('div', 'color-pop');
  pop.hidden = true;
  const grid = el('div', 'grid');
  const custom = el('button', 'mini custom', 'Autre couleur…');
  custom.type = 'button';
  const presets = COLOR_PRESETS.map((c) => {
    const b = el('button', 'dot');
    b.type = 'button';
    b.style.background = c;
    b.title = c;
    b.setAttribute('aria-label', `${name} : ${c}`);
    b.addEventListener('click', () => {
      input.value = c;
      fire(input);
      close();
    });
    grid.append(b);
    return b;
  });
  pop.append(grid, custom);
  field.append(label, btn, pop);
  input.before(field);
  input.classList.add('sr-only');
  input.tabIndex = -1;
  input.setAttribute('aria-hidden', 'true');

  const refresh = () => {
    dot.style.background = input.value;
    hex.textContent = input.value;
    btn.setAttribute('aria-label', `${name} : ${input.value}, changer`);
    presets.forEach((b) => b.classList.toggle('active', b.title === input.value));
  };
  const close = () => {
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  btn.addEventListener('click', () => {
    pop.hidden = !pop.hidden;
    btn.setAttribute('aria-expanded', String(!pop.hidden));
  });
  custom.addEventListener('click', () => input.click());
  input.addEventListener('input', refresh);
  document.addEventListener('click', (e) => !field.contains(e.target) && close());
  field.addEventListener('keydown', (e) => e.key === 'Escape' && (close(), btn.focus()));
  refresh();
  return refresh;
}

/** Carte « En-tête » commune aux feuilles : titre (vide = aucun) et ligne « Prénom / Date ». */
export function headerCard() {
  const card = el('details', 'card');
  card.open = true;
  card.innerHTML = `
    <summary><h2>En-tête</h2></summary>
    <label class="field" for="title">Titre (vide : aucun)<input type="text" id="title" /></label>
    <label class="check"><input type="checkbox" id="showName" checked /> Ligne « Prénom / Date »</label>`;
  return card;
}

/** Bloc d'actions commun : format de la page, imprimer, lien de partage, exports SVG et PNG. */
export function actionsCard() {
  const card = el('section', 'card actions');
  card.innerHTML = `
    <label class="field inline" for="page">Format de la page
      <select id="page">
        <option value="A4P">A4 portrait</option>
        <option value="A4L">A4 paysage</option>
        <option value="A3P">A3 portrait</option>
        <option value="A3L">A3 paysage</option>
      </select>
    </label>
    <div class="row">
      <button class="action primary" id="print" type="button">Imprimer / PDF</button>
      <button class="action ghost" id="share" type="button">Copier le lien</button>
      <button class="action" id="export-svg" type="button">Exporter SVG</button>
      <button class="action" id="export-png" type="button">Exporter PNG</button>
    </div>`;
  return card;
}
