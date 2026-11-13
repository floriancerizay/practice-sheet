# Practice sheet

Site statique (GitHub Pages ; Vite, JavaScript sans framework) de **feuilles à imprimer** pour parents et enseignants : on règle, on imprime (ou « Enregistrer en PDF »). Rien n'est envoyé à un serveur.

## Outils

- **Écriture** (`ecriture.html`) : lettres, chiffres, mots, prénoms ; script ou cursive ; réglure Seyès ou 4 lignes ; modèle + pointillés à repasser ; tracé fléché pour les lettres script a–z, A–Z et les chiffres 0–9.
- **Formes** (`formes.html`) : cercle, ovale, carré, rectangle, triangle, losange, demi-cercle, pentagone, hexagone, étoile, cœur, croix et traits (horizontale, verticale, oblique, zigzag, vagues, créneaux, spirale) et motifs de graphisme (ponts, coupes, boucles) ; modèle + pointillés à repasser, point de départ et sens du tracé, taille réglable, fond uni ou petits carreaux.
- **Labyrinthes** (`labyrinthe.html`) : labyrinthes parfaits rectangulaires, ronds ou en forme de cœur, triangle, losange, hexagone générés aléatoirement (facile à expert), un bouton « Nouveau labyrinthe », lien de partage (même labyrinthe), corrigé sur la feuille ou en page à part. Trois styles de murs (traits droits, coins arrondis, tubes) et, pour les formes libres, un contour en escalier ou lisse (courbe du cœur, coins arrondis des polygones).
- **Lecture** (`lecture.html`) : coloration de texte (voyelles, sons complexes, lettres muettes), palettes (par défaut, daltonisme Okabe-Ito, noir et blanc avec indices) et pastilles de couleur à choisir, présentation classique ou dyslexie (OpenDyslexic, interlettrage), réglages fins repliés.
- **Carte** (`carte.html`, ex-Print Map) : carte du monde à colorier (4 couleurs), projections (Natural Earth, Equal Earth, Mercator, globe), centrage, A4/A3, noms en pointillés, palettes (dont daltonisme), décors, export SVG/PNG et lien de partage.

Chaque outil a le même panneau de réglages (cartes repliables, boutons segmentés) avec, en bas, le **format de la page** (A4 ou A3, portrait ou paysage), **Imprimer / PDF** et **Copier le lien** (les réglages sont dans l'adresse). Toutes les feuilles partagent le même en-tête : titre (vide = aucun) et case « Ligne Prénom / Date ».

## Structure

```
src/
  index.html, ecriture.html, formes.html,   une page par outil (adresses inchangées)
  labyrinthe.html, lecture.html, carte.html
  home.js                  page d'accueil
  shared/                  tools.js (liste des outils : menu et accueil), nav.js, page.js (format de la page), panel.js, sheet-header.js (en-tête des feuilles)
  styles/                  fonts.css, panel.css (panneau de réglages commun), base.css (menu, feuilles), print.css
  shared/panel.js          boutons segmentés, lien de partage, sélecteur de couleur
  assets/fonts/            polices embarquées et leurs licences
  tools/
    ecriture/              feuilles d'écriture (réglure, tracé fléché)
    formes/                formes et traits à repasser
    labyrinthe/            générateur de labyrinthes : maze.js (algorithmes), labyrinthe.js (rendu SVG), contour.js (coins arrondis, contours lisses)
    lecture/               coloration de texte (graphemes.js, exceptions.js)
    carte/                 carte du monde : map.js (rendu SVG), fourcolor.js (4 couleurs), data/ (pays, villes, palettes)
tests/                     tests Vitest (graphèmes, labyrinthes, formes, 4 couleurs, drapeaux, pages)
```

Chaque outil a un module `main.js` (interface) et des modules de logique sans accès au DOM quand c'est possible, pour pouvoir les tester.
Pour ajouter un outil : un dossier dans `src/tools/`, une page HTML dans `src/`, une entrée dans `src/shared/tools.js` et dans `vite.config.js`.

## Développement

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # site statique dans dist/
npm run preview        # sert dist/ pour vérifier le build
npm test               # Vitest
npm run lint           # ESLint
npm run format:check   # Prettier
```

Imprimer en A4, marges « aucune », échelle 100 %.

## Déploiement

Le workflow [`pages.yml`](.github/workflows/pages.yml) vérifie le formatage, lance le lint et les tests, construit `dist/` (avec `BASE_PATH=/<dépôt>/`) et le publie sur GitHub Pages à chaque push sur `main`. Activer au préalable _Settings → Pages → Source : GitHub Actions_.

## Limites connues

- Segmentation en graphèmes heuristique (exceptions dans `src/tools/lecture/exceptions.js`) ; `ill` en début de mot approximatif.
- Pas de flèches pour la cursive ni pour les lettres accentuées (retombent sur le modèle en police).

## Dépendances et licences

Tout est servi par le site lui-même : aucune ressource n'est chargée depuis un CDN.

- Carte : D3 et topojson-client (rendu et voisinages), world-atlas (frontières Natural Earth), flag-icons (drapeaux), polices Inter, Andika, Lexend et OpenDyslexic via `@fontsource` (export SVG et PNG).
- Écriture / Lecture : polices embarquées dans `src/assets/fonts/` sous SIL OFL (Andika, Playwrite FR Trad / Moderne, Lexend, Atkinson Hyperlegible, OpenDyslexic), licences incluses.

## Licence

MIT (voir `LICENSE`) pour le code ; les polices gardent leur propre licence (voir ci-dessus).
