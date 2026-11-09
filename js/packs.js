// Packs tab: every card in each in-print set, with the big hits up front. Data: data/packs.js (loaded on first open, rebuilt daily).
(() => {
'use strict';
const $ = s => document.querySelector(s);
const K = () => window.PKC;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const money = v => !v ? '–' : v >= 1000 ? '$' + Math.round(v).toLocaleString() : '$' + v.toFixed(2);
const us = iso => { if (!iso) return ''; const [y, m, d] = iso.slice(0, 10).split('-'); return `${m}/${d}/${y.slice(2)}`; };
const pct = t => t == null ? '' : `<span class="tr ${t > 0.005 ? 'up' : t < -0.005 ? 'down' : 'flat'}">${t > 0.005 ? '▲' : t < -0.005 ? '▼' : '•'} ${Math.abs(t * 100).toFixed(0)}%</span>`;
// how big a hit is, from the printed rarity (5 = the gold-tier chase)
const hitRank = r => /mega hyper|hyper rare|special illustration/i.test(r) ? 5 : /illustration rare/i.test(r) ? 4 : /ultra rare|ace spec|shiny|double rare|black white/i.test(r) ? 3 : 0;
// rarity text -> our six forms, for points
const tierOfText = r => window.PKC && PKC.tierOfRarity ? PKC.tierOfRarity(r) : 0;
const ptsOf = (c, date) => window.PKC ? PKC.cardPoints(tierOfText(c.r || ''), c.usd, date) : 0;
const HIT_C = { 5: '#D97706', 4: '#DB2777', 3: '#4F46E5', 0: '#9CA3AF' };
const ST = { set: null, filter: 'all', sort: 'num', loading: false };

function load(cb) {
  if (window.PK_PACKS) return cb();
  if (ST.loading) return; ST.loading = true;
  const s = document.createElement('script'); s.src = 'data/packs.js?v=' + (document.querySelector('script[src*="trending.js?v="]') || { src: 'v=1' }).src.split('v=')[1];
  s.onload = () => { ST.loading = false; cb(); }; s.onerror = () => { ST.loading = false; $('#v-packs').innerHTML = '<div class="empty">Couldn’t load the packs. Check your connection.</div>'; };
  document.body.appendChild(s);
}
const cardObj = (set, a) => ({ id: `${set.id}-${a[0]}`, num: a[0], n: a[1], r: a[2], img: a[3], usd: a[4], t: a[5], dex: a[6], cat: a[7], set: set.name, hit: hitRank(a[2]) });
function status(c) {
  const k = K(); if (!k || !c.dex) return '';
  const o = k.ownedOf(c.dex), mine = o && o.c && k.BY_ID.get(o.c) && k.BY_ID.get(o.c).tdId === c.id;
  return mine ? '<span class="pill have">✓ Have</span>' : '<span class="pill need">✗ Need</span>';
}
function render() {
  const root = $('#v-packs'); if (!root) return;
  if (!window.PK_PACKS) { root.innerHTML = '<div class="empty"><span class="spin"></span> Loading every card…</div>'; load(render); return; }
  const P = window.PK_PACKS;
  // open on the newest pack that already has card pictures (brand-new sets can take days to get them)
  if (!ST.set || !P.sets.some(s => s.id === ST.set)) ST.set = (P.sets.find(s => s.cards.filter(a => a[3]).length > s.cards.length / 2) || P.sets[0]).id;
  const set = P.sets.find(s => s.id === ST.set), cards = set.cards.map(a => cardObj(set, a));
  const total = cards.reduce((a, c) => a + (c.usd || 0), 0), priced = cards.filter(c => c.usd).length, packPts = cards.reduce((a, c) => a + ptsOf(c, set.date), 0);
  cards.forEach(c => c.date = set.date);
  const hits = cards.filter(c => c.hit >= 4 || c.usd >= 20).sort((a, b) => b.usd - a.usd).slice(0, 16);
  let list = cards.filter(c => ST.filter === 'all' || (ST.filter === 'hits' && (c.hit >= 3 || c.usd >= 10)) || (ST.filter === 'poke' && c.cat === 'P') || (ST.filter === 'trainer' && c.cat !== 'P'));
  if (ST.sort === 'price') list = list.slice().sort((a, b) => (b.usd || 0) - (a.usd || 0));
  root.innerHTML = `
    <div class="setpick" id="packPick">${P.sets.map(x => `<button class="sp${x.id === ST.set ? ' on' : ''}" data-set="${x.id}">${x.logo ? `<img src="${x.logo}.webp" alt="" onerror="this.remove()">` : ''}<span>${esc(x.name)}<small>${us(x.date)}</small></span></button>`).join('')}</div>
    <div class="packhero">
      ${set.logo ? `<img class="plogo" src="${set.logo}.webp" alt="" onerror="this.remove()">` : ''}
      <div class="ph-t"><h2>${esc(set.name)}</h2><span class="muted">Released ${us(set.date)} · ${cards.length} cards (${set.count || '?'} + secret rares)</span></div>
      <div class="ph-stats"><div><small>Master set cost</small><b>${money(total)}</b></div><div><small>Pack points</small><b>⭐ ${packPts.toLocaleString()}</b></div><div><small>Big hits</small><b>${hits.length}</b></div><div><small>Top card</small><b>${money(hits[0] ? hits[0].usd : 0)}</b></div></div>
    </div>
    <h3 class="sech">💎 Big hits to pull</h3>
    <div class="hits">${hits.map((c, i) => `<div class="hit h${c.hit}" data-card="${esc(c.id)}" role="button" tabindex="0" style="--hc:${HIT_C[c.hit] || HIT_C[3]}">
      <div class="hitimg${c.img ? '' : ' noimg'}">${c.img ? `<img src="${BLANK}" data-src="${c.img}/low.webp" alt="" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ''}<span class="ph">${c.dex ? `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${c.dex}.png" alt="" loading="lazy">` : `<b>${esc(c.n)}</b>`}<small>Picture coming soon</small></span><span class="hrank">${i === 0 ? '👑' : '#' + (i + 1)}</span><span class="hsheen"></span></div>
      <div class="hitt"><b>${esc(c.n)}</b><small>${esc(c.r)} · #${esc(c.num)}</small><div class="hitp"><b>${money(c.usd)}</b>${pct(c.t)}</div><span class="ptschip sm">⭐ ${ptsOf(c, set.date)} pts</span>${status(c)}</div></div>`).join('') || '<div class="muted">No prices yet for this set.</div>'}</div>
    <div class="packbar">
      <h3 class="sech" style="margin:0">Every card in the pack</h3>
      <div class="chips" id="packFilter">${[['all', 'All ' + cards.length], ['hits', 'Hits'], ['poke', 'Pokémon'], ['trainer', 'Trainers & energy']].map(([v, l]) => `<button class="chip${ST.filter === v ? ' on' : ''}" data-f="${v}">${l}</button>`).join('')}
        <button class="chip" id="packSort">Sort: ${ST.sort === 'num' ? 'Number' : 'Price'}</button></div>
    </div>
    <div class="allcards">${list.map(c => `<div class="pc2${c.hit >= 3 ? ' hh' + c.hit : ''}" data-card="${esc(c.id)}" role="button" tabindex="0" style="--hc:${HIT_C[c.hit]}">
      <div class="pcimg${c.img ? '' : ' noimg'}">${c.img ? `<img src="${BLANK}" data-src="${c.img}/low.webp" alt="" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ''}<span class="ph"><b>${esc(c.n)}</b></span><span class="pnum">#${esc(c.num)}</span></div>
      <div class="pcn"><b>${esc(c.n)}</b><small>${esc(c.r) || '—'}</small></div>
      <div class="pcp"><b>${money(c.usd)}</b>${status(c)}</div></div>`).join('')}</div>
    <p class="muted small trnote">${priced} of ${cards.length} cards priced · TCGplayer market (USD) · as of ${us(P.asOf)}</p>`;
  root.querySelector('#packPick').onclick = e => { const b = e.target.closest('[data-set]'); if (!b) return; ST.set = b.dataset.set; render(); window.scrollTo(0, 0); };
  root.querySelector('#packFilter').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { ST.filter = b.dataset.f; render(); } if (e.target.id === 'packSort') { ST.sort = ST.sort === 'num' ? 'price' : 'num'; render(); } };
  root.onclick = e => { const el = e.target.closest('[data-card]'); if (!el || e.target.closest('#packPick,#packFilter')) return; const c = cards.find(x => x.id === el.dataset.card); c && openCard(c); };
}

// ----- price history chart (data/history/<pack>.json, one price per card per day) -----
const HIST = {};
async function loadHistory(sid) {
  if (sid in HIST) return HIST[sid];
  try { const r = await fetch(`data/history/${sid}.json?d=${(window.PK_TREND && PK_TREND.asOf) || ''}`); HIST[sid] = r.ok ? await r.json() : null; } catch (e) { HIST[sid] = null; }
  return HIST[sid];
}
function drawChart(box, h, num, range) {
  const row = h && h.p && h.p[String(num)];
  const all = row ? h.dates.map((d, i) => [d, row[i]]).filter(x => x[1] != null) : [];
  const today = new Date(), days = { '1w': 7, '1m': 30, '1y': 365 }[range];
  let pts = all;
  if (range === 'ytd') pts = all.filter(x => x[0] >= today.getFullYear() + '-01-01');
  else if (days) { const cut = new Date(today - days * 864e5).toISOString().slice(0, 10); pts = all.filter(x => x[0] >= cut); }
  const body = box.querySelector('.cbody'), chg = box.querySelector('.cchg');
  if (pts.length < 2) {
    body.innerHTML = `<div class="cempty"><b>${pts.length ? money(pts[pts.length - 1][1]) : '–'}</b><span>Tracking since ${all[0] ? us(all[0][0]) : 'today'}. The chart grows by one point each day.</span></div>`;
    chg.innerHTML = ''; return;
  }
  const W = 320, H = 120, P = 6, vs = pts.map(x => x[1]), mn = Math.min(...vs), mx = Math.max(...vs), sp = mx - mn || 1;
  const X = i => P + i / (pts.length - 1) * (W - 2 * P), Y = v => P + (1 - (v - mn) / sp) * (H - 2 * P);
  const d = pts.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x[1]).toFixed(1)}`).join('');
  const up = vs[vs.length - 1] >= vs[0], col = up ? '#059669' : '#DC2626';
  body.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="csvg" role="img" aria-label="Price chart"><path d="${d} L${X(pts.length - 1)},${H} L${X(0)},${H} Z" fill="${col}" opacity=".12"/>
    <path d="${d}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" class="cline"/>
    <circle cx="${X(pts.length - 1)}" cy="${Y(vs[vs.length - 1])}" r="4" fill="${col}" stroke="#fff" stroke-width="2"/>
    <line class="cx" x1="0" x2="0" y1="0" y2="${H}" stroke="#9CA3AF" stroke-dasharray="3 3" opacity="0"/></svg>
    <div class="ctip" hidden></div><div class="caxis"><span>${us(pts[0][0])}</span><span>low ${money(mn)} · high ${money(mx)}</span><span>${us(pts[pts.length - 1][0])}</span></div>`;
  const ch = (vs[vs.length - 1] / vs[0] - 1) * 100;
  chg.innerHTML = `<span class="tr ${up ? 'up' : 'down'}">${up ? '▲' : '▼'} ${Math.abs(ch).toFixed(1)}%</span>`;
  const svg = body.querySelector('svg'), tip = body.querySelector('.ctip'), cx = svg.querySelector('.cx');
  svg.onpointermove = e => { const r = svg.getBoundingClientRect(), i = Math.max(0, Math.min(pts.length - 1, Math.round((e.clientX - r.left) / r.width * (pts.length - 1))));
    cx.setAttribute('x1', X(i)); cx.setAttribute('x2', X(i)); cx.setAttribute('opacity', 1); tip.hidden = false; tip.textContent = `${us(pts[i][0])} · ${money(pts[i][1])}`; };
  svg.onpointerleave = () => { cx.setAttribute('opacity', 0); tip.hidden = true; };
}
// big card view: tilt, shine, price + history chart, and a link to every printing of that Pokémon
function openCard(c) {
  if (c.hit == null) c.hit = hitRank(c.r || '');
  let lb = $('#cardLB'); if (!lb) { lb = document.createElement('div'); lb.id = 'cardLB'; lb.className = 'lb'; document.body.appendChild(lb); }
  const k = K(), sp = c.dex && k.SPECIES[c.dex - 1];
  lb.innerHTML = `<div class="lbin" style="--hc:${HIT_C[c.hit] || HIT_C[0]}">
    <button class="x lbx" aria-label="Close">×</button>
    <div class="lbcard h${c.hit}">${c.img ? `<img src="${c.img}/high.webp" alt="${esc(c.n)}" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${c.img}/low.webp'}else{this.parentNode.insertAdjacentHTML('afterbegin','<div class=lbph>Picture coming soon</div>');this.remove()}">` : '<div class="lbph">Picture coming soon</div>'}<span class="lbshine"></span></div>
    <div class="lbinfo"><h2>${esc(c.n)}</h2><div class="muted">${esc(c.set)} · #${esc(c.num)}</div>
      <div class="lbr"><span class="rpill" style="background:${HIT_C[c.hit] || '#6B7280'}">${esc(c.r) || 'Unknown rarity'}</span>${status(c)}</div>
      <div class="lbp"><small>Raw · ungraded</small><b>${money(c.usd)}</b>${pct(c.t)}</div>
      <span class="ptschip" style="justify-self:start">⭐ ${ptsOf(c, c.date)} pts</span>
      <div class="lbchart"><div class="chead"><small>Price history</small><span class="cchg"></span></div>
        <div class="rng">${[['1w', '1W'], ['1m', '1M'], ['ytd', 'YTD'], ['1y', '1Y'], ['all', 'All']].map(([r, l]) => `<button data-r="${r}" class="${r === '1y' ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="cbody"><span class="spin"></span></div></div>
      ${(() => { const ours = k.CARDS.find(x => x.tdId === c.id); return ours ? `<a class="sales alt" style="margin:0;text-align:center" href="https://www.pokeprice.gg/cards/${String(ours.id).replace(/~\d+$/, '')}" target="_blank" rel="noopener">eBay sold &amp; graded prices on pokeprice.gg ↗</a>` : ''; })()}
      <a class="sales alt" style="margin:0;text-align:center" href="https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent((c.n || '') + ' ' + (c.set || '') + ' ' + (c.num || ''))}" target="_blank" rel="noopener">PSA 10 price ↗</a>
      ${sp ? `<button class="primary lbw" data-dex="${c.dex}">See every ${esc(sp.name)} printing →</button>` : ''}</div></div>`;
  lb.classList.add('on'); document.body.style.overflow = 'hidden';
  if (!(history.state && history.state.lb)) { history.pushState(Object.assign({}, history.state, { lb: 1 }), '', location.href); LB.pushed = true; }
  const cbox = lb.querySelector('.lbchart'), sid = String(c.id).slice(0, String(c.id).lastIndexOf('-'));
  loadHistory(sid).then(h => { drawChart(cbox, h, c.num, '1y');
    cbox.querySelector('.rng').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; cbox.querySelectorAll('.rng button').forEach(x => x.classList.toggle('on', x === b)); drawChart(cbox, h, c.num, b.dataset.r); }; });
  const card = lb.querySelector('.lbcard');
  lb.onpointermove = e => { if (e.pointerType !== 'mouse') return; const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    card.style.transform = `perspective(900px) rotateY(${x * 18}deg) rotateX(${-y * 18}deg)`; card.style.setProperty('--mx', (x + .5) * 100 + '%'); };
  const close = () => { const p = LB.pushed; LB.pushed = false; lb.classList.remove('on'); document.body.style.overflow = ''; if (p && history.state && history.state.lb) history.back(); };
  lb.onclick = e => { if (e.target === lb || e.target.closest('.lbx')) close(); const w = e.target.closest('.lbw'); if (w) { close(); k.openWheel(k.SPECIES[+w.dataset.dex - 1]); } };
  LB.close = close;
}
// one Escape handler and one Back handler for the big card view
const LB = { pushed: false, close: null };
document.addEventListener('keydown', e => { const lb = $('#cardLB'); if (e.key === 'Escape' && lb && lb.classList.contains('on') && LB.close) LB.close(); });
window.addEventListener('popstate', () => { const lb = $('#cardLB'); if (lb && lb.classList.contains('on')) { LB.pushed = false; lb.classList.remove('on'); document.body.style.overflow = ''; } });
window.PKP = { render, openCard, hitRank, ptsOf, loadHistory, drawChart };
if (document.querySelector('#v-packs.on')) render();
})();
