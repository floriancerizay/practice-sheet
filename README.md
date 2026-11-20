# Practice sheet

Static site (GitHub Pages; Vite, vanilla JavaScript) of **printable worksheets** for parents and teachers: set the options, print (or "Save as PDF"). Nothing is sent to a server.

## Development

Prerequisites: Node.js 24 or newer.

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # static site in dist/
npm run preview        # serves dist/ to check the build
npm test               # Vitest
npm run lint           # ESLint
npm run format:check   # Prettier
```

## Dependencies and licenses

Everything is served by the site itself: no resource is loaded from a CDN.

- Interface: [Pico CSS](https://picocss.com) (MIT), conditional build: it only styles the `.pico` elements (top bar, settings panel, home page), so the printed sheets keep their own styles.
- Map: D3 and topojson-client (rendering and neighbors), world-atlas (Natural Earth borders), flag-icons (flags), Inter, Andika, Lexend and OpenDyslexic fonts via `@fontsource` (SVG and PNG export).
- Writing / Reading: fonts embedded in `src/assets/fonts/` under the SIL OFL (Andika, Playwrite FR Trad / Moderne, Lexend, Atkinson Hyperlegible, OpenDyslexic), licenses included.

## License

MIT (see `LICENSE`) for the code; fonts keep their own license (see above).
