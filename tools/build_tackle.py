"""data/equipment_catalog_400.json から、ゲームで使う釣具400件（ロッド・リール・ルアー・メタルジグ）を data/tackle-data.js に書き出す。
使い方：python3 tools/build_tackle.py
IDはセーブ互換のため変えないこと。"""
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
COMMON = ['id','name','priceYen','unlockedAtLevel','description','features','tradeoff','targetSpecies']
ROD = ['rodStyle','reelType','lengthM','power','action','minLureWeightG','maxLureWeightG','recommendedPeMax','rodWeightG',
       'sensitivity','backbone','castingControl','flexibility','fatigueReduction','durability','playerEffect']
REEL = ['reelStyle','reelType','reelSize','gearRatio','retrieveCmPerTurn','maxDragKg','reelWeightG','capacityPeRating','capacityM',
        'dragPrecision','smoothness','lineManagement','durability','targetRodStyles','playerEffect']
for it in cat['rods']:
    d = {k: it[k] for k in COMMON + ROD}; d['cat'] = 'rod'; d['style'] = it['rodStyle']; out.append(d)
for it in cat['reels']:
    d = {k: it.get(k, []) if k == 'targetSpecies' else it[k] for k in COMMON + REEL}; d['cat'] = 'reel'; d['style'] = it['reelStyle']; out.append(d)
ids = [d['id'] for d in out]
assert len(ids) == len(set(ids)) == 400
js = ('/* 自動生成：tools/build_tackle.py（元データ data/equipment_catalog_400.json）。直接編集しないこと。\n'
      '   名称・価格・性能はすべて架空のゲーム用データ（実在の製品・価格ではない）。 */\n'
      '(function(root){const TACKLE=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
      "if(typeof module!=='undefined'&&module.exports)module.exports=TACKLE;else root.HamaTackleData=TACKLE;\n"
      "})(typeof self!=='undefined'?self:this);\n")
(root / 'data/tackle-data.js').write_text(js, encoding='utf-8')
print('wrote', len(out), 'items,', len(js.encode()), 'bytes')
