// Prices, save file, downstairs box and Binder Stats for the Poké Collection page.
// Loaded before the main script; everything reads window.PKC lazily (set by the main script).
(() => {
'use strict';
const $ = s => document.querySelector(s);
const K = () => window.PKC;
const PKEY = 'pkc.prices2';
let PRICES = {};
try { PRICES = JSON.parse(localStorage.getItem(PKEY)) || {}; } catch (e) { PRICES = {}; }
const DAY = 864e5;
const money = v => v == null ? '' : v >= 1000 ? '$' + Math.round(v).toLocaleString() : '$' + v.toFixed(2);
const usDate = s => { if (!s) return ''; const [y, m, d] = s.replace(/\//g, '-').split('-'); return `${m}/${d}/${y.slice(2)}`; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- prices (TCGdex: TCGplayer market prices, refreshed daily) ---------- */
function priceFor(card, tier) {
  if (!card) return null; const e = PRICES[card.id]; if (!e || !e.p) return null;
  const p = e.p, order = tier === 1 ? ['reverse-holofoil', 'normal', 'holofoil'] : ['normal', 'holofoil', 'unlimited-holofoil', '1st-edition-holofoil', 'unlimited-normal', '1st-edition-normal', 'reverse-holofoil'];
  const keys = [...order, ...Object.keys(p).filter(k => !order.includes(k))];
  for (const k of keys) { const v = p[k] && (p[k].marketPrice ?? p[k].midPrice); if (v != null) return { v, k, u: e.u, url: p[k].productId ? 'https://www.tcgplayer.com/product/' + p[k].productId : '' }; }
  return null;
}
const known = card => { const e = card && PRICES[card.id]; return !!e && Date.now() - e.f < DAY; };
let savePT = null;
const savePrices = () => { clearTimeout(savePT); savePT = setTimeout(() => { try { localStorage.setItem(PKEY, JSON.stringify(PRICES)); } catch (e) {} }, 400); };
async function fetchOne(card) {
  if (!card.tdId) { PRICES[card.id] = { p: null, f: Date.now() }; return true; }
  for (let a = 0; a < 3; a++) {
    try {
      const r = await fetch('https://api.tcgdex.net/v2/en/cards/' + encodeURIComponent(card.tdId));
      if (r.status === 404) { PRICES[card.id] = { p: null, f: Date.now() }; return true; }
      if (!r.ok) throw new Error(r.status);
      const j = await r.json(), t = j.pricing && j.pricing.tcgplayer;
      const p = t ? Object.fromEntries(Object.entries(t).filter(([k, v]) => v && typeof v === 'object')) : null;
      PRICES[card.id] = { p: p && Object.keys(p).length ? p : null, u: t && t.updated ? t.updated.slice(0, 10) : '', f: Date.now() };
      return true;
    } catch (e) { await new Promise(r => setTimeout(r, 500 * (a + 1))); }
  }
  return false;
}
let busy = false, failed = 0;
async function fetchPrices(cards, onBatch) {
  const todo = [...new Map(cards.filter(Boolean).map(c => [c.id, c])).values()].filter(c => !known(c));
  let i = 0, done = 0;
  const worker = async () => { while (i < todo.length) { const c = todo[i++]; if (!(await fetchOne(c))) failed++; done++; if (done % 15 === 0) { savePrices(); onBatch && onBatch(); } } };
  await Promise.all(Array.from({ length: Math.min(6, todo.length) }, worker));
  savePrices(); onBatch && onBatch();
  return failed < Math.max(3, todo.length * .2);
}
function priceAsOf() { let best = ''; Object.values(PRICES).forEach(e => { if (e.u && e.u > best) best = e.u; }); return best; }
function setPriceState(st) { const el = $('#priceState'); if (!el) return;
  el.textContent = st === 'loading' ? 'Updating prices…' : st === 'error' ? 'Some prices did not load' : priceAsOf() ? 'Prices as of ' + usDate(priceAsOf()) : ''; }
async function refreshAll() {
  if (busy) return; busy = true; failed = 0; setPriceState('loading');
  const k = K(), S = k.S, first = [], second = [];
  S.box.forEach(b => first.push(k.BY_ID.get(b.id)));
  k.SPECIES.forEach(sp => { const o = k.ownedOf(sp.dex); if (o && o.c) first.push(k.BY_ID.get(o.c)); else if (o) second.push(k.displayCard(sp)); });
  const ok = await fetchPrices([...first, ...second], () => updatePills());
  busy = false; setPriceState(ok ? 'done' : 'error'); updatePills(); snapshot(); watchMissing();
  if (document.querySelector('#v-stats.on')) renderStats(); if (document.querySelector('#v-box.on')) renderBox();
}
// missing cards: fetch the coolest printing's price only when its tile scrolls into view
let lazyQ = [], lazyRun = false;
const io = new IntersectionObserver(es => { es.forEach(e => { if (!e.isIntersecting) return; io.unobserve(e.target);
  const sp = K().SPECIES[e.target.dataset.dex - 1]; if (!K().ownedOf(sp.dex) && !known(sp.coolest)) lazyQ.push(sp.coolest); }); runLazy(); }, { rootMargin: '300px' });
async function runLazy() { if (lazyRun || !lazyQ.length) return; lazyRun = true; const batch = lazyQ.splice(0); await fetchPrices(batch, updatePills); lazyRun = false; runLazy(); }
function watchMissing() { document.querySelectorAll('#grid .tile.missing .pp:not([data-io])').forEach(el => { el.dataset.io = 1; io.observe(el); }); }
new MutationObserver(() => { if (!busy) watchMissing(); }).observe(document.getElementById('grid') || document.body, { childList: true });
function updatePills() {
  const k = K(); document.querySelectorAll('.pp[data-dex]').forEach(el => {
    const sp = k.SPECIES[el.dataset.dex - 1], o = k.ownedOf(sp.dex), c = k.displayCard(sp), pr = priceFor(c, o ? o.t : c.tier);
    el.textContent = pr ? (o && !o.c ? '~' : '') + money(pr.v) : ''; el.classList.toggle('on', !!pr);
    el.dataset.tip = pr ? `${o && !o.c ? 'Estimate: printing not picked yet<br>' : ''}TCGplayer market price, as of ${usDate(pr.u)}` : '';
  });
}
function totals() {
  const k = K(); let conf = 0, est = 0, nConf = 0, nEst = 0, box = 0;
  k.SPECIES.forEach(sp => { const o = k.ownedOf(sp.dex); if (!o) return; const pr = priceFor(k.displayCard(sp), o.t);
    if (!pr) return; if (o.c) { conf += pr.v; nConf++; } else { est += pr.v; nEst++; } });
  k.S.box.forEach(b => { const c = k.BY_ID.get(b.id), pr = c && priceFor(c, b.t ?? c.tier); if (pr) box += pr.v; });
  return { conf, est, nConf, nEst, box };
}
function snapshot() {
  const k = K(), t = totals(); if (!t.nConf && !t.nEst && !t.box) return;
  const S = k.S; S.valueLog = S.valueLog || []; const d = todayISO();
  const row = { d, binder: Math.round((t.conf + t.est) * 100) / 100, box: Math.round(t.box * 100) / 100 };
  const last = S.valueLog[S.valueLog.length - 1]; if (last && last.d === d) Object.assign(last, row); else S.valueLog.push(row);
  S.valueLog = S.valueLog.slice(-400); k.save();
}

/* ---------- save file (File System Access) ---------- */
const idb = (mode, fn) => new Promise((res, rej) => { const r = indexedDB.open('pkc', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('h'); r.onerror = () => rej(r.error);
  r.onsuccess = () => { const tx = r.result.transaction('h', mode), st = tx.objectStore('h'); const q = fn(st); tx.oncomplete = () => res(q && q.result); tx.onerror = () => rej(tx.error); }; });
let FH = null, perm = 'none', writeT = null, lastWrite = '';
async function initFile() {
  const b = $('#fileBtn'); if (!b) return;
  if (!window.showSaveFilePicker) { b.hidden = true; return; }
  try { FH = await idb('readonly', st => st.get('file')); } catch (e) { FH = null; }
  if (FH) { try { perm = await FH.queryPermission({ mode: 'readwrite' }); } catch (e) { perm = 'none'; } }
  fileBtnState();
  b.onclick = async () => {
    try {
      if (!FH) { FH = await window.showSaveFilePicker({ suggestedName: 'my-binder.json', types: [{ description: 'Collection file', accept: { 'application/json': ['.json'] } }] });
        await idb('readwrite', st => st.put(FH, 'file')); perm = 'granted'; }
      else if (perm !== 'granted') perm = await FH.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') { await writeFile(); K().toast('Save file linked: every change is written to it', '#059669'); }
      fileBtnState();
    } catch (e) { if (e.name !== 'AbortError') K().toast('Could not open the save file', '#DC2626'); }
  };
}
function fileBtnState() { const b = $('#fileBtn'); if (!b) return;
  b.classList.toggle('linked', perm === 'granted');
  b.textContent = !FH ? 'Link save file' : perm === 'granted' ? (lastWrite ? 'Saved ' + lastWrite : 'Save file linked') : 'Reconnect save file';
  b.title = !FH ? 'Pick where to keep my-binder.json (suggested: your Pokemon Collection folder)' : perm === 'granted' ? 'Every change is written to ' + FH.name : 'One click to keep writing to ' + FH.name; }
function fileJSON() {
  const k = K(), S = k.S, d = new Date();
  const card = c => c ? { card: c.id, cardName: c.name, set: c.set, number: c.num, rarity: c.rar } : {};
  return JSON.stringify({
    saved: `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(2)}`,
    binderId: S.cur, binderName: S.binders && S.binders[S.cur] ? S.binders[S.cur].name : '',
    binder: k.SPECIES.filter(sp => k.ownedOf(sp.dex)).map(sp => { const o = k.ownedOf(sp.dex);
      return Object.assign({ dex: sp.dex, pokemon: sp.name, form: k.TIERS[o.t].k, printingPicked: !!o.c, toFile: !!S.toFile[sp.dex] }, o.c ? card(k.BY_ID.get(o.c)) : {}); }),
    box: S.box.map(b => Object.assign({ dex: b.dex, pokemon: k.SPECIES[b.dex - 1].name, t: b.t ?? null, form: k.TIERS[b.t ?? k.BY_ID.get(b.id).tier].k }, card(k.BY_ID.get(b.id)))),
    removedByHand: Object.keys(S.removed).map(Number), filedByHand: Object.keys(S.filed).map(Number)
  }, null, 1);
}
async function writeFile() {
  if (!FH || perm !== 'granted') return;
  try { const w = await FH.createWritable(); await w.write(fileJSON()); await w.close();
    const d = new Date(); lastWrite = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); fileBtnState(); }
  catch (e) { perm = 'prompt'; fileBtnState(); }
}

/* ---------- tooltip ---------- */
const tip = document.createElement('div'); tip.id = 'tip'; document.body.appendChild(tip);
document.addEventListener('mouseover', e => { const t = e.target.closest('[data-tip]'); if (!t) { tip.classList.remove('on'); return; } tip.innerHTML = t.dataset.tip; tip.classList.add('on'); });
document.addEventListener('mousemove', e => { if (!tip.classList.contains('on')) return;
  const x = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8), y = e.clientY + 16 + tip.offsetHeight > innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 16;
  tip.style.transform = `translate(${x}px,${y}px)`; });

/* ---------- box helpers ---------- */
const boxOf = dex => K().S.box.filter(b => b.dex === dex);
function boxFlags(b) {
  const k = K(), c = k.BY_ID.get(b.id), sp = k.SPECIES[b.dex - 1], o = k.ownedOf(b.dex), t = b.t ?? c.tier, pr = priceFor(c, t);
  return { c, sp, o, pr, t, gap: !o, better: !!o && t > o.t, rare: t >= 3 || (pr && pr.v >= 10) };
}
function addToBox(card, dex) { const k = K(); k.S.box.push({ id: card.id, dex, at: Date.now() }); k.logMove(dex, `${card.set} #${card.num} added to box`, card.tier); k.save();
  fetchPrices([card], () => { updatePills(); if (document.querySelector('#v-box.on')) renderBox(); }); }
function removeFromBox(i) { const k = K(), b = k.S.box[i]; if (!b) return; k.S.box.splice(i, 1); k.logMove(b.dex, 'removed from box', -1); k.save(); }
function moveToBinder(i) {
  const k = K(), S = k.S, b = S.box[i]; if (!b) return; const c = k.BY_ID.get(b.id), o = k.ownedOf(b.dex);
  S.box.splice(i, 1);
  if (o && o.c) S.box.push({ id: o.c, dex: b.dex, t: o.t, at: Date.now() });
  S.owned[b.dex] = { t: b.t ?? c.tier, c: c.id, at: Date.now() }; delete S.removed[b.dex]; delete S.toFile[b.dex]; S.filed[b.dex] = 1;
  k.logMove(b.dex, `moved ${c.set} #${c.num} from box to binder`, c.tier); k.save();
  k.toast(`${k.SPECIES[b.dex - 1].name}: ${c.set} #${c.num} is now in your binder`, k.TIERS[c.tier].c);
  if (c.tier >= 4) k.shower();
}

/* ---------- hooks used by the main script ---------- */
const PKX = window.PKX = {
  persist() { clearTimeout(writeT); writeT = setTimeout(writeFile, 800); },
  tileExtra(sp, o) {
    const bx = boxOf(sp.dex), n = bx.length, gap = !o && n > 0, better = !!o && bx.some(b => boxFlags(b).better);
    return `<span class="pp" data-dex="${sp.dex}"></span>${n ? `<span class="boxchip${better || gap ? ' hot' : ''}" data-tip="${n} in your downstairs box${gap ? '<br><b>Not in your binder yet: move it in</b>' : better ? '<br><b>One is better than your binder copy</b>' : ''}">📦 ${n}</span>` : ''}${o && !o.c ? '<span class="unpicked" data-tip="Printing not picked yet: open the card and choose the one in your binder">?</span>' : ''}`;
  },
  infoExtra(c, sp) {
    const pr = priceFor(c, c.tier);
    if (!known(c)) fetchPrices([c], () => K().wheelRefresh());
    return `<div><div class="k">Market price</div>${pr ? `<div class="v price">${money(pr.v)} <span class="muted">${pr.k.replace(/-/g, ' ')}</span></div><div class="muted">TCGplayer, as of ${usDate(pr.u)}${pr.url ? ` · <a href="${pr.url}" target="_blank" rel="noopener">see sales</a>` : ''}</div>` : `<div class="v muted">${known(c) ? 'No price listed' : 'Loading…'}</div>`}</div>
      <div class="statline"><span>HP <b>${c.hp || '–'}</b></span><span>${['Basic', 'Stage 1', 'Stage 2', 'Special'][c.stage] || ''}</span></div>`;
  },
  infoBox(c, sp) {
    const n = K().S.box.filter(b => b.id === c.id).length;
    return `<div class="boxrow"><button class="ghost" id="boxAdd">📦 + Downstairs box</button>${n ? `<button class="ghost" id="boxDel" title="Remove one from the box">− ${n}</button>` : ''}</div>`;
  },
  bindInfo(c, sp) {
    const a = $('#boxAdd'), d = $('#boxDel');
    a && (a.onclick = e => { addToBox(c, sp.dex); const r = e.target.getBoundingClientRect(); K().burst(r.left + r.width / 2, r.top, ['#D97706', '#FDE68A', '#fff'], 30);
      K().toast(`${sp.name}: ${c.set} #${c.num} added to your downstairs box`, '#D97706'); K().wheelRefresh(); K().refreshTile(sp.dex); });
    d && (d.onclick = () => { const i = K().S.box.findIndex(b => b.id === c.id); removeFromBox(i); K().wheelRefresh(); K().refreshTile(sp.dex); });
  },
  inBox: id => K().S.box.some(b => b.id === id),
  render(v) { if (v === 'stats') renderStats(); if (v === 'box') renderBox(); if (v === 'need') window.PKY && PKY.renderNeed(); },
  start() { initFile(); setPriceState(); updatePills(); refreshAll(); setInterval(() => { if (!busy) refreshAll(); }, 6 * 36e5); }
};

/* ---------- charts ---------- */
function hbars(rows, opts = {}) {
  const max = Math.max(1, ...rows.map(r => r.v));
  return `<div class="hb">${rows.map((r, i) => `<div class="hbr" data-tip="${esc(r.tip || r.l + ': ' + r.v)}">
    ${r.img ? `<img src="${r.img}" alt="" loading="lazy">` : ''}<span class="hbl">${r.l}</span>
    <div class="hbt"><div class="hbf" style="--w:${r.v / max * 100}%;--c:${r.c || '#4F46E5'};transition-delay:${i * 40}ms"></div></div>
    <span class="hbv">${opts.fmt ? opts.fmt(r.v) : r.v.toLocaleString()}</span></div>`).join('')}</div>`;
}
function vbars(rows) {
  const max = Math.max(1, ...rows.map(r => r.v)), step = Math.ceil(rows.length / 12);
  return `<div class="vb">${rows.map((r, i) => `<div class="vbc" data-tip="${esc(r.tip)}"><div class="vbf" style="--h:${r.v / max * 100}%;transition-delay:${i * 18}ms"></div><span>${i % step ? '' : r.l}</span></div>`).join('')}</div>`;
}
function lineChart(log) {
  const W = 600, H = 190, P = { l: 52, r: 14, t: 12, b: 26 };
  const max = Math.max(1, ...log.map(r => Math.max(r.binder, r.box))) * 1.1;
  const x = i => P.l + (log.length === 1 ? (W - P.l - P.r) / 2 : i / (log.length - 1) * (W - P.l - P.r)), y = v => P.t + (1 - v / max) * (H - P.t - P.b);
  const path = key => log.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[key]).toFixed(1)}`).join('');
  const ticks = [0, .5, 1].map(f => max / 1.1 * f);
  return `<svg class="lc" viewBox="0 0 ${W} ${H}" data-log='${JSON.stringify(log)}'>
    ${ticks.map(t => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}" stroke="#F3F4F6"/><text x="${P.l - 6}" y="${y(t) + 4}" text-anchor="end">${money(t).replace('.00', '')}</text>`).join('')}
    <text x="${P.l}" y="${H - 6}">${usDate(log[0].d)}</text><text x="${W - P.r}" y="${H - 6}" text-anchor="end">${usDate(log[log.length - 1].d)}</text>
    <path d="${path('binder')}" fill="none" stroke="#4F46E5" stroke-width="2" class="draw"/><path d="${path('box')}" fill="none" stroke="#DB2777" stroke-width="2" class="draw"/>
    ${log.map((r, i) => `<circle cx="${x(i)}" cy="${y(r.binder)}" r="4" fill="#4F46E5" stroke="#fff" stroke-width="2"/><circle cx="${x(i)}" cy="${y(r.box)}" r="4" fill="#DB2777" stroke="#fff" stroke-width="2"/>`).join('')}
    <line class="xh" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" stroke="#9CA3AF" stroke-dasharray="3 3" opacity="0"/>
    <rect class="hit" x="${P.l}" y="0" width="${W - P.l - P.r}" height="${H}" fill="transparent" data-x="${log.map((_, i) => x(i).toFixed(1)).join(',')}"/></svg>`;
}
document.addEventListener('mousemove', e => {
  const h = e.target.closest && e.target.closest('.lc .hit'); const xh = document.querySelector('.lc .xh'); if (!xh) return;
  if (!h) { xh.setAttribute('opacity', 0); return; }
  const svg = h.ownerSVGElement, r = svg.getBoundingClientRect(), xs = h.dataset.x.split(',').map(Number), log = JSON.parse(svg.dataset.log);
  const px = (e.clientX - r.left) / r.width * 600; let i = 0; xs.forEach((v, j) => { if (Math.abs(v - px) < Math.abs(xs[i] - px)) i = j; });
  xh.setAttribute('x1', xs[i]); xh.setAttribute('x2', xs[i]); xh.setAttribute('opacity', 1);
  tip.innerHTML = `<b>${usDate(log[i].d)}</b><br><i class="sw" style="background:#4F46E5"></i>Binder ${money(log[i].binder)}<br><i class="sw" style="background:#DB2777"></i>Box ${money(log[i].box)}`; tip.classList.add('on');
});
function countTo(el) { const to = +el.dataset.to, fmt = el.dataset.fmt, t0 = performance.now();
  const f = v => fmt === 'money' ? money(v) : fmt === 'dec' ? v.toFixed(1) : Math.round(v).toLocaleString();
  const step = now => { const p = Math.min(1, (now - t0) / 1100), ez = 1 - Math.pow(1 - p, 3); el.textContent = f(to * ez); if (p < 1) requestAnimationFrame(step); }; requestAnimationFrame(step); }
const tile = (lab, val, fmt, sub, c) => `<div class="kpi" style="--c:${c || 'var(--accent)'}"><div class="lab">${lab}</div><div class="val" data-to="${val}" data-fmt="${fmt || ''}">0</div><div class="sub">${sub || ''}</div></div>`;
const fact = (icon, lab, val, sub, img) => `<div class="fact">${img ? `<img src="${img}" alt="" loading="lazy">` : `<div class="fi">${icon}</div>`}<div><div class="lab">${lab}</div><div class="fv">${val}</div><div class="muted">${sub || ''}</div></div></div>`;
function animateIn(root) { requestAnimationFrame(() => requestAnimationFrame(() => { root.classList.add('go'); root.querySelectorAll('[data-to]').forEach(countTo); })); }

/* ---------- Binder Stats ---------- */
function renderStats() {
  snapshot();
  const k = K(), S = k.S, root = $('#v-stats'); root.classList.remove('go');
  const owned = k.SPECIES.filter(sp => k.ownedOf(sp.dex)).map(sp => { const o = k.ownedOf(sp.dex), c = k.displayCard(sp); return { sp, o, c, picked: !!o.c, pr: priceFor(c, o.t) }; });
  const picked = owned.filter(r => r.picked), t = totals(), n = owned.length;
  const hp = owned.reduce((a, r) => a + (r.c.hp || 0), 0);
  // facts on picked printings
  const byDate = picked.slice().sort((a, b) => a.c.date < b.c.date ? -1 : 1);
  const topHP = owned.slice().sort((a, b) => (b.c.hp || 0) - (a.c.hp || 0))[0];
  const cnt = (arr, key) => { const m = {}; arr.forEach(r => { const v = key(r); if (v) m[v] = (m[v] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const artists = cnt(picked, r => r.c.artist), sets = cnt(picked, r => r.c.set);
  let run = 0, best = [0, 0, 0], start = 1; for (let d = 1; d <= k.SPECIES.length + 1; d++) { if (k.ownedOf(d)) { if (!run) start = d; run++; if (run > best[0]) best = [run, start, d]; } else run = 0; }
  const upgrades = S.box.filter(b => { const f = boxFlags(b); return f.better || f.gap; }).length;
  const valued = owned.filter(r => r.pr).sort((a, b) => b.pr.v - a.pr.v).slice(0, 10);
  const years = {}; picked.forEach(r => { const y = r.c.date.slice(0, 4); years[y] = (years[y] || 0) + 1; });
  const yKeys = Object.keys(years).sort(); const yRows = []; if (yKeys.length) for (let y = +yKeys[0]; y <= +yKeys[yKeys.length - 1]; y++) yRows.push({ l: "'" + String(y).slice(2), v: years[y] || 0, tip: `${y}: ${years[y] || 0} card${years[y] === 1 ? '' : 's'}` });
  const types = cnt(owned, r => k.D.types[r.sp.type]).map(([l, v]) => ({ l, v, c: k.TYPE_C[k.D.types.indexOf(l)], tip: `${l}: ${v} Pokémon` }));
  const eraFirst = {}; picked.forEach(r => { if (!eraFirst[r.c.series] || r.c.date < eraFirst[r.c.series]) eraFirst[r.c.series] = r.c.date; });
  const eras = cnt(picked, r => r.c.series).sort((a, b) => eraFirst[a[0]] < eraFirst[b[0]] ? -1 : 1).map(([l, v]) => ({ l, v, tip: `${l} era: ${v} cards` }));
  const stages = [0, 0, 0, 0]; owned.forEach(r => stages[r.c.stage ?? 3]++);
  const STC = ['#4F46E5', '#0EA5E9', '#DB2777', '#9CA3AF'], STL = ['Basic', 'Stage 1', 'Stage 2', 'Special'];
  const tierVal = k.TIERS.map((tt, i) => ({ l: tt.l, v: owned.filter(r => r.o.t === i && r.pr).reduce((a, r) => a + r.pr.v, 0), c: tt.c }));
  const setTot = {}; k.CARDS.forEach(c => setTot[c.setId] = (setTot[c.setId] || 0) + 1);
  const setMap = {}; picked.forEach(r => { const id = r.c.setId; (setMap[id] = setMap[id] || { id, name: r.c.set, date: r.c.date, series: r.c.series, n: 0 }).n++; });
  const setRows = Object.values(setMap).sort((a, b) => b.n - a.n || (a.date < b.date ? 1 : -1)).slice(0, 12);
  const setMax = Math.max(1, ...setRows.map(r => r.n));
  const log = S.valueLog || [];
  const empty = m => `<div class="muted emptybox">${m}</div>`;
  root.innerHTML = `
    <div class="kpis six">
      ${tile('Binder value', t.conf + t.est, 'money', t.nEst ? `${money(t.conf)} picked · ~${money(t.est)} estimate for ${t.nEst} unpicked` : `${t.nConf} cards priced`, '#059669')}
      ${tile('Printings picked', picked.length, '', `of ${n} cards in your binder`, '#4F46E5')}
      ${tile('Downstairs box', S.box.length, '', `${money(t.box)} market value${upgrades ? ` · ${upgrades} upgrade${upgrades > 1 ? 's' : ''} waiting` : ''}`, '#D97706')}
      ${tile('Binder pages', Math.ceil(n / 9), '', '9-pocket pages, front only', '#0EA5E9')}
      ${tile('Total HP', hp, '', `avg ${n ? Math.round(hp / n) : 0} per card`, '#DC2626')}
      ${tile('To file', Object.keys(S.toFile).length, '', 'waiting for the binder', '#6B7280')}
    </div>
    <div class="sgrid">
      <div class="panel span2"><h3>Most valuable in your binder</h3>${valued.length ? hbars(valued.map(r => ({ l: r.sp.name + (r.picked ? '' : ' (est.)'), v: r.pr.v, img: r.c.img, tip: `<b>${esc(r.c.name)}</b><br>${esc(r.c.set)} #${r.c.num}<br>${money(r.pr.v)} · as of ${usDate(r.pr.u)}${r.picked ? '' : '<br>Estimate: printing not picked'}` })), { fmt: money }) : empty('Prices load in the background. This fills in a moment.')}</div>
      <div class="panel"><h3>Value over time</h3>${t.nEst ? '<div class="muted small">Binder includes estimates for unpicked printings</div>' : ''}${log.length === 1 ? `<div class="hero2"><div><div class="lab">Binder</div><div class="hv" style="color:#4F46E5">${money(log[0].binder)}</div></div><div><div class="lab">Box</div><div class="hv" style="color:#DB2777">${money(log[0].box)}</div></div></div><div class="muted" style="text-align:center">Tracking since ${usDate(log[0].d)}</div>` : log.length > 1 ? lineChart(log) + `<div class="legend"><div class="lg" style="--bc:#4F46E5"><i></i>Binder <span>${money(log[log.length - 1].binder)}</span></div><div class="lg" style="--bc:#DB2777"><i></i>Box <span>${money(log[log.length - 1].box)}</span></div></div>` : empty('First reading saves once prices load.')}</div>
      <div class="panel"><h3>Value by form</h3>${hbars(tierVal, { fmt: money })}${t.nEst ? '<div class="muted small" style="margin-top:10px">Includes estimates for unpicked printings</div>' : ''}</div>
      <div class="panel"><h3>Types in your binder</h3>${hbars(types)}</div>
      <div class="panel"><h3>Evolution stages</h3><div class="stack">${stages.map((v, i) => `<div style="background:${STC[i]};--w:${n ? v / n * 100 : 0}%" data-tip="${STL[i]}: ${v}"></div>`).join('')}</div>
        <div class="legend">${stages.map((v, i) => `<div class="lg" style="--bc:${STC[i]}"><i></i>${STL[i]} <span>${v}</span></div>`).join('')}</div>
        <h3 style="margin-top:22px">By generation</h3>${hbars(k.GENS.map((g, i) => ({ l: 'Gen ' + k.ROMAN[i], v: owned.filter(r => r.sp.gen === i).length, tip: `Gen ${k.ROMAN[i]} · ${g[2]}` })).filter(r => r.v))}</div>
      <div class="panel span3"><h3>Sets you're rocking${setRows.length ? ` · ${Object.keys(setMap).length} set${Object.keys(setMap).length === 1 ? '' : 's'} in your binder` : ''}</h3>${setRows.length ? setRows.map((r, i) => `<div class="setrow" data-tip="<b>${esc(r.name)}</b><br>${r.n} of its ${setTot[r.id]} Pokémon cards (${(r.n / setTot[r.id] * 100).toFixed(1)}%)<br>Released ${usDate(r.date)}"><img src="https://images.pokemontcg.io/${r.id}/logo.png" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><div class="sn">${i === 0 ? '👑 ' : ''}${esc(r.name)}<small>${esc(r.series)} · ${usDate(r.date)}</small></div><div class="hbt"><div class="hbf" style="--w:${r.n / setMax * 100}%;--c:#4F46E5;transition-delay:${i * 50}ms"></div></div><div class="sv">${r.n} card${r.n > 1 ? 's' : ''}<small>${(r.n / setTot[r.id] * 100).toFixed(1)}% of the set</small></div></div>`).join('') : empty('Open a card and press “This one is in my binder” to fill this in.')}</div>
      <div class="panel span2"><h3>Cards by release year</h3>${yRows.length ? vbars(yRows) : empty('Pick the printings in your binder to see their years.')}</div>
      <div class="panel"><h3>Eras</h3>${eras.length ? hbars(eras) : empty('Fills in as you pick printings.')}</div>
    </div>
    <h3 class="sech">Binder trivia</h3>
    <div class="facts">
      ${fact('📏', 'Stack height', `${(n * 0.33 / 10).toFixed(1)} cm`, `${n} cards, 0.33 mm each`)}
      ${fact('🛤️', 'Laid end to end', `${(n * 0.088).toFixed(1)} m`, 'at 88 mm per card')}
      ${fact('⚖️', 'Binder weight (cards)', `${(n * 1.75 / 1000).toFixed(2)} kg`, '1.75 g per card')}
      ${fact('🔗', 'Longest Pokédex streak', `${best[0]} in a row`, best[0] ? `#${best[1]} ${k.SPECIES[best[1] - 1].name} → #${best[2]} ${k.SPECIES[best[2] - 1].name}` : '')}
      ${topHP ? fact('', 'Highest HP', `${topHP.c.hp} HP`, `${topHP.sp.name}${topHP.picked ? '' : ' (default printing)'}`, topHP.c.img) : ''}
      ${byDate[0] ? fact('', 'Oldest card', usDate(byDate[0].c.date), `${byDate[0].c.name} · ${byDate[0].c.set}`, byDate[0].c.img) : fact('🕰️', 'Oldest card', '–', 'pick printings to unlock')}
      ${byDate.length ? fact('', 'Newest card', usDate(byDate[byDate.length - 1].c.date), `${byDate[byDate.length - 1].c.name} · ${byDate[byDate.length - 1].c.set}`, byDate[byDate.length - 1].c.img) : fact('✨', 'Newest card', '–', 'pick printings to unlock')}
      ${fact('🎨', 'Top artist', artists[0] ? esc(artists[0][0]) : '–', artists[0] ? `${artists[0][1]} cards` : 'pick printings to unlock')}
      ${fact('📚', 'Favourite set', sets[0] ? esc(sets[0][0]) : '–', sets[0] ? `${sets[0][1]} cards` : 'pick printings to unlock')}
      ${fact('🗂️', 'Different sets', sets.length, `across ${eras.length} eras`)}
      ${fact('💎', 'Holo or better', owned.filter(r => r.o.t >= 3).length, `${owned.filter(r => r.o.t === 5).length} secret / illustration`)}
      ${fact('📦', 'Box upgrades waiting', upgrades, 'better card or a binder gap')}
    </div>`;
  animateIn(root);
}

/* ---------- Box ---------- */
let boxFilter = 'all';
function renderBox() {
  const k = K(), S = k.S, root = $('#v-box'); root.classList.remove('go');
  const items = S.box.map((b, i) => Object.assign({ i }, boxFlags(b)));
  const val = items.reduce((a, r) => a + (r.pr ? r.pr.v : 0), 0);
  const show = items.filter(r => boxFilter === 'all' || (boxFilter === 'rare' && r.rare) || (boxFilter === 'up' && r.better) || (boxFilter === 'gap' && r.gap))
    .sort((a, b) => (b.pr ? b.pr.v : -1) - (a.pr ? a.pr.v : -1) || b.t - a.t);
  root.innerHTML = `
    <div class="kpis">
      ${tile('Cards in the box', items.length, '', 'downstairs', '#D97706')}
      ${tile('Box value', val, 'money', priceAsOf() ? 'TCGplayer market, as of ' + usDate(priceAsOf()) : '', '#059669')}
      ${tile('Rare finds', items.filter(r => r.rare).length, '', 'holo or better, or $10+', '#DB2777')}
      ${tile('Binder moves', items.filter(r => r.better || r.gap).length, '', `${items.filter(r => r.gap).length} fill a gap · ${items.filter(r => r.better).length} upgrade`, '#4F46E5')}
    </div>
    <div class="filters">
      <div class="search boxsearch"><input id="boxQ" placeholder="Add a box card: type a Pokémon, press Enter" autocomplete="off"></div>
      <div class="chips" id="boxChips">${[['all', 'All'], ['rare', 'Rare finds'], ['up', 'Upgrades binder'], ['gap', 'Fills a gap']].map(([v, l]) => `<button class="chip${boxFilter === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    </div>
    <div class="grid boxgrid">${show.length ? show.map((r, j) => `<div class="tile ${r.t ? 't' + r.t : ''}" style="--dl:${Math.min(j, 20) * 30}ms">
      <div class="card3d" data-open="${r.sp.dex}"><img loading="lazy" src="${r.c.img}" alt=""><div class="foil"></div><div class="glare"></div>
        ${r.pr ? `<span class="pp on">${money(r.pr.v)}</span>` : ''}
        ${r.gap ? '<div class="flag gap">FILLS A GAP</div>' : r.better ? '<div class="flag up">⬆ UPGRADE</div>' : r.rare ? '<div class="flag rare">★ RARE</div>' : ''}</div>
      <div class="meta"><span class="nm">${r.sp.name}</span><span class="num">#${String(r.sp.dex).padStart(3, '0')}</span></div>
      <div class="muted small">${esc(r.c.set)} #${r.c.num}</div>
      <span class="badge" style="--bc:${k.TIERS[r.t].c}">${k.TIERS[r.t].l}</span>
      <div class="acts"><button class="up" style="--nc:#4F46E5" data-mv="${r.i}">${r.gap || r.better ? '→ Binder' : 'Swap in'}</button><button class="dn" data-rm="${r.i}" title="Remove from box">×</button></div>
    </div>`).join('') : `<div class="empty"><div class="ball"></div>${items.length ? 'Nothing matches this filter.' : 'Your downstairs box is empty. Type a Pokémon above, open its wheel, and press “+ Downstairs box” on the printing you have.'}</div>`}</div>`;
  $('#boxChips').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; boxFilter = b.dataset.v; renderBox(); };
  $('#boxQ').onkeydown = e => { if (e.key !== 'Enter') return; const q = e.target.value.trim().toLowerCase(); if (!q) return;
    const sp = k.SPECIES.find(s => s.name.toLowerCase() === q) || k.SPECIES.find(s => s.name.toLowerCase().startsWith(q)) || k.SPECIES.find(s => s.name.toLowerCase().includes(q)) || (/^\d+$/.test(q) && k.SPECIES[+q - 1]);
    if (sp) k.openWheel(sp); else k.toast('No Pokémon by that name', '#DC2626'); };
  root.querySelector('.boxgrid').onclick = e => {
    const mv = e.target.closest('[data-mv]'), rm = e.target.closest('[data-rm]'), op = e.target.closest('[data-open]');
    if (mv) { const r = e.target.getBoundingClientRect(); k.burst(r.left + r.width / 2, r.top, ['#4F46E5', '#A5B4FC', '#fff'], 40); moveToBinder(+mv.dataset.mv); renderBox(); k.renderGrid(); return; }
    if (rm) { removeFromBox(+rm.dataset.rm); renderBox(); k.renderGrid(); return; }
    if (op) k.openWheel(k.SPECIES[op.dataset.open - 1]);
  };
  animateIn(root);
}
})();
