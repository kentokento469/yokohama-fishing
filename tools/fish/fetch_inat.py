#!/usr/bin/env python3
"""魚の写真の候補を iNaturalist（研究用グレード＝複数人が同定した観察）から集める。Wikimedia Commons で見つからない魚種用。
  python3 tools/fish/fetch_inat.py candidates [--ids a,b] [--n 8]   # 写真がまだ無い魚種の候補（500px）→ data-build/fish-img/inat/<id>/ と一覧画像 sheets/<id>.jpg
  python3 tools/fish/fetch_inat.py sheet a,b,c,d OUT.jpg            # 複数魚種の一覧を1枚に（目で確認する用）
  python3 tools/fish/fetch_inat.py approve id=番号 ...              # 確認して採用 → data-build/fish-img/approved_src/<id>.jpg と <id>.json（fetch_images.py build --from-dir で変換）
方針：ライセンスは CC0・CC BY・CC BY-SA だけ（NC・ND・著作権表示のみは使わない）。学名で検索。自動では採用しない（目で確認する）。
帰属は観察者の表示名・ライセンス・観察ページの URL を記録する。改変は縮小・圧縮・切り抜きだけ。"""
import argparse, json, sys, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
B = ROOT / 'data-build' / 'fish-img'
UA = 'yokohama-fishing-game/1.0 (hobby project; https://github.com/kentokento469/yokohama-fishing)'
LIC = {'cc0': ('CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'), 'cc-by': ('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'),
       'cc-by-sa': ('CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/')}


def jget(url):
    for k in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                return json.loads(r.read())
        except Exception:
            time.sleep(3 * (k + 1))
    return None


def fetch(url, out):
    for k in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=60) as r:
                out.write_bytes(r.read())
            return True
        except Exception:
            time.sleep(2 * (k + 1))
    return False


def species():
    return json.loads((ROOT / 'data' / 'fish' / 'species.json').read_text())['species']


def approved():
    p = ROOT / 'data' / 'fish' / 'img' / 'approved.json'
    a = json.loads(p.read_text()) if p.exists() else {}
    for f in (B / 'approved_src').glob('*.json'):
        a.setdefault(f.stem, True)
    return a


def candidates(ids, n):
    ap = approved()
    for s in species():
        if ids and s['id'] not in ids:
            continue
        if not ids and s['id'] in ap:
            continue
        q = urllib.parse.urlencode({'taxon_name': s['sci'], 'quality_grade': 'research', 'photo_license': 'cc0,cc-by,cc-by-sa', 'per_page': 30, 'order_by': 'votes', 'photos': 'true'})
        d = jget('https://api.inaturalist.org/v1/observations?' + q)
        time.sleep(1.1)
        out = B / 'inat' / s['id']
        out.mkdir(parents=True, exist_ok=True)
        meta = []
        for o in (d or {}).get('results', []):
            # 学名が一致する観察だけ（上位の分類群に落ちたものは除く）
            tn = (o.get('taxon') or {}).get('name') or ''
            g, e = (s['sci'].split() + [''])[:2]
            if not (tn.startswith(g + ' ') and tn.split(' ')[1][:5] == e[:5]):  # 種名の語尾の違い（japonica/japonicus）は同じとみなす
                continue
            for ph in o.get('photos', [])[:1]:
                if ph.get('license_code') not in LIC:
                    continue
                k = len(meta)
                if fetch(ph['url'].replace('square', 'medium'), out / f'{k}.jpg'):
                    meta.append({'n': k, 'photo': ph['id'], 'url': ph['url'], 'license': ph['license_code'], 'attribution': ph.get('attribution', ''),
                                 'user': (o.get('user') or {}).get('login', ''), 'obs': f"https://www.inaturalist.org/observations/{o['id']}", 'place': o.get('place_guess', '')})
            if len(meta) >= n:
                break
        (out / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
        print(s['id'], s['sci'], len(meta), flush=True)


def sheet(ids, out, cell=220, per=6):
    from PIL import Image, ImageDraw
    rows = []
    for i in ids:
        d = B / 'inat' / i
        meta = json.loads((d / 'meta.json').read_text()) if (d / 'meta.json').exists() else []
        rows.append((i, meta[:per]))
    W, H = cell * per, (cell + 22) * len(rows)
    img = Image.new('RGB', (W, H), (30, 30, 30))
    dr = ImageDraw.Draw(img)
    for r, (i, meta) in enumerate(rows):
        y = r * (cell + 22)
        sp = next((s for s in species() if s['id'] == i), {})
        dr.text((4, y + 4), f"{i}  {sp.get('sci', '')}", fill=(255, 230, 120))
        for c, m in enumerate(meta):
            try:
                im = Image.open(B / 'inat' / i / f"{m['n']}.jpg").convert('RGB')
                im.thumbnail((cell - 4, cell - 4))
                img.paste(im, (c * cell + 2, y + 22))
                dr.text((c * cell + 6, y + 24), str(m['n']), fill=(255, 255, 255))
            except Exception:
                pass
    img.save(out, quality=80)


def approve(pairs):
    dst = B / 'approved_src'
    dst.mkdir(parents=True, exist_ok=True)
    for p in pairs:
        i, k = p.split('=')
        meta = json.loads((B / 'inat' / i / 'meta.json').read_text())
        m = next(x for x in meta if x['n'] == int(k))
        if not fetch(m['url'].replace('square', 'original'), dst / f'{i}.jpg'):
            print('取得できない', i)
            continue
        lic, url = LIC[m['license']]
        (dst / f'{i}.json').write_text(json.dumps({'title': f"iNaturalist photo {m['photo']}", 'page': m['obs'], 'artist': m['attribution'].replace('(c) ', '').split(',')[0] or m['user'],
                                                    'license': lic, 'license_url': url, 'source': 'iNaturalist（研究用グレードの観察）'}, ensure_ascii=False))
        print('採用', i, m['obs'], lic)


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd')
    ap.add_argument('rest', nargs='*')
    ap.add_argument('--ids')
    ap.add_argument('--n', type=int, default=8)
    a = ap.parse_args()
    if a.cmd == 'candidates':
        candidates(set(a.ids.split(',')) if a.ids else None, a.n)
    elif a.cmd == 'sheet':
        sheet(a.rest[0].split(','), a.rest[1])
    elif a.cmd == 'approve':
        approve(a.rest)
