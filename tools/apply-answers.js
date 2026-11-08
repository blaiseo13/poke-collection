// Applies his answers (private/scan-answers.txt, pasted from the check page) to private/scan-match.json.
// "yes" = keep the match; "no | 26/100" or "72/132" = re-look-up that number; "No. 031" = foreign card with no set number (Pokédex no.);
// anything else = keep the Pokémon, no exact printing. Re-run scan-verify.js afterwards.
const fs = require('fs'), path = require('path');
global.window = global; require(path.resolve('data/cards.js')); const D = window.PKDATA;
const M = JSON.parse(fs.readFileSync('private/scan-match.json', 'utf8'));
const lines = fs.readFileSync('private/scan-answers.txt', 'utf8').split(/\r?\n/).map(l => /^p(\d+)-(\d+):\s*(.*)$/.exec(l.trim())).filter(Boolean);
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const setIdx = raw => { let s = norm(String(raw).replace(/\(.*?\)/g, '')); if (s === 'base set') s = 'base'; return D.sets.findIndex(x => norm(x[1]) === s || norm(x[1]) === s.replace(/^ex /, '')); };
const dexOf = c => Array.isArray(c[6]) ? c[6] : [c[6]], idOf = c => c[0] || `${D.sets[c[3]][0]}-${c[4]}`;
const IMG = 'https://images.pokemontcg.io/', img = c => { const s = D.sets[c[3]], im = c[5]; return im && String(im).startsWith('http') ? im : IMG + (im || `${s[0]}/${c[4]}.png`); };
const setCard = (o, c, note) => { Object.assign(o, { card: idOf(c), cardSet: D.sets[c[3]][1], img: img(c), date: D.sets[c[3]][3], status: 'ok', answer: note }); };
let done = 0, left = [];
for (const [, pg, sl, ans] of lines) {
  const o = M.find(x => x.page === +pg && x.slot === +sl); if (!o) { left.push(`p${pg}-${sl}: no such pocket`); continue; }
  const a = ans.trim(); done++;
  if (/^yes$/i.test(a)) { if (o.card) { o.status = 'ok'; o.answer = 'confirmed'; } else left.push(`p${pg}-${sl}: "yes" but no match to confirm`); continue; }
  const num = /(\d+)\s*\/\s*(\d+)/.exec(a), dexNo = /No\.?\s*0*(\d{1,4})\b/i.exec(a);
  if (num) { const n = num[1].replace(/^0+(?=\d)/, ''), tot = num[2]; const si = setIdx(o.set);
    let pool = D.cards.filter(c => String(c[4]) === n && (!o.dex || dexOf(c).includes(o.dex)));
    const inSet = pool.filter(c => c[3] === si), bySize = pool.filter(c => String(D.sets[c[3]][5]) === tot);
    const c = inSet[0] || (bySize.length === 1 ? bySize[0] : null);
    if (c) setCard(o, c, `you said ${n}/${tot}`); else { o.status = 'check'; o.why = [`${n}/${tot}: no ${o.pokemon} with that number in ${o.set}`]; left.push(`p${pg}-${sl}: ${o.pokemon} ${n}/${tot} not found`); }
    continue; }
  if (dexNo) { // foreign card: count the Pokémon; use the English printing of the same set when there is exactly one at that form
    o.dex = +dexNo[1]; const si = setIdx(o.set); const same = D.cards.filter(c => c[3] === si && dexOf(c).includes(o.dex));
    const holo = /holo/i.test(o.rarity + ' ' + o.finish), pickc = same.length === 1 ? same[0] : same.find(c => holo ? /holo/i.test(D.rarities[c[2]] || '') : !/holo/i.test(D.rarities[c[2]] || ''));
    if (pickc && same.filter(c => (/holo/i.test(D.rarities[c[2]] || '')) === holo).length === 1) setCard(o, pickc, 'foreign card, English equivalent'); else { Object.assign(o, { card: null, img: null, status: 'species', answer: 'foreign card, Pokémon counted' }); }
    continue; }
  // free text (e.g. a promo not in the card list): count the Pokémon, no exact printing
  Object.assign(o, { card: null, img: null, status: 'species', answer: a });
}
fs.writeFileSync('private/scan-match.json', JSON.stringify(M, null, 1));
const C = s => M.filter(x => x.status === s).length;
console.log('answers', done, '| ok', C('ok'), 'species-only', C('species'), 'check', C('check'), 'notfound', C('notfound'));
left.forEach(l => console.log(' !', l));
