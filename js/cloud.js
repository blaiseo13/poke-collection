// Firebase: everyone reads the binders live; a device opened once with the private edit link (#edit-<key>) can edit.
// Data: binders/<id> {name, createdAt, owned:{dex:[form, cardId|null]}, toFile:[dex], want:[dex]}, box/main {items}, prefs/main {favs}.
(() => {
'use strict';
const cfg = window.FIREBASE_CONFIG, fb = window.firebase;
if (!cfg || !fb || !fb.firestore) return;
fb.initializeApp(cfg);
const db = fb.firestore(), auth = fb.auth();
const K = () => window.PKC;
let editor = false;

// one canonical shape for comparing local and remote, so echoes of our own writes never redraw the page
const serBinder = b => ({ name: b.name || 'Binder', createdAt: b.createdAt || '',
  owned: Object.fromEntries(Object.entries(b.owned || {}).map(([d, o]) => [d, Array.isArray(o) ? [o[0] || 0, o[1] || null] : [o.t || 0, o.c || null]])),
  toFile: (Array.isArray(b.toFile) ? b.toFile : Object.keys(b.toFile || {})).map(Number).sort((a, c) => a - c),
  want: (b.want || []).map(Number) });
const serBox = items => (items || []).map(x => ({ id: x.id || x.card, dex: +x.dex, t: x.t ?? null }));
const localBooks = () => { const S = K().S; return JSON.stringify(Object.keys(S.binders).sort().map(id => [id, serBinder(S.binders[id])])); };
const remote = { books: null, box: null, favs: null };
const pushed = {};

function apply() {
  const k = K(); if (!k || !remote.books) return;
  const rb = JSON.stringify(remote.books.slice().sort((a, b) => a.id < b.id ? -1 : 1).map(b => [b.id, serBinder(b)]));
  const sameBooks = rb === localBooks();
  const sameBox = remote.box == null || JSON.stringify(serBox(remote.box)) === JSON.stringify(serBox(k.S.box));
  const sameFavs = remote.favs == null || JSON.stringify(remote.favs.slice().sort((a, b) => a - b)) === JSON.stringify([...k.FAVS].sort((a, b) => a - b));
  if (sameBooks && sameBox && sameFavs) return;
  k.applyCloud(remote.books, remote.box, remote.favs);
}
db.collection('binders').onSnapshot(s => { if (s.metadata.hasPendingWrites) return; const all = s.docs.map(d => ({ id: d.id, ...d.data() }));
  remote.books = all.filter(b => b.game !== 'onepiece'); remote.books.forEach(b => pushed['binders/' + b.id] = JSON.stringify(serBinder(b))); apply();
  // One Piece binder lives in the same collection as binders/op-main
  const op = all.find(b => b.game === 'onepiece'); if (op) { const j = JSON.stringify(normOP(op.owned)); pushed['binders/op-main'] = j; if (window.PKOP && JSON.stringify(normOP(PKOP.owned)) !== j) PKOP.applyCloud(op); } }, () => { K().toast('Can’t reach your collection right now. Changes on this device won’t save until it reconnects.', '#DC2626'); });
db.doc('box/main').onSnapshot(s => { if (s.metadata.hasPendingWrites || !s.exists) return; remote.box = s.data().items || []; pushed['box/main'] = JSON.stringify(serBox(remote.box)); apply(); }, () => {});
db.doc('prefs/main').onSnapshot(s => { if (s.metadata.hasPendingWrites || !s.exists) return; remote.favs = (s.data().favs || []).map(Number); pushed['prefs/main'] = JSON.stringify(remote.favs.slice().sort((a, b) => a - b)); apply(); }, () => {});

// editor: write whatever changed, a moment after the last tap
let t = null;
function push() {
  // never write before the live data has arrived: a stale copy on this device must not overwrite the cloud
  if (!editor || !remote.books) return; clearTimeout(t);
  t = setTimeout(() => {
    const k = K(), S = k.S;
    // after each write, update our copy of the cloud too, so a later snapshot of another document can't roll this change back
    Object.keys(S.binders).forEach(id => { const j = JSON.stringify(serBinder(S.binders[id])); if (pushed['binders/' + id] !== j) { pushed['binders/' + id] = j; const body = JSON.parse(j);
      db.doc('binders/' + id).set(body).catch(fail); const i = remote.books.findIndex(b => b.id === id); if (i >= 0) remote.books[i] = { id, ...body }; else remote.books.push({ id, ...body }); } });
    const bj = JSON.stringify(serBox(S.box)); if (pushed['box/main'] !== bj) { pushed['box/main'] = bj; remote.box = JSON.parse(bj); db.doc('box/main').set({ items: JSON.parse(bj) }).catch(fail); }
    const fj = JSON.stringify([...k.FAVS].map(Number).sort((a, b) => a - b)); if (pushed['prefs/main'] !== fj) { pushed['prefs/main'] = fj; remote.favs = JSON.parse(fj); db.doc('prefs/main').set({ favs: JSON.parse(fj) }).catch(fail); }
  }, 700);
}
function fail() { K().toast('Couldn’t save that change. Check your connection.', '#DC2626'); }
const normOP = o => Object.fromEntries(Object.entries(o || {}).filter(([k, v]) => v === 1 || v === 2).sort((a, b) => a[0] < b[0] ? -1 : 1));
function pushOP(owned) { if (!editor || !remote.books) return; const j = JSON.stringify(normOP(owned)); if (pushed['binders/op-main'] === j) return; pushed['binders/op-main'] = j;
  db.doc('binders/op-main').set({ game: 'onepiece', name: 'One Piece', createdAt: '2026-11-08', owned: JSON.parse(j) }).catch(fail); }
function removeBinder(id) { if (!editor) return; delete pushed['binders/' + id]; if (remote.books) remote.books = remote.books.filter(b => b.id !== id); db.doc('binders/' + id).delete().catch(fail); }

let key = null; try { key = localStorage.getItem('pkc.editKey'); } catch (e) {}
if (key) {
  auth.signInAnonymously().then(async cred => {
    const ref = db.doc('devices/' + cred.user.uid);
    let snap = null; try { snap = await ref.get(); } catch (e) {}
    if (!snap || !snap.exists) await ref.set({ k: key, at: new Date().toISOString(), device: navigator.userAgent.slice(0, 90) });
    editor = true; K().setEditor(true);
  }).catch(() => { try { localStorage.removeItem('pkc.editKey'); } catch (e) {} K().toast('That edit link didn’t work. Ask Claude for a fresh one.', '#DC2626'); });
}
window.PKCloud = { push, pushOP, removeBinder, get editor() { return editor; } };
})();
