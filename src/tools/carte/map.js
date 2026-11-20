/* Moteur de rendu de la carte : tout est dessiné dans un seul <svg> (feuille complète),
 * en unités « 1 U = 1 mm de papier » (viewBox = taille de la page × 4). */
import { download, svgToPng } from '../../shared/export.js';
import { PAGES as SHEET_PAGES } from '../../shared/page.js';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import { colorGraph } from './fourcolor.js';
import { frName } from './data/names-fr.js';
import { CAPITALS, CITIES, OCEANS } from './data/places.js';
import { LABEL_POS, REGIONS } from './data/countries.js';
import { FONTS, PALETTES } from './data/style.js';
import { flagUrl } from './data/flags.js';
import { fontFaceCss } from './data/fonts-embed.js';

const U = 4; // pixels du viewBox par millimètre
// formats de page de la feuille commune, sous la forme [largeur, hauteur] en mm
export const PAGES = Object.fromEntries(
  Object.entries(SHEET_PAGES).map(([k, p]) => [k, [p.w, p.h]]),
);
const rad = Math.PI / 180;
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2));
const NS = 'http://www.w3.org/2000/svg';

function biggestPolygon(f) {
  const geo = f.geometry;
  if (geo.type === 'Polygon') return geo;
  let best = null,
    ba = -1;
  for (const c of geo.coordinates) {
    const poly = { type: 'Polygon', coordinates: c };
    const a = d3.geoArea(poly);
    if (a > ba) {
      ba = a;
      best = poly;
    }
  }
  return best;
}

export class MapView {
  constructor(svgEl, tipEl) {
    this.svgEl = svgEl;
    this.svg = d3.select(svgEl);
    this.tip = tipEl;
    this.state = null;
    this.features = [];
    this.neighbors = [];
    this.colorIdx = [];
    this.nColors = 4;
    this.rot = [-10, -20, 0];
    this.k = 1;
    this.t = d3.zoomIdentity;
    this._last = d3.zoomIdentity;

    const s = this.svg;
    s.attr('xmlns', NS).attr('preserveAspectRatio', 'xMidYMid meet');
    const defs = s.append('defs');
    this.clipRect = defs.append('clipPath').attr('id', 'pm-clip').append('rect');

    this.bg = s.append('rect').attr('fill', '#fff');
    this.gMap = s.append('g').attr('clip-path', 'url(#pm-clip)');
    this.oceanRect = this.gMap.append('rect');
    this.oceanPath = this.gMap.append('path');
    this.grat = this.gMap.append('path').attr('fill', 'none');
    this.gC = this.gMap.append('g');
    this.gMount = this.gMap.append('g');
    this.gLines = this.gMap.append('g');
    this.gLabels = this.gMap.append('g');
    this.gCities = this.gMap.append('g');
    this.gOver = s.append('g');
    this.gHead = this.gOver.append('g');
    this.gScale = this.gOver.append('g');
    this.onPick = null;

    this.zoom = d3
      .zoom()
      .scaleExtent([0.6, 150])
      .on('zoom', (e) => this._onZoom(e));
    s.call(this.zoom).on('dblclick.zoom', null);
  }

  /* ---------- données ---------- */
  setData(topo) {
    const obj = topo.objects.countries;
    this.features = topojson.feature(topo, obj).features;
    this.neighbors = topojson.neighbors(obj.geometries);
    this.features.forEach((f, i) => {
      f.key = f.properties.name;
      f.i = i;
      f.big = biggestPolygon(f);
      f.cen = LABEL_POS[f.key] || d3.geoCentroid(f.big);
      f.fr = frName(f.key);
      f.area = d3.geoArea(f.big);
    });
    const r = colorGraph(this.neighbors, 4);
    this.colorIdx = r.colors;
    this.nColors = r.used;
  }

