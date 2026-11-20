import './styles/fonts.css';
import './styles/pico.css';
import './styles/panel.css';
import './styles/base.css';
import { initNav } from './shared/nav.js';
import { TOOLS } from './shared/tools.js';

initNav('accueil');

// ordre des cartes : 3 en haut, puis lecture et écriture en bas (le menu garde l'ordre de TOOLS)
const HOME_ORDER = ['formes', 'labyrinthe', 'carte', 'lecture', 'ecriture'];
const rank = (id) => (HOME_ORDER.includes(id) ? HOME_ORDER.indexOf(id) : HOME_ORDER.length);

document.getElementById('cards').replaceChildren(
  ...[...TOOLS]
    .sort((a, b) => rank(a.id) - rank(b.id))
    .map(({ href, title, description }) => {
      const a = document.createElement('a');
      a.className = 'tool-card';
      a.href = href;
      const h2 = document.createElement('h2');
      h2.textContent = title;
      const p = document.createElement('p');
      p.textContent = description;
      a.append(h2, p);
      return a;
    }),
);
