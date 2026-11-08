// One Piece section: same app, same dock. Data: data/onepiece.js (tcgcsv.com / TCGplayer, rebuilt daily), loaded on first switch.
// Ownership per card (TCGplayer product id): 1 = in binder, 2 = owned (not in binder). Saved locally + Firebase binders/op-main.
(() => {
'use strict';
const $ = s => document.querySelector(s);
const K = () => window.PKC;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const money = v => !v ? '–' : v >= 1000 ? '$' + Math.round(v).toLocaleString() : '$' + v.toFixed(2);
const us = iso => { if (!iso) return ''; const [y, m, d] = iso.slice(0, 10).split('-'); return `${m}/${d}/${y.slice(2)}`; };
const img = (pid, big) => `https://tcgplayer-cdn.tcgplayer.com/product/${pid}_${big ? 'in_1000x1000' : '200w'}.jpg`;
const COLOR = { Red: '#DC2626', Green: '#16A34A', Blue: '#2563EB', Purple: '#9333EA', Black: '#374151', Yellow: '#CA8A04' };
const RARITY_NAME = { C: 'Common', UC: 'Uncommon', R: 'Rare', SR: 'Super Rare', SEC: 'Secret Rare', L: 'Leader', PR: 'Promo', TR: 'Treasure Rare' };
const PROMO = /promotion|release event|tournament|championship|judge|pre-release|premium|anniversary set|demo/i;
const NOT_PULLABLE = /serial|trophy|winner|champion|finalist|top \d/i;

/* ----- data + state ----- */
const OP = { data: null, loading: false, owned: {}, view: 'collection', f: { set: 'all', color: 'all', rarity: 'all', state: 'all', q: '', sort: 'num' }, quick: false, packSet: null, limit: 120, needQ: '' };
try { OP.owned = JSON.parse(localStorage.getItem('pkc.op')) || {}; } catch (e) {}
const saveLocal = () => { try { localStorage.setItem('pkc.op', JSON.stringify(OP.owned)); } catch (e) {} };
const save = () => { saveLocal(); window.PKCloud && PKCloud.pushOP && PKCloud.pushOP(OP.owned); };
function load(cb) {
  if (OP.data) return cb();
  if (OP.loading) return; OP.loading = true;
  const s = document.createElement('script'); s.src = 'data/onepiece.js?v=' + (document.querySelector('script[src*="js/onepiece.js?v="]') || { src: 'v=1' }).src.split('v=')[1];
  s.onload = () => { const D = window.PK_OP; OP.data = { asOf: D.asOf, sets: D.sets.map((x, i) => ({ i, gid: x[0], name: x[1], date: x[2], abbr: x[3], n: x[4], promo: PROMO.test(x[1]) })),
    cards: D.cards.map(c => ({ pid: c[0], num: c[1], n: c[2], r: c[3], color: c[4], type: c[5], cost: c[6], power: c[7], traits: c[8], si: c[9], usd: c[10], v: c[11] })) };
    OP.data.cards.forEach(c => { c.set = OP.data.sets[c.si]; c.tier = tierOf(c); });
    // sets that aren't out yet have no pictures: list them last
    const today = new Date().toISOString().slice(0, 10); OP.data.sets.forEach(x => x.future = x.date > today);
    OP.data.cards.sort((a, b) => (a.set.future - b.set.future) || (a.si - b.si));
    OP.loading = false; cb(); };
  s.onerror = () => { OP.loading = false; root().innerHTML = '<div class="empty">Couldn’t load One Piece cards. Check your connection.</div>'; };
  document.body.appendChild(s);
}
// rarity + version -> our six forms (for points and "big hits")
function tierOf(c) {
  const v = (c.v || '').toLowerCase(); let t = { C: 0, UC: 1, PR: 1, R: 2, SR: 3, L: 3, SEC: 5, TR: 5 }[c.r] ?? 1;
  if (/manga|super|red super|gold|serial|treasure/.test(v)) t = 5; else if (/alternate|parallel|sp\b|^sp$|full art|special|foil/.test(v)) t = Math.max(t, 4);
  return t;
}
const pts = c => K() ? K().cardPoints(c.tier, c.usd, c.set.date) : 0;
const st = c => OP.owned[c.pid] || 0; // 0 not owned, 1 in binder, 2 owned
const statusPill = c => { const s = st(c); return s === 1 ? '<span class="pill have">📒 In binder</span>' : s === 2 ? '<span class="pill own">✓ Owned</span>' : '<span class="pill need">✗ Need</span>'; };
const root = () => $('#op-' + OP.view);
const isEditor = () => !!(window.PKCloud && PKCloud.editor);

/* ----- shared card tile ----- */
function tile(c) {
  const s = st(c), col = COLOR[(c.color || '').split(';')[0]] || '#6B7280';
  if (OP.quick) return `<div class="tile qt opq${s === 1 ? ' on' : s === 2 ? ' own' : ''}" data-pid="${c.pid}" role="button" tabindex="0"><img src="${BLANK}" data-src="${img(c.pid)}" alt=""><span class="qn">${esc(c.n)}</span><span class="qd">${esc(c.num)}${c.v ? ' · ' + esc(c.v) : ''}</span><span class="qs">${s === 1 ? '📒 In binder' : s === 2 ? '✓ Owned' : 'Not owned'}</span><span class="qc">${s ? '✓' : ''}</span></div>`;
  return `<div class="opc${s ? ' have' : ''}${c.tier >= 4 ? ' hit' + c.tier : ''}" data-pid="${c.pid}" role="button" tabindex="0" style="--cc:${col}">
    <div class="opimg"><img src="${BLANK}" data-src="${img(c.pid)}" alt="" onerror="this.parentNode.classList.add('noimg');this.remove()"><span class="ph"><b>${esc(c.n)}</b><small>${c.set.future ? 'Out ' + us(c.set.date) : 'Picture coming soon'}</small></span><span class="pnum">${esc(c.num)}</span>${c.v ? `<span class="opv">${esc(c.v)}</span>` : ''}</div>
    <div class="pcn"><b>${esc(c.n)}</b><small>${esc(RARITY_NAME[c.r] || c.r)} · ${esc(c.color)}</small></div>
    <div class="pcp"><b>${money(c.usd)}</b>${statusPill(c)}</div></div>`;
}
function grid(list, cls) { OP.list = list; return `<div class="${cls || 'opgrid'}${OP.quick ? ' grid quick' : ''}" id="opGrid">${list.slice(0, OP.limit).map(tile).join('')}${list.length > OP.limit ? `<button class="ghost needmore" data-more="1">Show more (${list.length - OP.limit} to go)</button>` : ''}</div>`; }

/* ----- Collection ----- */
function filtered() {
  const f = OP.f, q = f.q.trim().toLowerCase(); let list = OP.data.cards;
  if (f.set !== 'all') list = list.filter(c => String(c.set.gid) === f.set);
  if (f.color !== 'all') list = list.filter(c => (c.color || '').includes(f.color));
  if (f.rarity !== 'all') list = list.filter(c => f.rarity === 'hits' ? c.tier >= 4 : c.r === f.rarity);
  if (f.state !== 'all') list = list.filter(c => f.state === 'binder' ? st(c) === 1 : f.state === 'owned' ? st(c) > 0 : f.state === 'out' ? st(c) === 2 : !st(c));
  if (q) list = list.filter(c => c.n.toLowerCase().includes(q) || c.num.toLowerCase().includes(q) || (c.traits || '').toLowerCase().includes(q));
  if (f.sort === 'price') list = list.slice().sort((a, b) => b.usd - a.usd);
  return list;
}
function kpis() {
  const own = OP.data.cards.filter(c => st(c)), inB = own.filter(c => st(c) === 1);
  const value = own.reduce((a, c) => a + (c.usd || 0), 0), points = inB.reduce((a, c) => a + pts(c), 0);
  return `<div class="kpis opk">
    <div class="kpi" style="--c:var(--accent)"><div class="lab">Owned</div><div class="val">${own.length.toLocaleString()}</div><div class="sub">of ${OP.data.cards.length.toLocaleString()} cards · ${inB.length} in binder</div></div>
    <div class="kpi" style="--c:var(--green)"><div class="lab">Collection value</div><div class="val">${money(value)}</div><div class="sub">TCGplayer market · as of ${us(OP.data.asOf)}</div></div>
    <div class="kpi" style="--c:#D97706"><div class="lab">⭐ Binder points</div><div class="val">${points.toLocaleString()}</div><div class="sub">rarity + value</div></div>
    <div class="kpi" style="--c:var(--red)"><div class="lab">Sets</div><div class="val">${OP.data.sets.filter(s => !s.promo).length}</div><div class="sub">plus promo groups</div></div></div>`;
}
function renderCollection() {
  const f = OP.f, list = filtered(), sets = OP.data.sets;
  root().innerHTML = `${kpis()}
    <div class="quickbar" id="opQuickBar" style="${OP.quick ? 'display:flex' : ''}"><span>✅ <b>Quick edit:</b> tap to cycle <span class="qlegend"><i style="background:var(--green)">📒 In binder</i>→<i style="background:var(--accent)">✓ Owned</i>→<i style="background:#9CA3AF">✗ Not owned</i></span> Every tap saves.</span></div>
    <div class="filters opf">
      <button class="quickbtn${OP.quick ? ' on' : ''}" id="opQuick" type="button">${OP.quick ? '✓ Done editing' : '✅ Quick edit'}</button>
      <input class="opsearch" id="opQ" type="search" placeholder="Search name, OP01-120, or trait" value="${esc(f.q)}" autocomplete="off">
      <select id="opSet"><option value="all">All sets</option>${sets.map(s => `<option value="${s.gid}"${String(s.gid) === f.set ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <div class="chips">${[['all', 'All'], ['binder', '📒 In binder'], ['out', 'Not in binder'], ['need', 'Not owned']].map(([v, l]) => `<button class="chip${f.state === v ? ' on' : ''}" data-state="${v}">${l}</button>`).join('')}</div>
      <div class="chips">${['all', ...Object.keys(COLOR)].map(v => `<button class="chip${f.color === v ? ' on' : ''}" data-color="${v}"${v !== 'all' ? ` style="--cc:${COLOR[v]}"` : ''}>${v === 'all' ? 'Any colour' : v}</button>`).join('')}</div>
      <select id="opRar"><option value="all">Any rarity</option><option value="hits"${f.rarity === 'hits' ? ' selected' : ''}>💎 Big hits</option>${Object.entries(RARITY_NAME).map(([k, l]) => `<option value="${k}"${f.rarity === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <select id="opSort"><option value="num">Sort: Set order</option><option value="price"${f.sort === 'price' ? ' selected' : ''}>Sort: Price</option></select>
      <span class="count">${list.length.toLocaleString()} shown</span>
    </div>
    ${list.length ? grid(list) : '<div class="empty">No cards match.</div>'}`;
  const r = root(); let t;
  r.querySelector('#opQ').oninput = e => { clearTimeout(t); t = setTimeout(() => { f.q = e.target.value; OP.limit = 120; const pos = e.target.selectionStart; renderCollection(); const q = $('#opQ'); q.focus(); q.setSelectionRange(pos, pos); }, 200); };
  r.querySelector('#opSet').onchange = e => { f.set = e.target.value; OP.limit = 120; renderCollection(); };
  r.querySelector('#opRar').onchange = e => { f.rarity = e.target.value; OP.limit = 120; renderCollection(); };
  r.querySelector('#opSort').onchange = e => { f.sort = e.target.value; renderCollection(); };
  r.querySelector('#opQuick').onclick = () => { OP.quick = !OP.quick; renderCollection(); };
  r.querySelectorAll('[data-state]').forEach(b => b.onclick = () => { f.state = b.dataset.state; OP.limit = 120; renderCollection(); });
  r.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { f.color = b.dataset.color; OP.limit = 120; renderCollection(); });
}

/* ----- clicks: quick toggle, more, open card ----- */
document.addEventListener('click', e => {
  if (!document.body.classList.contains('game-op')) return;
  const more = e.target.closest('#opGrid [data-more], .opview [data-more]'); if (more) { OP.limit += 120; render(OP.view); return; }
  const el = e.target.closest('.opview [data-pid]'); if (!el) return;
  const c = OP.data.cards.find(x => x.pid === +el.dataset.pid); if (!c) return;
  if (OP.quick && el.classList.contains('qt')) { cycle(c, el); return; }
  openCard(c);
});
function cycle(c, el) {
  if (!isEditor()) return;
  const s = st(c); if (s === 1) OP.owned[c.pid] = 2; else if (s === 2) delete OP.owned[c.pid]; else OP.owned[c.pid] = 1;
  save(); const tmp = document.createElement('div'); tmp.innerHTML = tile(c); const nu = tmp.firstElementChild; nu.classList.add('pop'); el.replaceWith(nu);
  try { navigator.vibrate && navigator.vibrate(8); } catch (e) {}
}
function setState(c, s) { if (!isEditor()) return; if (s) OP.owned[c.pid] = s; else delete OP.owned[c.pid]; save(); }

/* ----- big card view with price chart ----- */
function openCard(c) {
  let lb = $('#cardLB'); if (!lb) { lb = document.createElement('div'); lb.id = 'cardLB'; lb.className = 'lb'; document.body.appendChild(lb); }
  const s = st(c), hc = c.tier >= 5 ? '#D97706' : c.tier >= 4 ? '#DB2777' : '#6B7280';
  const draw = () => {
    const s2 = st(c);
    lb.innerHTML = `<div class="lbin" style="--hc:${hc}"><button class="x lbx" aria-label="Close">×</button>
      <div class="lbcard h${c.tier >= 5 ? 5 : c.tier}"><img src="${img(c.pid, true)}" alt="${esc(c.n)}" onerror="this.src='${img(c.pid)}'"><span class="lbshine"></span></div>
      <div class="lbinfo"><h2>${esc(c.n)}</h2><div class="muted">${esc(c.set.name)} · ${esc(c.num)}${c.v ? ' · ' + esc(c.v) : ''}</div>
        <div class="lbr"><span class="rpill" style="background:${hc}">${esc(RARITY_NAME[c.r] || c.r)}</span>${statusPill(c)}<span class="ptschip">⭐ ${pts(c)} pts</span></div>
        <div class="opmeta">${[c.type, c.color, c.cost ? 'Cost ' + c.cost : '', c.power ? c.power.toLocaleString() + ' power' : '', c.traits].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div>
        <div class="lbp"><small>Market price</small><b>${money(c.usd)}</b></div>
        <div class="lbchart"><div class="chead"><small>Price history</small><span class="cchg"></span></div>
          <div class="rng">${[['1w', '1W'], ['1m', '1M'], ['ytd', 'YTD'], ['1y', '1Y'], ['all', 'All']].map(([r, l]) => `<button data-r="${r}" class="${r === '1y' ? 'on' : ''}">${l}</button>`).join('')}</div>
          <div class="cbody"><span class="spin"></span></div></div>
        ${isEditor() ? `<div class="opbtns"><button class="stagesave coll${s2 ? ' done' : ''}" data-set="2" ${s2 ? 'disabled' : ''}>${s2 ? '✓ In collection' : '＋ Save to collection'}</button><button class="stagesave${s2 === 1 ? ' done' : ''}" data-set="1" ${s2 === 1 ? 'disabled' : ''}>${s2 === 1 ? '★ In binder' : '📒 Move to binder'}</button>${s2 ? '<button class="ghost" data-set="0">Remove</button>' : ''}</div>` : ''}
        <a class="sales alt" style="margin:0;text-align:center" href="https://www.tcgplayer.com/product/${c.pid}" target="_blank" rel="noopener">See it on TCGplayer ↗</a></div></div>`;
    const cbox = lb.querySelector('.lbchart');
    if (window.PKP && PKP.loadHistory) PKP.loadHistory('op-' + c.set.gid).then(h => { PKP.drawChart(cbox, h, c.pid, '1y');
      cbox.querySelector('.rng').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; cbox.querySelectorAll('.rng button').forEach(x => x.classList.toggle('on', x === b)); PKP.drawChart(cbox, h, c.pid, b.dataset.r); }; });
  };
  draw();
  lb.classList.add('on'); document.body.style.overflow = 'hidden';
  lb.onclick = e => {
    const b = e.target.closest('[data-set]');
    if (b) { setState(c, +b.dataset.set); const r = b.getBoundingClientRect(); K().burst(r.left + r.width / 2, r.top, ['#059669', '#4F46E5', '#fff', '#FBBF24'], 40); K().toast(+b.dataset.set === 1 ? `${c.n} is in your binder 📒` : +b.dataset.set === 2 ? `${c.n} saved to your collection` : `${c.n} removed`, '#059669'); draw(); render(OP.view); return; }
    if (e.target === lb || e.target.closest('.lbx')) { lb.classList.remove('on'); document.body.style.overflow = ''; }
  };
}

/* ----- Need ----- */
function renderNeed() {
  const q = OP.needQ.trim().toLowerCase();
  const hits = q ? OP.data.cards.filter(c => c.num.toLowerCase() === q || c.num.toLowerCase().startsWith(q) || c.n.toLowerCase().includes(q)).slice(0, 12) : [];
  const missing = OP.data.cards.filter(c => !st(c) && !c.set.promo);
  root().innerHTML = `<div class="needcheck"><label for="opNeedQ" class="lab">Do I need it?</label><input id="opNeedQ" type="search" placeholder="Card number like OP01-120, or a name" value="${esc(OP.needQ)}" autocomplete="off">
      <div class="anslist">${hits.map(c => `<button class="ansrow ${st(c) ? 'have' : 'need'}" data-pid="${c.pid}"><img src="${img(c.pid)}" alt="" loading="lazy"><div><b>${esc(c.n)}</b> <span class="muted">${esc(c.num)}${c.v ? ' · ' + esc(c.v) : ''} · ${esc(c.set.name)}</span><div>${st(c) ? `<span class="ans have">✓ You have it</span><small>${st(c) === 1 ? '📒 in your binder' : 'not in your binder'}</small>` : `<span class="ans need">✗ You need it</span><small>${money(c.usd)}</small>`}</div></div></button>`).join('') || (q ? '<div class="muted">No card matches.</div>' : '')}</div></div>
    <h3 class="sech">Still need · ${missing.length.toLocaleString()} cards from booster sets</h3>${grid(missing)}`;
  const inp = root().querySelector('#opNeedQ'); let t;
  inp.oninput = () => { clearTimeout(t); t = setTimeout(() => { OP.needQ = inp.value; const pos = inp.selectionStart; renderNeed(); const n = $('#opNeedQ'); n.focus(); n.setSelectionRange(pos, pos); }, 200); };
}

/* ----- Packs ----- */
function renderPacks() {
  const sets = OP.data.sets.filter(s => !s.promo);
  if (!OP.packSet || !sets.some(s => s.gid === OP.packSet)) OP.packSet = (sets.find(s => s.date <= new Date().toISOString().slice(0, 10)) || sets[0]).gid;
  const set = sets.find(s => s.gid === OP.packSet), cards = OP.data.cards.filter(c => c.set === set);
  const total = cards.reduce((a, c) => a + (c.usd || 0), 0), packPts = cards.reduce((a, c) => a + pts(c), 0);
  const hits = cards.filter(c => c.tier >= 4 || c.usd >= 20).sort((a, b) => b.usd - a.usd).slice(0, 16);
  root().innerHTML = `
    <div class="setpick" id="opPackPick">${sets.map(x => `<button class="sp${x.gid === OP.packSet ? ' on' : ''}" data-gid="${x.gid}"><span>${esc(x.name)}<small>${x.future ? 'Out ' : ''}${us(x.date)}</small></span></button>`).join('')}</div>
    <div class="packhero"><div class="ph-t"><h2>${esc(set.name)}</h2><span class="muted">Released ${us(set.date)} · ${cards.length} cards</span></div>
      <div class="ph-stats"><div><small>Master set cost</small><b>${money(total)}</b></div><div><small>Pack points</small><b>⭐ ${packPts.toLocaleString()}</b></div><div><small>Top card</small><b>${money(hits[0] ? hits[0].usd : 0)}</b></div></div></div>
    <h3 class="sech">💎 Big hits to pull</h3>
    <div class="hits">${hits.map((c, i) => `<div class="hit h${c.tier >= 5 ? 5 : 4}" data-pid="${c.pid}" role="button" tabindex="0" style="--hc:${c.tier >= 5 ? '#D97706' : '#DB2777'}">
      <div class="hitimg"><img src="${BLANK}" data-src="${img(c.pid)}" alt="" onerror="this.parentNode.classList.add('noimg');this.remove()"><span class="ph"><b>${esc(c.n)}</b><small>Picture coming soon</small></span><span class="hrank">${i === 0 ? '👑' : '#' + (i + 1)}</span><span class="hsheen"></span></div>
      <div class="hitt"><b>${esc(c.n)}</b><small>${esc(c.num)}${c.v ? ' · ' + esc(c.v) : ''}</small><div class="hitp"><b>${money(c.usd)}</b></div><span class="ptschip sm">⭐ ${pts(c)} pts</span>${statusPill(c)}</div></div>`).join('')}</div>
    <h3 class="sech" style="margin-top:28px">Every card in the set</h3>${grid(cards.slice().sort((a, b) => a.num.localeCompare(b.num) || b.tier - a.tier))}`;
  root().querySelector('#opPackPick').onclick = e => { const b = e.target.closest('[data-gid]'); if (!b) return; OP.packSet = +b.dataset.gid; OP.limit = 120; renderPacks(); window.scrollTo(0, 0); };
}

/* ----- Trending ----- */
function renderTrend() {
  const pull = OP.data.cards.filter(c => !c.set.promo && !NOT_PULLABLE.test(c.v + ' ' + c.n) && c.usd > 0).sort((a, b) => b.usd - a.usd).slice(0, 25);
  root().innerHTML = `<div class="trhead"><h2>One Piece trending</h2><span class="muted">As of ${us(OP.data.asOf)}</span></div>
    <div class="panel"><h3>💰 Most expensive cards you can pull</h3><div class="mxlist">${pull.map((c, i) => `<button class="mx${i < 3 ? ' top3' : ''}" data-pid="${c.pid}"><span class="mxr">${i === 0 ? '👑' : i + 1}</span><img src="${img(c.pid)}" alt="" loading="lazy">
      <span class="mxn"><b>${esc(c.n)}</b><span class="mxpack">🎁 ${esc(c.set.name)}</span><small>${esc(c.num)}${c.v ? ' · ' + esc(c.v) : ''}</small></span>
      <span class="mxp"><b>${money(c.usd)}</b><span class="ptschip sm">⭐ ${pts(c)} pts</span>${statusPill(c)}</span></button>`).join('')}</div></div>
    <p class="muted small trnote">Weekly ▲▼ changes appear once a week of daily prices has been recorded.</p>`;
}

/* ----- Stats + Complete ----- */
const bars = (rows, color) => { const max = Math.max(1, ...rows.map(r => r.v)); return `<div class="hb">${rows.map(r => `<div class="hbr"><span class="hbl">${esc(r.l)}</span><div class="hbt"><div class="hbf" style="--w:${r.v / max * 100}%;width:${r.v / max * 100}%;--c:${r.c || color || '#4F46E5'}"></div></div><span class="hbv">${r.f || r.v}</span></div>`).join('')}</div>`; };
function renderStats() {
  const own = OP.data.cards.filter(c => st(c)), by = (key) => { const m = {}; own.forEach(c => { const k = key(c); m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const top = own.slice().sort((a, b) => pts(b) - pts(a)).slice(0, 10);
  root().innerHTML = `${kpis()}<div class="sgrid">
    <div class="panel"><h3>Colours</h3>${own.length ? bars(by(c => (c.color || 'Other').split(';')[0]).map(([l, v]) => ({ l, v, c: COLOR[l] }))) : '<div class="muted emptybox">Mark cards you own to see stats.</div>'}</div>
    <div class="panel"><h3>Rarities</h3>${own.length ? bars(by(c => RARITY_NAME[c.r] || c.r).map(([l, v]) => ({ l, v }))) : ''}</div>
    <div class="panel"><h3>⭐ Top point cards</h3>${top.length ? bars(top.map(c => ({ l: c.n, v: pts(c), c: '#D97706' }))) : ''}</div>
    <div class="panel span2"><h3>Sets you're rocking</h3>${own.length ? bars(by(c => c.set.name).slice(0, 10).map(([l, v]) => ({ l, v }))) : ''}</div></div>`;
}
function renderComplete() {
  const sets = OP.data.sets.filter(s => !s.promo);
  root().innerHTML = `<div class="panel"><h3>Completion by set</h3><div class="gens">${sets.map(s => { const cs = OP.data.cards.filter(c => c.set === s), n = cs.filter(c => st(c)).length;
    return `<div class="genrow${n === cs.length && n ? ' done' : ''}"><div class="gn">${esc(s.name)}<small>${us(s.date)}</small></div><div class="track"><div style="width:${cs.length ? n / cs.length * 100 : 0}%"></div></div><div class="gp">${cs.length ? Math.round(n / cs.length * 100) : 0}% <small>${n}/${cs.length}</small></div></div>`; }).join('')}</div></div>`;
}

/* ----- routing ----- */
const RENDER = { collection: renderCollection, need: renderNeed, packs: renderPacks, trend: renderTrend, stats: renderStats, completion: renderComplete };
function render(v) { OP.view = RENDER[v] ? v : 'collection'; document.querySelectorAll('.opview').forEach(el => el.classList.toggle('on', el.id === 'op-' + OP.view));
  const r = root(); if (!OP.data) { r.innerHTML = '<div class="empty"><span class="spin"></span> Loading every One Piece card…</div>'; load(() => render(OP.view)); return; } RENDER[OP.view](); }
function applyCloud(doc) { OP.owned = Object.assign({}, doc.owned || {}); saveLocal(); if (document.body.classList.contains('game-op') && OP.data) render(OP.view); }
window.PKOP = { render, applyCloud, get owned() { return OP.owned; } };
// this script can load after the app already switched to One Piece (opened straight into it): draw now
if (document.body.classList.contains('game-op')) render((document.querySelector('#tabs button.on') || { dataset: { v: 'collection' } }).dataset.v);
})();
