// Builds data/sync.js (the laptop page's copy of the phone page's binders + box).
// Usage: node tools/make-sync.js <dump folder holding books/*.json and box/main.json>
// The dump comes from reading the phone artifact's database (ArtifactData list/get with out_dir).
const fs = require('fs'), path = require('path');
const dump = process.argv[2];
if (!dump) { console.error('Pass the dump folder'); process.exit(1); }
const bdir = path.join(dump, 'books');
const books = fs.readdirSync(bdir).filter(f => f.endsWith('.json')).map(f => {
  const j = JSON.parse(fs.readFileSync(path.join(bdir, f), 'utf8'));
  return { id: f.replace(/\.json$/, ''), name: j.name, createdAt: j.createdAt || '', owned: j.owned || {}, toFile: j.toFile || [], want: j.want || [] };
}).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
const boxFile = path.join(dump, 'box', 'main.json');
const box = fs.existsSync(boxFile) ? (JSON.parse(fs.readFileSync(boxFile, 'utf8')).items || []) : [];
const syncedAt = new Date().toISOString();
const out = path.join(__dirname, '..', 'data', 'sync.js');
fs.writeFileSync(out, `// Copy of the phone page's binders, made by Claude ${syncedAt}. Do not edit by hand.\nwindow.PK_SYNC = ${JSON.stringify({ syncedAt, books, box })};\n`);
console.log('binders', books.map(b => `${b.name} (${Object.keys(b.owned).length})`).join(', '), '| box', box.length, '| wrote', out);
