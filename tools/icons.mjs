// Generates src/icons.json: { signature-of-original-svg : engraved replacement inner }
import fs from 'fs';
const orig = JSON.parse(fs.readFileSync(process.argv[2] || new URL('../icons.dump.json', import.meta.url), 'utf8'));
const r = (n) => +n.toFixed(2);
function gear(cx, cy, R, r0, teeth) {
  const pts = [], n = teeth * 4;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2 + Math.PI / n, rad = i % 4 < 2 ? R : r0;
    pts.push(`${r(cx + rad * Math.cos(a))} ${r(cy + rad * Math.sin(a))}`);
  }
  return 'M' + pts.join('L') + 'Z';
}
const shield = 'M8 1.9l5.1 1.9v3.7c0 3.3-2.3 5.3-5.1 6.6-2.8-1.3-5.1-3.3-5.1-6.6V3.8z';
const thumb = '<path d="M5.1 7.3l2.5-4.7c1 0 1.7.9 1.5 1.8l-.4 2h3.4c.9 0 1.5.8 1.3 1.7l-.9 4.1c-.2.8-.9 1.3-1.6 1.3H5.1z"/><rect x="1.9" y="7.3" width="3.2" height="6.2" rx=".9"/><circle class="af" cx="3.5" cy="11.5" r=".65"/>';
const folder = 'M1.9 4.2c0-.7.6-1.3 1.3-1.3h2.6l1.5 1.6h5.5c.7 0 1.3.6 1.3 1.3v6.3c0 .7-.6 1.3-1.3 1.3H3.2c-.7 0-1.3-.6-1.3-1.3z';
const frame = '<rect x="1.8" y="2.5" width="12.4" height="11" rx="2.2"/>';
const D = {
  '0e9d3a5f': frame + '<path d="M6 2.8v10.4"/><path class="a" d="M3.6 5.4h.9M3.6 7.4h.9"/>',
  'ad4fd656': frame + '<path d="M8 2.8v10.4"/><path class="a" d="M10.2 5.6h1.7M10.2 7.6h1.7"/>',
  '1c37d073': '<path d="M12.7 2.3c.7.7.7 1.8 0 2.5l-6.4 6.4-3 1 1-3 6.4-6.4c.7-.7 1.8-.7 2.5 0z"/><path d="M9.8 3.9l2.3 2.3"/><path class="a" d="M2.4 14.2h4.4"/><circle class="af" cx="9" cy="14.2" r=".7"/>',
  'e49eb4c6': '<path d="M8 1.8l1.5 4.7L14.2 8l-4.7 1.5L8 14.2 6.5 9.5 1.8 8l4.7-1.5z"/><circle class="af" cx="8" cy="8" r="1.05"/>',
  '4e5e41b3': '<rect x="1.9" y="1.9" width="12.2" height="12.2" rx="2.6"/><path class="a" d="M8 4.4l.9 2.7 2.7.9-2.7.9L8 11.6l-.9-2.7L4.4 8l2.7-.9z"/>',
  'b6395497': '<path d="M13.7 8.2a5.7 5.7 0 1 1-1.8-4.3"/><path d="M12.3 1.7v2.5H9.8"/><path class="a" d="M8 5.2V8.3l2.1 1.3"/>',
  'dc11c66e': '<circle cx="8" cy="9.1" r="5.1"/><path class="a" d="M6.5 1.8h3M8 1.8V4"/><path d="M8 6.6v2.5l1.7 1.1"/>',
  '9720af42': '<circle cx="7" cy="7" r="4.6"/><path d="M10.4 10.4l3.6 3.6" stroke-width="1.6"/><path class="a" d="M4.8 6.2a2.4 2.4 0 0 1 1.5-1.6"/>',
  '6807bc45': '<path d="M2.3 5h6M12.1 5h1.6M2.3 11h1.6M8 11h5.7"/><circle class="a" cx="10.1" cy="5" r="1.6"/><circle class="a" cx="5.9" cy="11" r="1.6"/>',
  'e1bebc6b': '<path d="M8.2 13.1H3.2c-.7 0-1.3-.6-1.3-1.3V4.2c0-.7.6-1.3 1.3-1.3h2.6l1.5 1.6h5.5c.7 0 1.3.6 1.3 1.3v1.9"/><path class="a" d="M12 9.4v4.4M9.8 11.6h4.4"/>',
  '7ef5b0de': `<path d="${folder}"/><path class="a" d="M2.2 6.6h11.6"/>`,
  '6267bc97': '<path d="M1.9 12.6V4.2c0-.7.6-1.3 1.3-1.3h2.5l1.5 1.6h4.3c.7 0 1.3.6 1.3 1.3v1.1"/><path d="M1.9 12.6l1.7-4.6c.2-.5.6-.8 1.1-.8h8.9c.6 0 1 .6.8 1.1l-1.5 3.8c-.2.5-.7.8-1.2.8H2.3"/><path class="a" d="M6.6 10.2h3.8"/>',
  'dd8514d8': '<path d="M6.2 4.4L9.8 8l-3.6 3.6" stroke-width="1.35"/>',
  'd928404c': '<path d="M6.2 4.2L10 8l-3.8 3.8"/>',
  '162a4346': '<path d="M4.2 6.1L8 9.9l3.8-3.8"/>',
  'f0022895': '<path class="f" d="M3 6.8L4.2 8 3 9.2 1.8 8zM13 6.8L14.2 8 13 9.2 11.8 8z"/><path class="af" d="M8 6.5L9.5 8 8 9.5 6.5 8z"/>',
  '0eb76025': '<rect x="1.8" y="2.6" width="12.4" height="3.1" rx="1"/><path d="M2.9 5.7v6.5c0 .7.6 1.3 1.3 1.3h7.6c.7 0 1.3-.6 1.3-1.3V5.7"/><path class="a" d="M6.3 8.5h3.4"/>',
  '76ab9b6a': '<path d="M9.7 2.1l4.2 4.2-1.7.7-2.4 2.4.2 2.7-1.1 1.1-5.3-5.3 1.1-1.1 2.7.2 2.4-2.4z"/><path class="a" d="M5.6 10.4L2.3 13.7"/>',
  'cf306bcd': '<path d="M8 2.1l5.9 3L8 8.1 2.1 5.1z"/><path d="M2.1 8L8 11l5.9-3"/><path class="a" d="M2.1 10.9L8 13.9l5.9-3"/>',
  '259daef8': '<path d="M8 3v10M3 8h10"/>',
  'c62c2ac1': `<path d="${shield}"/><path class="a" d="M5.9 10.1l.4-1.5 3-3a.8.8 0 0 1 1.1 1.1l-3 3z"/>`,
  'df4794f5': `<path d="${shield}"/><path class="a" d="M5.6 7.9l1.6 1.6 3.2-3.2"/>`,
  '625a1d1f': '<path d="M4.5 2.6h7l2.7 3.3L8 13.6 1.8 5.9z"/><path d="M1.9 5.9h12.2"/><path class="a" d="M6 5.9L8 2.7l2 3.2L8 13.3z"/>',
  'f2c5ae7f': '<path d="M8 13.4V2.9M3.7 7.2L8 2.9l4.3 4.3" stroke-width="1.5"/>',
  'b80564ad': '<path d="M2.3 5.6V3.5c0-.7.5-1.2 1.2-1.2h2.1M10.4 2.3h2.1c.7 0 1.2.5 1.2 1.2v2.1M13.7 10.4v2.1c0 .7-.5 1.2-1.2 1.2h-2.1M5.6 13.7H3.5c-.7 0-1.2-.5-1.2-1.2v-2.1"/><path class="af" d="M8 6.9L9.1 8 8 9.1 6.9 8z"/>',
  '51c13515': '<rect x="1.9" y="4.6" width="9.5" height="9.5" rx="1.9"/><path d="M4.6 2.1h7.5c1 0 1.8.8 1.8 1.8v7.5"/><path class="a" d="M4.4 8.3h4.4M4.4 10.7h2.8"/>',
  '3735d861': '<ellipse cx="8" cy="8" rx="6.3" ry="2.5" transform="rotate(-38 8 8)"/><ellipse cx="8" cy="8" rx="6.3" ry="2.5" transform="rotate(38 8 8)"/><circle class="af" cx="8" cy="8" r="1.15"/>',
  '7234c428': '<path d="M2.8 4.3L6.5 8l-3.7 3.7"/><path class="a" d="M8.6 11.8h4.6"/>',
  'f063a8b1': '<path d="M3.3 2.9c0-.6.5-1.1 1.1-1.1h5l3.3 3.3v8c0 .6-.5 1.1-1.1 1.1H4.4c-.6 0-1.1-.5-1.1-1.1z"/><path d="M9.3 1.9v3.3h3.3"/><path class="a" d="M5.5 8.4h4.9M5.5 10.8h3.2"/>',
  'ce658e01': '<path d="M8.4 2.8H4.3c-.8 0-1.5.7-1.5 1.5v7.4c0 .8.7 1.5 1.5 1.5h7.4c.8 0 1.5-.7 1.5-1.5V7.6"/><path class="a" d="M10 2.4h3.6V6M13.4 2.6L7.8 8.2"/>',
  '12ef6a24': thumb,
  'a836f2fc': `<g transform="matrix(1 0 0 -1 0 16)">${thumb}</g>`,
  '3b946099': '<circle cx="4.2" cy="3.7" r="1.6"/><circle cx="4.2" cy="12.3" r="1.6"/><circle class="a" cx="11.8" cy="5.4" r="1.6"/><path d="M4.2 5.3v5.4M11.8 7c0 2.4-2.1 3-4.4 3.4-1.3.2-2.4.5-3 .9"/>',
  'db797bb4': '<path d="M2.5 11.7a5.8 5.8 0 1 1 11 0"/><path d="M4.6 7.4l.7.5M8 4.5v.9M11.4 7.4l-.7.5"/><path class="a" d="M8 10.6l2.9-3.4"/><circle class="af" cx="8" cy="10.7" r="1.1"/>',
  'ceb81bc9': '<ellipse cx="8" cy="3.9" rx="5.6" ry="2"/><path d="M2.4 3.9v8.3c0 1.1 2.5 2 5.6 2s5.6-.9 5.6-2V3.9"/><path class="a" d="M2.4 8.1c0 1.1 2.5 2 5.6 2s5.6-.9 5.6-2"/>',
  'c7d939c7': `<path d="${gear(8, 8, 6.3, 4.9, 8)}"/><circle class="a" cx="8" cy="8" r="2.1"/>`,
  '1f56aa86': '+<circle class="ja-ring-ticks" cx="7" cy="7" r="3.4"/><circle class="af" cx="7" cy="7" r=".95"/>',
  '965878b3': '<path d="M3.6 3.6l8.8 8.8M12.4 3.6l-8.8 8.8"/>',
};
// signature must match client sigOf(): per child tag + first 12 chars of d (or geometry attrs)
function sig(inner) {
  const out = [];
  for (const m of inner.matchAll(/<(path|rect|circle|ellipse|line|polyline|polygon|g)\b([^>]*)>/g)) {
    const at = (k) => { const x = m[2].match(new RegExp(`(?:^|\\s)${k}="([^"]*)"`)); return x ? x[1] : ''; };
    const d = at('d');
    out.push(m[1] + ':' + (d || ['cx', 'cy', 'x', 'y', 'r', 'width'].map(at).join(',')).slice(0, 12));
  }
  return out.join('|');
}
const map = {}; let miss = [];
for (const [k, v] of Object.entries(D)) { if (!orig[k]) { miss.push(k); continue; } const s = sig(orig[k].inner); if (map[s]) throw new Error('dup ' + k); map[s] = v; }
fs.writeFileSync(new URL('../src/icons.json', import.meta.url), JSON.stringify(map));
console.log(Object.keys(map).length, 'icons', miss.length ? 'missing ' + miss : '');
