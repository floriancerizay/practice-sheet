/* Palettes de coloriage et polices proposées. */

/* Palettes de 4 couleurs (+ 2 couleurs de secours si le graphe en réclame plus) */
const EXTRA = ['#cdb4db', '#bdbdbd'];
export const PALETTES = {
  pastel: { label: 'Pastel', colors: ['#ffadad', '#fdffb6', '#caffbf', '#9bf6ff'].concat(EXTRA),
    names: ['rose', 'jaune clair', 'vert clair', 'bleu clair'],
    title: ['#ee7b8f', '#e6b422', '#4cbf86', '#45a9d6'] },
  vives: { label: 'Vives', colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff'].concat(EXTRA),
    names: ['rouge', 'jaune', 'vert', 'bleu'],
    title: ['#ef476f', '#f59e0b', '#10b981', '#3b82f6'] },
  daltonien: { label: 'Daltonisme', colors: ['#e69f00', '#56b4e9', '#009e73', '#cc79a7'].concat(EXTRA),
    names: ['orange', 'bleu ciel', 'vert', 'rose-violet'],
    title: ['#d98a00', '#2f8fc9', '#009e73', '#b4548a'] },
  sobre: { label: 'Terre', colors: ['#e9c46a', '#e76f51', '#8ab17d', '#7aa6c2'].concat(EXTRA),
    names: ['doré', 'brique', 'vert sauge', 'bleu gris'],
    title: ['#c9962c', '#d85a3a', '#5f8a50', '#4f7f9f'] }
};

export const FONTS = [
  { label: 'Lexend', css: "'Lexend', sans-serif", embed: 'Lexend' },
  { label: 'Andika', css: "'Andika', sans-serif", embed: 'Andika' },
  { label: 'OpenDyslexic', css: "'OpenDyslexic', sans-serif", embed: 'OpenDyslexic' }
];
