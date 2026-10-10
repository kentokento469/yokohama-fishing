// ゲームをヘッドレス Chromium で起動して、主な遊び方が壊れていないか確かめる（npm run smoke）。
// 各シナリオの出力に期待する文字列があるかと、JavaScript のエラーが出ていないかを見る。失敗の時だけ詳しく出す。
import {execFileSync} from 'child_process';import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'../..');
const CASES=[
  ['s27','車の走行・道路・ルート・セーブ',[/"saveload":\{"same":true/,/"onRoad":true/]],
  ['s29','湘南：車で来て駐車→歩いて釣る',[/"parked":true/,/sabiki \{/]],
  ['s31','横浜（本牧）：ルアーでアタリ',[/bite:/]],
  ['s33','湘南：地図の釣り場情報',[/closed true/]],
  ['s53','古いセーブの移行（mapv 3）',[/"mapv":3/,/"walk":true/]],
  ['lookup','見上げ（約30°・ランドマークタワー）',[/"elev":(2[5-9]|3[0-5])/]],
  ['lookup_low','軽量画質でも空が描かれる',[/"top":\[(\d{2,3}),(\d{2,3}),(1[3-9]\d|2\d\d)/]],
  ['kanto','関東（横須賀・箱根）を散策：地形・陸・チャンク',[/kanto_yokosuka {"rg":"kanto","land":true,"gy":([4-9]|[1-3]\d)\./,/kanto_hakone {"rg":"kanto","land":true,"gy":(8\d|9\d|1[0-3]\d)\./,/0pending/,/kanto_bridge \{"walk":true,"water":true,"dy":0(\.[0-4]\d*)?[,}]/]],
  ['s60','横浜の6釣り場で投げられる',[/\["kanazawa",[^\]]*"kanazawa","kanazawa"\]/,/\["honmoku",[^\]]*"honmoku","honmoku"\]/]]];
const only=process.argv.slice(2);let fail=0;
for(const[id,name,want]of CASES){if(only.length&&!only.includes(id))continue;let out='';
  try{out=execFileSync('node',[path.join(ROOT,'tools/smoke/run.mjs')],{env:{...process.env,SCRIPT:path.join(ROOT,'tools/smoke/scenarios',id+'.mjs')},encoding:'utf8',timeout:300000,stdio:['ignore','pipe','pipe']});}catch(e){out=(e.stdout||'')+(e.stderr||'')+String(e.message);}
  const ok=want.every(r=>r.test(out))&&!/(TypeError|ReferenceError|SyntaxError):/.test(out);
  console.log(`${ok?'OK  ':'FAIL'} ${id} ${name}`);if(!ok){fail++;console.log(out.split('\n').filter(l=>!/^\[info\]|ERR_FAILED|404/.test(l)).slice(-15).join('\n'));}}
process.exit(fail?1:0);