  /* ---------- mise en page ---------- */
  rebuild(reset) {
    const s = this.state;
    if (!s || !this.features.length) return;
    const [pw, ph] = PAGES[s.format];
    const W = pw * U,
      H = ph * U;
    this.W = W;
    this.H = H;
    this.pw = pw;
    this.ph = ph;
    this.svg.attr('viewBox', `0 0 ${W} ${H}`);
    this.bg.attr('width', W).attr('height', H);

    const pad = 8 * U;
    let hdr = 0;
    if (s.title.trim()) hdr += 17 * U;
    if (s.showName) hdr += 8 * U;
    const a = { x: pad, y: pad + hdr, w: W - 2 * pad, h: H - 2 * pad - hdr };
    this.area = a;
    this.clipRect
      .attr('x', a.x)
      .attr('y', a.y)
      .attr('width', a.w)
      .attr('height', a.h)
      .attr('rx', 3 * U);
    this.globe = s.projection === 'globe';

    // projection de base (vue « monde entier »)
    let p0;
    if (s.projection === 'mercator') {
      p0 = d3.geoMercator();
      const yT = mercY(80),
        yB = mercY(-58);
      const sc = Math.min(a.w / (2 * Math.PI), a.h / (yT - yB));
      p0.scale(sc).translate([a.x + a.w / 2, a.y + a.h / 2 + (sc * (yT + yB)) / 2]);
    } else {
      p0 =
        s.projection === 'naturalEarth'
          ? d3.geoNaturalEarth1()
          : s.projection === 'equalEarth'
            ? d3.geoEqualEarth()
            : d3.geoOrthographic().clipAngle(90);
      p0.fitExtent(
        [
          [a.x, a.y],
          [a.x + a.w, a.y + a.h],
        ],
        { type: 'Sphere' },
      );
    }
    if (!this.globe) p0.rotate([-this._cl(), 0, 0]);
    this.p0 = p0;
    this.s0 = p0.scale();
    this.t0 = p0.translate();
    this.proj =
      s.projection === 'mercator'
        ? d3.geoMercator()
        : s.projection === 'naturalEarth'
          ? d3.geoNaturalEarth1()
          : s.projection === 'equalEarth'
            ? d3.geoEqualEarth()
            : d3.geoOrthographic().clipAngle(90);

    this._drawOverlay();
    if (reset) {
      const v = this._regionView();
      if (this.globe) {
        this.rot = v.rot;
        this.k = v.k;
        this._last = d3.zoomIdentity.scale(v.k);
        this.svg.interrupt().call(this.zoom.transform, this._last);
      } else {
        this._last = v.t;
        this.svg.interrupt().call(this.zoom.transform, v.t);
      }
    } else {
      this._drawGeo();
    }
  }

  _regionView() {
    const r = REGIONS[this.state.region];
    const a = this.area;
    if (this.globe) {
      if (!r || !r.bbox) return { rot: [-this._cl(), -20, 0], k: 1 };
      const [w, so, e, n] = r.bbox;
      const cx = (w + e) / 2,
        cy = (so + n) / 2;
      const ang = Math.max((e - w) * Math.cos(cy * rad), n - so);
      return { rot: [-cx, -cy, 0], k: Math.min(10, Math.max(1, 160 / ang)) };
    }
    if (!r || !r.bbox) return { t: d3.zoomIdentity };
    const [w, so, e, n] = r.bbox;
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (let i = 0; i <= 4; i++)
      for (let j = 0; j <= 4; j++) {
        const pt = this.p0([w + ((e - w) * i) / 4, so + ((n - so) * j) / 4]);
        if (!pt) continue;
        x0 = Math.min(x0, pt[0]);
        x1 = Math.max(x1, pt[0]);
        y0 = Math.min(y0, pt[1]);
        y1 = Math.max(y1, pt[1]);
      }
    const k = 0.94 * Math.min(a.w / (x1 - x0), a.h / (y1 - y0));
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    return {
      t: d3.zoomIdentity.translate(a.x + a.w / 2 - k * cx, a.y + a.h / 2 - k * cy).scale(k),
    };
  }

