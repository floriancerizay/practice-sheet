/* Coloriage de graphe : théorème des quatre couleurs.
 * DSATUR (ordre par saturation puis degré) + retour arrière.
 * Une carte réelle peut ne pas être strictement planaire (pays en plusieurs morceaux,
 * ex. la France et la Guyane) : si 4 couleurs ne suffisent pas, on essaie 5, puis 6. */
function tryColor(adj, maxColors, nodeLimit) {
  const n = adj.length;
  const color = new Array(n).fill(-1);
  let nodes = 0;

  function pickNext() {
    let best = -1,
      bs = -1,
      bd = -1;
    for (let i = 0; i < n; i++) {
      if (color[i] >= 0) continue;
      const seen = new Set();
      let deg = 0;
      for (const j of adj[i]) {
        if (color[j] >= 0) seen.add(color[j]);
        else deg++;
      }
      if (seen.size > bs || (seen.size === bs && deg > bd)) {
        best = i;
        bs = seen.size;
        bd = deg;
      }
    }
    return best;
  }

  function solve() {
    const v = pickNext();
    if (v < 0) return true;
    if (++nodes > nodeLimit) return false;
    const used = new Set(adj[v].map((j) => color[j]));
    for (let k = 0; k < maxColors; k++) {
      const c = (k + v) % maxColors; // rotation : répartit mieux les couleurs
      if (used.has(c)) continue;
      color[v] = c;
      if (solve()) return true;
      color[v] = -1;
      if (nodes > nodeLimit) return false;
    }
    return false;
  }

  return solve() ? color : null;
}

/** neighbors : tableau d'indices voisins par sommet (format topojson.neighbors). */
export function colorGraph(neighbors, maxColors = 4, nodeLimit = 200000) {
  const adj = neighbors.map((a, i) => Array.from(new Set(a)).filter((j) => j !== i));
  for (let k = maxColors; k <= maxColors + 2; k++) {
    const colors = tryColor(adj, k, nodeLimit);
    if (colors) return { colors, used: k };
  }
  // dernier recours : glouton
  const colors = new Array(adj.length).fill(-1);
  let used = 0;
  adj.forEach((a, i) => {
    const taken = new Set(a.map((j) => colors[j]));
    let c = 0;
    while (taken.has(c)) c++;
    colors[i] = c;
    used = Math.max(used, c + 1);
  });
  return { colors, used };
}

/** Renvoie la liste des paires de voisins ayant la même couleur (doit être vide). */
export function checkColoring(neighbors, colors) {
  const bad = [];
  neighbors.forEach((a, i) =>
    a.forEach((j) => {
      if (i < j && colors[i] === colors[j]) bad.push([i, j]);
    }),
  );
  return bad;
}
