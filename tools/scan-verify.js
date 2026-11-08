// Builds private/scan-verify.html from private/scan-match.json + the live binder (private/binders-now.json).
// He ticks each doubtful card, then "Copy my answers" puts a reply on his clipboard to paste back to Claude.
const fs = require('fs'), path = require('path');
global.window = global; require(path.resolve('data/cards.js'));
const D = window.PKDATA, M = require(path.resolve('private/scan-match.json'));
const live = require(path.resolve('private/binders-now.json')).documents.find(d => d.name.endsWith('/b1'));
const owned = {}; Object.entries(live.fields.owned.mapValue.fields).forEach(([dex, v]) => { const a = v.arrayValue.values || []; owned[dex] = [+(a[0] && (a[0].integerValue ?? a[0].doubleValue) || 0), a[1] && a[1].stringValue || null]; });
const toFile = new Set((live.fields.toFile.arrayValue.values || []).map(v => +v.integerValue));
const FORMS = ['Basic', 'Reverse Holo', 'Rare', 'Holo Rare', 'Ultra Rare', 'Secret/Illustration'];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const name = d => D.names[d - 1] || '?';
const C = s => M.filter(o => o.status === s).length;

// what would change in binder b1 if he approves the matched cards (best card per Pokémon)
const best = {}; M.filter(o => o.dex && ((o.card && (o.status === 'ok' || o.status === 'check')) || o.status === 'species')).forEach(o => { const b = best[o.dex]; if (!b || o.form > b.form) best[o.dex] = o; });
const ch = { added: [], upgraded: [], exact: [], filed: [] };
Object.values(best).forEach(o => { const cur = owned[o.dex];
  if (!cur) ch.added.push(o); else if (o.form > cur[0]) ch.upgraded.push([o, cur[0]]); else if (!cur[1]) ch.exact.push(o);
  if (toFile.has(o.dex)) ch.filed.push(o); });
const dupes = Object.entries(M.filter(o => o.dex && (o.card || o.status === 'species')).reduce((a, o) => ((a[o.dex] = a[o.dex] || []).push(o), a), {})).filter(([, l]) => l.length > 1);

const trouble = M.filter(o => o.status === 'check' || o.status === 'notfound');
const card = (o, big) => `<div class="cd${big ? ' big' : ''}">${o.img ? `<img loading="lazy" src="${esc(o.img)}" alt="">` : '<div class="noimg">?</div>'}</div>`;
const tRow = (o, i) => `<div class="tr" data-k="${o.page}-${o.slot}">
  <div class="pos">Page ${o.page}<br>Slot ${o.slot}</div>
  ${o.img ? card(o, 1) : o.options ? `<div class="opts">${o.options.map(x => `<label><input type="radio" name="o${i}" value="${esc(x.id)}"><img src="${esc(x.img)}" alt=""><small>${esc(x.set)}</small></label>`).join('')}</div>` : card(o, 1)}
  <div class="tx"><b>${esc(o.pokemon)}</b> <span class="muted">read as ${esc(o.set || '?')} · #${esc(o.num || '?')} · ${esc(o.rarity || '?')} ${esc(o.finish || '')}</span>
    ${o.img ? `<div>Best match: <b>${esc(o.cardSet)}</b> (${esc(o.card)})</div>` : '<div class="bad">No exact match in the card list</div>'}
    <div class="why">${esc([...(o.why || []), o.conf === 'low' ? 'photo read with low confidence' : '', o.notes].filter(Boolean).join(' · '))}</div>
    <div class="ans">${o.img ? '<button data-a="yes">✓ That\'s it</button><button data-a="no">✗ Wrong card</button>' : ''}<button data-a="skip">Skip it</button><input placeholder="Or type set + number, e.g. Jungle 7/64"></div></div></div>`;
