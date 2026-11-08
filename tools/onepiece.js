// Builds data/onepiece.js (every One Piece card + TCGplayer market price) and appends today's prices to data/history/op-<groupId>.json.
// Source: tcgcsv.com (free daily copy of TCGplayer's catalog + prices), category 68 = One Piece Card Game.
// Run: node tools/onepiece.js   (also runs daily in .github/workflows/trending.yml)
const fs = require('fs'), path = require('path');
const BASE = 'https://tcgcsv.com/tcgplayer/68';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) { for (let a = 0; a < 4; a++) { try { const r = await fetch(url, { headers: { 'User-Agent': 'poke-collection-dashboard/1.0' } }); if (r.ok) return (await r.json()).results || []; } catch (e) {} await sleep(800 * (a + 1)); } return null; }
async function pool(items, n, fn) { let i = 0; const out = []; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }
const ext = (p, k) => { const e = (p.extendedData || []).find(x => x.name === k); return e ? String(e.value) : ''; };
const variantOf = name => { const m = name.match(/\(([^)]*)\)\s*$/); return m ? m[1] : ''; };

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  const groups = await get(`${BASE}/groups`);
  if (!groups) { console.error('groups failed'); process.exit(1); }
  const sets = [], cards = [];
  const results = await pool(groups, 6, async g => ({ g, products: await get(`${BASE}/${g.groupId}/products`), prices: await get(`${BASE}/${g.groupId}/prices`) }));
  results.filter(r => r.products).sort((a, b) => (a.g.publishedOn < b.g.publishedOn ? 1 : -1)).forEach(({ g, products, prices }) => {
    const best = {}; (prices || []).forEach(p => { const v = p.marketPrice || p.midPrice || 0; if (!best[p.productId] || v > best[p.productId].v) best[p.productId] = { v, sub: p.subTypeName }; });
    const rows = products.filter(p => ext(p, 'Number'));
    if (!rows.length) return; // sealed-only groups (boxes, decks) are skipped
    const si = sets.length;
    sets.push([g.groupId, g.name, g.publishedOn.slice(0, 10), g.abbreviation || '', rows.length]);
    rows.forEach(p => cards.push([p.productId, ext(p, 'Number'), p.name.replace(/\s*\([^)]*\)\s*$/, ''), ext(p, 'Rarity'), ext(p, 'Color'), ext(p, 'CardType'),
      +ext(p, 'Cost') || 0, +ext(p, 'Power') || 0, ext(p, 'Subtypes'), si, Math.round((best[p.productId] ? best[p.productId].v : 0) * 100) / 100, variantOf(p.name)]));
  });
  const out = { asOf: today, sets, cards };
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'onepiece.js'), `// Built ${today} by tools/onepiece.js from tcgcsv.com (TCGplayer catalog + market prices)\n// card: [productId, number, name, rarity, color, type, cost, power, traits, setIndex, usd, variant]\nwindow.PK_OP = ${JSON.stringify(out)};\n`);
  // price history, one file per set
  const hdir = path.join(__dirname, '..', 'data', 'history'); fs.mkdirSync(hdir, { recursive: true });
  sets.forEach((s, si) => {
    const f = path.join(hdir, `op-${s[0]}.json`); let h = { dates: [], p: {} };
    try { h = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) {}
    if (h.dates[h.dates.length - 1] === today) return;
    h.dates.push(today); const n = h.dates.length;
    cards.filter(c => c[9] === si).forEach(c => { const k = String(c[0]); if (!h.p[k]) h.p[k] = Array(n - 1).fill(null); h.p[k].push(c[10] || null); });
    Object.keys(h.p).forEach(k => { while (h.p[k].length < n) h.p[k].push(null); });
    fs.writeFileSync(f, JSON.stringify(h));
  });
  console.log('one piece: sets', sets.length, 'cards', cards.length, 'priced', cards.filter(c => c[10] > 0).length, '| rarities', [...new Set(cards.map(c => c[3]))].join(','));
})();
