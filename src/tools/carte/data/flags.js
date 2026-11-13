import { ISO } from './countries.js';

/* Drapeaux (paquet flag-icons) : fichiers du site, plus de téléchargement depuis un CDN. */
const FILES = import.meta.glob('../../../../node_modules/flag-icons/flags/4x3/*.svg', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** URL du drapeau d'un pays (nom Natural Earth), ou null s'il n'y en a pas. */
export const flagUrl = (name) => {
  const code = ISO[name];
  return code ? (FILES[`../../../../node_modules/flag-icons/flags/4x3/${code}.svg`] ?? null) : null;
};
