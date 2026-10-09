"""data/equipment_catalog_400.json から、ゲームで使うルアー・メタルジグ（200件）を data/tackle-data.js に書き出す。
使い方：python3 tools/build_tackle.py
ロッド・リール（200件）は段階5（ファイト・ドラグ）で取り込む予定。IDはセーブ互換のため変えないこと。"""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
cat = json.loads((root / 'data/equipment_catalog_400.json').read_text(encoding='utf-8'))['items']
KEEP = ['id','name','priceYen','unlockedAtLevel','description','features','tradeoff','weightG','lengthMm','buoyancy',
        'actionType','minEffectiveDepthM','maxEffectiveDepthM','sinkRateMps','optimalRetrieveMinMps','optimalRetrieveMaxMps',
        'castEfficiency','snagRisk','color','targetSpecies']
LURE_EXTRA = ['recommendedTechnique','actionIntensity','noiseLevel']
JIG_EXTRA = ['balance','fallFlutter','jerkResponse']
out = []
for it in cat['lures']:
    d = {k: it[k] for k in KEEP + LURE_EXTRA}; d['cat'] = 'lure'; d['style'] = it['lureStyle']; out.append(d)
for it in cat['jigs']:
    d = {k: it[k] for k in KEEP + JIG_EXTRA}; d['cat'] = 'jig'; d['style'] = it['jigStyle']; out.append(d)
ids = [d['id'] for d in out]
assert len(ids) == len(set(ids)) == 200
js = ('/* 自動生成：tools/build_tackle.py（元データ data/equipment_catalog_400.json）。直接編集しないこと。\n'
      '   名称・価格・性能はすべて架空のゲーム用データ（実在の製品・価格ではない）。 */\n'
      '(function(root){const TACKLE=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
      "if(typeof module!=='undefined'&&module.exports)module.exports=TACKLE;else root.HamaTackleData=TACKLE;\n"
      "})(typeof self!=='undefined'?self:this);\n")
(root / 'data/tackle-data.js').write_text(js, encoding='utf-8')
print('wrote', len(out), 'items,', len(js.encode()), 'bytes')
