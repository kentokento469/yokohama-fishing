// 魚種のマスターデータを作る： node tools/fish/build_species.mjs
// 入力：tools/fish/species_rows.txt（新しい魚種）、tools/fish/existing_extra.txt（既存36種の追加情報）、index.html の FISH（既存の値）、fishing-sim.js（適水温・泳層）
// 出力：data/fish/species.json（マスター。外部JSON）と data/fish/species.js（ブラウザ用。window.HamaFishData）
// 検査：id の重複、学名・生息・季節・体長などの欠け、数値の範囲。問題があれば失敗する。
import fs from 'fs';import path from 'path';import {createRequire} from 'module';
const require=createRequire(import.meta.url);const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
const SIM=require(path.join(root,'fishing-sim.js'));
const rd=f=>fs.readFileSync(path.join(root,f),'utf8').split('\n').filter(l=>l.trim()&&!l.startsWith('#')).map(l=>l.split('|'));
// 既存の FISH を index.html から取り出す（MO だけ定義して評価）
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');const a=html.indexOf('const FISH={'),b=html.indexOf('\n};',a);
const MO=(...r)=>{const s=new Array(13).fill(0);for(const[x,y]of r){let m=x;for(let k=0;k<12;k++){s[m]=1;if(m===y)break;m=m%12+1;}}return s;};
const ALL=MO([1,12]);const FISH=new Function('MO','ALL','return '+html.slice(a+11,b+2))(MO,ALL);
const HAB={b:'bay',p:'port',w:'breakwater',i:'iso',s:'beach',e:'estuary',u:'upstream',m:'midstream',l:'lower',k:'lake'};
const SEA_HAB=['bay','port','breakwater','iso','beach','estuary'];
const CLS={f:'fish',c:'cephalopod',k:'crustacean'};
const RAR={c:'common',u:'uncommon',r:'rare',vr:'very_rare',l:'legendary'};
const FLAGS={poison:['kusafugu','shousaifugu','higanfugu','komonfugu','hakofugu'],venom:['gonzui','akaei','haokoze','aigo','kasago'],
  invasive:['largemouth','smallmouth','bluegill','channelcat','kamuruchi','browntrout','bitterling','hasu','nijimasu'],
  specified_invasive:['largemouth','smallmouth','bluegill','channelcat'],endangered:['unagi']};
const hab=s=>{const o={};for(const k of Object.values(HAB))o[k]=0;for(const m of s.matchAll(/([a-z])(\d)/g))o[HAB[m[1]]]=+m[2];return o;};
const rng=s=>s.split('-').map(Number);
const months=s=>{if(s==='all')return{peak:MO([1,12]),strict:false};const st=s.endsWith('!');const[x,y]=rng(s.replace('!',''));return{peak:MO([x,y]),strict:st};};
const look=s=>{const[shape,asp,back,belly,pat]=s.split('/');return{shape,aspect:+asp,back,belly,pattern:pat};};
const ai=s=>{const[style,beh]=s.split(':');return{style,beh:beh||null};};
const flags=id=>Object.fromEntries(Object.entries(FLAGS).filter(([k,v])=>v.includes(id)).map(([k])=>[k,true]));
const out=[];
// 既存36種
for(const r of rd('tools/fish/existing_extra.txt')){const[id,sci,cls,grp,h,dep,bot,tide,spd,wary,pow,fight,rar,max]=r;const f=FISH[id];if(!f)throw new Error('既存にない id '+id);
  const L=f.L;out.push({id,ja:f.n,sci,cls:CLS[cls],group:grp,existing:true,hab:hab(h),depth:rng(dep),bottom:bot==='any'?[]:bot.split(','),
    months:{peak:f.mo,strict:false},time:f.tm,tide,temp:SIM.TEMP_PREF[id]||null,methods:f.bait.slice(),size:{min:L[0],max:L[1],avg:Math.round((L[0]+(L[1]-L[0])*.36)*10)/10,record:+max},
    a:f.a,speed:+spd,wary:+wary,power:+pow,fight,rarity:RAR[rar],price:f.kg,layer:SIM.LAYER?SIM.LAYER[id]||'mid':'mid',ai:{style:SIM.styleOf(id),beh:null},
    look:Object.assign({shape:f.sh.shape||'fish',aspect:f.sh.a,back:f.sh.bk,belly:f.sh.bl,pattern:f.sh.pat},f.sh.shape?{}:{}),desc:f.d,
    flags:Object.assign(flags(id),f.poison?{poison:true}:{},f.venom?{venom:true}:{}),traits:{blue:!!f.blue,rock:!!f.rock,near:!!f.near,far:!!f.far},unit:f.unit||null});}
