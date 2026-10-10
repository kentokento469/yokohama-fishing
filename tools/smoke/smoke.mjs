// ゲームをヘッドレス Chromium で起動して、主な遊び方が壊れていないか確かめる（npm run smoke）。
// 各シナリオの出力に期待する文字列があるかと、JavaScript のエラーが出ていないかを見る。失敗の時だけ詳しく出す。
import {execFileSync} from 'child_process';import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
const CASES=[
  ['s27','車の走行・道路・ルート・セーブ',[/"saveload":\{"same":true/,/"onRoad":true/]],
  ['s29','湘南：車で来て駐車→歩いて釣る',[/"parked":true/,/sabiki \{/]],
  ['s31','横浜（本牧）：ルアーでアタリ',[/bite:/]],
  ['s33','湘南：地図の釣り場情報',[/closed true/]],
  ['s53','古いセーブの移行（mapv 4）',[/"mapv":4/,/"walk":true/]],
  ['lookup','見上げ（約30°・ランドマークタワー）',[/"elev":(2[5-9]|3[0-5])/]],
  ['lookup_low','軽量画質でも空が描かれる',[/"top":\[(\d{2,3}),(\d{2,3}),(1[3-9]\d|2\d\d)/]],
  ['parity','横浜と湘南で同じ操作（歩く・釣り場・アタリ・購入・NPC・駅・地図・セーブ）',[/parity_yokohama_honmoku \{"walk":true[^\n]*"near":"honmoku"[^\n]*"bite":[1-9][^\n]*"travel":true,"npc":[1-9][^\n]*"saved":true/,/parity_shonan_shinko_south \{"walk":true[^\n]*"buy":true[^\n]*"near":"shinko_south"[^\n]*"bite":[1-9][^\n]*"travel":true,"npc":[1-9][^\n]*"mini":true,"wm":true,"saved":true/,/parity_shonan_katase_west \{"walk":true[^\n]*"surface":"sand"[^\n]*"bite":[1-9][^\n]*"travel":true,"npc":[1-9][^\n]*"saved":true/]],
  ['common','地域共通：ジャンプ・段差・持ち帰り→買取所で売る（横浜・湘南）',[/common_yokohama \{"jump":0\.[7-9]\d*,"landed":true,"kept":1,"near":true,"sellBtn":true,"sold":true,"gain":[1-9]/,/common_shonan \{"jump":0\.[7-9]\d*,"landed":true,"kept":1,"near":true,"sellBtn":true,"sold":true,"gain":[1-9]/,/common_step \{"tooHigh":true,"stepOk":true\}/]],
  ['kanto','関東（横須賀・箱根）を散策：地形・陸・チャンク',[/kanto_yokosuka {"rg":"kanto","land":true,"gy":([4-9]|[1-3]\d)\./,/kanto_hakone {"rg":"kanto","land":true,"gy":(8\d|9\d|1[0-3]\d)\./,/0pending/,/kanto_nostation \{"rg":"[a-z]+","paid":0\}/,/kanto_yokosuka [^\n]*"st":"[^"]*駅","std":\d{1,2}[,}]/,/kanto_hakone [^\n]*"st":"箱根湯本駅"/,/kanto_bridge \{"walk":true,"water":true,"dy":0(\.[0-4]\d*)?[,}]/]],
  ['p10','魚拓・生き餌（泳がせ）',[/p10 \{"gy":1,"best":true,"cv":[1-9]\d*,"noGear":0,"live":1,"liveCand":true,[^\n]*"back":2,"fish3d":true/,/p8 \{"cats":true,"det":true,"leader":true,"rough":true,"hooks":10\}/]],
  ['p11','魚市場アプリ・買取所・移動買取・地図',[/p11 \{"counts":\{"yokohama":([5-9]|\d\d),"shonan":(\d\d)[^\n]*"conf":true,"quoted":[1-9]\d*,"gain":[1-9]\d*,"once":true,"left":1,"favKept":true,"cmpRows":([5-9]|\d\d),"pts":([3-9]|\d\d),"rec":true,"npc":([4-9]|10),"vis":true,"mStats":2\}/,/p11map \{"orange":[1-9]\d+/]],
  ['s60','横浜の6釣り場で投げられる',[/\["kanazawa",[^\]]*"kanazawa","kanazawa"\]/,/\["honmoku",[^\]]*"honmoku","honmoku"\]/]]];
const only=process.argv.slice(2);let fail=0;
for(const[id,name,want]of CASES){if(only.length&&!only.includes(id))continue;let out='';
  try{out=execFileSync('node',[path.join(ROOT,'tools/smoke/run.mjs')],{env:{...process.env,SCRIPT:path.join(ROOT,'tools/smoke/scenarios',id+'.mjs')},encoding:'utf8',timeout:600000,stdio:['ignore','pipe','pipe']});}catch(e){out=(e.stdout||'')+(e.stderr||'')+String(e.message);}
  const ok=want.every(r=>r.test(out))&&!/(TypeError|ReferenceError|SyntaxError):/.test(out);
  console.log(`${ok?'OK  ':'FAIL'} ${id} ${name}`);if(!ok){fail++;console.log(out.split('\n').filter(l=>!/^\[info\]|ERR_FAILED|404/.test(l)).slice(-15).join('\n'));}}
process.exit(fail?1:0);