  /* ---------- zoom / centrage ---------- */
  _onZoom(e) {
    const t = e.transform;
    if (this.globe) {
      if (t.k !== this._last.k) {
        this.k = t.k;
      } else {
        const R = this.s0 * this.k;
        this.rot[0] += (t.x - this._last.x) / R / rad;
        this.rot[1] -= (t.y - this._last.y) / R / rad;
        this.rot[1] = Math.max(-90, Math.min(90, this.rot[1]));
      }
    } else {
      this.t = t;
    }
    this._last = t;
    if (!this._raf)
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        this._drawGeo();
      });
  }

  zoomBy(f) {
    this.svg.transition().duration(300).call(this.zoom.scaleBy, f);
  }

  recenter() {
    const v = this._regionView();
    if (!this.globe) {
      this.svg.transition().duration(600).call(this.zoom.transform, v.t);
      return;
    }
    const r0 = this.rot.slice(),
      k0 = this.k;
    const ir = d3.interpolate(r0, v.rot),
      ik = d3.interpolate(k0, v.k);
    // la transition est portée par un autre nœud : zoom.transform interrompt celles du <svg>
    this.gOver
      .interrupt()
      .transition()
      .duration(700)
      .tween('globe', () => (u) => {
        this.rot = ir(u);
        const tr = d3.zoomIdentity.scale(ik(u));
        this._last = tr; // rotation fixée ici : pas de glisser parasite
        this.k = tr.k;
        this.svg.call(this.zoom.transform, tr);
      });
  }

  /* ---------- dessin ---------- */
  draw() {
    this._drawOverlay();
    this._drawGeo();
  }

  /* longitude au centre de la carte (monde entier uniquement) */
  _cl() {
    return this.state.region === 'world' ? this.state.centerLon || 0 : 0;
  }

  _pal() {
    return PALETTES[this.state.palette].colors;
  }

  _hl() {
    const h = this.state.hl;
    return h && h.length ? new Set(h) : null;
  }

  _fill(f) {
    const s = this.state;
    const hl = this._hl();
    if (hl && !hl.has(f.key)) return '#e4e4e4';
    if (!s.fill) return '#ffffff';
    const pal = this._pal();
    const idx = this.colorIdx[f.i];
    return pal[idx % pal.length];
  }

  _drawGeo() {
    const s = this.state;
    if (!s || !this.proj || !this.area) return;
    const a = this.area,
      p = this.proj,
      t = this.t;
    const coloring = !s.fill;
    const ink = '#111',
      line = '#33415c';
    this.svgEl.dataset.mode = s.fill ? 'color' : 'coloring';

    if (this.globe)
      p.scale(this.s0 * this.k)
        .translate(this.t0)
        .rotate(this.rot);
    else
      p.rotate([-this._cl(), 0, 0])
        .scale(this.s0 * t.k)
        .translate([this.t0[0] * t.k + t.x, this.t0[1] * t.k + t.y]);
    const path = d3.geoPath(p);
    const center = [-this.rot[0], -this.rot[1]];
    const vis = (ll) => !this.globe || d3.geoDistance(ll, center) < Math.PI / 2 - 0.05;
    const inside = (pt, m = 0) =>
      pt && pt[0] > a.x + m && pt[0] < a.x + a.w - m && pt[1] > a.y + m && pt[1] < a.y + a.h - m;
    const proj = (ll) => {
      if (!vis(ll)) return null;
      const pt = p(ll);
      return inside(pt, U) ? pt : null;
    };

    // océan
    const oceanFill = s.ocean ? '#cfeeff' : '#ffffff';
    const merc = s.projection === 'mercator';
    this.oceanRect
      .attr('display', merc ? null : 'none')
      .attr('x', a.x)
      .attr('y', a.y)
      .attr('width', a.w)
      .attr('height', a.h)
      .attr('fill', oceanFill);
    const sphere = merc ? '' : path({ type: 'Sphere' });
    this.oceanPath
      .attr('display', merc ? 'none' : null)
      .attr('d', sphere)
      .attr('fill', oceanFill)
      .attr('stroke', coloring ? ink : line)
      .attr('stroke-width', 0.5 * U);
    this.grat
      .attr('display', s.graticule ? null : 'none')
      .attr('d', s.graticule ? path(d3.geoGraticule10()) : '')
      .attr('stroke', '#000')
      .attr('stroke-opacity', coloring ? 0.4 : 0.18)
      .attr('stroke-width', 0.2 * U);

    // pays
    const feats = merc ? this.features.filter((f) => f.key !== 'Antarctica') : this.features;
    const sel = this.gC.selectAll('path').data(feats, (d) => d.key);
    sel.exit().remove();
    const self = this;
    const en = sel
      .enter()
      .append('path')
      .attr('class', 'country')
      .attr('stroke-linejoin', 'round')
      .on('pointermove', (e, d) => {
        if (!self.tip) return;
        self.tip.textContent = d.fr;
        self.tip.style.left = e.clientX + 14 + 'px';
        self.tip.style.top = e.clientY + 14 + 'px';
        self.tip.hidden = s.dots;
      })
      .on('pointerleave', () => {
        if (self.tip) self.tip.hidden = true;
      })
      .on('click', (e, d) => {
        if (self.onPick) self.onPick(d.key);
      });
    const hl = this._hl();
    en.merge(sel)
      .attr('d', path)
      .attr('fill', (d) => this._fill(d))
      .attr('stroke', coloring ? ink : line)
      .attr(
        'stroke-width',
        (d) => s.stroke * U * (coloring ? 1.8 : 1) * (hl && hl.has(d.key) ? 1.8 : 1),
      );
    if (hl)
      this.gC
        .selectAll('path')
        .filter((d) => hl.has(d.key))
        .raise();

    const boxes = [];
    const free = (b) =>
      !boxes.some((o) => b.x < o.x + o.w && b.x + b.w > o.x && b.y < o.y + o.h && b.y + b.h > o.y);
    const label = (grp, txt, x, y, fs, o = {}) => {
      const anchor = o.anchor || 'middle';
      const tw = txt.length * fs * 0.56,
        h = fs * 1.1,
        pd = 0.4 * U;
      const fh = fs * 0.95,
        fwid = fh * (4 / 3); // drapeau 4:3
      const fw = o.flag ? fwid + (txt ? 0.35 * fs : 0) : 0;
      const w = fw + tw;
      const bx = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
      const b = { x: bx - pd, y: y - h / 2 - pd, w: w + 2 * pd, h: h + 2 * pd };
      if (!inside([bx, y], 0) || !inside([bx + w, y], 0) || !free(b)) return false;
      boxes.push(b);
      if (o.flag) {
        grp
          .append('image')
          .attr('href', o.flag)
          .attr('x', bx)
          .attr('y', y - fh / 2)
          .attr('width', fwid)
          .attr('height', fh)
          .attr('preserveAspectRatio', 'none')
          .attr('pointer-events', 'none');
        grp
          .append('rect')
          .attr('x', bx)
          .attr('y', y - fh / 2)
          .attr('width', fwid)
          .attr('height', fh)
          .attr('fill', 'none')
          .attr('stroke', '#33415c')
          .attr('stroke-width', 0.2 * U)
          .attr('pointer-events', 'none');
      }
      if (!txt) return true;
      const tx0 = bx + fw;
      if (s.dots && !o.noDots) {
        // pointillés à la place du nom : l'enfant l'écrit lui-même
        grp
          .append('line')
          .attr('x1', tx0)
          .attr('x2', tx0 + tw)
          .attr('y1', y + fs * 0.3)
          .attr('y2', y + fs * 0.3)
          .attr('stroke', o.fill || '#1d2b3a')
          .attr('stroke-width', fs * 0.14)
          .attr('stroke-linecap', 'round')
          .attr('stroke-dasharray', `0 ${fs * 0.4}`)
          .attr('pointer-events', 'none');
        return true;
      }
      grp
        .append('text')
        .attr('x', o.flag ? tx0 : x)
        .attr('y', y)
        .attr('text-anchor', o.flag ? 'start' : anchor)
        .attr('dominant-baseline', 'central')
        .attr('font-family', s.font)
        .attr('font-size', fs)
        .attr('font-weight', o.weight || 700)
        .attr('font-style', o.italic ? 'italic' : null)
        .attr('letter-spacing', o.spacing || null)
        .attr('fill', o.fill || '#1d2b3a')
        .attr('stroke', o.halo === false ? null : '#fff')
        .attr('stroke-width', fs * 0.22)
        .attr('paint-order', 'stroke')
        .attr('stroke-linejoin', 'round')
        .attr('pointer-events', 'none')
        .text(txt);
      return true;
    };

    // équateur, tropiques, cercles polaires
    this.gLines.selectAll('*').remove();
    if (s.tropics) {
      [
        [0, 'Équateur', 1],
        [23.44, 'Tropique du Cancer'],
        [-23.44, 'Tropique du Capricorne'],
        [66.56, 'Cercle polaire arctique'],
        [-66.56, 'Cercle polaire antarctique'],
      ].forEach(([lat, name, solid]) => {
        const coords = d3.range(-180, 181, 2).map((l) => [l, lat]);
        this.gLines
          .append('path')
          .attr('d', path({ type: 'LineString', coordinates: coords }))
          .attr('fill', 'none')
          .attr('stroke', coloring ? ink : '#c0392b')
          .attr('stroke-width', (solid ? 0.5 : 0.35) * U)
          .attr('stroke-dasharray', solid ? null : `${2 * U} ${1.4 * U}`)
          .attr('pointer-events', 'none');
        let lon = null;
        if (this.globe) lon = center[0] - 35;
        else {
          const yy = p([0, lat])[1];
          const inv = yy != null ? p.invert([a.x + 3 * U, yy]) : null;
          if (inv) lon = inv[0] + 1;
        }
        if (lon !== null) {
          const pt = proj([lon, lat]);
          if (pt)
            label(this.gLines, name, pt[0], pt[1] - 2 * U, 2.6 * U, {
              anchor: 'start',
              fill: coloring ? ink : '#8e2b1f',
              weight: 400,
              italic: true,
            });
        }
      });
    }

    // villes et capitales : le point (rond ou étoile) et son nom sont placés ensemble
    this.gLabels.selectAll('*').remove();
    this.gCities.selectAll('*').remove();
    const placed = [];
    const near = (lon, lat, list) =>
      list.some((c) => Math.abs(c[1] - lon) < 0.6 && Math.abs(c[2] - lat) < 0.6);
    const star = (cx, cy, R) =>
      d3.range(10).map((k) => {
        const a = (k * Math.PI) / 5 - Math.PI / 2,
          r = k % 2 ? R * 0.42 : R;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      });
    const point = (name, lon, lat, big, cap) => {
      if (near(lon, lat, placed)) return;
      const pt = proj([lon, lat]);
      if (!pt) return;
      const r = (cap ? 1.7 : big ? 1.2 : 0.9) * U,
        fs = 2.9 * U * s.fontScale,
        g = r + 1.2 * U;
      const dot = { x: pt[0] - r, y: pt[1] - r, w: 2 * r, h: 2 * r };
      if (!free(dot)) return;
      const tries = [
        [pt[0] + g, pt[1], 'start'],
        [pt[0] - g, pt[1], 'end'],
        [pt[0], pt[1] - r - fs * 0.8, 'middle'],
        [pt[0], pt[1] + r + fs * 0.8, 'middle'],
      ];
      if (!tries.some(([x, y, anchor]) => label(this.gCities, name, x, y, fs, { anchor }))) return;
      boxes.push(dot);
      placed.push([name, lon, lat]);
      if (cap) {
        this.gCities
          .append('polygon')
          .attr(
            'points',
            star(pt[0], pt[1], r)
              .map((q) => q.join(','))
              .join(' '),
          )
          .attr('fill', '#111')
          .attr('stroke', '#fff')
          .attr('stroke-width', 0.3 * U)
          .attr('stroke-linejoin', 'round');
      } else {
        this.gCities
          .append('circle')
          .attr('cx', pt[0])
          .attr('cy', pt[1])
          .attr('r', r)
          .attr('fill', '#111')
          .attr('stroke', '#fff')
          .attr('stroke-width', 0.35 * U);
      }
    };
    const cities = (minR, maxR) => {
      for (const [name, lon, lat, rank] of CITIES) {
        if (rank < minR || rank > maxR || rank > s.cityLevel - 1) continue;
        point(name, lon, lat, rank === 1, near(lon, lat, CAPITALS));
      }
    };
    const capitals = () => {
      if (s.cityLevel < 1) return;
      for (const [name, lon, lat] of CAPITALS) point(name, lon, lat, false, true);
    };

    // 1) très grandes villes, puis capitales (prioritaires : un nom de pays ne doit pas les masquer)
    cities(1, 1);
    capitals();

    // 2) noms des pays / numéros, du plus grand au plus petit ; police réduite si ça ne tient pas
    const cands = [];
    const wantNames = s.showCountries;
    const wantFlags = s.flags;
    if (wantNames || wantFlags) {
      for (const f of feats) {
        if (hl && !hl.has(f.key)) continue;
        const pt = p(f.cen);
        if (!pt || !vis(f.cen) || !inside(pt, 2 * U)) continue;
        const A = Math.abs(path.area(f.big));
        const bw = path.bounds(f.big);
        cands.push({ f, pt, A, bw: bw[1][0] - bw[0][0] });
      }
      cands.sort((x, y) => y.A - x.A);
      const fsc = s.fontScale;
      for (const c of cands) {
        const flag = wantFlags ? flagUrl(c.f.key) : null;
        if (!wantNames && !flag) continue;
        const n = (wantNames ? c.f.fr.length : 0) + (flag ? 3 : 0);
        const fit = Math.min(5.5 * U, Math.max(c.bw * 0.92, Math.sqrt(c.A) * 1.15) / (n * 0.56));
        if (fit < 3 * U * 0.8) continue;
        const base = Math.max(3 * U, fit) * fsc;
        const txt = wantNames ? c.f.fr : '';
        sizes: for (const k of [1, 0.85, 0.72]) {
          if (base * k < 2.1 * U) break;
          // au centre, sinon légèrement décalé pour éviter une capitale ou une ville
          for (const dy of [0, -1.2, 1.2]) {
            if (label(this.gLabels, txt, c.pt[0], c.pt[1] + dy * base * k, base * k, { flag }))
              break sizes;
          }
        }
      }
    }

    // 3) autres villes par ordre d'importance
    cities(2, 99);

    // 4) océans et mers : légère translation si l'emplacement est pris
    if (s.showOceans) {
      for (const [name, lon, lat] of OCEANS) {
        const pt = proj([lon, lat]);
        if (!pt) continue;
        const fs = 3.8 * U * s.fontScale;
        const o = {
          italic: true,
          weight: 400,
          spacing: 0.5 * U,
          fill: coloring ? '#111' : '#1f5f94',
          halo: false,
        };
        for (const [dx, dy] of [
          [0, 0],
          [0, -fs * 1.2],
          [0, fs * 1.2],
          [-fs * 3, 0],
          [fs * 3, 0],
        ]) {
          if (label(this.gLabels, name, pt[0] + dx, pt[1] + dy, fs, o)) break;
        }
      }
    }

    this._drawScale(p);
  }

  /* échelle : évaluée au centre de la carte (approximative, surtout en Mercator ou près des bords) */
  _drawScale(p) {
    const s = this.state,
      a = this.area,
      G = this.gScale;
    G.selectAll('*').remove();
    if (!s.scale) return;
    const cx = a.x + a.w / 2,
      cy = a.y + a.h / 2,
      d = 20 * U;
    const g1 = p.invert([cx, cy]),
      g2 = p.invert([cx + d, cy]);
    if (!g1 || !g2 || !isFinite(g1[0]) || !isFinite(g2[0])) return;
    const kmPx = (d3.geoDistance(g1, g2) * 6371) / d;
    if (!(kmPx > 0)) return;
    const target = kmPx * 30 * U; // ~30 mm de papier
    const mag = Math.pow(10, Math.floor(Math.log10(target)));
    const km = [1, 2, 5, 10]
      .map((m) => m * mag)
      .reduce((b, v) => (Math.abs(v - target) < Math.abs(b - target) ? v : b));
    const len = km / kmPx,
      h = 1.6 * U;
    const x0 = cx - len / 2,
      y0 = a.y + a.h - 6 * U;
    G.append('rect')
      .attr('x', x0 - 3 * U)
      .attr('y', y0 - 6.2 * U)
      .attr('width', len + 6 * U)
      .attr('height', 11 * U)
      .attr('rx', 2 * U)
      .attr('fill', '#fff')
      .attr('fill-opacity', 0.85);
    [0, 1].forEach((i) =>
      G.append('rect')
        .attr('x', x0 + (i * len) / 2)
        .attr('y', y0)
        .attr('width', len / 2)
        .attr('height', h)
        .attr('fill', i ? '#fff' : '#111')
        .attr('stroke', '#111')
        .attr('stroke-width', 0.3 * U),
    );
    const t = (x, anchor, txt) =>
      G.append('text')
        .attr('x', x)
        .attr('y', y0 - 2.4 * U)
        .attr('text-anchor', anchor)
        .attr('dominant-baseline', 'central')
        .attr('font-family', s.font)
        .attr('font-weight', 700)
        .attr('font-size', 2.6 * U)
        .attr('fill', '#111')
        .text(txt);
    const fmt = (v) => v.toLocaleString('fr-FR');
    t(x0, 'middle', '0');
    t(x0 + len, 'middle', fmt(km) + ' km');
  }

  /* ---------- titre, cadre, légende, rose des vents ---------- */
  _drawOverlay() {
    const s = this.state,
      a = this.area;
    if (!s || !a) return;
    const W = this.W,
      pad = 8 * U,
      coloring = !s.fill;
    const tcol = PALETTES[s.palette].title;
    const ink = coloring ? '#111' : '#33415c';
    const g = this.gHead;
    g.selectAll('*').remove();

    let y = pad;
    const title = s.title.trim();
    if (title) {
      const fs = Math.min(11 * U, (W - 2 * pad) / (title.length * 0.62));
      const tx = g
        .append('text')
        .attr('x', W / 2)
        .attr('y', y + 8.5 * U)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-family', s.font)
        .attr('font-size', fs)
        .attr('font-weight', 700);
      tx.attr('fill', '#111').text(title);
      y += 17 * U;
    }
    if (s.showName) {
      const cy = y + 4 * U,
        fs = 3.8 * U;
      const txt = (x, t) =>
        g
          .append('text')
          .attr('x', x)
          .attr('y', cy)
          .attr('dominant-baseline', 'central')
          .attr('font-family', s.font)
          .attr('font-size', fs)
          .attr('font-weight', 700)
          .attr('fill', '#333')
          .text(t);
      const ln = (x1, x2) =>
        g
          .append('line')
          .attr('x1', x1)
          .attr('x2', x2)
          .attr('y1', cy + 2 * U)
          .attr('y2', cy + 2 * U)
          .attr('stroke', '#555')
          .attr('stroke-width', 0.3 * U);
      txt(pad, 'Prénom :');
      ln(pad + 22 * U, W * 0.58);
      txt(W * 0.62, 'Date :');
      ln(W * 0.62 + 14 * U, W - pad);
    }
    g.append('rect')
      .attr('x', a.x)
      .attr('y', a.y)
      .attr('width', a.w)
      .attr('height', a.h)
      .attr('rx', 3 * U)
      .attr('fill', 'none')
      .attr('stroke', ink)
      .attr('stroke-width', 0.6 * U);

    // rose des vents : petite, calée dans l'angle en bas à droite de la carte
    if (s.compass) {
      const R = 4.5 * U,
        q = 1 * U,
        rb = R + 3.2 * U;
      const cx = a.x + a.w - rb - 2 * U,
        cy = a.y + a.h - rb - 1.5 * U;
      const c = g.append('g').attr('transform', `translate(${cx},${cy})`);
      c.append('circle')
        .attr('r', rb)
        .attr('fill', '#fff')
        .attr('fill-opacity', 0.85)
        .attr('stroke', ink)
        .attr('stroke-width', 0.25 * U);
      c.append('path')
        .attr('d', `M0,${-R}L${q},${-q}L${R},0L${q},${q}L0,${R}L${-q},${q}L${-R},0L${-q},${-q}Z`)
        .attr('fill', '#fff')
        .attr('stroke', ink)
        .attr('stroke-width', 0.3 * U)
        .attr('stroke-linejoin', 'round');
      c.append('path')
        .attr('d', `M0,${-R}L${q},${-q}L${-q},${-q}Z`)
        .attr('fill', coloring ? '#fff' : tcol[0])
        .attr('stroke', ink)
        .attr('stroke-width', 0.3 * U);
      c.append('text')
        .attr('y', -R - 1.1 * U)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'central')
        .attr('font-family', s.font)
        .attr('font-weight', 800)
        .attr('font-size', 2.2 * U)
        .attr('fill', ink)
        .text('N');
    }
  }

  /* ---------- export ---------- */
  async _serialize() {
    const clone = this.svgEl.cloneNode(true);
    clone.setAttribute('width', `${this.pw}mm`);
    clone.setAttribute('height', `${this.ph}mm`);
    clone.removeAttribute('class');
    clone.removeAttribute('data-mode');
    const font = FONTS.find((f) => f.css === this.state.font);
    if (font && font.embed) {
      try {
        const st = document.createElementNS(NS, 'style');
        st.textContent = await fontFaceCss(font.embed);
        clone.insertBefore(st, clone.firstChild);
      } catch {
        /* police non intégrée : repli sur la police du système */
      }
    }
    // drapeaux : images du site -> intégrées au fichier (sinon absentes de l'export)
    const imgs = Array.from(clone.querySelectorAll('image:not([href^="data:"])'));
    const cache = {};
    await Promise.all(
      imgs.map(async (im) => {
        const url = im.getAttribute('href');
        try {
          if (!cache[url]) cache[url] = fetch(url).then((r) => r.text());
          const svg = await cache[url];
          im.setAttribute(
            'href',
            'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))),
          );
        } catch {
          im.remove();
        }
      }),
    );
    return new XMLSerializer().serializeToString(clone);
  }

  async exportSVG() {
    const str = await this._serialize();
    download('carte.svg', new Blob([str], { type: 'image/svg+xml;charset=utf-8' }));
  }

  async exportPNG() {
    const svg = await this._serialize();
    download('carte.png', await svgToPng({ w: this.pw, h: this.ph, svg }));
  }
}
