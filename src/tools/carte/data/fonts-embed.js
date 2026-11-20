/* Polices intégrées aux exports SVG/PNG : sous-ensemble latin en woff2, depuis les paquets @fontsource. */
import andika400 from '@fontsource/andika/files/andika-latin-400-normal.woff2?url';
import andika700 from '@fontsource/andika/files/andika-latin-700-normal.woff2?url';
import lexend400 from '@fontsource/lexend/files/lexend-latin-400-normal.woff2?url';
import lexend700 from '@fontsource/lexend/files/lexend-latin-700-normal.woff2?url';
import dyslexic400 from '@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff2?url';
import dyslexic700 from '@fontsource/opendyslexic/files/opendyslexic-latin-700-normal.woff2?url';
import atkinson400 from '../../../assets/fonts/AtkinsonHyperlegible-Regular.ttf?url';
import tradTtf from '../../../assets/fonts/PlaywriteFRTrad.ttf?url';
import moderneTtf from '../../../assets/fonts/PlaywriteFRModerne.ttf?url';

const FILES = {
  Andika: [
    { weight: 400, url: andika400 },
    { weight: 700, url: andika700 },
  ],
  Lexend: [
    { weight: 400, url: lexend400 },
    { weight: 700, url: lexend700 },
  ],
  OpenDyslexic: [
    { weight: 400, url: dyslexic400 },
    { weight: 700, url: dyslexic700 },
  ],
  // polices complètes (pas de sous-ensemble woff2) ; Playwrite est une police variable, de graisse 100 à 400
  'Atkinson Hyperlegible': [{ weight: 400, url: atkinson400, ttf: true }],
  'Playwrite FR Trad': [{ weight: '100 400', url: tradTtf, ttf: true }],
  'Playwrite FR Moderne': [{ weight: '100 400', url: moderneTtf, ttf: true }],
};

const toBase64 = (bytes) => {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
};

/** Règles @font-face (données en base64) de la famille demandée. */
export async function fontFaceCss(family) {
  let css = '';
  for (const { weight, url, ttf } of FILES[family] ?? []) {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
    css +=
      `@font-face{font-family:'${family}';font-weight:${weight};` +
      `src:url(data:font/${ttf ? 'ttf' : 'woff2'};base64,${toBase64(bytes)}) format('${ttf ? 'truetype' : 'woff2'}');}\n`;
  }
  return css;
}
