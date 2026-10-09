const test=require('node:test'),assert=require('node:assert');const TR=require('../terrain.js');
test('標高タイルの色→高さ',()=>{assert.strictEqual(TR.decodePx(0,0,100),1);assert.strictEqual(TR.decodePx(128,0,0),null);
  assert.ok(Math.abs(TR.decodePx(255,255,156)-(-1))<1e-9);assert.ok(Math.abs(TR.decodePx(0,14,16)-36)<1e-9);});
test('格子から緯度経度で高さ（補間・範囲外・無効）',()=>{const z=15,lat=35.41,lon=139.67;const x0=Math.floor(TR.lon2x(lon,z)),y0=Math.floor(TR.lat2y(lat,z));
  const px=4,W=px,data=new Int16Array(W*px);for(let j=0;j<px;j++)for(let i=0;i<px;i++)data[j*W+i]=i*10;data[0]=-32768;
  const g=TR.grid({z,x0,y0,w:1,h:1,px,scale:.1},data);assert.ok(g.covers(lat,lon));
  const h=g.heightAt(lat,lon);assert.ok(h>=0&&h<=3,'h='+h);assert.strictEqual(g.covers(35.0,139.0),false);
  assert.strictEqual(TR.heightAt(lat,lon),null);TR.add(g);assert.ok(TR.heightAt(lat,lon)!=null);});