// 新しい魚種
for(const r of rd('tools/fish/species_rows.txt')){if(r.length!==26)throw new Error(`列の数が違う（${r.length}）：${r[0]}`);
  const[id,ja,sci,cls,grp,h,dep,bot,mo,tm,tide,temp,meth,L,max,aa,spd,wary,pow,fight,rar,yen,layer,aist,lk,desc]=r;const[l0,l1]=rng(L);
  out.push({id,ja,sci,cls:CLS[cls],group:grp,existing:false,hab:hab(h),depth:rng(dep),bottom:bot==='any'?[]:bot.split(','),months:months(mo),time:tm,tide,temp:rng(temp),
    methods:meth.split(','),size:{min:l0,max:l1,avg:Math.round((l0+(l1-l0)*.36)*10)/10,record:+max},a:+aa,speed:+spd,wary:+wary,power:+pow,fight,rarity:RAR[rar],price:+yen,
    layer,ai:ai(aist),look:look(lk),desc,flags:flags(id),traits:{blue:grp==='mig',rock:grp==='rock',near:false,far:false},unit:cls==='k'?'体長':null});}
// 検査
const ids=new Set(),err=[];const METH=['sabiki','isome','lure','egi','worm'];
for(const s of out){if(ids.has(s.id))err.push('重複 '+s.id);ids.add(s.id);
  if(!s.sci||!s.ja)err.push('名前 '+s.id);if(!(s.size.min>0&&s.size.max>=s.size.min&&s.size.record>=s.size.max*.9))err.push('体長 '+s.id);
  if(!(s.a>0&&s.a<.1))err.push('重さ係数 '+s.id);if(!s.methods.every(m=>METH.includes(m)))err.push('釣り方 '+s.id);if(!s.months.peak.some(Boolean))err.push('季節 '+s.id);
  if(!Object.values(s.hab).some(v=>v>0))err.push('生息 '+s.id);if(!['run','dive','shake','heavy','circle','jet','stick','twist','weak'].includes(s.fight))err.push('ファイト '+s.id);
  if(!Object.values(RAR).includes(s.rarity))err.push('レア度 '+s.id);s.catchable=SEA_HAB.some(k=>s.hab[k]>0);}
if(err.length){console.error(err.join('\n'));process.exit(1);}
const meta={version:1,count:out.length,generated:new Date().toISOString().slice(0,10),
  note:'学名・分布は一般的な資料にもとづくおおよそ。能力値（速さ・警戒心・引き・レア度・価格）はゲーム用の推定。釣り可否・規制は現地の情報を優先。',
  habitats:HAB,catchable_habitats:SEA_HAB,fields:'id,ja,sci,cls,group,hab,depth,bottom,months{peak[13],strict},time,tide,temp,methods,size{min,max,avg,record},a(g=a*cm^3),speed,wary,power,fight,rarity,price(円/kg),layer,ai,look,desc,flags,traits'};
fs.mkdirSync(path.join(root,'data/fish'),{recursive:true});
fs.writeFileSync(path.join(root,'data/fish/species.json'),'{"meta":'+JSON.stringify(meta)+',\n"species":[\n'+out.map(s=>JSON.stringify(s)).join(',\n')+'\n]}\n');
fs.writeFileSync(path.join(root,'data/fish/species.js'),`/* 自動生成：tools/fish/build_species.mjs（元：data/fish/species.json）。直接編集しない */\n(function(root){const D=${JSON.stringify({meta,species:out})};if(typeof module!=='undefined'&&module.exports)module.exports=D;else root.HamaFishData=D;})(typeof self!=='undefined'?self:this);\n`);
const by=k=>Object.entries(out.reduce((o,s)=>(o[s[k]]=(o[s[k]]||0)+1,o),{})).map(([a,b])=>a+':'+b).join(' ');
console.log(`魚種 ${out.length}（既存 ${out.filter(s=>s.existing).length}・新規 ${out.filter(s=>!s.existing).length}）・海や河口で釣れる ${out.filter(s=>s.catchable).length}`);
console.log('分類',by('cls'));console.log('レア度',by('rarity'));
