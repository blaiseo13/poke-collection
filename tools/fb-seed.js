// Copies binders + box from a Pokédex Binder dump into Firebase (Firestore REST).
// Usage: node tools/fb-seed.js <dump folder with books/*.json and box/main.json>
// Signs up an anonymous device, registers it with the private edit key (read from private/edit-key.txt, never printed),
// then writes binders/<id>, box/main and prefs/main in one commit. Prints counts only.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'private', 'firebase-config.json'), 'utf8'));
const key = fs.readFileSync(path.join(root, 'private', 'edit-key.txt'), 'utf8').trim();
const dump = process.argv[2];
const P = cfg.projectId, BASE = `https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents`;

const val = v => v === null || v === undefined ? { nullValue: null }
  : typeof v === 'boolean' ? { booleanValue: v }
  : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v })
  : typeof v === 'string' ? { stringValue: v }
  : Array.isArray(v) ? { arrayValue: { values: v.map(val) } }
  : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } };
const fields = o => Object.fromEntries(Object.entries(o).map(([k, x]) => [k, val(x)]));

(async () => {
  const su = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${cfg.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) })).json();
  if (!su.idToken) { console.error('anonymous sign-up failed:', su.error && su.error.message); process.exit(1); }
  const H = { Authorization: 'Bearer ' + su.idToken, 'Content-Type': 'application/json' };
  const reg = await fetch(`${BASE}/devices?documentId=${su.localId}`, { method: 'POST', headers: H, body: JSON.stringify({ fields: fields({ k: key, note: 'seed script' }) }) });
  console.log('register device:', reg.status);
  if (reg.status !== 200) { console.error((await reg.text()).slice(0, 200)); process.exit(1); }

  const books = fs.readdirSync(path.join(dump, 'books')).filter(f => f.endsWith('.json')).map(f => [f.slice(0, -5), JSON.parse(fs.readFileSync(path.join(dump, 'books', f), 'utf8'))]);
  const boxFile = path.join(dump, 'box', 'main.json');
  const box = fs.existsSync(boxFile) ? JSON.parse(fs.readFileSync(boxFile, 'utf8')).items || [] : [];
  const writes = books.map(([id, b]) => ({ update: { name: `projects/${P}/databases/(default)/documents/binders/${id}`, fields: fields({ name: b.name, createdAt: b.createdAt || '', owned: b.owned || {}, toFile: b.toFile || [], want: b.want || [] }) } }));
  writes.push({ update: { name: `projects/${P}/databases/(default)/documents/box/main`, fields: fields({ items: box }) } });
  writes.push({ update: { name: `projects/${P}/databases/(default)/documents/prefs/main`, fields: fields({ favs: [] }) } });
  const c = await fetch(`https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents:commit`, { method: 'POST', headers: H, body: JSON.stringify({ writes }) });
  console.log('commit:', c.status, '| binders', books.map(([id, b]) => `${b.name} (${Object.keys(b.owned || {}).length})`).join(', '), '| box', box.length);
  if (c.status !== 200) console.error((await c.text()).slice(0, 300));
})();
