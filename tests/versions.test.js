// index.html の <script src="x.js?v=..."> が中身のハッシュと一致するか（古いファイルがキャッシュから使われるのを防ぐ）。
// 失敗したら node tools/bump_versions.mjs を実行する
const test=require('node:test'),assert=require('node:assert'),{execFileSync}=require('child_process'),path=require('path');
test('スクリプトの版（?v=）が中身と一致',()=>{let out='';try{execFileSync('node',[path.join(__dirname,'../tools/bump_versions.mjs'),'--check'],{encoding:'utf8'});}catch(e){out=e.stdout;}assert.strictEqual(out,'',out+'\n→ node tools/bump_versions.mjs を実行');});
