// Need list (missing Pokémon in their Basic printing) and "Rip a pack" sorting for the Poké Collection page.
(() => {
'use strict';
const $ = s => document.querySelector(s);
const K = () => window.PKC;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(3, '0');

/* ---------- Need tab ---------- */
const NEED = { gen: -1, only: 'all', q: '' };
function renderNeed() {
  const k = K(), root = $('#v-need');
  const all = k.SPECIES.filter(sp => !k.ownedOf(sp.dex));
  const list = all.filter(sp => (NEED.gen < 0 || sp.gen === NEED.gen) && (NEED.only === 'all' || k.WANT.has(sp.dex))
    && (!NEED.q || sp.name.toLowerCase().includes(NEED.q) || String(sp.dex).startsWith(NEED.q.replace('#', ''))));
  const byGen = k.GENS.map((g, i) => all.filter(sp => sp.gen === i).length);
  root.innerHTML = `
    <div class="needhead">
      <div><div class="lab">Still need</div><div class="needbig">${all.length}</div><div class="muted">${all.filter(sp => k.WANT.has(sp.dex)).length} on your want list</div></div>
      <div class="needgens">${k.GENS.map((g, i) => `<button class="ng${NEED.gen === i ? ' on' : ''}" data-g="${i}" data-tip="Gen ${k.ROMAN[i]} · ${g[2]}: ${byGen[i]} needed"><b>${byGen[i]}</b><span>Gen ${k.ROMAN[i]}</span><i style="--h:${byGen[i] / (g[1] - g[0] + 1) * 100}%"></i></button>`).join('')}</div>
    </div>
    <div class="filters">
      <div class="search boxsearch"><input id="needQ" placeholder="Quick check: type a name or #" value="${esc(NEED.q)}" autocomplete="off"></div>
      <div class="chips" id="needChips">${[['all', 'Everything I need'], ['want', 'Want list only']].map(([v, l]) => `<button class="chip${NEED.only === v ? ' on' : ''}" data-v="${v}">${l}</button>`).join('')}
        <button class="chip${NEED.gen < 0 ? ' on' : ''}" data-g="-1">All gens</button></div>
      <span class="count">${list.length} shown</span>
    </div>
    <div class="needgrid">${list.length ? list.map((sp, i) => `<div class="needc${k.WANT.has(sp.dex) ? ' w' : ''}" style="--dl:${Math.min(i, 30) * 20}ms" data-dex="${sp.dex}">
      <img loading="lazy" src="${sp.basic.img}" alt="" data-open="${sp.dex}">
      <div class="nn"><b>${sp.name}</b><span>#${pad(sp.dex)}</span></div>
      <div class="muted small">${esc(sp.basic.set)} #${sp.basic.num}</div>
      <button class="gotit" data-got="${sp.dex}">✓ Got it</button></div>`).join('')
      : `<div class="empty"><div class="ball"></div>${NEED.q ? 'You already have that one, or no Pokémon matches.' : 'Nothing needed here. Caught them all!'}</div>`}</div>`;
  root.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { NEED.gen = +b.dataset.g === NEED.gen ? -1 : +b.dataset.g; renderNeed(); });
  $('#needChips').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; NEED.only = b.dataset.v; renderNeed(); });
  const q = $('#needQ'); q.oninput = () => { NEED.q = q.value.trim().toLowerCase(); clearTimeout(q._t); q._t = setTimeout(() => { renderNeed(); const n = $('#needQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 150); };
  root.querySelector('.needgrid').onclick = e => {
    const g = e.target.closest('[data-got]'), o = e.target.closest('[data-open]');
    if (g) { const dex = +g.dataset.got, sp = k.SPECIES[dex - 1], S = k.S;
      S.owned[dex] = { t: 0, c: null, at: Date.now() }; delete S.removed[dex]; S.toFile[dex] = 1; delete S.filed[dex];
      k.logMove(dex, 'added from Need list', 0); k.save();
      const r = g.getBoundingClientRect(); k.burst(r.left + r.width / 2, r.top, ['#059669', '#34D399', '#fff', '#FBBF24'], 50);
      k.toast(`${sp.name} caught! Marked to file`, '#059669'); const card = g.closest('.needc'); card.classList.add('caught');
      setTimeout(() => { renderNeed(); k.renderGrid(); }, 520); return; }
    if (o) k.openWheel(k.SPECIES[o.dataset.open - 1]);
  };
}

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
})();
