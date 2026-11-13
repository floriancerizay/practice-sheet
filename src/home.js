import './styles/fonts.css';
import './styles/panel.css';
import './styles/base.css';
import { initNav } from './shared/nav.js';
import { TOOLS } from './shared/tools.js';

initNav('accueil');

document.getElementById('cards').replaceChildren(
  ...TOOLS.map(({ href, title, description }) => {
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
