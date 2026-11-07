// Map every PokemonTCG card to its TCGdex card id (for fresh prices). Writes tdmap.json.
const fs=require('fs'),path=require('path');
const [src,tdSetsFile,out]=process.argv.slice(2);
const td=JSON.parse(fs.readFileSync(tdSetsFile));const ours=JSON.parse(fs.readFileSync(path.join(src,'sets/en.json')));
const n=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');const byName={};td.forEach(s=>byName[n(s.name)]=s.id);
const manual={base1:'base1',hgss2:'hgss2',hgss3:'hgss3',hgss4:'hgss4',fut20:'fut2020',svp:'svp',sve:'sve',me55c:'30th-c'};
const norm=x=>String(x).toUpperCase().replace(/\d+/g,d=>String(+d));
(async()=>{const map={},stats={sets:0,cards:0,hit:0,missSets:[]};
 for(const o of ours){const tid=manual[o.id]||byName[n(o.name)];if(!tid){stats.missSets.push(o.id);continue}
  let j;for(let a=0;a<4&&!j;a++){try{const r=await fetch('https://api.tcgdex.net/v2/en/sets/'+encodeURIComponent(tid));if(r.ok)j=await r.json()}catch(e){}}
  if(!j){stats.missSets.push(o.id+'(fetch)');continue}stats.sets++;
  const local={};(j.cards||[]).forEach(c=>local[norm(c.localId)]=c.id);
  const cards=JSON.parse(fs.readFileSync(path.join(src,'cards/en',o.id+'.json')));
  for(const c of cards){if(c.supertype!=='Pokémon')continue;stats.cards++;const hit=local[norm(c.number)];if(hit){map[o.id+'|'+c.number]=hit;stats.hit++}}
 }
 fs.writeFileSync(out,JSON.stringify(map));console.log(stats);})();
