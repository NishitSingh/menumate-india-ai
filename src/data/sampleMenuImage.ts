// An illustrative Hindi menu card drawn as SVG, used as the demo "photo".
// The restaurant name is fictional.

const rows: [string, string][] = [
  ['नाश्ता', ''],
  ['मसाला डोसा', '₹120'],
  ['इडली सांभर', '₹90'],
  ['मुख्य भोजन', ''],
  ['पनीर बटर मसाला', '₹280'],
  ['वेज बिरयानी', '₹220'],
  ['चिकन बिरयानी', '₹260'],
  ['मिठाई', ''],
  ['गुलाब जामुन', '₹80'],
];

let y = 190;
const body = rows
  .map(([name, price]) => {
    const isHeading = !price;
    y += isHeading ? 62 : 46;
    if (isHeading) {
      return `<text x="60" y="${y}" font-size="26" font-weight="700" fill="#176B5B">${name}</text><line x1="60" y1="${y + 12}" x2="540" y2="${y + 12}" stroke="#176B5B" stroke-opacity=".3"/>`;
    }
    return `<text x="60" y="${y}" font-size="24" fill="#183C36">${name}</text><line x1="${80 + name.length * 13}" y1="${y - 6}" x2="470" y2="${y - 6}" stroke="#183C36" stroke-opacity=".35" stroke-dasharray="2 6"/><text x="540" y="${y}" font-size="24" text-anchor="end" fill="#183C36">${price}</text>`;
  })
  .join('');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800" font-family="'Noto Sans Devanagari','Mangal','Kohinoor Devanagari',sans-serif">
<rect width="600" height="800" fill="#FBF6EA"/>
<rect x="24" y="24" width="552" height="752" fill="none" stroke="#C9692F" stroke-width="3"/>
<rect x="34" y="34" width="532" height="732" fill="none" stroke="#C9692F" stroke-opacity=".45"/>
<text x="300" y="118" font-size="44" font-weight="700" text-anchor="middle" fill="#183C36">स्वाद भोजनालय</text>
<text x="300" y="160" font-size="20" text-anchor="middle" fill="#747474">शुद्ध स्वाद · ताज़ा खाना</text>
${body}
<text x="300" y="740" font-size="16" text-anchor="middle" fill="#747474">Illustrative demo menu · MenuMate India AI</text>
</svg>`;

export const SAMPLE_MENU_IMAGE = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
