// Trending tab: most expensive cards you can pull, top movers, chase cards per pack. Data: data/trending.js (rebuilt daily).
// Tapping any card opens the big card view (js/packs.js) with its price chart.
(() => {
'use strict';
const $ = s => document.querySelector(s);
const K = () => window.PKC;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const money = v => v >= 1000 ? '$' + Math.round(v).toLocaleString() : '$' + v.toFixed(2);
const us = iso => { if (!iso) return ''; const [y, m, d] = iso.slice(0, 10).split('-'); return `${m}/${d}/${y.slice(2)}`; };
const pct = t => t == null ? '' : `<span class="tr ${t > 0.005 ? 'up' : t < -0.005 ? 'down' : 'flat'}">${t > 0.005 ? '▲' : t < -0.005 ? '▼' : '•'} ${Math.abs(t * 100).toFixed(0)}% wk</span>`;
const ST = { set: null }; let IDX = [];
const reg = c => { IDX.push(c); return IDX.length - 1; };
const thumb = c => `<img src="${BLANK}" ${c.img ? `data-src="${c.img}/low.webp"` : ''} alt="" onerror="this.style.visibility='hidden'">`;

function status(c) {
  const k = K(); if (!k || !c.dex) return '';
  const o = k.ownedOf(c.dex), mine = o && o.c && k.BY_ID.get(o.c) && k.BY_ID.get(o.c).tdId === c.id;
  return mine ? '<span class="pill have">✓ Have</span>' : '<span class="pill need">✗ Need</span>';
}
function moverRow(c, i) {
  return `<button class="mv" data-i="${reg(c)}"><span class="mvr">${i + 1}</span>${thumb(c)}
    <span class="mvn"><b>${esc(c.n)}</b><small>${esc(c.set)} · ${esc(c.r)}</small></span>
    <span class="mvp"><b>${money(c.usd)}</b>${pct(c.t)}</span></button>`;
}
function richRow(c, i) {
  return `<button class="mx${i < 3 ? ' top3' : ''}" data-i="${reg(c)}"><span class="mxr">${i === 0 ? '👑' : i + 1}</span>${thumb(c)}
    <span class="mxn"><b>${esc(c.n)}</b><span class="mxpack">🎁 ${esc(c.set)}</span><small>${esc(c.r)} · #${esc(c.num)}</small></span>
    <span class="mxp"><b>${money(c.usd)}</b>${pct(c.t)}${status(c)}</span></button>`;
}
function chase(c, i) {
  return `<div class="ch${i < 3 ? ' top3' : ''}" data-i="${reg(c)}" role="button" tabindex="0">
    <span class="rank">${i === 0 ? '👑' : '#' + (i + 1)}</span>
    <div class="chimg${c.img ? '' : ' ph'}">${c.img ? `<img src="${BLANK}" data-src="${c.img}/low.webp" alt="" onerror="this.parentNode.classList.add('ph');this.remove()">` : ''}<span class="phn">${c.dex ? `<img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${c.dex}.png" alt="" loading="lazy">` : ''}<b>${esc(c.n)}</b><small>Picture coming soon</small></span></div>
    <div class="chn"><b>${esc(c.n)}</b><small>${esc(c.r)} · #${esc(c.num)}</small></div>
    <div class="chp"><b>${money(c.usd)}</b>${pct(c.t)}</div>
    <div class="chs">${status(c)}</div></div>`;
}
function render() {
  const T = window.PK_TREND, root = $('#v-trend'); if (!root) return;
  if (!T) { root.innerHTML = '<div class="empty">Trending prices are not available right now.</div>'; return; }
  IDX = [];
  if (!ST.set || !T.sets.some(s => s.id === ST.set)) ST.set = (T.sets.find(s => s.top.filter(c => c.img).length > s.top.length / 2) || T.sets[0]).id;
  const s = T.sets.find(x => x.id === ST.set);
  const priciest = T.sets.flatMap(x => x.top.map(c => Object.assign({}, c, { set: x.name }))).sort((a, b) => b.usd - a.usd).slice(0, 20);
  root.innerHTML = `
    <div class="trhead"><h2>Trending</h2><span class="muted">As of ${us(T.asOf)}</span></div>
    <div class="panel"><h3>💰 Most expensive cards you can pull</h3><div class="mxlist">${priciest.map(richRow).join('')}</div></div>
    <div class="movers" style="margin-top:16px">
      <div class="panel"><h3>🔥 Biggest gains this week</h3><div class="mvlist">${T.gains.slice(0, 10).map(moverRow).join('')}</div></div>
      <div class="panel"><h3>🧊 Biggest drops this week</h3><div class="mvlist">${T.drops.slice(0, 10).map(moverRow).join('')}</div></div>
    </div>
    <h3 class="sech">Cards to look for in each pack</h3>
    <div class="setpick" id="setPick">${T.sets.map(x => `<button class="sp${x.id === ST.set ? ' on' : ''}" data-set="${x.id}">${x.logo ? `<img src="${x.logo}.webp" alt="" onerror="this.remove()">` : ''}<span>${esc(x.name)}<small>${us(x.date)}</small></span></button>`).join('')}</div>
    <div class="panel chasebox">
      <div class="chhead"><b>${esc(s.name)}</b><span class="muted">released ${us(s.date)} · top ${s.top.length} by market price</span></div>
      <div class="chgrid">${s.top.map(c => Object.assign({}, c, { set: s.name })).map(chase).join('')}</div>
    </div>
    <p class="muted small trnote">Price: TCGplayer market (USD). wk: Cardmarket 7-day vs 30-day average sale price.</p>`;
  root.querySelector('#setPick').onclick = e => { const b = e.target.closest('[data-set]'); if (!b) return; ST.set = b.dataset.set; render();
    const on = root.querySelector('.sp.on'); on && on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); };
  root.onclick = e => { const el = e.target.closest('[data-i]'); if (!el) return; const c = IDX[+el.dataset.i]; if (c && window.PKP) PKP.openCard(c); };
}
window.PKT = { render };
if (document.querySelector('#v-trend.on')) render();
})();
