// Match a binder-scan CSV (from the claude.ai photo read) to cards.js.
// usage: node tools/match-scan.js private/binder-scan.csv  -> private/scan-match.json + private/scan-verify.html
// Nothing is written to Firebase here; Blaise verifies first.
const fs = require('fs'), path = require('path');
global.window = global; require(path.resolve('data/cards.js'));
const D = window.PKDATA;
const csv = fs.readFileSync(process.argv[2], 'utf8').replace(/^﻿/, '');
function parseCSV(t) { const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; } else f += c; }
  if (f || row.length) { row.push(f); rows.push(row); } return rows.filter(r => r.length > 1); }
const [hd, ...body] = parseCSV(csv); const R = body.map(r => Object.fromEntries(hd.map((h, i) => [h.trim(), (r[i] || '').trim()])));

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const SETS = D.sets.map((s, i) => ({ i, id: s[0], name: s[1], n: norm(s[1]) }));
const ALIAS = { 'base set': 'base', 'scarlet violet 151': '151', 'sv 151': '151', 'expedition': 'expedition base set', 'ex trainer kit latias latios': 'ex trainer kit latias', 'ex trainer kit 2 latias': 'ex trainer kit latias', 'scarlet violet promos': 'scarlet violet black star promos', 'sv promos': 'scarlet violet black star promos', 'swsh promos': 'swsh black star promos' };
function findSet(raw) {
  let s = norm(String(raw).replace(/\(.*?\)/g, '')); if (!s || s === 'unknown') return null;
  if (ALIAS[s]) s = ALIAS[s];
  let hit = SETS.find(x => x.n === s) || SETS.find(x => x.n === s.replace(/^ex /, '')) || SETS.find(x => x.n === 'ex ' + s);
  return hit || null; }
const NAMES = D.names.map(norm);
const cardsBy = new Map(); // setIndex|num -> cards
D.cards.forEach((c, i) => { const k = c[3] + '|' + String(c[4]).toLowerCase(); (cardsBy.get(k) || cardsBy.set(k, []).get(k)).push(i); });
const dexOf = c => (Array.isArray(c[6]) ? c[6] : [c[6]]);
const cardId = c => c[0] || `${D.sets[c[3]][0]}-${c[4]}`;
const IMG = 'https://images.pokemontcg.io/';
const cardImg = c => { const s = D.sets[c[3]]; const im = c[5]; return im && String(im).startsWith('http') ? im : IMG + (im || `${s[0]}/${c[4]}.png`); };
const speciesDex = name => { const t = String(name || ''); if (/nidoran\s*(m\b|male|♂)/i.test(t)) return 32; if (/nidoran\s*(f\b|female|♀)/i.test(t)) return 29; const n = norm(t).replace(/ (ex|gx|v|vmax|vstar|lv x|star|delta)$/, ''); let i = NAMES.indexOf(n); if (i < 0) i = NAMES.findIndex(x => n.startsWith(x + ' ') || n.endsWith(' ' + x)); return i >= 0 ? i + 1 : null; };
// our six forms: 0 Basic, 1 Reverse Holo, 2 Rare, 3 Holo Rare, 4 Ultra Rare, 5 Secret/Illustration
function formOf(r) { const ra = (r.rarity || '').toLowerCase(), fi = (r.finish || '').toLowerCase();
  if (/secret|illustration/.test(ra)) return 5; if (/ultra/.test(ra)) return 4; if (/holo rare/.test(ra) || (/^rare/.test(ra) && fi === 'holo')) return 3;
  if (/^rare|promo/.test(ra)) return 2; if (fi === 'reverse holo') return 1; return 0; }

const out = R.map(r => {
  const o = { page: +r.page, slot: +r.slot, pokemon: r.pokemon, set: r.set_name, num: r.card_number, rarity: r.rarity, finish: r.finish, conf: r.confidence, notes: r.notes };
  if (/^empty$/i.test(r.pokemon) || (!r.pokemon && !r.card_number)) return { ...o, status: 'empty' };
  if (/card ?back/i.test(r.pokemon)) return { ...o, status: 'back' };
  o.dex = speciesDex(r.pokemon) || speciesDex(r.card_name); o.form = formOf(r);
  const set = findSet(r.set_name), num = String(r.card_number || '').split('/')[0].replace(/^(svp|swsh|sm|xy|bw|dp|hgss)\s*/i, '').trim().replace(/^0+(?=\d)/, '').toLowerCase();
  let cands = [];
  const raw = String(r.card_number || '').split('/')[0].trim().toLowerCase().replace(/\s+/g, '');
  if (set && raw) cands = (cardsBy.get(set.i + '|' + raw) || []).map(i => D.cards[i]);
  if (!cands.length && set && num) cands = (cardsBy.get(set.i + '|' + num) || []).map(i => D.cards[i]);
  if (!cands.length && set && num) cands = (cardsBy.get(set.i + '|' + num.padStart(3, '0')) || []).map(i => D.cards[i]);
  const nameOk = c => o.dex && dexOf(c).includes(o.dex);
  let pick = cands.find(nameOk) || null, why = [];
  if (!pick && o.dex && num) { // set unknown or wrong: look for this Pokémon with this number in any set
    const total = String(r.card_number || '').split('/')[1]; const any = D.cards.filter(c => String(c[4]).toLowerCase() === num && dexOf(c).includes(o.dex));
    const byTotal = total ? any.filter(c => String(D.sets[c[3]][5]) === total.trim()) : [];
    const pool = byTotal.length ? byTotal : any;
    if (pool.length === 1) { pick = pool[0]; why.push(set ? 'set name didn\'t match; found by number' : 'set unknown; found by number' + (byTotal.length ? ' + set size' : '')); }
    else if (pool.length > 1) { o.options = pool.slice(0, 6).map(c => ({ id: cardId(c), set: D.sets[c[3]][1], img: cardImg(c) })); why.push(`${pool.length} possible sets`); }
  }
  if (!pick && !o.dex) why.push('Pokémon name not recognised');
  if (!pick && cands.length && o.dex) why.push(`${r.card_number} in ${set.name} is ${cands.map(c => c[1]).join('/')}, not ${r.pokemon}`);
  if (!pick && set && num && !cands.length) why.push(`no #${num} in ${set.name}`);
  if (!pick && !set && r.set_name && !/unknown/i.test(r.set_name)) why.push(`set "${r.set_name}" not in the card list`);
  if (!pick && !num) why.push('no card number');
  if (pick && cands.length && !nameOk(pick)) why.push('number points to a different Pokémon');
  if (/german|japanese|french|italian|spanish/i.test(r.set_name + ' ' + r.notes)) why.push('foreign-language card');
  if (pick) { o.card = cardId(pick); o.cardSet = D.sets[pick[3]][1]; o.img = cardImg(pick); o.date = D.sets[pick[3]][3]; }
  o.status = !pick ? 'notfound' : (r.confidence === 'low' || why.length) ? 'check' : 'ok';
  o.why = why; return o; });

const C = s => out.filter(o => o.status === s).length;
console.log('ok', C('ok'), 'check', C('check'), 'notfound', C('notfound'), 'empty', C('empty'), 'back', C('back'), 'total', out.length);
fs.writeFileSync('private/scan-match.json', JSON.stringify(out, null, 1));
