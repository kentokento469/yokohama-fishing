const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),path=require('path'),vm=require('vm');
// index.html の script（ゲーム本体）が構文として正しいか（1行の中の // コメントで閉じかっこを消してしまう事故など）
test('index.html の script の構文',()=>{const s=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');const blocks=[...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.ok(blocks.length>0);for(const b of blocks)assert.doesNotThrow(()=>new vm.Script(b),'構文エラー');});
