// Need list (missing Pokémon in their Basic printing) and "Rip a pack" sorting for the Poké Collection page.
(() => {
'use strict';
const $ = s => document.querySelector(s);
const K = () => window.PKC;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(3, '0');

/* ---------- Need tab ---------- */
// The shell (search box, filters) is built once; typing only redraws the answer and the grid, so focus never jumps.
const NEED = { gen: -1, only: 'all', q: '', built: false };
const nnum = x => String(x || '').toUpperCase().replace(/^0+(?=\d)/, '').replace(/([A-Z])0+(?=\d)/g, '$1');
function needShell() {
  const root = $('#v-need');
  root.innerHTML = `
    <div class="needcheck">
      <label for="needQ" class="lab">Do I need it?</label>
      <input id="needQ" type="search" inputmode="search" autocomplete="off" placeholder="Pokémon name, #number, or card number like 199/165">
      <div id="needAns" aria-live="polite"></div>
    </div>
    <div id="needHead"></div>
    <div class="filters"><div class="chips" id="needChips"></div><span class="count" id="needCount"></span></div>
    <div class="needgrid" id="needGrid"></div>`;
  const q = $('#needQ'); let t;
  q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { NEED.q = q.value.trim().toLowerCase(); updateNeed(); }, 120); });
  root.addEventListener('click', e => {
    const k = K(), g = e.target.closest('[data-g]'), v = e.target.closest('[data-v]'), got = e.target.closest('[data-got]'), op = e.target.closest('[data-open]');
    if (got) { const dex = +got.dataset.got, sp = k.SPECIES[dex - 1], S = k.S;
      S.owned[dex] = { t: 0, c: null, at: Date.now() }; delete S.removed[dex]; S.toFile[dex] = 1; delete S.filed[dex];
      k.logMove(dex, 'added from Need list', 0); k.save(); k.toast(`${sp.name} caught! Marked to file`, '#059669');
      const c = got.closest('.needc'); c && c.classList.add('caught'); setTimeout(() => { updateNeed(); k.renderGrid(); }, 480); return; }
    if (op) { k.openWheel(k.SPECIES[op.dataset.open - 1]); return; }
    if (g) { NEED.gen = +g.dataset.g === NEED.gen ? -1 : +g.dataset.g; updateNeed(); return; }
    if (v) { NEED.only = v.dataset.v; updateNeed(); }
  });
  NEED.built = true;
}
function needAnswer(raw) {
  const k = K(); if (!raw) return '';
  const q = raw.trim(), ql = q.toLowerCase(), qn = q.replace(/^#/, '');
  const status = sp => { const o = k.ownedOf(sp.dex);
    return o ? `<span class="ans have">✓ You have it</span><small>${k.TIERS[o.t].l}${o.c ? ' · ' + esc(k.BY_ID.get(o.c).set) + ' #' + esc(k.BY_ID.get(o.c).num) : ' · printing not set'}${k.S.toFile[sp.dex] ? ' · waiting to be filed' : ''}</small>`
      : `<span class="ans need">✗ You need it</span><small>${k.WANT.has(sp.dex) ? 'On your want list · ' : ''}${sp.cards.length} printings exist</small>`; };
  const rows = [], seen = new Set();
  const addSp = sp => { if (sp && !seen.has(sp.dex)) { seen.add(sp.dex); rows.push(`<button class="ansrow ${k.ownedOf(sp.dex) ? 'have' : 'need'}" data-open="${sp.dex}"><img src="${sp.basic.img}" alt="" loading="lazy"><div><b>${esc(sp.name)}</b> <span class="muted">#${pad(sp.dex)}</span><div>${status(sp)}</div></div></button>`); } };
  // card number: has a slash, or letters + digits (TG05, SWSH069, GG12)
  const m = q.match(/^([a-z]{0,6}\s?\d{1,4})\s*(?:\/\s*([a-z]{0,6}\d{1,4}))?$/i);
  const isCardNo = m && (m[2] || /[a-z]/i.test(m[1]));
  if (isCardNo) {
    // "199/165": the number after the slash is the set's printed size, so cards from a 165-card set come first
    const total = m[2] && /^\d+$/.test(m[2]) ? +m[2] : 0, setTotal = {}; k.D.sets.forEach(x => setTotal[x[0]] = x[5] || 0);
    const num = nnum(m[1].replace(/\s/g, '')), hits = k.CARDS.filter(c => nnum(c.num) === num)
      .sort((a, b) => ((total && setTotal[b.setId] === total) - (total && setTotal[a.setId] === total)) || (a.date < b.date ? 1 : -1)).slice(0, total && k.CARDS.some(c => nnum(c.num) === num && setTotal[c.setId] === total) ? 3 : 10);
    hits.forEach(c => { const dex = c.dex[0], sp = k.SPECIES[dex - 1], o = k.ownedOf(dex), mine = o && o.c === c.id;
      rows.push(`<button class="ansrow ${o ? 'have' : 'need'}" data-open="${dex}"><img src="${c.img}" alt="" loading="lazy"><div><b>${esc(c.name)}</b> <span class="muted">${esc(c.set)} #${esc(c.num)} · ${esc(c.rar)}</span><div>${mine ? '<span class="ans have">★ This exact card is in your binder</span>' : o ? `<span class="ans have">✓ You have ${esc(sp.name)}</span><small>a different printing; this one would be ${k.TIERS[c.tier].l}${c.tier > o.t ? ' (an upgrade!)' : ''}</small>` : `<span class="ans need">✗ You need ${esc(sp.name)}</span>`}</div></div></button>`); });
    if (!hits.length) rows.push(`<div class="muted">No card has the number ${esc(q)}.</div>`);
  } else {
    if (/^\d{1,4}$/.test(qn) && +qn >= 1 && +qn <= k.SPECIES.length) addSp(k.SPECIES[+qn - 1]);
    k.SPECIES.filter(sp => sp.name.toLowerCase() === ql).forEach(addSp);
    k.SPECIES.filter(sp => sp.name.toLowerCase().startsWith(ql)).slice(0, 6).forEach(addSp);
    if (rows.length < 6) k.SPECIES.filter(sp => sp.name.toLowerCase().includes(ql)).slice(0, 6 - rows.length).forEach(addSp);
    if (!rows.length) rows.push(`<div class="muted">No Pokémon matches “${esc(q)}”.</div>`);
  }
  return `<div class="anslist">${rows.join('')}</div>`;
}
function updateNeed() {
  const k = K(); if (!NEED.built) needShell();
  const all = k.SPECIES.filter(sp => !k.ownedOf(sp.dex)), byGen = k.GENS.map((g, i) => all.filter(sp => sp.gen === i).length);
  const qn = NEED.q.replace('#', '');
  const isCardNo = /\//.test(NEED.q) || /^[a-z]{1,6}\s?\d/i.test(NEED.q) && !/^[a-z]+$/i.test(NEED.q) && /\d/.test(NEED.q);
  const list = all.filter(sp => (NEED.gen < 0 || sp.gen === NEED.gen) && (NEED.only === 'all' || k.WANT.has(sp.dex))
    && (!NEED.q || isCardNo || sp.name.toLowerCase().includes(NEED.q) || (/^\d+$/.test(qn) && String(sp.dex).startsWith(qn))));
  $('#needAns').innerHTML = needAnswer(NEED.q);
  $('#needHead').innerHTML = `<div class="needhead">
      <div><div class="lab">Still need</div><div class="needbig">${all.length}</div><div class="muted">${all.filter(sp => k.WANT.has(sp.dex)).length} on your want list</div></div>
      <div class="needgens">${k.GENS.map((g, i) => `<button class="ng${NEED.gen === i ? ' on' : ''}" data-g="${i}" data-tip="Gen ${k.ROMAN[i]} · ${g[2]}: ${byGen[i]} needed"><b>${byGen[i]}</b><span>Gen ${k.ROMAN[i]}</span><i style="--h:${byGen[i] / (g[1] - g[0] + 1) * 100}%"></i></button>`).join('')}</div></div>`;
  $('#needChips').innerHTML = [['all', 'Everything I need'], ['want', 'Want list only']].map(([v, l]) => `<button class="chip${NEED.only === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('') + `<button class="chip${NEED.gen < 0 ? ' on' : ''}" data-g="-1">All gens</button>`;
  $('#needCount').textContent = `${list.length} shown`;
  const shown = isCardNo ? [] : list;
  $('#needGrid').innerHTML = shown.length ? shown.map(sp => `<div class="needc${k.WANT.has(sp.dex) ? ' w' : ''}" data-dex="${sp.dex}">
      <img loading="lazy" src="${sp.basic.img}" alt="" data-open="${sp.dex}">
      <div class="nn"><b>${sp.name}</b><span>#${pad(sp.dex)}</span></div>
      <div class="muted small">${esc(sp.basic.set)} #${sp.basic.num}</div>
      <button class="gotit" data-got="${sp.dex}">✓ Got it</button></div>`).join('')
    : isCardNo ? '' : `<div class="empty">${NEED.q ? 'You don’t need any Pokémon matching that. See the answer above.' : 'Nothing needed here. Caught them all!'}</div>`;
}
function renderNeed() { updateNeed(); }

/* ---------- Rip a pack ---------- */
const setsByDate = () => K().D.sets.map((s, i) => ({ i, id: s[0], name: s[1], date: s[3] })).sort((a, b) => a.date < b.date ? 1 : -1);
const normNum = x => String(x).toUpperCase().replace(/^0+(?=\d)/, '').replace(/(\D)0+(?=\d)/g, '$1');
function parsePulls(text, setId) {
  const k = K(); const inSet = k.CARDS.filter(c => c.setId === setId);
  return text.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean).map(raw => {
    let tok = raw, rev = false;
    // reverse holo: 'r' / 'rh' / 'rev' only right after a card number (45r, 199/165 r); names need the whole word (Pikachu reverse)
    const mNum = tok.match(/^([A-Za-z]{0,6}\d+(?:\s*\/\s*[A-Za-z]{0,6}\d+)?)\s*(r|rh|rev|reverse)(\s+holo)?$/i);
    const mName = !mNum && tok.match(/^(.+?)\s+(reverse holo|reverse)$/i);
    if (mNum) { rev = true; tok = mNum[1]; } else if (mName) { rev = true; tok = mName[1]; }
    const num = tok.split('/')[0].trim();
    let card = inSet.find(c => normNum(c.num) === normNum(num));
    if (!card) { const n = tok.toLowerCase(); card = inSet.find(c => c.name.toLowerCase() === n) || inSet.find(c => c.name.toLowerCase().startsWith(n)) || inSet.find(c => c.name.toLowerCase().includes(n)); }
    return { raw, card, rev };
  });
}
function classify(p) {
  const k = K(); if (!p.card) return { kind: 'skip' };
  const dex = p.card.dex[0], o = k.ownedOf(dex), tier = p.rev && p.card.tier === 0 ? 1 : p.card.tier;
  if (!o) return { kind: 'new', dex, tier };
  if (tier > o.t) return { kind: 'up', dex, tier, from: o.t };
  return { kind: 'dupe', dex, tier };
}
function openRip() {
  const k = K(), sets = setsByDate();
  $('#ripBody').innerHTML = `
    <div class="ripform">
      <label class="lab">Which set?</label>
      <select id="ripSet">${sets.map(s => `<option value="${s.id}">${esc(s.name)} · ${k.fmtDate(s.date)}</option>`).join('')}</select>
      <label class="lab">What did you pull?</label>
      <textarea id="ripText" rows="5" placeholder="Card numbers or names, one per line or with commas.&#10;Add r for a reverse holo.&#10;e.g.  12, 45r, 199/165, Pikachu"></textarea>
      <button class="primary" id="ripGo">Open the pack ✨</button>
    </div>`;
  $('#rip').classList.add('on'); $('#ripText').focus();
  $('#ripGo').onclick = () => reveal($('#ripSet').value, $('#ripText').value);
}
function reveal(setId, text) {
  const k = K(), pulls = parsePulls(text, setId).map(p => Object.assign(p, classify(p)));
  if (!pulls.length) { k.toast('Type at least one card number or name', '#DC2626'); return; }
  // batch-aware: two of the same new Pokémon in one pack → second is a dupe
  // several of the same Pokémon in one pack: the best copy is judged against the binder, every other copy is a dupe
  const groups = {}; pulls.forEach(p => { if (p.kind !== 'skip') (groups[p.dex] = groups[p.dex] || []).push(p); });
  Object.values(groups).forEach(g => { if (g.length < 2) return; g.sort((a, b) => b.tier - a.tier); g.slice(1).forEach(p => p.kind = 'dupe'); });
  const label = { new: ['NEW', 'Binder: fills a gap', '#059669'], up: ['UPGRADE', 'Binder: swap it in', '#4F46E5'], dupe: ['DUPE', 'Goes to the box', '#D97706'], skip: ['?', 'Not found in this set', '#9CA3AF'] };
  $('#ripBody').innerHTML = `<div class="pack">${pulls.map((p, i) => `<div class="pc" style="--d:${i * 380}ms">
      <div class="pci"><div class="pback"></div><div class="pfront ${p.card && p.tier >= 3 ? 'shiny' : ''}">${p.card ? `<img src="${p.card.img}" alt="">` : `<div class="pnf">${esc(p.raw)}</div>`}</div></div>
      <div class="ptag" style="--c:${label[p.kind][2]}">${label[p.kind][0]}</div>
      <div class="pname">${p.card ? esc(p.card.name) : esc(p.raw)}</div><div class="muted small">${label[p.kind][1]}${p.rev && p.card ? ' · reverse' : ''}</div></div>`).join('')}</div>
    <div class="ripsum" style="--d:${pulls.length * 380 + 300}ms">
      <div><b>${pulls.filter(p => p.kind === 'new' || p.kind === 'up').length}</b> for the binder · <b>${pulls.filter(p => p.kind === 'dupe').length}</b> to the box${pulls.some(p => p.kind === 'skip') ? ` · <b>${pulls.filter(p => p.kind === 'skip').length}</b> not found` : ''}</div>
      <button class="primary" id="ripApply">Sort into my collection</button><button class="ghost" id="ripBack">Edit pulls</button></div>`;
  pulls.forEach((p, i) => { if (p.card && p.tier >= 4) setTimeout(() => { const el = document.querySelectorAll('.pc')[i]; if (!el) return; const r = el.getBoundingClientRect(); k.burst(r.left + r.width / 2, r.top + r.height / 3, ['#FBBF24', '#F472B6', '#A78BFA', '#fff'], 70); }, i * 380 + 700); });
  $('#ripBack').onclick = () => { openRip(); $('#ripSet').value = setId; $('#ripText').value = text; };
  $('#ripApply').onclick = () => apply(pulls);
}
function apply(pulls) {
  const k = K(), S = k.S, toBinder = [], toBox = [];
  pulls.forEach(p => {
    if (p.kind === 'skip') return; const sp = k.SPECIES[p.dex - 1];
    if (p.kind === 'new' || p.kind === 'up') {
      const o = k.ownedOf(p.dex);
      if (o && o.c) S.box.push({ id: o.c, dex: p.dex, t: o.t, at: Date.now() });
      S.owned[p.dex] = { t: p.tier, c: p.card.id, at: Date.now() }; delete S.removed[p.dex]; S.toFile[p.dex] = 1; delete S.filed[p.dex];
      k.logMove(p.dex, `pulled ${p.card.set} #${p.card.num}${p.kind === 'up' ? ' (upgrade)' : ''}`, p.tier);
      toBinder.push(`${sp.name}: ${p.card.set} #${p.card.num}${p.kind === 'up' ? (o && o.c ? ' (old one to the box)' : ' (swap out your old copy)') : ''}`);
    } else { S.box.push({ id: p.card.id, dex: p.dex, t: p.tier, at: Date.now() }); k.logMove(p.dex, `pulled dupe ${p.card.set} #${p.card.num} → box`, p.tier); toBox.push(`${sp.name}: ${p.card.set} #${p.card.num}`); }
  });
  k.save(); k.renderGrid(); if (toBinder.length) k.shower();
  $('#ripBody').innerHTML = `<div class="ripdone">
    <h3>📒 Put these in your binder (${toBinder.length})</h3>${toBinder.length ? `<ul>${toBinder.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<div class="muted">Nothing new this time.</div>'}
    <h3>📦 These go to the box (${toBox.length})</h3>${toBox.length ? `<ul>${toBox.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : '<div class="muted">No dupes.</div>'}
    <div class="muted small">Binder cards are tagged TO FILE until you press 📁 on them.</div>
    <button class="primary" id="ripAgain">Rip another pack</button></div>`;
  $('#ripAgain').onclick = openRip;
}
$('#ripBtn') && ($('#ripBtn').onclick = openRip);
$('#ripClose') && ($('#ripClose').onclick = () => $('#rip').classList.remove('on'));
$('#rip') && $('#rip').addEventListener('click', e => { if (e.target.id === 'rip') $('#rip').classList.remove('on'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#rip') && $('#rip').classList.remove('on'); });

window.PKY = { renderNeed, openRip };
// this script loads after the main one: if the page opened straight on the Need tab (#need), draw it now
if (document.querySelector('#v-need.on')) renderNeed();
})();
