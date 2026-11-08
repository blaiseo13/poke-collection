// Bumps the site version: every ?v=N in index.html -> N+1, the self-update check's version, and version.txt.
// Run before every push (replaces bumping ?v by hand). The page fetches version.txt (no cache) on open,
// when it comes back on screen, and every 5 min; if the live site is newer it reloads itself
// (keeping ?edit=KEY and the #tab), so the iPhone home-screen app never sticks on an old build.
const fs = require('fs'), path = require('path');
const p = path.join(__dirname, '..', 'index.html'); let h = fs.readFileSync(p, 'utf8');
const cur = Math.max(...[...h.matchAll(/\?v=(\d+)/g)].map(m => +m[1])), next = cur + 1;
h = h.split(`?v=${cur}`).join(`?v=${next}`);
const CHECK = `<script id="stayfresh">/* stay fresh: reload when a newer build is on the site */(function(){var V='${next}';function chk(){try{fetch('version.txt?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.text():''}).then(function(t){t=(t||'').trim();if(!t||t===V)return;var u=new URL(location.href);if(u.searchParams.get('v')===t)return;u.searchParams.set('v',t);location.replace(u.toString())}).catch(function(){})}catch(e){}}chk();document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')chk()});setInterval(chk,300000)})();</script>`;
if (/<script id="stayfresh">[\s\S]*?<\/script>/.test(h)) h = h.replace(/<script id="stayfresh">[\s\S]*?<\/script>/, CHECK);
else h = h.replace('</title>', '</title>\n' + CHECK);
fs.writeFileSync(p, h); fs.writeFileSync(path.join(__dirname, '..', 'version.txt'), String(next));
console.log('version', cur, '->', next);
