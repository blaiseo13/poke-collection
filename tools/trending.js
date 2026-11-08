// Builds data/trending.js: chase cards per in-print set + biggest movers.
// Prices: TCGplayer market (USD) via TCGdex. Momentum: Cardmarket 7-day vs 30-day average (EUR) via TCGdex.
// Run: node tools/trending.js   (also runs daily in GitHub Actions: .github/workflows/trending.yml)
const fs = require('fs'), path = require('path');
const API = 'https://api.tcgdex.net/v2/en';
const SKIP = /promo|energy|classic collection|my first battle/i;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url) {
  for (let a = 0; a < 4; a++) {
    try { const r = await fetch(url); if (r.status === 404) return null; if (r.ok) return r.json(); } catch (e) {}
    await sleep(600 * (a + 1));
  }
  return null;
}
async function pool(items, n, fn) { let i = 0; const out = []; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } })); return out; }
const r2 = x => Math.round(x * 100) / 100;

(async () => {
  const today = new Date().toISOString().slice(0, 10);
  // sets on shelves: the newest main sets of the current series (Mega Evolution, Scarlet & Violet), already released
  const series = await Promise.all(['me', 'sv'].map(s => get(`${API}/series/${s}`)));
  const ids = series.filter(Boolean).flatMap(s => s.sets).filter(s => !SKIP.test(s.name) && !/^(mep|svp|mee|sve|mfb)$/.test(s.id) && !/-c$/.test(s.id)).map(s => s.id);
  const details = (await pool(ids, 6, id => get(`${API}/sets/${id}`))).filter(s => s && s.releaseDate && s.releaseDate <= today);
  details.sort((a, b) => (a.releaseDate < b.releaseDate ? 1 : -1));
  const sets = details.slice(0, 14);
  console.log('sets:', sets.map(s => `${s.name} (${s.releaseDate})`).join(', '));

  const all = [];
  for (const s of sets) {
    const cards = await pool(s.cards, 10, c => get(`${API}/cards/${c.id}`));
    let rows = cards.filter(Boolean).map(c => {
      const tp = c.pricing && c.pricing.tcgplayer, cm = c.pricing && c.pricing.cardmarket;
      let usd = 0, variant = '';
      if (tp) for (const [k, v] of Object.entries(tp)) if (v && typeof v === 'object' && (v.marketPrice || 0) > usd) { usd = v.marketPrice; variant = k; }
      const a7 = cm && cm.avg7, a30 = cm && cm.avg30, a1 = cm && cm.avg1;
      return { id: c.id, n: c.name, r: c.rarity || '', num: c.localId, cat: c.category, dex: (c.dexId || [])[0] || 0,
        img: c.image || '', usd: r2(usd), v: variant.replace(/-/g, ' '),
        t: a7 && a30 ? Math.round((a7 / a30 - 1) * 1000) / 1000 : null, e1: a1 || null, e7: a7 || null, e30: a30 || null,
        set: s.name, sid: s.id };
    });
    s.allRows = rows.slice();
    rows = rows.filter(x => x.usd > 0);
    rows.sort((a, b) => b.usd - a.usd);
    s.top = rows.slice(0, 12);
    all.push(...rows);
    console.log(`${s.name}: ${rows.length} priced, top $${s.top[0] ? s.top[0].usd : 0}`);
  }
  const movers = all.filter(x => x.t != null && x.usd >= 5 && x.e30 >= 3);
  const gains = movers.slice().sort((a, b) => b.t - a.t).slice(0, 15);
  const drops = movers.slice().sort((a, b) => a.t - b.t).slice(0, 15);
  const out = {
    asOf: today,
    sets: sets.map(s => ({ id: s.id, name: s.name, date: s.releaseDate, logo: s.logo || '', top: s.top })),
    gains, drops
  };
  // every card of every pack (for the Packs tab): [number, name, rarity, image, usd, trend, dex, category]
  const packs = { asOf: today, sets: sets.map(s => ({ id: s.id, name: s.name, date: s.releaseDate, logo: s.logo || '', count: s.cardCount ? s.cardCount.official || s.cardCount.total : 0,
    cards: (s.allRows || []).sort((a, b) => (parseInt(a.num) || 9999) - (parseInt(b.num) || 9999) || String(a.num).localeCompare(String(b.num)))
      .map(c => [c.num, c.n, c.r, c.img, c.usd, c.t, c.dex, c.cat === 'Pokemon' ? 'P' : c.cat === 'Trainer' ? 'T' : 'E']) })) };
  fs.writeFileSync(path.join(__dirname, '..', 'data', 'packs.js'), `// Built ${today} by tools/trending.js (every card of each in-print set; TCGplayer market USD)
window.PK_PACKS = ${JSON.stringify(packs)};
`);
  console.log('packs:', packs.sets.reduce((a, s) => a + s.cards.length, 0), 'cards');
  const file = path.join(__dirname, '..', 'data', 'trending.js');
  fs.writeFileSync(file, `// Built ${today} by tools/trending.js (TCGdex: TCGplayer market USD; momentum = Cardmarket 7-day vs 30-day avg)\nwindow.PK_TREND = ${JSON.stringify(out)};\n`);
  console.log('wrote', file, 'sets', out.sets.length, 'gains', gains.length, 'drops', drops.length);
})();
