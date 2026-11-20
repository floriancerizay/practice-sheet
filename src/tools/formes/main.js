import { $, createTool, num } from '../../shared/tool.js';
import { SHAPES } from './shapes.js';
import { renderSheets } from './formes.js';

let selected = new Set(['cercle', 'carre', 'triangle']);

for (const g of ['formes', 'traits', 'graphisme']) {
  const box = $(g);
  for (const s of SHAPES.filter((s) => s.group === g)) {
    const l = document.createElement('label');
    l.className = 'check';
    l.innerHTML = `<input type="checkbox" data-shape="${s.id}"> ${s.label}`;
    box.append(l);
  }
}
const syncBoxes = () =>
  document
    .querySelectorAll('[data-shape]')
    .forEach((b) => (b.checked = selected.has(b.dataset.shape)));

const tool = createTool({
  id: 'formes',
  fields: ['size', 'gap', 'rowsPerShape', 'dotRows', 'dotStyle', 'bg'],
  checks: ['arrows', 'modelEach', 'gray'],
  state: {
    save: () => ({ shapes: [...selected] }),
    share: () => ({ shapes: [...selected].join(',') }),
    restore: (o, q) => q.has('shapes') && (o.shapes = q.get('shapes').split(',')),
    apply: (o) => {
      if (Array.isArray(o.shapes)) selected = new Set(o.shapes);
      syncBoxes();
    },
  },
  render({ page, title, showName }) {
    const cfg = {
      page,
      title,
      showName,
      size: Math.min(60, Math.max(8, num('size', 25))),
      gap: Math.max(0, num('gap', 8)),
      rowsPerShape: Math.max(1, num('rowsPerShape', 2)),
      dotRows: Math.max(0, num('dotRows', 1)),
      dotStyle: $('dotStyle').value,
      bg: $('bg').value,
      arrows: $('arrows').checked,
      modelEach: $('modelEach').checked,
      gray: $('gray').checked,
    };
    renderSheets(
      $('sheets'),
      cfg,
      SHAPES.map((s) => s.id).filter((id) => selected.has(id)),
    );
  },
});

document.addEventListener('change', (e) => {
  const b = e.target.closest('[data-shape]');
  if (!b) return;
  b.checked ? selected.add(b.dataset.shape) : selected.delete(b.dataset.shape);
  tool.draw();
});
document.querySelectorAll('[data-pick]').forEach((b) =>
  b.addEventListener('click', () => {
    const grp = b.dataset.group;
    for (const s of SHAPES.filter((s) => !grp || s.group === grp))
      b.dataset.pick === 'all' ? selected.add(s.id) : selected.delete(s.id);
    syncBoxes();
    tool.draw();
  }),
);
await tool.start();
