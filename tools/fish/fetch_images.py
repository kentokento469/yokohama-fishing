#!/usr/bin/env python3
"""魚の写真を Wikimedia Commons から集め、ライセンスを画像ごとに確かめて、ゲーム用に変換する。
  python3 tools/fish/fetch_images.py search  [--ids aji,saba]   # 候補を探す → data-build/fish-img/candidates.json と review.html（目で確認する一覧）
  python3 tools/fish/fetch_images.py approve aji=File:Trachurus_japonicus.jpg ...   # 確認して採用（data/fish/img/approved.json に記録）
  python3 tools/fish/fetch_images.py build                    # 採用した画像を取得・変換 → data/fish/img/<id>.webp（表示用）と <id>_t.webp（サムネイル）、data/fish/images.js（出典つき）
  python3 tools/fish/fetch_images.py build --from-dir DIR     # 手元の画像（DIR/<id>.jpg と DIR/<id>.json＝出典）から変換だけ（取得できない環境用）
方針：
 ・使えるライセンスだけ（CC0・パブリックドメイン・CC BY・CC BY-SA）。NC（非営利のみ）・ND（改変禁止）・不明は使わない。
 ・魚種の取り違え・図版・標本の悪い写真を避けるため、自動では採用しない（review.html を見て approve する）。
 ・改変は「縮小・圧縮・切り抜き」だけ。CC BY-SA の画像は改変後も CC BY-SA。帰属（作者・ライセンス・元の URL・改変の内容）を images.js と図鑑の出典に表示する。
 ・元の高解像度（長辺2048px）は data-build/fish-img/master/ に保存（リポジトリには入れない）。ゲームには長辺1600pxの WebP（約200KB）と 384px のサムネイル。
"""
import argparse, html, json, os, re, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILD = ROOT / 'data-build' / 'fish-img'
OUT = ROOT / 'data' / 'fish' / 'img'
API = 'https://commons.wikimedia.org/w/api.php'
UA = 'yokohama-fishing-game/1.0 (hobby project; https://github.com/kentokento469/yokohama-fishing)'
OK_LIC = re.compile(r'^(cc0|public domain|pd|cc by(-sa)? ?\d(\.\d)?( [a-z]+)?)$', re.I)
BAD_WORDS = re.compile(r'(drawing|illustration|map|distribution|stamp|logo|diagram|\.svg|\.gif|\.tif|skeleton|otolith|egg|larva)', re.I)
DISPLAY, THUMB, MASTER = 1600, 384, 2048


def get(params, tries=6):
    q = API + '?' + urllib.parse.urlencode(dict(params, format='json', formatversion=2, maxlag=5))
    for k in range(tries):  # 回数制限（429）は待って再試行
        try:
            with urllib.request.urlopen(urllib.request.Request(q, headers={'User-Agent': UA}), timeout=60) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code not in (429, 503) or k == tries - 1:
                raise
            time.sleep(int(e.headers.get('Retry-After') or 0) or 10 * (k + 1))


def species():
    d = json.loads((ROOT / 'data' / 'fish' / 'species.json').read_text())
    return {s['id']: s for s in d['species']}


def license_ok(meta):
    lic = (meta.get('LicenseShortName', {}) or {}).get('value', '').strip()
    usage = (meta.get('UsageTerms', {}) or {}).get('value', '')
    if re.search(r'\b(nc|nd)\b', lic.lower()) or 'NonCommercial' in usage or 'NoDerivatives' in usage:
        return None
    return lic if OK_LIC.match(lic.lower().replace('-', ' ').replace('  ', ' ').replace('cc by sa', 'cc by-sa')) else None


def search(ids):
    S = species()
    BUILD.mkdir(parents=True, exist_ok=True)
    cf = BUILD / 'candidates.json'
    out = json.loads(cf.read_text()) if cf.exists() else {}  # 前回の結果に足す（候補のある種は探し直さない）
    for id in ids or S:
        if out.get(id, {}).get('candidates'):
            continue
        s = S[id]
        sci = s['sci'].split(' (')[0].replace('（', '(')
        found = []
        for src in (lambda: get({'action': 'query', 'generator': 'categorymembers', 'gcmtitle': 'Category:' + sci, 'gcmtype': 'file', 'gcmlimit': 50, 'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata'}),
                    lambda: get({'action': 'query', 'generator': 'search', 'gsrsearch': f'"{sci}" filetype:bitmap', 'gsrnamespace': 6, 'gsrlimit': 30, 'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata'})):
            try:
                pages = (src().get('query') or {}).get('pages') or []
            except Exception as e:
                print(id, '取得失敗：', e, file=sys.stderr)
                pages = []
            for p in pages:
                ii = (p.get('imageinfo') or [{}])[0]
                meta = ii.get('extmetadata') or {}
                lic = license_ok(meta)
                if not lic or ii.get('mime') != 'image/jpeg' or BAD_WORDS.search(p['title']):
                    continue
                w, h = ii.get('width', 0), ii.get('height', 0)
                if max(w, h) < 1200 or w < h:  # 横長の写真で、長辺1200px以上
                    continue
                artist = re.sub('<[^>]+>', '', (meta.get('Artist') or {}).get('value', '')).strip()
                found.append({'title': p['title'], 'url': ii['url'].split('?')[0], 'page': ii.get('descriptionurl'), 'w': w, 'h': h, 'license': lic,
                              'license_url': (meta.get('LicenseUrl') or {}).get('value'), 'artist': artist or '不明',
                              'credit': re.sub('<[^>]+>', '', (meta.get('Credit') or {}).get('value', '')).strip(),
                              'score': min(w, 4000) / 4000 + (0.3 if 'fish' in p['title'].lower() else 0)})
            time.sleep(2)
        found = sorted({f['title']: f for f in found}.values(), key=lambda f: -f['score'])[:8]
        out[id] = {'ja': s['ja'], 'sci': s['sci'], 'candidates': found}
        print(f"{id} {s['ja']}：候補 {len(found)}", flush=True)
        cf.write_text(json.dumps(out, ensure_ascii=False, indent=1))  # 1種ごとに保存（途中で止まっても続きから）
    cf.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    rows = []
    for id, o in out.items():
        cells = ''.join(f'<figure><img loading="lazy" src="{html.escape(c["url"])}" width="320"><figcaption>{html.escape(c["title"])}<br>{html.escape(c["license"])} / {html.escape(c["artist"][:60])}<br><code>{id}={html.escape(c["title"])}</code></figcaption></figure>' for c in o['candidates'])
        rows.append(f'<h2>{html.escape(o["ja"])} <i>{html.escape(o["sci"])}</i>（{id}）</h2><div class="r">{cells or "候補なし"}</div>')
    (BUILD / 'review.html').write_text('<meta charset="utf-8"><style>.r{display:flex;gap:8px;overflow-x:auto}figure{margin:0;width:320px;font-size:11px}</style>'
                                       '<p>魚種が正しく、体全体が自然に写った写真だけを approve する（標本の色落ち・切り身・図版・水槽のガラス越しで歪んだものは避ける）。</p>' + ''.join(rows))
    print('→', BUILD / 'review.html')


