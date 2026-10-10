const test=require('node:test'),assert=require('node:assert');
global.THREE=require('three');
const F=require('../fish3d.js');const sp=require('../data/fish/species.json').species;
test('全魚種の3Dモデルが作れる（形が壊れていない・長さは体長に合う）',()=>{const T=global.THREE;let n=0;
  for(const s of sp){const g=F.build(s.look,{L:.4,seed:3});const b=new T.Box3().setFromObject(g);assert.ok(isFinite(b.min.x)&&isFinite(b.max.y),s.id);const len=b.max.x-b.min.x;
    assert.ok(len>.25&&len<.7,s.id+' len='+len.toFixed(3));g.userData.setSwim(.1,9);g.userData.dispose();n++;}
  assert.strictEqual(n,sp.length);});
test('体形ごとに違う形（タイは体高が高く、ダツは細い）',()=>{const T=global.THREE;const box=id=>new T.Box3().setFromObject(F.build(sp.find(s=>s.id===id).look,{L:.4}));
  const madai=box('madai'),datsu=box('datsu');assert.ok((madai.max.y-madai.min.y)>(datsu.max.y-datsu.min.y)*2);});
