const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
global.HamaTiles=require('../tiles.js');
const G=require('../gsi.js'),K=require('../kanto.js'),GEO=require('../geo.js');
const FX=path.join(__dirname,'fixtures/gsi');
const fakeFetch=async url=>{const p=path.join(FX,url.replace(G.BASE,''));if(!fs.existsSync(p))return{ok:false,status:404};const b=fs.readFileSync(p);return{ok:true,status:200,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length)};};
const mk=()=>{const g=G.create({fetch:fakeFetch,decodePng:G.nodeDecodePng,gunzip:u=>require('zlib').gunzipSync(u),persist:false,tiles:global.HamaTiles});
  return K.create({gsi:g,geo:GEO,lon2tx:G.lon2tx,lat2ty:G.lat2ty,tx2lon:G.tx2lon,ty2lat:G.ty2lat});};
test('枠で切る：多角形と線',()=>{const r=K.clipPoly([[-10,-10],[50,-10],[50,50],[-10,50]],40);assert.ok(r.every(p=>p[0]>=0&&p[0]<=40&&p[1]>=0&&p[1]<=40));
  const l=K.clipLine([[-10,5],[20,5],[50,5]],40);assert.strictEqual(l.length,1);assert.deepStrictEqual(l[0][0],[0,5]);assert.deepStrictEqual(l[0][l[0].length-1],[40,5]);});
test('山手の丘：読み込み前は不明、読み込み後は高さと陸',async()=>{const k=mk();const[x,y]=GEO.toGame(35.437,139.651);
  assert.strictEqual(k.groundY(x,y),null);assert.ok(!k.ready(x-20,y-20,x+20,y+20));
  await k.load(x-20,y-20,x+20,y+20);assert.ok(k.ready(x-20,y-20,x+20,y+20));const g=k.groundY(x,y);assert.ok(g>8&&g<80,'g='+g);assert.ok(k.isLand(x,y));
  // 格子の点ではちょうどその点の高さ
  const n=k.node(Math.round(x/10),Math.round(y/10));assert.ok(Math.abs(k.groundY(Math.round(x/10)*10,Math.round(y/10)*10)-n.y)<1e-9);});
test('地物：建物・道路がゲーム座標で範囲の近く',async()=>{const k=mk();const[x,y]=GEO.toGame(35.437,139.651);await k.load(x-100,y-100,x+100,y+100);
  const f=k.featuresIn(x-100,y-100,x+100,y+100);assert.ok(f.blds.length>5,'blds '+f.blds.length);assert.ok(f.roads.length>3);
  for(const b of f.blds){assert.ok(b.p.length>=6);const cx=(b.x0+b.x1)/2;assert.ok(Math.abs(cx-x)<=100);}
  for(const r of f.roads)assert.ok(r.w>=2&&r.w<=40&&r.a.length>=4);});
test('地名：近くの町名（施設名は除く）',async()=>{const k=mk();const[x,y]=GEO.toGame(35.437,139.651);await k.load(x-50,y-50,x+50,y+50);const n=k.nameNear(x,y);assert.ok(n&&!/学校|大学/.test(n),'n='+n);});
