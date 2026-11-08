// Trending tab: chase cards per pack + top movers. Data: data/trending.js (rebuilt daily by GitHub Actions).
(() => {
'use strict';
const $ = s => document.querySelector(s);
const K = () => window.PKC;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const money = v => v >= 1000 ? '$' + Math.round(v).toLocaleString() : '$' + v.toFixed(2);
const us = iso => { if (!iso) return ''; const [y, m, d] = iso.slice(0, 10).split('-'); return `${m}/${d}/${y.slice(2)}`; };
const pct = t => t == null ? '' : `<span class="tr ${t > 0.005 ? 'up' : t < -0.005 ? 'down' : 'flat'}">${t > 0.005 ? '▲' : t < -0.005 ? '▼' : '•'} ${Math.abs(t * 100).toFixed(0)}%</span>`;
const ST = { set: null };

// is this exact card (TCGdex id) the printing in his binder? Then he has it; otherwise it's one to look for.
function status(c) {
  const k = K(); if (!k || !c.dex) return '';
  const o = k.ownedOf(c.dex), mine = o && o.c && k.BY_ID.get(o.c) && k.BY_ID.get(o.c).tdId === c.id;
  return mine ? '<span class="pill have">✓ Have</span>' : '<span class="pill need">✗ Need</span>';
}
function moverRow(c, i) {
  return `<button class="mv" data-dex="${c.dex || ''}" data-tip="${esc(c.n)} · ${esc(c.set)} #${esc(c.num)}<br>${esc(c.r)}<br>7-day avg vs 30-day avg (Cardmarket)">
    <span class="mvr">${i + 1}</span><img src="${BLANK}" ${c.img ? `data-src="${c.img}/low.webp"` : ''} alt="" loading="lazy">
    <span class="mvn"><b>${esc(c.n)}</b><small>${esc(c.set)} · ${esc(c.r)}</small></span>
    <span class="mvp"><b>${money(c.usd)}</b>${pct(c.t)}</span></button>`;
}
function chase(c, i) {
  return `<div class="ch${i < 3 ? ' top3' : ''}" data-dex="${c.dex || ''}" role="button" tabindex="0">
    <span class="rank">${i === 0 ? '👑' : '#' + (i + 1)}</span>
    <div class="chimg${c.img ? '' : ' ph'}">${c.img ? `<img src="${BLANK}" data-src="${c.img}/low.webp" alt="" onerror="this.parentNode.classList.add('ph');this.remove()">` : ''}<span class="phn">${c.dex ? `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${c.dex}.png" alt="" loading="lazy">` : ''}<b>${esc(c.n)}</b><small>Picture coming soon</small></span></div>
    <div class="chn"><b>${esc(c.n)}</b><small>${esc(c.r)} · #${esc(c.num)}</small></div>
    <div class="chp"><b>${money(c.usd)}</b>${pct(c.t)}</div>
    <div class="chs">${status(c)}</div></div>`;
}
function render() {
  const T = window.PK_TREND, root = $('#v-trend'); if (!root) return;
  if (!T) { root.innerHTML = '<div class="empty">Trending prices are not available right now.</div>'; return; }
  if (!ST.set || !T.sets.some(s => s.id === ST.set)) ST.set = T.sets[0].id;
  const s = T.sets.find(x => x.id === ST.set);
  root.innerHTML = `
    <div class="trhead"><h2>Trending</h2><span class="muted">As of ${us(T.asOf)}</span></div>
    <div class="movers">
      <div class="panel"><h3>🔥 Biggest gains this week</h3><div class="mvlist">${T.gains.slice(0, 10).map(moverRow).join('')}</div></div>
      <div class="panel"><h3>🧊 Biggest drops this week</h3><div class="mvlist">${T.drops.slice(0, 10).map(moverRow).join('')}</div></div>
    </div>
    <h3 class="sech">Cards to look for in each pack</h3>
    <div class="setpick" id="setPick">${T.sets.map(x => `<button class="sp${x.id === ST.set ? ' on' : ''}" data-set="${x.id}">${x.logo ? `<img src="${x.logo}.webp" alt="" onerror="this.remove()">` : ''}<span>${esc(x.name)}<small>${us(x.date)}</small></span></button>`).join('')}</div>
    <div class="panel chasebox">
      <div class="chhead"><b>${esc(s.name)}</b><span class="muted">released ${us(s.date)} · top ${s.top.length} by market price</span></div>
      <div class="chgrid">${s.top.map(chase).join('')}</div>
    </div>
    <p class="muted small trnote">Price: TCGplayer market (USD). ▲▼: Cardmarket 7-day vs 30-day average sale price.</p>`;
  root.querySelector('#setPick').onclick = e => { const b = e.target.closest('[data-set]'); if (!b) return; ST.set = b.dataset.set; render();
    const on = root.querySelector('.sp.on'); on && on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); };
  root.onclick = e => { const el = e.target.closest('[data-dex]'); if (!el || !+el.dataset.dex || e.target.closest('#setPick')) return; const k = K(); k.openWheel(k.SPECIES[+el.dataset.dex - 1]); };
}
window.PKT = { render };
if (document.querySelector('#v-trend.on')) render();
})();
