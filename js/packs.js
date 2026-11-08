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
  const total = cards.reduce((a, c) => a + (c.usd || 0), 0), priced = cards.filter(c => c.usd).length;
  const hits = cards.filter(c => c.hit >= 4 || c.usd >= 20).sort((a, b) => b.usd - a.usd).slice(0, 16);
  let list = cards.filter(c => ST.filter === 'all' || (ST.filter === 'hits' && (c.hit >= 3 || c.usd >= 10)) || (ST.filter === 'poke' && c.cat === 'P') || (ST.filter === 'trainer' && c.cat !== 'P'));
  if (ST.sort === 'price') list = list.slice().sort((a, b) => (b.usd || 0) - (a.usd || 0));
  root.innerHTML = `
    <div class="setpick" id="packPick">${P.sets.map(x => `<button class="sp${x.id === ST.set ? ' on' : ''}" data-set="${x.id}">${x.logo ? `<img src="${x.logo}.webp" alt="" onerror="this.remove()">` : ''}<span>${esc(x.name)}<small>${us(x.date)}</small></span></button>`).join('')}</div>
    <div class="packhero">
      ${set.logo ? `<img class="plogo" src="${set.logo}.webp" alt="" onerror="this.remove()">` : ''}
      <div class="ph-t"><h2>${esc(set.name)}</h2><span class="muted">Released ${us(set.date)} · ${cards.length} cards (${set.count || '?'} + secret rares)</span></div>
      <div class="ph-stats"><div><small>Master set cost</small><b>${money(total)}</b></div><div><small>Big hits</small><b>${hits.length}</b></div><div><small>Top card</small><b>${money(hits[0] ? hits[0].usd : 0)}</b></div></div>
    </div>
    <h3 class="sech">💎 Big hits to pull</h3>
    <div class="hits">${hits.map((c, i) => `<div class="hit h${c.hit}" data-card="${esc(c.id)}" role="button" tabindex="0" style="--hc:${HIT_C[c.hit] || HIT_C[3]}">
      <div class="hitimg${c.img ? '' : ' noimg'}">${c.img ? `<img src="${BLANK}" data-src="${c.img}/low.webp" alt="" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ''}<span class="ph">${c.dex ? `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${c.dex}.png" alt="" loading="lazy">` : `<b>${esc(c.n)}</b>`}<small>Picture coming soon</small></span><span class="hrank">${i === 0 ? '👑' : '#' + (i + 1)}</span><span class="hsheen"></span></div>
      <div class="hitt"><b>${esc(c.n)}</b><small>${esc(c.r)} · #${esc(c.num)}</small><div class="hitp"><b>${money(c.usd)}</b>${pct(c.t)}</div>${status(c)}</div></div>`).join('') || '<div class="muted">No prices yet for this set.</div>'}</div>
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
// big card view: tilt, shine, price, and a link to every printing of that Pokémon
function openCard(c) {
  let lb = $('#cardLB'); if (!lb) { lb = document.createElement('div'); lb.id = 'cardLB'; lb.className = 'lb'; document.body.appendChild(lb); }
  const k = K(), sp = c.dex && k.SPECIES[c.dex - 1];
  lb.innerHTML = `<div class="lbin" style="--hc:${HIT_C[c.hit] || HIT_C[0]}">
    <button class="x lbx" aria-label="Close">×</button>
    <div class="lbcard h${c.hit}">${c.img ? `<img src="${c.img}/high.webp" alt="${esc(c.n)}" onerror="this.src='${c.img}/low.webp'">` : '<div class="lbph">Picture coming soon</div>'}<span class="lbshine"></span></div>
    <div class="lbinfo"><h2>${esc(c.n)}</h2><div class="muted">${esc(c.set)} · #${esc(c.num)}</div>
      <div class="lbr"><span class="rpill" style="background:${HIT_C[c.hit] || '#6B7280'}">${esc(c.r) || 'Unknown rarity'}</span>${status(c)}</div>
      <div class="lbp"><small>Market price</small><b>${money(c.usd)}</b>${pct(c.t)}</div>
      ${sp ? `<button class="primary lbw" data-dex="${c.dex}">See every ${esc(sp.name)} printing →</button>` : ''}</div></div>`;
  lb.classList.add('on'); document.body.style.overflow = 'hidden';
  const card = lb.querySelector('.lbcard');
  lb.onpointermove = e => { if (e.pointerType !== 'mouse') return; const r = card.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    card.style.transform = `perspective(900px) rotateY(${x * 18}deg) rotateX(${-y * 18}deg)`; card.style.setProperty('--mx', (x + .5) * 100 + '%'); };
  const close = () => { lb.classList.remove('on'); document.body.style.overflow = ''; };
  lb.onclick = e => { if (e.target === lb || e.target.closest('.lbx')) close(); const w = e.target.closest('.lbw'); if (w) { close(); k.openWheel(k.SPECIES[+w.dataset.dex - 1]); } };
  document.addEventListener('keydown', function esc2(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc2); } });
}
window.PKP = { render };
if (document.querySelector('#v-packs.on')) render();
})();
