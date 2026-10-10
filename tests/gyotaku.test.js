const test=require('node:test'),assert=require('node:assert');
const G=require('../gyotaku.js');
test('記録：自己記録の判定と、売っても残る記録',()=>{const S={};const a=G.record(S,{id:'aji',name:'マアジ',cm:20,kg:.1});assert.ok(a.best);const b=G.record(S,{id:'aji',name:'マアジ',cm:18,kg:.08});assert.ok(!b.best);
  const c=G.record(S,{id:'aji',name:'マアジ',cm:25,kg:.2});assert.ok(c.best);assert.ok(!S.gyotaku[0].best,'前の記録は自己記録でなくなる');assert.strictEqual(G.list(S)[0].cm,25);});
test('上限を超えたら古い記録から消す（自己記録は残す）',()=>{const S={};G.record(S,{id:'x',cm:99,kg:1});for(let i=0;i<G.MAX+5;i++)G.record(S,{id:'y',cm:1,kg:.01});assert.ok(S.gyotaku.length<=G.MAX);assert.ok(S.gyotaku.some(g=>g.id==='x'&&g.best));});
test('輪郭の関数は 0〜1 で正の値',()=>{for(const k in G.PROF)for(let u=0;u<=1;u+=.05){const v=G.PROF[k](u);assert.ok(v>0&&v<=1.01,k+' '+u);}});
