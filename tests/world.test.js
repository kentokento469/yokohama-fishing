const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const HW=require('../world.js'),D=require('../data/world/yokohama-base.js');
const W=HW.create(D,{readFile:f=>fs.readFileSync(path.join(__dirname,'..',f)),base:'data/world/yokohama-bld/'});
test('陸と海（横浜駅・本牧ふ頭・海づり桟橋は陸、湾の中は海）',()=>{
  assert.ok(W.isLand(7860,-5086),'横浜駅');assert.ok(W.isLand(12856,-1106),'本牧ふ頭');assert.ok(W.isLand(13965,-972),'本牧海づり施設の桟橋');
  assert.ok(!W.isLand(12000,-3000),'本牧と大黒の間の海');assert.ok(!W.isLand(15000,0),'沖');assert.ok(!W.isLand(0,0),'範囲外');});
test('水際：桟橋の近くは近い、街の中は遠い',()=>{const c=W.nearestCoast(13965,-972,60);assert.ok(c&&c.d<10);assert.ok(!W.isLand(c.x+c.nx*5,c.y+c.ny*5),'海側を向く');
  assert.ok(W.coastDist(7860,-5086,100)>=100||W.coastDist(7860,-5086,100)===Infinity);});
test('道路：横浜駅前に道路、道路の上は車が通れる',()=>{assert.ok(W.roadsIn(7700,-5200,8000,-4900).length>10);const r=W.nearestRoad(7860,-5086,200);assert.ok(r&&r.d<100);
  const at=W.roadAt(r.x,r.y);assert.ok(at&&at.w>0);});
test('地名：駅と名所',()=>{assert.ok(W.findName('横浜駅',422).length);assert.ok(W.findName('三溪園').length);});
test('建物：区画を読み込める',async()=>{const[i,j]=W.cellOf(7860,-5086);const b=await W.loadCell(i,j);assert.ok(b.length>50);assert.ok(b[0].p.length>=6);});
test('複数の地域をまとめる（combine）：点は含む地域へ、範囲は合わせて',()=>{
  // 2つ目の地域：横浜のデータを東へ 50km ずらしたもの（テスト用）
  const D2=Object.assign({},D,{name:'test2',bbox:[D.bbox[0]+50000,D.bbox[1],D.bbox[2]+50000,D.bbox[3]],land:[],roads:[],rails:[],names:[],breakwaters:[],structs:[]});
  const W2=HW.create(D2,{readFile:()=>null});const C=HW.combine([W,W2]);
  assert.ok(C.isLand(7860,-5086)&&C.inBox(7860,-5086));assert.ok(C.inBox(57860,-5086)&&!C.isLand(57860,-5086));assert.ok(!C.inBox(30000,-5086));
  assert.strictEqual(C.at(57860,-5086),W2);assert.strictEqual(C.at(7860,-5086),W);
  assert.ok(C.roadsIn(7700,-5200,8000,-4900).length===W.roadsIn(7700,-5200,8000,-4900).length);
  assert.ok(C.onBoxEdge([D2.bbox[0],0,D2.bbox[0],10]));assert.ok(!C.onBoxEdge([1,2,3,4]));
  assert.strictEqual(C.rings.length,W.rings.length);
  const one=HW.combine([W]);assert.strictEqual(one,W);assert.ok(one.at(7860,-5086)===W);});