def approve(pairs):
    OUT.mkdir(parents=True, exist_ok=True)
    f = OUT / 'approved.json'
    ap = json.loads(f.read_text()) if f.exists() else {}
    cand = json.loads((BUILD / 'candidates.json').read_text())
    for p in pairs:
        id, title = p.split('=', 1)
        c = next((c for c in cand.get(id, {}).get('candidates', []) if c['title'] == title), None)
        if not c:
            sys.exit(f'候補にない：{p}')
        ap[id] = c
    f.write_text(json.dumps(ap, ensure_ascii=False, indent=1))
    print('採用', len(ap), '種')


def convert(src_path, id, credit):
    from PIL import Image, ImageOps
    im = ImageOps.exif_transpose(Image.open(src_path)).convert('RGB')
    (BUILD / 'master').mkdir(parents=True, exist_ok=True)
    m = im.copy()
    m.thumbnail((MASTER, MASTER), Image.LANCZOS)
    m.save(BUILD / 'master' / f'{id}.webp', 'WEBP', quality=90, method=6)
    d = im.copy()
    d.thumbnail((DISPLAY, DISPLAY), Image.LANCZOS)
    d.save(OUT / f'{id}.webp', 'WEBP', quality=82, method=6)
    t = im.copy()
    t.thumbnail((THUMB, THUMB), Image.LANCZOS)
    t.save(OUT / f'{id}_t.webp', 'WEBP', quality=78, method=6)
    try:  # AVIF に対応した Pillow なら AVIF も作る（対応ブラウザはこちらを使う）
        d.save(OUT / f'{id}.avif', 'AVIF', quality=60)
    except Exception:
        pass
    return {'full': f'data/fish/img/{id}.webp', 'avif': f'data/fish/img/{id}.avif' if (OUT / f'{id}.avif').exists() else None,
            'thumb': f'data/fish/img/{id}_t.webp', 'w': d.width, 'h': d.height, 'src_w': im.width, 'src_h': im.height,
            'title': credit.get('title'), 'page': credit.get('page'), 'artist': credit.get('artist'), 'license': credit.get('license'),
            'license_url': credit.get('license_url'), 'modified': '縮小・圧縮（WebP）', 'source': credit.get('source', 'Wikimedia Commons')}


def build(from_dir=None):
    OUT.mkdir(parents=True, exist_ok=True)
    S = species()
    manifest = {}
    if from_dir:
        for p in sorted(Path(from_dir).glob('*.json')):
            id = p.stem
            if id not in S:
                continue
            credit = json.loads(p.read_text())
            if not credit.get('license') or not credit.get('artist'):
                print(id, '出典（license・artist）が無いので使わない')
                continue
            img = next((p.with_suffix(x) for x in ('.jpg', '.jpeg', '.png', '.webp') if p.with_suffix(x).exists()), None)
            if img:
                manifest[id] = convert(img, id, credit)
    else:
        ap = json.loads((OUT / 'approved.json').read_text())
        (BUILD / 'src').mkdir(parents=True, exist_ok=True)
        for id, c in ap.items():
            dst = BUILD / 'src' / f'{id}.jpg'
            if not dst.exists():
                req = urllib.request.Request(c['url'], headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=120) as r:
                    dst.write_bytes(r.read())
                time.sleep(1)
            manifest[id] = convert(dst, id, c)
            print(id, '変換', manifest[id]['w'], 'x', manifest[id]['h'])
    js = ('/* 自動生成：tools/fish/fetch_images.py build。直接編集しない。各画像の出典・ライセンス・改変内容つき */\n'
          f'(function(root){{const D={json.dumps(manifest, ensure_ascii=False)};if(typeof module!=="undefined"&&module.exports)module.exports=D;else root.HamaFishImages=D;}})(typeof self!=="undefined"?self:this);\n')
    (ROOT / 'data' / 'fish' / 'images.js').write_text(js)
    print('data/fish/images.js：', len(manifest), '種')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', choices=['search', 'approve', 'build'])
    ap.add_argument('args', nargs='*')
    ap.add_argument('--ids')
    ap.add_argument('--from-dir')
    a = ap.parse_args()
    if a.cmd == 'search':
        search(a.ids.split(',') if a.ids else None)
    elif a.cmd == 'approve':
        approve(a.args)
    else:
        build(a.from_dir)
