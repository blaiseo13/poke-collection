// Saves the confirmed binder-scan cards into Firebase binder b1 ("Blaise: Gen 1-3").
// usage: node tools/apply-scan.js            -> dry run, counts only
//        node tools/apply-scan.js --write    -> backup + write
// Rules: only scan rows he confirmed (status ok, or "species" = Pokémon counted with no exact card);
// best form per Pokémon; never lowers a recorded form; fills in the exact card; scanned Pokémon move into the binder (off toFile);
// writes ONLY owned + toFile (updateMask) and only if b1 hasn't changed since it was read (updateTime precondition).
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'private', 'firebase-config.json'), 'utf8'));
const P = cfg.projectId, DOC = `projects/${P}/databases/(default)/documents/binders/b1`, URL = `https://firestore.googleapis.com/v1/${DOC}`;
const WRITE = process.argv.includes('--write');
const dec = v => v == null ? null : 'stringValue' in v ? v.stringValue : 'integerValue' in v ? +v.integerValue : 'doubleValue' in v ? v.doubleValue : 'nullValue' in v ? null : 'booleanValue' in v ? v.booleanValue : 'arrayValue' in v ? (v.arrayValue.values || []).map(dec) : 'mapValue' in v ? Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, dec(x)])) : null;
const val = v => v === null || v === undefined ? { nullValue: null } : typeof v === 'number' ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === 'string' ? { stringValue: v } : Array.isArray(v) ? { arrayValue: { values: v.map(val) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, val(x)])) } };
(async () => {
  const doc = await (await fetch(URL)).json(); if (!doc.fields) { console.error('could not read b1'); process.exit(1); }
  const owned = dec(doc.fields.owned) || {}, toFile = new Set((dec(doc.fields.toFile) || []).map(Number));
  const M = JSON.parse(fs.readFileSync(path.join(root, 'private', 'scan-match.json'), 'utf8'));
  const best = {}; M.filter(o => o.dex && ((o.status === 'ok' && o.card) || o.status === 'species')).forEach(o => { const b = best[o.dex]; if (!b || o.form > b.form || (o.form === b.form && !b.card && o.card)) best[o.dex] = o; });
  const N = JSON.parse(JSON.stringify(owned)), c = { added: 0, upgraded: 0, exact: 0, keptHigher: 0, intoBinder: 0, rows: M.filter(o => (o.status === 'ok' && o.card) || o.status === 'species').length };
  Object.values(best).forEach(o => { const k = String(o.dex), cur = N[k];
    if (!cur) { N[k] = [o.form, o.card || null]; c.added++; }
    else if (o.form > (cur[0] || 0)) { N[k] = [o.form, o.card || null]; c.upgraded++; }
    else if (o.form === (cur[0] || 0)) { if (o.card && cur[1] !== o.card) { N[k] = [cur[0], o.card]; c.exact++; } }
    else c.keptHigher++;
    if (toFile.delete(o.dex)) c.intoBinder++; });
  console.log(JSON.stringify({ confirmedRows: c.rows, pokemon: Object.keys(best).length, ownedBefore: Object.keys(owned).length, ownedAfter: Object.keys(N).length, added: c.added, upgraded: c.upgraded, exactPrintingSet: c.exact, keptHigherRecordedForm: c.keptHigher, movedIntoBinder: c.intoBinder, toFileAfter: toFile.size }));
  if (!WRITE) return;
  const ts = new Date().toISOString().replace(/[:.]/g, '-'); fs.writeFileSync(path.join(root, 'private', `binder-b1-before-${ts}.json`), JSON.stringify(doc, null, 1));
  const key = fs.readFileSync(path.join(root, 'private', 'edit-key.txt'), 'utf8').trim();
  const su = await (await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${cfg.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) })).json();
  if (!su.idToken) { console.error('sign-in failed'); process.exit(1); }
  const H = { Authorization: 'Bearer ' + su.idToken, 'Content-Type': 'application/json' };
  const reg = await fetch(`https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents/devices?documentId=${su.localId}`, { method: 'POST', headers: H, body: JSON.stringify({ fields: { k: val(key), note: val('binder scan import 11/08/26') } }) });
  if (reg.status !== 200) { console.error('device register failed', reg.status); process.exit(1); }
  const body = { writes: [{ update: { name: DOC, fields: { owned: val(N), toFile: val([...toFile].sort((a, b) => a - b)) } }, updateMask: { fieldPaths: ['owned', 'toFile'] }, currentDocument: { updateTime: doc.updateTime } }] };
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${P}/databases/(default)/documents:commit`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  console.log('write:', r.status, r.status === 200 ? 'saved' : (await r.text()).slice(0, 200));
})();
