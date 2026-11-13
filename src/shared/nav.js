import { TOOLS } from './tools.js';

/** Remplit la barre de navigation `<nav id="topbar">` ; `current` est l'id de l'outil ouvert (ou 'accueil'). */
export function initNav(current) {
  const nav = document.getElementById('topbar');
  const links = [{ id: 'accueil', href: 'index.html', label: 'Accueil' }, ...TOOLS];
  nav.replaceChildren();
  const brand = document.createElement('strong');
  brand.textContent = 'Practice sheet';
  nav.append(brand);
  for (const { id, href, label } of links) {
    const a = document.createElement('a');
    a.href = href;
    a.textContent = label;
    if (id === current) a.setAttribute('aria-current', 'page');
    nav.append(a);
  }
}