const pages = [...new Set(M.map(o => o.page))].sort((a, b) => a - b);
const pageGrid = p => { const cells = Array.from({ length: 9 }, (_, i) => M.find(o => o.page === p && o.slot === i + 1));
  return `<div class="pg"><h4>Page ${p}</h4><div class="g9">${cells.map(o => !o ? '<div class="c e"></div>' : o.status === 'empty' ? '<div class="c e">empty</div>' : o.status === 'back' ? '<div class="c e">card back</div>'
    : `<div class="c ${o.status}" title="${esc(o.pokemon)} · ${esc(o.cardSet || o.set)}">${o.img ? `<img loading="lazy" src="${esc(o.img)}" alt="">` : `<span>${esc(o.pokemon)}</span>`}</div>`).join('')}</div></div>`; };

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Binder Scan Check</title>
<style>
:root{--bg:#F8FAFC;--card:#fff;--text:#0F172A;--muted:#64748B;--border:#E2E8F0;--ok:#16A34A;--chk:#D97706;--bad:#DC2626}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}
.wrap{max-width:1100px;margin:0 auto;padding:20px 16px 80px}h1{margin:0 0 4px;font-size:24px}.muted{color:var(--muted)}
.chips{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0 18px}.chip{background:#fff;border:1px solid var(--border);border-radius:10px;padding:8px 14px}.chip b{display:block;font-size:22px}.chip small{color:var(--muted)}
.bar{display:flex;height:14px;border-radius:7px;overflow:hidden;margin:4px 0 20px}.bar span{display:block}
h2{font-size:18px;margin:26px 0 10px}
.tr{display:grid;grid-template-columns:70px 120px 1fr;gap:14px;align-items:start;background:#fff;border:1px solid var(--border);border-left:4px solid var(--chk);border-radius:10px;padding:12px;margin-bottom:10px}
.tr.done{opacity:.55}.pos{font-weight:700;font-size:13px;color:var(--muted)}
.cd img{width:120px;border-radius:6px;display:block}.noimg{width:120px;aspect-ratio:63/88;border:2px dashed var(--border);border-radius:6px;display:grid;place-items:center;font-size:30px;color:var(--muted)}
.why{font-size:13px;color:var(--chk);margin-top:4px}.bad{color:var(--bad);font-size:13px}
.ans{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.ans button{border:1px solid var(--border);background:#fff;border-radius:6px;padding:6px 10px;cursor:pointer;font-weight:600}
.ans button.on{background:#0F172A;color:#fff}.ans input{flex:1;min-width:180px;border:1px solid var(--border);border-radius:6px;padding:6px 8px}
.opts{display:flex;gap:6px;flex-wrap:wrap;max-width:420px}.opts label{display:grid;justify-items:center;font-size:11px;cursor:pointer}.opts img{width:70px;border-radius:4px}
.changes{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}.changes div{background:#fff;border:1px solid var(--border);border-radius:10px;padding:10px 12px}.changes b{font-size:20px}
.list{font-size:13px;color:var(--muted);margin-top:4px;max-height:120px;overflow:auto}
.pages{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}.pg{background:#fff;border:1px solid var(--border);border-radius:10px;padding:10px}.pg h4{margin:0 0 6px;font-size:13px}
.g9{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}.c{aspect-ratio:63/88;border-radius:4px;overflow:hidden;background:#F1F5F9;display:grid;place-items:center;font-size:10px;color:var(--muted);text-align:center;border:2px solid transparent}
.c img{width:100%;height:100%;object-fit:cover}.c.check{border-color:var(--chk)}.c.notfound{border-color:var(--bad)}
.copy{position:fixed;right:16px;bottom:16px;background:#0F172A;color:#fff;border:0;border-radius:999px;padding:12px 18px;font-weight:700;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25)}
@media (max-width:640px){.tr{grid-template-columns:1fr}.cd img,.noimg{width:150px}}
</style></head><body><div class="wrap">
<h1>Binder scan check</h1><div class="muted">Your 64 photographed pages, matched to the card list. Nothing is saved to your binder until you OK it.</div>
<div class="chips"><div class="chip"><b style="color:var(--ok)">${C('ok')}</b><small>matched</small></div><div class="chip"><b style="color:var(--ok)">${C('species')}</b><small>counted, no exact card</small></div><div class="chip"><b style="color:var(--chk)">${C('check')}</b><small>please check</small></div><div class="chip"><b style="color:var(--bad)">${C('notfound')}</b><small>couldn't match</small></div><div class="chip"><b>${C('back')}</b><small>card backs (not read)</small></div><div class="chip"><b>${C('empty')}</b><small>empty pockets</small></div></div>
<div class="bar">${[['ok', 'var(--ok)'], ['check', 'var(--chk)'], ['notfound', 'var(--bad)'], ['back', '#94A3B8'], ['empty', '#E2E8F0']].map(([s, c]) => `<span style="width:${C(s) / M.length * 100}%;background:${c}"></span>`).join('')}</div>
<h2>What this changes in "Blaise: Gen 1-3"</h2>
<div class="changes">
 <div><b>${ch.added.length}</b> Pokémon not in your binder record yet<div class="list">${ch.added.map(o => `#${o.dex} ${esc(name(o.dex))}`).join(', ') || '–'}</div></div>
 <div><b>${ch.upgraded.length}</b> higher form than recorded<div class="list">${ch.upgraded.map(([o, f]) => `${esc(name(o.dex))}: ${FORMS[f]} → ${FORMS[o.form]}`).join('<br>') || '–'}</div></div>
 <div><b>${ch.exact.length}</b> get their exact printing (same form)<div class="list">Your record had the form but not which card.</div></div>
 <div><b>${ch.filed.length}</b> marked "not in binder" but are in the photos<div class="list">${ch.filed.map(o => esc(name(o.dex))).join(', ') || '–'}</div></div>
 <div><b>${dupes.length}</b> Pokémon with 2+ cards in the binder<div class="list">${dupes.map(([d, l]) => `${esc(name(+d))} ×${l.length}`).join(', ') || '–'}</div></div>
</div>
<h2>Need your eyes (${trouble.length})</h2><div class="muted" style="margin-bottom:10px">Tap ✓ or ✗, or type the right set and number. Then press "Copy my answers" and paste them to Claude.</div>
${trouble.map(tRow).join('')}
<h2>All pages</h2><div class="muted" style="margin-bottom:8px">Orange border = please check, red = couldn't match.</div><div class="pages">${pages.map(pageGrid).join('')}</div>
</div><button class="copy" id="copy">📋 Copy my answers</button>
<script>
const A = {}; try { Object.assign(A, JSON.parse(localStorage.getItem('scanAns') || '{}')); } catch (e) {}
const save = () => { try { localStorage.setItem('scanAns', JSON.stringify(A)); } catch (e) {} };
document.querySelectorAll('.tr').forEach(tr => { const k = tr.dataset.k, a = A[k] || {};
  const paint = () => { tr.querySelectorAll('[data-a]').forEach(b => b.classList.toggle('on', b.dataset.a === (A[k] || {}).a)); tr.classList.toggle('done', !!(A[k] && (A[k].a || A[k].t || A[k].o))); };
  if (a.t) tr.querySelector('.ans input').value = a.t; if (a.o) { const r = tr.querySelector('input[value="' + a.o + '"]'); if (r) r.checked = true; } paint();
  tr.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { A[k] = Object.assign(A[k] || {}, { a: b.dataset.a }); save(); paint(); } });
  tr.addEventListener('change', e => { if (e.target.type === 'radio') { A[k] = Object.assign(A[k] || {}, { o: e.target.value }); save(); paint(); } });
  tr.querySelector('.ans input').addEventListener('input', e => { A[k] = Object.assign(A[k] || {}, { t: e.target.value }); save(); paint(); }); });
document.getElementById('copy').onclick = async () => { const lines = Object.entries(A).filter(([, v]) => v.a || v.t || v.o).map(([k, v]) => 'p' + k + ': ' + [v.a, v.o, v.t].filter(Boolean).join(' | '));
  const txt = 'Binder scan answers (' + lines.length + '):\\n' + lines.join('\\n'); try { await navigator.clipboard.writeText(txt); document.getElementById('copy').textContent = '✓ Copied ' + lines.length + ' answers'; } catch (e) { prompt('Copy this:', txt); } };
</script></body></html>`;
fs.writeFileSync('private/scan-verify.html', html);
console.log('added', ch.added.length, 'upgraded', ch.upgraded.length, 'exact', ch.exact.length, 'filed', ch.filed.length, 'dupes', dupes.length, 'trouble', trouble.length);
