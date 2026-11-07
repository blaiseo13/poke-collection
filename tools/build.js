const fs=require('fs'),path=require('path');
const [src,speciesFile,out,tdFile]=process.argv.slice(2);
const TD=tdFile?JSON.parse(fs.readFileSync(tdFile)):{};const tdSet={};Object.entries(TD).forEach(([k,v])=>{const s=k.split('|')[0];if(!tdSet[s])tdSet[s]=v.slice(0,v.lastIndexOf('-'))});
const sets=JSON.parse(fs.readFileSync(path.join(src,'sets/en.json')));
const setIdx={};const S=sets.map((s,i)=>{setIdx[s.id]=i;return [s.id,s.name,s.series,s.releaseDate.replace(/\//g,'-'),tdSet[s.id]||'']});
const RAR={};const R=[];const ri=r=>{r=r||'Common';if(!(r in RAR)){RAR[r]=R.length;R.push(r)}return RAR[r]};
const TYPES=['Grass','Fire','Water','Lightning','Psychic','Fighting','Darkness','Metal','Fairy','Dragon','Colorless'];
const C=[];const byDex={};let badImg=0;
for(const f of fs.readdirSync(path.join(src,'cards/en'))){const sid=f.replace('.json','');
 for(const c of JSON.parse(fs.readFileSync(path.join(src,'cards/en',f)))){
  if(c.supertype!=='Pokémon'||!c.nationalPokedexNumbers)continue;
  const exp=`https://images.pokemontcg.io/${sid}/${c.number}.png`;
  const img=c.images.small===exp?'':c.images.small.replace('https://images.pokemontcg.io/','');
  if(img)badImg++;
  const t=TYPES.indexOf((c.types||['Colorless'])[0]);
  const st=(c.subtypes||[]);const stage=st.includes('Basic')||st.includes('Baby')?0:st.includes('Stage 1')?1:st.includes('Stage 2')?2:3;
  C.push([sid===c.id.split('-')[0]?'':c.id,c.name,ri(c.rarity),setIdx[sid]??-1,c.number,img,c.nationalPokedexNumbers,t<0?10:t,c.artist||'',sid,parseInt(c.hp)||0,stage,(()=>{const m=TD[sid+'|'+c.number];return !m?-1:m===tdSet[sid]+'-'+c.number?0:m})()]);
 }}
// species names
const sp=JSON.parse(fs.readFileSync(speciesFile)).results;
const fix={'nidoran-f':'Nidoran♀','nidoran-m':'Nidoran♂','mr-mime':'Mr. Mime','mime-jr':'Mime Jr.','mr-rime':'Mr. Rime','farfetchd':"Farfetch'd",'sirfetchd':"Sirfetch'd",'ho-oh':'Ho-Oh','porygon-z':'Porygon-Z','type-null':'Type: Null','jangmo-o':'Jangmo-o','hakamo-o':'Hakamo-o','kommo-o':'Kommo-o','flabebe':'Flabébé','tapu-koko':'Tapu Koko','tapu-lele':'Tapu Lele','tapu-bulu':'Tapu Bulu','tapu-fini':'Tapu Fini','chi-yu':'Chi-Yu','chien-pao':'Chien-Pao','ting-lu':'Ting-Lu','wo-chien':'Wo-Chien'};
const names=sp.map(s=>fix[s.name]||s.name.split('-').map(w=>w[0].toUpperCase()+w.slice(1)).join(' '));
const out1=`// Built ${new Date().toISOString().slice(0,10)} from PokemonTCG/pokemon-tcg-data + PokeAPI species list\nwindow.PKDATA=${JSON.stringify({sets:S,rarities:R,types:TYPES,names,cards:C.map(c=>{const [id,n,r,s,num,img,dex,t,a,sid,hp,stage,td]=c;return [id||0,n,r,s,num,img||0,dex.length===1?dex[0]:dex,t,a,hp,stage,td]})})};\n`;
fs.writeFileSync(out,out1);
console.log('cards',C.length,'sets',S.length,'rarities',R.length,'species',names.length,'custom img',badImg,'bytes',out1.length);
const dexes=new Set();C.forEach(c=>c[6].forEach(d=>dexes.add(d)));const miss=[];for(let i=1;i<=names.length;i++)if(!dexes.has(i))miss.push(i);console.log('species without cards',miss.length,miss.slice(0,40).join(','));
