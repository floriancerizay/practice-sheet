import { TOOLS } from './tools.js';
import logo from '../assets/logo.svg?url';

/**
 * Remplit la barre de navigation `<nav id="topbar">` ; `current` est l'id de l'outil ouvert (ou 'accueil').
 * En mode mobile (CSS), les liens sont repliés derrière un bouton burger.
 */
export function initNav(current) {
  const nav = document.getElementById('topbar');
  const links = [{ id: 'accueil', href: 'index.html', label: 'Accueil' }, ...TOOLS];
  nav.replaceChildren();
  const brand = document.createElement('strong');
  const mark = document.createElement('img');
  mark.src = logo;
  mark.alt = '';
  brand.append(mark);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'burger';
  toggle.id = 'topbar-toggle';
  toggle.setAttribute('aria-label', 'Menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'topbar-links');
  toggle.innerHTML = '<span></span><span></span><span></span>';

  const list = document.createElement('div');
  list.className = 'topbar-links';
  list.id = 'topbar-links';
  for (const { id, href, label } of links) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (id === current) a.setAttribute('aria-current', 'page');
    list.append(a);
  }
  nav.append(brand, toggle, list);

  const setOpen = (open) => {
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}
