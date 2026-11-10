// Regenerates fhr/index.json, the metadata index used by fhrquotes.html.
// Run from the repo root: node tools/fhr-build-index.js
// Re-run whenever reviews are added to fhr/ (and listed in fhr/filelist.txt).
//
// Per review: f = filename, d = original date (YYYY-MM-DD), t = title,
// s = firsts text (if any), b = number of usable image/text/image blocks.
// The block rule must match findBlocks() in fhrquotes.html.
const fs = require('fs');

const decode = s => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const strip = s => decode(s.replace(/<[^>]*>/g, '')).trim();

function countBlocks(html) {
  const nodes = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m => {
    const inner = m[1];
    const text = strip(inner);
    if (/<img\b/i.test(inner)) return { type: 'IMG', text };
    if (text && !text.includes('Original Date') && !text.toLowerCase().includes('source:') && !text.startsWith('Firsts:'))
      return { type: 'TEXT', text };
    return { type: 'SKIP', text };
  });
  let count = 0;
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].type !== 'IMG') continue;
    let texts = 0;
    for (let j = i + 1; j < nodes.length; j++) {
      if (nodes[j].type === 'TEXT') texts++;
      else if (nodes[j].type === 'IMG') { if (texts > 0) count++; break; }
    }
  }
  return count;
}

const files = fs.readFileSync('fhr/filelist.txt', 'utf8').split('\n').map(s => s.trim()).filter(s => s.endsWith('.html'));
const out = [];
for (const f of files) {
  const html = fs.readFileSync('fhr/' + f, 'utf8');
  const d = (html.match(/Original Date:\s*(\d{4}-\d{2}-\d{2})/) || [])[1];
  const t = strip((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '') || 'Unknown Title';
  const firsts = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m => strip(m[1])).find(x => x.startsWith('Firsts:'));
  const entry = { f, d: d || null, t, b: countBlocks(html) };
  if (firsts) entry.s = firsts.replace('Firsts:', '').trim();
  out.push(entry);
  if (!d) console.warn('no date:', f);
}
fs.writeFileSync('fhr/index.json', JSON.stringify(out));
console.log(`${out.length} reviews indexed, ${out.filter(e => e.b > 0).length} with usable blocks`);
