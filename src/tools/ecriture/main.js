import { $, createTool, num } from '../../shared/tool.js';
import { loadFonts, parseItems, renderSheets } from './sheet.js';

const OLD_DEFAULT_TEXT = 'ABCDEF';

const tool = createTool({
  id: 'ecriture',
  fields: ['text', 'mode', 'style', 'ruling', 'i', 'gap', 'rowsPerItem', 'dotRows', 'dotStyle'],
  checks: ['arrows', 'modelEach', 'gray'],
  state: {
    // ancien texte par défaut, enregistré tel quel : repartir du texte par défaut actuel
    migrate: (o) => o.text === OLD_DEFAULT_TEXT && delete o.text,
    restore: (o, q) => q.has('text') && !q.has('mode') && (o.mode = 'words'),
  },
  ready: loadFonts,
  render({ page, title, showName }) {
    const cfg = {
      page,
      title,
      showName,
      mode: $('mode').value,
      style: $('style').value,
      ruling: $('ruling').value,
      i: num('i') || 2.5,
      gap: num('gap'),
      rowsPerItem: Math.max(1, num('rowsPerItem')),
      dotRows: num('dotRows'),
      dotStyle: $('dotStyle').value,
      arrows: $('arrows').checked,
      modelEach: $('modelEach').checked,
      gray: $('gray').checked,
    };
    renderSheets($('sheets'), cfg, parseItems($('text').value, cfg.mode));
  },
});

document.querySelectorAll('[data-fill]').forEach((b) =>
  b.addEventListener('click', () => {
    $('text').value = b.dataset.fill;
    $('mode').value = b.dataset.mode;
    tool.draw();
  }),
);
await tool.start();
