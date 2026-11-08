// Need list + card ladders: every Pokémon's forms from Basic up to its best card ("Best in slot"), with goals.
// Goals: PKC.GOALS = { dex: [tier, cardId] } (synced in Firebase prefs/main.goals by cloud.js; editors only).
(() => {
'use strict';
const $ = s => document.querySelector(s);
const K = () => window.PKC;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pad = n => String(n).padStart(3, '0');
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const money = v => !v ? '' : v >= 1000 ? '$' + Math.round(v).toLocaleString() : '$' + v.toFixed(2);
const isEditor = () => !!(window.PKCloud && PKCloud.editor) || !!window.__goalTest;

/* ---------- the ladder for one Pokémon ---------- */
// one rung per available tier; tier 1 (Reverse Holo) is the Basic card in its reverse finish
function printings(sp, t) { const pool = sp.pool || sp.cards; return t === 1 ? [sp.basic] : t === 0 ? [sp.basic, ...pool.filter(c => c.tier === 0 && c !== sp.basic).reverse()] : pool.filter(c => c.tier === t).slice().sort((a, b) => b.score - a.score || (a.date < b.date ? 1 : -1)); }
function ladder(sp) { return sp.tiersAvail.map(t => ({ t, list: printings(sp, t) })).filter(r => r.list.length && r.list[0]); }
const bestTier = sp => Math.max(...sp.tiersAvail);
function goalOf(dex) { const g = K().GOALS[dex]; if (!g) return null; const c = K().BY_ID.get(g[1]); return c ? { t: g[0], c } : null; }
function goalDone(dex) { const g = goalOf(dex), o = K().ownedOf(dex); return !!(g && o && (o.t > g.t || (o.t === g.t))); }
// what to chase next for an owned Pokémon (goal wins over "next")
function nextFor(sp) { const k = K(), o = k.ownedOf(sp.dex), g = goalOf(sp.dex);
  if (g && !goalDone(sp.dex)) return { t: g.t, c: g.c, goal: true };
  if (!o) return { t: 0, c: sp.basic };
  const nt = sp.tiersAvail.find(t => t > o.t); if (nt == null) return null;
  return { t: nt, c: printings(sp, nt)[0] }; }
const price = (c, t) => window.PKX && PKX.price ? PKX.price(c, t) : 0;
const priceEl = (c, t) => `<b class="np" data-cid="${esc(c.id)}" data-t="${t}">${money(price(c, t))}</b>`;
function fillPrices(root) { (root || document).querySelectorAll('.np[data-cid]').forEach(el => { const c = K().BY_ID.get(el.dataset.cid); const v = c && price(c, +el.dataset.t); if (v) el.textContent = money(v); }); }
let pfT = null;
function loadPrices(cards, root) { if (!window.PKX || !PKX.prices) return; const list = cards.filter(Boolean).slice(0, 80); if (!list.length) return;
  PKX.prices(list, () => { clearTimeout(pfT); pfT = setTimeout(() => fillPrices(root), 60); }); }
const tierPill = t => { const T = K().TIERS[t]; return `<span class="tpill" style="--tc:${T.c}">${T.l}</span>`; };

/* ---------- list rows ---------- */
function rowMissing(sp) { const c = sp.basic, g = goalOf(sp.dex);
  return `<div class="nrow" data-lad="${sp.dex}"><img class="nimg" src="${BLANK}" data-src="${c.img}" alt="">
    <div class="ninfo"><div class="nn"><b>${esc(sp.name)}</b><span>#${pad(sp.dex)}</span></div>
      <div class="nsub">${tierPill(0)} ${esc(c.set)} #${esc(c.num)}</div>
      <div class="nsub">${priceEl(c, 0)}${g ? ` <span class="gtag">⭐ ${esc(K().TIERS[g.t].l)}</span>` : ''}</div></div>
    <div class="nact"><button class="gotit" data-got="${sp.dex}">✓ Got it</button><span class="chev">›</span></div></div>`; }
function rowUpgrade(sp) { const k = K(), o = k.ownedOf(sp.dex), cur = k.displayCard(sp), n = nextFor(sp);
  if (!n) return rowBest(sp);
  return `<div class="nrow up${n.goal ? ' goal' : ''}" data-lad="${sp.dex}">
    <div class="pair"><img class="nimg sm" src="${BLANK}" data-src="${cur.img}" alt=""><span class="arr">→</span><img class="nimg" src="${BLANK}" data-src="${n.c.img}" alt=""></div>
    <div class="ninfo"><div class="nn"><b>${esc(sp.name)}</b><span>#${pad(sp.dex)}</span></div>
      <div class="nsub">${tierPill(o.t)} → ${tierPill(n.t)}${n.goal ? ' <span class="gtag">⭐ Goal</span>' : ''}</div>
      <div class="nsub">${esc(n.c.set)} #${esc(n.c.num)} · ${priceEl(n.c, n.t)}</div></div><span class="chev">›</span></div>`; }
function rowBest(sp) { const k = K(), o = k.ownedOf(sp.dex), cur = k.displayCard(sp);
  return `<div class="nrow best" data-lad="${sp.dex}"><img class="nimg" src="${BLANK}" data-src="${cur.img}" alt="">
    <div class="ninfo"><div class="nn"><b>${esc(sp.name)}</b><span>#${pad(sp.dex)}</span></div><div class="nsub">${tierPill(o.t)} <span class="bis">🏆 Best in slot</span></div></div><span class="chev">›</span></div>`; }

/* ---------- the Need list (called by the Need tab) ---------- */
const L = { only: 'all', sort: 'dex', limit: { miss: 60, up: 60 }, bestOpen: false };
function render(box, list, opts) { const k = K(), q = opts.q || '';
  const owned = list.filter(sp => k.ownedOf(sp.dex)), missing = list.filter(sp => !k.ownedOf(sp.dex));
  const ups = owned.filter(sp => nextFor(sp)), best = owned.filter(sp => !nextFor(sp));
  const goalsAll = Object.keys(k.GOALS).map(Number), goalsDone = goalsAll.filter(goalDone).length;
  const cheap = (arr, f) => L.sort === 'price' ? arr.slice().sort((a, b) => (price(f(a).c, f(a).t) || 1e9) - (price(f(b).c, f(b).t) || 1e9)) : arr;
  let miss = cheap(missing, sp => ({ c: sp.basic, t: 0 })), up = cheap(ups, sp => nextFor(sp));
  if (L.only === 'goals') { miss = miss.filter(sp => goalOf(sp.dex)); up = up.filter(sp => goalOf(sp.dex) && !goalDone(sp.dex)); }
  const showMiss = L.only === 'all' || L.only === 'miss' || L.only === 'goals', showUp = L.only === 'all' || L.only === 'up' || L.only === 'goals';
  const ms = miss.slice(0, L.limit.miss), us = up.slice(0, L.limit.up);
  box.innerHTML = `
    <div class="lchips"><div class="chips">${[['all', 'All'], ['miss', `Not owned ${missing.length}`], ['up', `Upgrades ${ups.length}`], ['goals', `⭐ Goals ${goalsDone}/${goalsAll.length}`]].map(([v, l]) => `<button class="chip${L.only === v ? ' on' : ''}" data-lonly="${v}">${l}</button>`).join('')}</div>
      <button class="chip" data-lsort="1">${L.sort === 'dex' ? 'Sort: #' : 'Sort: cheapest'}</button></div>
    ${showMiss ? `<h3 class="sech">Not owned · ${miss.length}</h3><div class="nlist">${ms.map(rowMissing).join('') || '<div class="muted">–</div>'}</div>${miss.length > ms.length ? `<button class="ghost needmore" data-lmore="miss">Show more (${miss.length - ms.length})</button>` : ''}` : ''}
    ${showUp ? `<h3 class="sech">${L.only === 'goals' ? 'Goals in progress' : 'Upgrades'} · ${up.length}</h3><div class="nlist">${us.map(rowUpgrade).join('') || '<div class="muted">–</div>'}</div>${up.length > us.length ? `<button class="ghost needmore" data-lmore="up">Show more (${up.length - us.length})</button>` : ''}` : ''}
    ${L.only === 'all' || L.only === 'up' ? `<button class="bisbar" data-lbest="1">🏆 Best in slot ✓ · ${best.length} ${L.bestOpen ? '▴' : '▾'}</button>${L.bestOpen ? `<div class="nlist">${best.map(rowBest).join('')}</div>` : ''}` : ''}`;
  loadPrices([...ms.map(sp => sp.basic), ...us.map(sp => nextFor(sp).c)], box); fillPrices(box);
  if (!box._wired) { box._wired = 1; box.addEventListener('click', e => {
    const k2 = K(), lad = e.target.closest('[data-lad]'), o = e.target.closest('[data-lonly]'), s = e.target.closest('[data-lsort]'), m = e.target.closest('[data-lmore]'), b = e.target.closest('[data-lbest]');
    if (e.target.closest('[data-got]')) return; // handled by the Need tab
    if (o) { L.only = o.dataset.lonly; opts.redraw(); return; } if (s) { L.sort = L.sort === 'dex' ? 'price' : 'dex'; opts.redraw(); return; }
    if (m) { L.limit[m.dataset.lmore] += 60; opts.redraw(); return; } if (b) { L.bestOpen = !L.bestOpen; opts.redraw(); return; }
    if (lad) openLadder(k2.SPECIES[+lad.dataset.lad - 1], opts.redraw); }); }
}

/* ---------- ladder sheet ---------- */
function openLadder(sp, after) {
  const k = K(), o = k.ownedOf(sp.dex), cur = o ? k.displayCard(sp) : null, top = bestTier(sp), g0 = goalOf(sp.dex), rungs = ladder(sp), ed = isEditor();
  const nt = o ? sp.tiersAvail.find(t => t > o.t) : 0;
  let el = $('#ladder'); if (!el) { el = document.createElement('div'); el.id = 'ladder'; el.className = 'lsheet'; document.body.appendChild(el); }
  const pick = {}; rungs.forEach(r => pick[r.t] = (g0 && g0.t === r.t && r.list.includes(g0.c)) ? g.c : (o && o.t === r.t && cur && r.list.includes(cur)) ? cur : r.list[0]);
  const draw = () => { const g = goalOf(sp.dex);
    el.innerHTML = `<div class="lin"><div class="lhd"><div><h2>${esc(sp.name)} <span class="muted">#${pad(sp.dex)}</span></h2><div class="muted small">${o ? `${k.TIERS[o.t].l}${o.t === top ? ' · 🏆 Best in slot' : ''}` : 'Not owned'}${g ? ` · ⭐ ${esc(k.TIERS[g.t].l)}` : ''}</div></div><button class="lx" aria-label="Close">✕</button></div>
      <div class="lrow">${rungs.map(r => { const c = pick[r.t], have = o && o.t === r.t, isGoal = g && g.t === r.t && g.c === c, done = o && o.t >= r.t;
        return `<div class="rung${have ? ' have' : ''}${done && !have ? ' done' : ''}${r.t === top ? ' top' : ''}${isGoal ? ' goal' : ''}">
          <div class="rtop">${tierPill(r.t)}${have ? '<span class="rtag you">You have</span>' : r.t === nt ? '<span class="rtag nx">Next</span>' : ''}${r.t === top ? '<span class="rtag bis">🏆 Best in slot</span>' : ''}</div>
          <img class="rimg" src="${c.img}" alt="${esc(c.name)}" data-zoom="${esc(c.img)}" loading="lazy">
          <div class="rname">${esc(c.set)} #${esc(c.num)}</div><div class="rprice">${priceEl(c, r.t)}</div>
          ${r.list.length > 1 ? `<details class="more"><summary>+${r.list.length - 1} more</summary><div class="alts">${r.list.map(x => `<img src="${x.img}" data-alt="${r.t}|${esc(x.id)}" class="${x === c ? 'on' : ''}" alt="" loading="lazy">`).join('')}</div></details>` : ''}
          ${ed ? `<button class="gbtn${isGoal ? ' on' : ''}" data-goal="${r.t}|${esc(c.id)}">${isGoal ? '⭐ Goal ✓' : '⭐ Set as goal'}</button>` : isGoal ? '<span class="gtag">⭐ Goal</span>' : ''}</div>`; }).join('')}</div></div>`;
    loadPrices(rungs.map(r => pick[r.t]), el); fillPrices(el);
    const h = el.querySelector('.rung.goal') || el.querySelector('.rung.have'); if (h) h.scrollIntoView({ inline: 'center', block: 'nearest' });
  };
  draw(); el.classList.add('on'); document.body.style.overflow = 'hidden';
  el.onclick = e => { const z = e.target.closest('[data-zoom]'), a = e.target.closest('[data-alt]'), gb = e.target.closest('[data-goal]');
    if (e.target === el || e.target.closest('.lx')) { el.classList.remove('on'); document.body.style.overflow = ''; after && after(); return; }
    if (a) { const [t, id] = a.dataset.alt.split('|'); pick[+t] = k.BY_ID.get(id); draw(); return; }
    if (gb) { const [t, id] = gb.dataset.goal.split('|'); setGoal(sp.dex, +t, id); draw(); return; }
    if (z) zoom(z.dataset.zoom); };
}
function setGoal(dex, t, id) { const k = K(); if (!isEditor()) return;
  const g = k.GOALS[dex]; if (g && g[0] === t && g[1] === id) delete k.GOALS[dex]; else k.GOALS[dex] = [t, id];
  try { localStorage.setItem('pkc.goals', JSON.stringify(k.GOALS)); } catch (e) {}
  window.PKCloud && PKCloud.push(); k.toast(k.GOALS[dex] ? `⭐ Goal set: ${k.SPECIES[dex - 1].name} · ${k.TIERS[t].l}` : 'Goal cleared', '#D97706'); }
function zoom(src) { let z = $('#lzoom'); if (!z) { z = document.createElement('div'); z.id = 'lzoom'; document.body.appendChild(z); z.onclick = () => z.classList.remove('on'); }
  z.innerHTML = `<img src="${esc(src).replace('.png', '_hires.png')}" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${esc(src)}'}" alt="">`; z.classList.add('on'); }

window.PKL = { render, openLadder, nextFor, goalOf, goalDone, ladder, _setGoal: setGoal };
})();
