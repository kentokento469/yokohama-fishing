// 魚の画像の検査：全魚種に画像があるか（無ければ data/fish/img/missing.json に理由つきで記録されているか）、
// 参照先のファイルがあり壊れていないか（WebP・AVIF の先頭の形式）、別の魚種に同じ写真を使い回していないか、出典・ライセンスがあるか。
// 新しい魚種を足して画像が無いと、ここで失敗する（tools/fish/fetch_images.py・fetch_inat.py・fetch_gbif.py で追加する）
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path');
const R=path.join(__dirname,'..');
const SP=JSON.parse(fs.readFileSync(path.join(R,'data/fish/species.json'),'utf8')).species;
const src=fs.readFileSync(path.join(R,'data/fish/images.js'),'utf8');const D=JSON.parse(src.match(/const D=(\{[\s\S]*?\});/)[1]);
const MP=path.join(R,'data/fish/img/missing.json');const MISSING=fs.existsSync(MP)?JSON.parse(fs.readFileSync(MP,'utf8')):{};
const OK_LIC=/^(CC0|CC BY(-SA)? \d\.\d|CC BY(-SA)?|パブリックドメイン|Public domain|PD)/i;
const kind=b=>b.slice(0,4).toString()==='RIFF'&&b.slice(8,12).toString()==='WEBP'?'webp':b.slice(4,12).toString().includes('ftypavi')?'avif':'?';
test('全魚種に画像がある（無い魚は理由つきで missing.json に）',()=>{const no=SP.filter(s=>!D[s.id]&&!MISSING[s.id]).map(s=>s.id);assert.deepStrictEqual(no,[],'画像も理由も無い魚種: '+no.join(','));
  for(const id in MISSING){assert.ok(SP.some(s=>s.id===id),'missing.json に存在しない魚種: '+id);assert.ok(!D[id],'画像があるのに missing.json にある: '+id);assert.ok(MISSING[id].reason,'理由が無い: '+id);}
  const rate=Object.keys(D).filter(k=>SP.some(s=>s.id===k)).length/SP.length;console.log(`# 画像あり ${Object.keys(D).length}/${SP.length}（${(rate*100).toFixed(1)}%）`);});
test('参照先のファイルがあり、形式が正しい（WebP・AVIF）',()=>{for(const id in D){const m=D[id];for(const f of['full','thumb','avif']){if(!m[f])continue;const p=path.join(R,m[f]);assert.ok(fs.existsSync(p),id+' '+f+' が無い: '+m[f]);
    const b=fs.readFileSync(p);assert.ok(b.length>800,id+' '+f+' が小さすぎる（壊れている）');assert.strictEqual(kind(b),f==='avif'?'avif':'webp',id+' '+f+' の形式が違う');}
  assert.ok(m.w>=320&&m.h>=200,id+' の解像度が低い');}});
test('魚種と画像の対応：存在しない魚種の画像が無い・同じ写真の使い回しが無い',()=>{for(const id in D)assert.ok(SP.some(s=>s.id===id),'魚種に無い画像: '+id);
  const seen={};for(const id in D){const k=D[id].page+'|'+D[id].title;assert.ok(!seen[k],`${id} と ${seen[k]} が同じ写真`);seen[k]=id;}});
test('出典・ライセンス・撮影者の記録',()=>{for(const id in D){const m=D[id];assert.ok(m.page&&/^https?:\/\//.test(m.page),id+' 出典ページ');assert.ok(OK_LIC.test(m.license||''),id+' ライセンス: '+m.license);assert.ok(m.artist,id+' 撮影者／権利者');assert.ok(m.source,id+' 出どころ');}});
