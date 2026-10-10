// 構造の一覧を docs/ARCHITECTURE.md に書き出す（node tools/inventory.mjs）。再解析を減らすため、ファイル・公開名・index.html の節を機械的にまとめる
import fs from 'fs';import path from 'path';
const ROOT=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const js=fs.readdirSync(ROOT).filter(f=>/\.js$/.test(f));const rows=[];
for(const f of js){const s=fs.readFileSync(path.join(ROOT,f),'utf8');const exp=(s.match(/root\.(Hama\w+)/)||[])[1]||'';const head=(s.match(/\/\*\s*([^\n]*)/)||[])[1]||'';rows.push(`| ${f} | ${Math.round(s.length/1024)}KB | ${exp} | ${head.replace(/\|/g,'/').slice(0,90)} |`);}
const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');const lines=html.split('\n');const secs=[];
lines.forEach((l,i)=>{const m=l.match(/^\/\* =====\s*(.+?)\s*=====/);if(m)secs.push(`- L${i+1} ${m[1].slice(0,70)}`);});
const scripts=[...html.matchAll(/<script src="([^"?]+)/g)].map(m=>m[1]);
const data=[];for(const d of['data','data/fish','data/world','data/terrain','data/geo','data/osm','data/tiles'])if(fs.existsSync(path.join(ROOT,d)))data.push(`- ${d}/: `+fs.readdirSync(path.join(ROOT,d)).slice(0,12).join(', '));
const out=`# 構造一覧（自動生成：node tools/inventory.mjs。直接編集しない）\n\n## 読み込み順（index.html）\n${scripts.map(s=>'- '+s).join('\n')}\n\n## モジュール\n| ファイル | 大きさ | 公開名 | 説明 |\n|---|---|---|---|\n${rows.join('\n')}\n\n## index.html の節（${Math.round(html.length/1024)}KB）\n${secs.join('\n')}\n\n## データ\n${data.join('\n')}\n\n## テスト\n- npm test（tests/*.test.js）、npm run smoke（tools/smoke：ヘッドレス Chromium で主な遊び方）\n- セーブ：localStorage hama-tsuri-v2。移行 migrateMap（mapv 2 湘南等倍、mapv 3 横浜等倍）、TK.migrate / migrateGear、VH.migrate\n`;
fs.writeFileSync(path.join(ROOT,'docs/ARCHITECTURE.md'),out);console.log('docs/ARCHITECTURE.md',out.length);
