// Binders Best tab: themed 3x3 binder pages. Owned = full color, not owned = grey; tap a grey card to see which pack it's in.
// Featured pages + honorable mentions; swaps are kept per device (localStorage pkc.best).
(() => {
'use strict';
const $ = s => document.querySelector(s);
const K = () => window.PKC;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = v => !v ? '–' : v >= 1000 ? '$' + Math.round(v).toLocaleString() : '$' + v.toFixed(2);
const us = iso => { if (!iso) return ''; const [y, m, d] = iso.slice(0, 10).split('-'); return `${m}/${d}/${y.slice(2)}`; };
const ART = d => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${d}.png`;

const PAGES = {
  eevee:  { t: 'Eeveelutions', e: '🌈', b: 'Eevee and all eight evolutions on one page', dex: [133, 134, 135, 136, 196, 197, 470, 471, 700] },
  kanto:  { t: 'Kanto Starters', e: '🔥', b: 'Bulbasaur, Charmander, Squirtle and their full lines', dex: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  birds:  { t: 'Birds & Beasts', e: '🕊️', b: 'Legendary birds, legendary beasts, Lugia, Ho-Oh and Mew', dex: [144, 145, 146, 243, 244, 245, 249, 250, 151] },
  dragon: { t: 'Dragon Lines', e: '🐉', b: 'Three pseudo-legendary lines: Dragonite, Salamence, Garchomp', dex: [147, 148, 149, 371, 372, 373, 443, 444, 445] },
  legend: { t: 'Hoenn & Sinnoh Legends', e: '⚡', b: 'The eon duo, weather trio, creation trio and Arceus', dex: [380, 381, 382, 383, 384, 483, 484, 487, 493] },
  top9:   { t: 'Your Best 9', e: '💎', b: 'Your 9 most valuable cards in this binder', kind: 'top9' },
  johto:  { t: 'Johto Starters', e: '🌿', b: 'Chikorita, Cyndaquil, Totodile lines', dex: [152, 153, 154, 155, 156, 157, 158, 159, 160] },
  hoenn:  { t: 'Hoenn Starters', e: '🌊', b: 'Treecko, Torchic, Mudkip lines', dex: [252, 253, 254, 255, 256, 257, 258, 259, 260] },
  sinnoh: { t: 'Sinnoh Starters', e: '🐧', b: 'Turtwig, Chimchar, Piplup lines', dex: [387, 388, 389, 390, 391, 392, 393, 394, 395] },
  ghost:  { t: 'Ghost Squad', e: '👻', b: 'Gengar line, Mismagius, Banette, Dusknoir and friends', dex: [92, 93, 94, 200, 429, 353, 354, 355, 477] },
  fossil: { t: 'Fossil Dig', e: '🦴', b: 'Omanyte, Kabuto, Aerodactyl, Lileep and Anorith', dex: [138, 139, 140, 141, 142, 345, 346, 347, 348] },
  babies: { t: 'Baby Pokémon', e: '🍼', b: 'Pichu, Cleffa, Togepi, Elekid, Magby and more', dex: [172, 173, 174, 175, 236, 238, 239, 240, 298] },
  mice:   { t: 'Electric Mice', e: '🐭', b: 'Every Pikachu look-alike, Gen 1 to Gen 7', dex: [172, 25, 26, 311, 312, 417, 587, 702, 777] },
  chase:  { t: 'Newest Set Chase', e: '🎯', b: 'The 9 most valuable cards in the newest pack', kind: 'chase' }
};
const DEFAULT = ['eevee', 'kanto', 'birds', 'dragon', 'legend', 'top9'];
let featured = (() => { try { const v = JSON.parse(localStorage.getItem('pkc.best')); if (Array.isArray(v) && v.every(x => PAGES[x])) return v; } catch (e) {} return DEFAULT.slice(); })();
const saveF = () => { try { localStorage.setItem('pkc.best', JSON.stringify(featured)); } catch (e) {} };
const ST = { loading: false };

function loadPacks(cb) {
  if (window.PK_PACKS) return cb();
  if (ST.loading) return; ST.loading = true;
  const s = document.createElement('script'); s.src = 'data/packs.js?v=' + (document.querySelector('script[src*="trending.js?v="]') || { src: 'v=1' }).src.split('v=')[1];
  s.onload = s.onerror = () => { ST.loading = false; cb(); };
  document.body.appendChild(s);
}
// every in-print printing of a Pokémon, cheapest first
function inPrint(dex) {
  const P = window.PK_PACKS; if (!P) return [];
  const out = [];
  P.sets.forEach(set => set.cards.forEach(a => { if (a[6] === dex) out.push({ id: `${set.id}-${a[0]}`, num: a[0], n: a[1], r: a[2], img: a[3], usd: a[4], set: set.name, date: set.date }); }));
  return out.sort((a, b) => (a.usd || 999) - (b.usd || 999));
}
const inBinder = dex => { const k = K(); return !!k.ownedOf(dex) && !k.S.toFile[dex]; };

// one slot = {dex, img, name, own: 'bind'|'box'|'none', sub}
function slotsOf(id) {
  const k = K(), pg = PAGES[id];
  if (pg.kind === 'top9') {
    const PX = window.PKX;
    return k.SPECIES.filter(sp => inBinder(sp.dex)).map(sp => { const c = k.displayCard(sp), o = k.ownedOf(sp.dex); return { sp, c, v: PX && PX.priceValue ? PX.priceValue(c, o.t) : 0 }; })
      .sort((a, b) => b.v - a.v).slice(0, 9).map(x => ({ dex: x.sp.dex, img: x.c.img, name: x.sp.name, own: 'bind', sub: money(x.v) }));
  }
  if (pg.kind === 'chase') {
    const P = window.PK_PACKS; if (!P) return [];
    const set = P.sets.find(s => s.cards.filter(a => a[3]).length > s.cards.length / 2) || P.sets[0];
    return set.cards.filter(a => a[6]).slice().sort((a, b) => (b[4] || 0) - (a[4] || 0)).slice(0, 9).map(a => {
      const id = `${set.id}-${a[0]}`, o = k.ownedOf(a[6]), mine = o && o.c && k.BY_ID.get(o.c) && k.BY_ID.get(o.c).tdId === id;
      return { dex: a[6], img: a[3] ? a[3] + '/low.webp' : ART(a[6]), name: a[1], own: mine ? 'bind' : 'none', sub: money(a[4]), card: id, set: set.name };
    });
  }
  return pg.dex.map(d => {
    const sp = k.SPECIES[d - 1], o = k.ownedOf(d);
    const own = !o ? 'none' : k.S.toFile[d] ? 'box' : 'bind';
    let img = (o ? k.displayCard(sp) : sp.coolest).img;
    if (!o) { const ip = inPrint(d); const pick = ip.filter(c => c.img).pop(); if (pick) img = pick.img + '/low.webp'; }
    return { dex: d, img, name: sp.name, own };
  });
}
const ring = (n, of, big) => { const r = big ? 22 : 15, C = 2 * Math.PI * r, s = big ? 54 : 38; return `<svg class="bring" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="var(--line,#E5E7EB)" stroke-width="${big ? 6 : 4}"/>
  <circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="${n === of ? '#16A34A' : '#D97706'}" stroke-width="${big ? 6 : 4}" stroke-linecap="round" stroke-dasharray="${(C * n / of).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 ${s / 2} ${s / 2})"/>
  <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-size="${big ? 13 : 10}" font-weight="700" fill="currentColor">${n}/${of}</text></svg>`; };
const pocket = (s, i, id) => `<button class="bpk ${s.own}" data-pg="${id}" data-i="${i}" title="${esc(s.name)}"><img src="${esc(s.img)}" alt="${esc(s.name)}" loading="lazy" onerror="this.src='${ART(s.dex)}'">
  ${s.own === 'none' ? '<span class="bpk-q">?</span>' : s.own === 'box' ? '<span class="bpk-tag">not in binder</span>' : ''}<span class="bpk-n">${esc(s.name)}${s.sub ? ` · ${esc(s.sub)}` : ''}</span></button>`;

function render() {
  const root = $('#v-best'); if (!root) return;
  if (!window.PK_PACKS && !ST.tried) { ST.tried = true; root.innerHTML = '<div class="empty"><span class="spin"></span> Laying out your pages…</div>'; loadPacks(render); return; }
  const all = Object.keys(PAGES), hm = all.filter(x => !featured.includes(x));
  const stat = id => { const s = slotsOf(id); return { s, n: s.filter(x => x.own !== 'none').length }; };
  const F = featured.map(id => ({ id, ...stat(id) })), H = hm.map(id => ({ id, ...stat(id) }));
  const done = F.filter(p => p.s.length && p.n === p.s.length).length, missing = F.reduce((a, p) => a + p.s.length - p.n, 0);
  const closest = F.filter(p => p.n < p.s.length).sort((a, b) => (b.n / b.s.length) - (a.n / a.s.length))[0];
  root.innerHTML = `
    <div class="bbhero">
      <div class="bbchip"><small>Pages complete</small><b>${done}/${F.length}</b></div>
      <div class="bbchip"><small>Cards to chase</small><b>${missing}</b></div>
      ${closest ? `<div class="bbchip wide"><small>Closest to done</small><b>${PAGES[closest.id].e} ${esc(PAGES[closest.id].t)} · ${closest.s.length - closest.n} to go</b></div>` : ''}
    </div>
    <p class="muted small bbtip">Grey = not in your collection yet. Tap it to see which pack to buy.</p>
    <div class="bbpages">${F.map(p => `<section class="bbpage panel">
      <div class="bbhd">${ring(p.n, p.s.length || 9, true)}<div><h3>${PAGES[p.id].e} ${esc(PAGES[p.id].t)}</h3><small class="muted">${esc(PAGES[p.id].b)}</small></div>
        <button class="ghost bbsw" data-down="${p.id}" title="Move to honorable mentions">↓</button></div>
      <div class="bbgrid">${p.s.map((s, i) => pocket(s, i, p.id)).join('')}</div></section>`).join('')}</div>
    <h3 class="sech">🏅 Honorable mentions</h3>
    <div class="bbhm">${H.map(p => `<div class="bbmini panel">
      <div class="bbmg">${p.s.map(s => `<span class="${s.own}"><img src="${esc(s.img)}" alt="" loading="lazy" onerror="this.src='${ART(s.dex)}'"></span>`).join('')}</div>
      <div class="bbmt">${ring(p.n, p.s.length || 9)}<div><b>${PAGES[p.id].e} ${esc(PAGES[p.id].t)}</b><small class="muted">${esc(PAGES[p.id].b)}</small></div></div>
      <button class="primary bbup" data-up="${p.id}">⭐ Feature this page</button></div>`).join('')}</div>`;
  root.onclick = e => {
    const up = e.target.closest('[data-up]'), dn = e.target.closest('[data-down]'), pk = e.target.closest('.bpk');
    if (up) { featured.push(up.dataset.up); saveF(); render(); K().toast(`${PAGES[up.dataset.up].t} is now a featured page`, '#16A34A'); return; }
    if (dn) { featured = featured.filter(x => x !== dn.dataset.down); saveF(); render(); return; }
    if (pk) { const s = slotsOf(pk.dataset.pg)[+pk.dataset.i]; s && openSlot(s); }
  };
}

function openSlot(s) {
  const k = K(), sp = k.SPECIES[s.dex - 1];
  if (s.own !== 'none') { k.openWheel(sp); return; }
  const ip = s.card ? inPrint(s.dex).filter(c => c.id === s.card) : inPrint(s.dex);
  const old = sp.coolest;
  let sh = $('#bestSheet'); if (!sh) { sh = document.createElement('div'); sh.id = 'bestSheet'; sh.className = 'bsheet'; document.body.appendChild(sh); }
  sh.innerHTML = `<div class="bsin panel"><button class="x" aria-label="Close">×</button>
    <div class="bshead"><img src="${ART(s.dex)}" alt=""><div><h2>${esc(s.card ? s.name : sp.name)}</h2><small class="muted">#${s.dex} · not in your collection yet</small></div></div>
    ${ip.length ? `<h4>🎁 Packs on shelves now with ${esc(sp.name)}</h4>
      <div class="bslist">${ip.slice(0, 8).map(c => `<div class="bsrow"><span><b>${esc(c.set)}</b><small class="muted">${esc(c.n)} · ${esc(c.r) || '—'} · #${esc(c.num)} · released ${us(c.date)}</small></span><b>${money(c.usd)}</b></div>`).join('')}</div>
      <p class="muted small">Card prices are the single-card market price (TCGplayer). Cheapest first, so the top pack is your easiest pull.</p>`
    : `<h4>📦 Not in any pack on shelves now</h4><p class="muted">Last big printing: <b>${esc(old.set)}</b> (${us(old.date)}). Look for it as a single card.</p>`}
    <button class="primary bsall">See every ${esc(sp.name)} printing →</button></div>`;
  sh.classList.add('on');
  sh.onclick = e => { if (e.target === sh || e.target.closest('.x')) sh.classList.remove('on'); if (e.target.closest('.bsall')) { sh.classList.remove('on'); k.openWheel(sp); } };
}

window.PKB = { render, PAGES };
if (document.querySelector('#v-best.on')) render();
})();
