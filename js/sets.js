// Set view: tap a set in "Sets you're rocking" -> a booster pack opens, then every card in that set,
// Basic -> Reverse Holo -> Rare -> Holo Rare -> Ultra Rare -> Secret/Illustration, with have / other print / missing.
(() => {
'use strict';
const K = () => window.PKC;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = v => !v ? '$0' : v >= 1000 ? '$' + Math.round(v).toLocaleString() : '$' + v.toFixed(2);
const numKey = n => { const m = /^(\D*)(\d+)(.*)$/.exec(String(n)); return m ? [m[1], +m[2], m[3]] : [String(n), 0, '']; };
const byNum = (a, b) => { const x = numKey(a.num), y = numKey(b.num); return x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : x[1] - y[1] || (x[2] < y[2] ? -1 : 1); };
const hue = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const ST = { set: null, f: 'all', timers: [] }; // window.__svHold = test hook that freezes the pack opening

const CSS = `
#setView{position:fixed;inset:0;z-index:45;background:radial-gradient(circle at 50% 30%,#1E1B4B,#0B0A1A);color:#fff;display:none;overflow:hidden}
#setView.on{display:block}
#setView .svx{position:absolute;top:calc(10px + env(safe-area-inset-top));right:12px;z-index:5;width:44px;height:44px;border-radius:50%;border:0;background:#ffffff22;color:#fff;font-size:24px;cursor:pointer}
.svstage{position:absolute;inset:0;display:grid;place-items:center;perspective:1000px;pointer-events:none}
.svpack{width:190px;height:290px;border-radius:14px;position:relative;transform-style:preserve-3d;box-shadow:0 30px 60px #0009;
  background:linear-gradient(160deg,hsl(var(--h),80%,62%),hsl(calc(var(--h) + 40),70%,38%) 60%,hsl(calc(var(--h) + 80),60%,24%));
  animation:svIn .7s cubic-bezier(.2,1.4,.4,1) both, svWob .5s .7s ease-in-out}
.svpack::after{content:"";position:absolute;inset:0;border-radius:14px;background:linear-gradient(115deg,transparent 30%,#ffffff55 45%,transparent 60%);background-size:250% 100%;animation:svShine 1.2s .2s ease-in-out both}
.svpack .lg{position:absolute;left:12%;right:12%;top:34%;height:22%;background-size:contain;background-repeat:no-repeat;background-position:center;filter:drop-shadow(0 3px 4px #0007)}
.svpack .nm{position:absolute;left:8px;right:8px;bottom:18px;text-align:center;font:800 15px/1.2 system-ui,sans-serif;text-shadow:0 2px 4px #0008}
.svpack .top{position:absolute;left:0;right:0;top:0;height:16%;border-radius:14px 14px 0 0;background:repeating-linear-gradient(90deg,#ffffff33 0 6px,transparent 6px 12px),inherit;background-color:hsl(var(--h),80%,55%);
  border-bottom:2px dashed #ffffffaa;transform-origin:100% 0}
.svstage.tear .top{animation:svTear .55s ease-in both}
.svburst{position:absolute;width:40px;height:40px;border-radius:50%;background:radial-gradient(circle,#fff,#FDE68A 40%,transparent 70%);opacity:0;top:calc(50% - 160px)}
.svstage.tear .svburst{animation:svBurst .7s .25s ease-out both}
.svfly{position:absolute;width:110px;height:154px;border-radius:8px;background:#fff center/cover no-repeat;box-shadow:0 10px 24px #0008;opacity:0;top:calc(50% - 130px)}
.svstage.fly .svfly{animation:svFly .9s cubic-bezier(.2,.8,.2,1) both}
.svstage.done{opacity:0;transition:opacity .35s}
@keyframes svIn{from{transform:translateY(60vh) rotateX(40deg) scale(.7)}to{transform:none}}
@keyframes svWob{0%,100%{transform:rotateZ(0)}25%{transform:rotateZ(-5deg) scale(1.03)}75%{transform:rotateZ(5deg) scale(1.03)}}
@keyframes svShine{from{background-position:120% 0}to{background-position:-60% 0}}
@keyframes svTear{to{transform:translate(70px,-120px) rotate(35deg);opacity:0}}
@keyframes svBurst{0%{opacity:0;transform:scale(.2)}30%{opacity:1}100%{opacity:0;transform:scale(14)}}
@keyframes svFly{0%{opacity:0;transform:translateY(40px) scale(.5) rotate(0)}25%{opacity:1}100%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(1) rotate(var(--r))}}
.svbody{position:absolute;inset:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:calc(14px + env(safe-area-inset-top)) 14px calc(30px + env(safe-area-inset-bottom));opacity:0;transition:opacity .4s}
#setView.show .svbody{opacity:1}
.svhd{display:flex;align-items:center;gap:14px;max-width:1100px;margin:0 auto 12px;padding-right:50px}
.svhd img{max-height:46px;max-width:120px;object-fit:contain}
.svhd h2{margin:0;font:800 20px/1.2 system-ui,sans-serif}.svhd small{color:#C7D2FE;font-size:12px;display:block}
.svring{flex:none;position:relative;width:64px;height:64px}.svring b{position:absolute;inset:0;display:grid;place-items:center;font:800 13px system-ui}
.svkpi{display:flex;gap:10px;max-width:1100px;margin:0 auto 12px;flex-wrap:wrap}.svkpi div{background:#ffffff14;border-radius:10px;padding:8px 12px}.svkpi b{display:block;font-size:18px}.svkpi small{color:#C7D2FE;font-size:11px}
.svchips{display:flex;gap:8px;max-width:1100px;margin:0 auto 10px}.svchips button{border:1px solid #ffffff44;background:transparent;color:#fff;border-radius:999px;padding:7px 14px;font:700 13px system-ui;cursor:pointer}.svchips button.on{background:#fff;color:#1E1B4B}
.svtier{max-width:1100px;margin:16px auto 8px;font:800 12px system-ui;letter-spacing:.08em;text-transform:uppercase;color:#E0E7FF;display:flex;gap:8px;align-items:center}.svtier i{width:10px;height:10px;border-radius:50%;background:var(--tc)}.svtier span{color:#A5B4FC;font-weight:600;letter-spacing:0;text-transform:none}
.svgrid{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:10px}
.svc{position:relative;border:0;padding:0;background:#ffffff10;border-radius:8px;cursor:pointer;aspect-ratio:63/88;overflow:hidden;animation:svPop .35s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--d,0s)}
.svc img{width:100%;height:100%;object-fit:cover;display:block}
.svc.miss img{filter:grayscale(1) brightness(.45);opacity:.7}.svc.other img{filter:saturate(.55) brightness(.8)}
.svc .tg{position:absolute;left:4px;right:4px;bottom:4px;font:800 10px system-ui;border-radius:4px;padding:2px 4px;text-align:center}
.svc.have .tg{background:#16A34A}.svc.have.out .tg{background:#D97706}.svc.other .tg{background:#ffffffcc;color:#1E1B4B}
.svc .nn{position:absolute;top:4px;left:4px;font:800 10px system-ui;background:#0009;border-radius:4px;padding:1px 5px}
@keyframes svPop{from{opacity:0;transform:translateY(24px) scale(.85)}to{opacity:1;transform:none}}
@media (max-width:640px){.svgrid{grid-template-columns:repeat(3,1fr);gap:7px}.svhd h2{font-size:17px}}
`;
function ensure() { let el = document.getElementById('setView'); if (el) return el;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  el = document.createElement('div'); el.id = 'setView'; document.body.appendChild(el);
  el.addEventListener('click', e => {
    if (e.target.closest('.svx')) return close();
    if (el.classList.contains('anim')) return finish();
    const f = e.target.closest('[data-f]'); if (f) { ST.f = f.dataset.f; drawBody(); return; }
    const c = e.target.closest('.svc'); if (c) openCardView(c.dataset.id); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && el.classList.contains('on') && !document.getElementById('modal').classList.contains('on')) close(); });
  return el; }

function stateOf(c) { const k = K(); let st = 'miss', out = false;
  for (const d of c.dex) { const o = k.S.owned[d]; if (!o) continue; if (o.c === c.id) { st = 'have'; out = !!k.S.toFile[d]; break; } st = 'other'; }
  return { st, out }; }
function cardsOf(setId) { return K().CARDS.filter(c => c.setId === setId).sort((a, b) => a.tier - b.tier || byNum(a, b)); }

function open(setId) { const k = K(), list = cardsOf(setId); if (!list.length) return; ST.set = setId; ST.f = 'all';
  const el = ensure(); el.className = 'on'; document.body.style.overflow = 'hidden';
  const first = list[0], h = hue(setId), logo = `https://images.pokemontcg.io/${setId}/logo.png`;
  const flyers = list.filter(c => c.tier >= 2).slice(-5).concat(list).slice(0, 5);
  el.innerHTML = `<button class="svx" aria-label="Close">×</button>
    <div class="svstage" style="--h:${h}"><div class="svburst"></div>
      <div class="svpack" style="--h:${h}"><div class="top"></div><div class="lg" style="background-image:url('${logo}')"></div><div class="nm">${esc(first.set)}</div></div>
      ${flyers.map((c, i) => `<div class="svfly" style="background-image:url('${esc(c.img)}');--dx:${(i - 2) * 70}px;--dy:${-160 - Math.abs(i - 2) * -30}px;--r:${(i - 2) * 9}deg;animation-delay:${.05 * i}s"></div>`).join('')}</div>
    <div class="svbody"></div>`;
  drawBody();
  if (reduce()) return finish();
  el.classList.add('anim'); const stg = el.querySelector('.svstage');
  ST.timers.forEach(clearTimeout); ST.timers = [setTimeout(() => stg.classList.add('tear'), 750), setTimeout(() => stg.classList.add('fly'), 1050)]; if (!window.__svHold) ST.timers.push(setTimeout(finish, 1850)); }
function finish() { const el = document.getElementById('setView'); if (!el) return; ST.timers.forEach(clearTimeout); ST.timers = [];
  el.classList.remove('anim'); el.classList.add('show'); const stg = el.querySelector('.svstage'); if (stg) { stg.classList.add('done'); setTimeout(() => stg.remove(), 400); } }
function close() { const el = document.getElementById('setView'); if (!el) return; ST.timers.forEach(clearTimeout); el.className = ''; el.innerHTML = ''; document.body.style.overflow = ''; }

function drawBody() { const k = K(), el = document.getElementById('setView'), body = el && el.querySelector('.svbody'); if (!body) return;
  const list = cardsOf(ST.set), first = list[0], rows = list.map(c => ({ c, ...stateOf(c) }));
  const have = rows.filter(r => r.st === 'have'), pct = list.length ? have.length / list.length : 0;
  const R = 26, C = 2 * Math.PI * R, val = () => have.reduce((a, r) => a + (window.PKX && PKX.price ? PKX.price(r.c, r.c.tier) : 0), 0);
  const shown = rows.filter(r => ST.f === 'all' || (ST.f === 'have' ? r.st === 'have' : r.st !== 'have'));
  const groups = k.TIERS.map((t, i) => ({ t, i, rows: shown.filter(r => r.c.tier === i), all: rows.filter(r => r.c.tier === i) })).filter(g => g.all.length);
  let n = 0;
  body.innerHTML = `<div class="svhd"><img src="https://images.pokemontcg.io/${esc(ST.set)}/logo.png" alt="" onerror="this.remove()">
      <div style="flex:1;min-width:0"><h2>${esc(first.set)}</h2><small>${esc(first.series)} · ${k.fmtDate(first.date)}</small></div>
      <div class="svring"><svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="${R}" fill="none" stroke="#ffffff22" stroke-width="7"/><circle cx="32" cy="32" r="${R}" fill="none" stroke="${pct >= 1 ? '#22C55E' : '#FBBF24'}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 32 32)"/></svg><b>${Math.round(pct * 100)}%</b></div></div>
    <div class="svkpi"><div><small>You have</small><b>${have.length} / ${list.length}</b></div><div><small>Value of yours</small><b id="svVal">${money(val())}</b></div><div><small>Pokémon owned, other print</small><b>${rows.filter(r => r.st === 'other').length}</b></div></div>
    <div class="svchips">${[['all', 'All ' + list.length], ['have', 'Have ' + have.length], ['miss', 'Missing ' + (list.length - have.length)]].map(([f, l]) => `<button data-f="${f}" class="${ST.f === f ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${groups.map(g => `<div class="svtier" style="--tc:${g.t.c}"><i></i>${esc(g.t.l)} <span>${g.all.filter(r => r.st === 'have').length} / ${g.all.length}</span></div>
      <div class="svgrid">${g.rows.map(r => `<button class="svc ${r.st}${r.out ? ' out' : ''}" data-id="${esc(r.c.id)}" style="--d:${Math.min(n++, 24) * 0.035}s" aria-label="${esc(r.c.name)} #${esc(r.c.num)}">
        <img src="${esc(r.c.img)}" alt="" loading="lazy" decoding="async"><span class="nn">#${esc(r.c.num)}</span>${r.st === 'have' ? `<span class="tg">✓ ${r.out ? 'Not in binder' : 'In binder'}</span>` : r.st === 'other' ? '<span class="tg">Other print</span>' : ''}</button>`).join('')}</div>`).join('')}`;
  // prices for his cards in this set (value tile)
  if (have.length && window.PKX && PKX.prices) PKX.prices(have.map(r => r.c).slice(0, 80), () => { const v = document.getElementById('svVal'); if (v) v.textContent = money(val()); }); }

function openCardView(id) { const k = K(), c = k.BY_ID.get(id); if (!c) return; const sp = k.SPECIES[c.dex[0] - 1]; if (!sp) return;
  k.openWheel(sp); const i = sp.cards.indexOf(c); if (i >= 0 && k.wheelGo) setTimeout(() => k.wheelGo(i), 30); }

// tap a set row in Stats -> open it
document.addEventListener('click', e => { const r = e.target.closest('.setrow[data-set]'); if (r) open(r.dataset.set); });
window.PKS = { open, close };
})();
