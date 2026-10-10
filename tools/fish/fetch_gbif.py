#!/usr/bin/env python3
"""魚の写真の候補を GBIF（世界の博物館・研究機関・iNaturalist などの観察記録の集約）から集める。Commons・iNaturalist（研究用グレード）で見つからない魚種用。
  python3 tools/fish/fetch_gbif.py candidates [--ids a,b] [--n 12]  # 写真がまだ無い魚種の候補 → data-build/fish-img/gbif/<id>/ と meta.json
  python3 tools/fish/fetch_gbif.py sheet a,b,c OUT.jpg              # 候補の一覧を1枚に（目で確認する用）
  python3 tools/fish/fetch_gbif.py approve id=番号 ...              # 確認して採用 → data-build/fish-img/approved_src/<id>.jpg と <id>.json（fetch_images.py build --from-dir で変換）
方針：画像ごとに明示されたライセンスが CC0・パブリックドメイン・CC BY・CC BY-SA のものだけ（NC・ND・ライセンス不明は使わない）。
自動では採用しない（目で魚種と写りを確認する）。帰属は撮影者／権利者・ライセンス・GBIF の記録ページを記録する。改変は縮小・圧縮だけ。"""
import argparse, json, re, time, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
B = ROOT / 'data-build' / 'fish-img'
UA = 'yokohama-fishing-game/1.0 (hobby project; https://github.com/kentokento469/yokohama-fishing)'
# 学名の検索語（資料の学名が複合種・未記載種のもの）と、国の絞り込み
QUERY = {'magochi': ('Platycephalus', 'JP'), 'mebaru': ('Sebastes inermis', None), 'kataku': ('Engraulis japonicus', None), 'oikawa': ('Zacco platypus', None), 'haokoze': ('Paracentropogon rubripinnis', None)}


def http(url, timeout=60, raw=False, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': UA}), timeout=timeout) as r:
                b = r.read()
                return b if raw else json.loads(b)
        except Exception:
            time.sleep(1.5 * (k + 1))
    return None


def lic_of(s):
    """画像のライセンス表記 → (表示名, URL)。使えないものは None"""
    s = (s or '').strip()
    t = s.lower()
    if not t or 'nc' in re.split(r'[/_\- ]', t) or 'by-nc' in t or '-nd' in t or '_nd' in t or 'noderiv' in t or 'noncommercial' in t:
        return None
    if 'zero' in t or t in ('cc0', 'cc0_1_0') or 'cc0' in t:
        return ('CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/')
    if 'publicdomain/mark' in t or 'public domain' in t:
        return ('パブリックドメイン', 'https://creativecommons.org/publicdomain/mark/1.0/')
    m = re.search(r'licenses/(by-sa|by)/(\d\.\d)', t)
    if m:
        k, v = m.groups()
        return (f"CC {k.upper()} {v}", f"https://creativecommons.org/licenses/{k}/{v}/")
    if t in ('cc_by_4_0', 'cc-by', 'cc by 4.0'):
        return ('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/')
    if t in ('cc-by-sa', 'cc by-sa 4.0'):
        return ('CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/')
    return None


def species():
    return json.loads((ROOT / 'data' / 'fish' / 'species.json').read_text())['species']


def have():
    src = (ROOT / 'data' / 'fish' / 'images.js').read_text()
    m = re.search(r'const D=(\{.*?\});', src, re.S)
    a = set(json.loads(m.group(1)).keys()) if m else set()
    a |= {f.stem for f in (B / 'approved_src').glob('*.json')}
    return a


def small(url):
    # iNaturalist は中くらいの大きさ、NHM（ロンドン自然史博物館）はプレビュー
    if 'inaturalist' in url:
        return re.sub(r'/(original|large)\.', '/medium.', url)
    if 'data.nhm.ac.uk/media/' in url and not url.endswith('/preview'):
        return url.rstrip('/') + '/preview'
    return url


def large(url):
    if 'inaturalist' in url:
        return re.sub(r'/(original|medium)\.', '/large.', url)
    return url


def candidates(ids, n):
    hv = have()
    for s in species():
        if ids and s['id'] not in ids:
            continue
        if not ids and s['id'] in hv:
            continue
        name, country = QUERY.get(s['id'], (re.sub(r'\s*\(.*\)', '', s['sci']).replace(' sp.', ''), None))
        out = B / 'gbif' / s['id']
        out.mkdir(parents=True, exist_ok=True)
        meta, seen = [], set()
        for off in range(0, 1500, 50):  # 大きな応答は途中で切れやすいので小さく分けて取る
            q = {'scientificName': name, 'mediaType': 'StillImage', 'limit': 50, 'offset': off}
            if country:
                q['country'] = country
            d = http('https://api.gbif.org/v1/occurrence/search?' + urllib.parse.urlencode(q))
            if not d:
                break
            for r in d.get('results', []):
                for med in r.get('media', [])[:1]:
                    url = med.get('identifier')
                    L = lic_of(med.get('license'))
                    if not url or not L or url in seen:
                        continue
                    seen.add(url)
                    k = len(meta)
                    th = http(small(url), raw=True, tries=2)
                    if not th or len(th) < 3000:
                        continue
                    (out / f'{k}.jpg').write_bytes(th)
                    meta.append({'n': k, 'url': url, 'license': L[0], 'license_url': L[1], 'artist': med.get('creator') or med.get('rightsHolder') or r.get('recordedBy') or r.get('institutionCode') or '',
                                 'page': f"https://www.gbif.org/occurrence/{r['key']}", 'ref': med.get('references') or '', 'dataset': r.get('datasetName') or r.get('institutionCode') or '',
                                 'taxon': r.get('species') or r.get('scientificName') or '', 'country': r.get('countryCode') or ''})
                if len(meta) >= n:
                    break
            if len(meta) >= n or d.get('endOfRecords'):
                break
        (out / 'meta.json').write_text(json.dumps(meta, ensure_ascii=False, indent=1))
        print(s['id'], name, len(meta), flush=True)


def inat(ids, n):
    """iNaturalist の観察（同定が確定していないものも含む）から CC0・CC BY・CC BY-SA の写真を候補に足す。採用は目で魚種を確かめてから"""
    INL = {'cc0': ('CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'), 'cc-by': ('CC BY 4.0', 'https://creativecommons.org/licenses/by/4.0/'),
           'cc-by-sa': ('CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/')}
    for s in species():
        if s['id'] not in ids:
            continue
        name = QUERY.get(s['id'], (re.sub(r'\s*\(.*\)', '', s['sci']).replace(' sp.', ''), None))[0]
        out = B / 'gbif' / s['id']
        out.mkdir(parents=True, exist_ok=True)
        mp = out / 'meta.json'
        meta = json.loads(mp.read_text()) if mp.exists() else []
        got = {m['url'] for m in meta}
        # 学名から iNaturalist の分類の番号を引く（名前が見つからないと絞り込みが効かず別の生き物が混ざるため）
        tx = http('https://api.inaturalist.org/v1/taxa?' + urllib.parse.urlencode({'q': name, 'per_page': 10}))
        tid = next((t['id'] for t in (tx or {}).get('results', []) if t.get('name') == name), None)  # 学名が完全に一致するものだけ（別種扱いの同物異名・属への置き換えはしない）
        if not tid:
            print(s['id'], name, '分類が見つからない', flush=True)
            continue
        q = {'taxon_id': tid, 'photo_license': 'cc0,cc-by,cc-by-sa', 'per_page': 50, 'photos': 'true'}
        if s['id'] in ('magochi',):
            q['place_id'] = 6737  # 日本（マゴチは日本の未記載種を含む）
        d = http('https://api.inaturalist.org/v1/observations?' + urllib.parse.urlencode(q))
        add = 0
        g0 = name.split(' ')[0]
        for o in (d or {}).get('results', []):
            tn = (o.get('taxon') or {}).get('name', '')
            if not (tn == name or (' ' not in name and tn.startswith(g0 + ' ')) or tn.startswith(name + ' ')):
                continue
            for ph in o.get('photos', [])[:2]:
                if ph.get('license_code') not in INL:
                    continue
                url = ph['url'].replace('square', 'original')
                if url in got:
                    continue
                th = http(url.replace('original', 'medium'), raw=True, tries=2)
                if not th:
                    continue
                k = max([m['n'] for m in meta] + [-1]) + 1
                (out / f'{k}.jpg').write_bytes(th)
                L = INL[ph['license_code']]
                meta.append({'n': k, 'url': url, 'license': L[0], 'license_url': L[1], 'artist': (ph.get('attribution') or '').replace('(c) ', '').split(',')[0] or (o.get('user') or {}).get('login', ''),
                             'page': o['uri'], 'ref': o['uri'], 'dataset': f"iNaturalist（{o.get('quality_grade')}）", 'taxon': (o.get('taxon') or {}).get('name', ''), 'country': o.get('place_guess', '')[-20:]})
                got.add(url)
                add += 1
            if add >= n:
                break
        mp.write_text(json.dumps(meta, ensure_ascii=False, indent=1))
        print(s['id'], name, '+', add, flush=True)


def sheet(ids, out, cell=230, per=30, cols=6):
    from PIL import Image, ImageDraw
    rows = []
    for i in ids:
        d = B / 'gbif' / i
        meta = json.loads((d / 'meta.json').read_text()) if (d / 'meta.json').exists() else []
        for j in range(0, min(len(meta), per), cols):
            rows.append((i, meta[j:j + cols], j == 0))
    W, H = cell * cols, (cell + 22) * max(1, len(rows))
    img = Image.new('RGB', (W, H), (30, 30, 30))
    dr = ImageDraw.Draw(img)
    sp = {s['id']: s for s in species()}
    for r, (i, meta, first) in enumerate(rows):
        y = r * (cell + 22)
        dr.text((4, y + 4), f"{i}  {sp.get(i, {}).get('sci', '')}" if first else f"{i} (つづき)", fill=(255, 230, 120))
        for c, m in enumerate(meta):
            try:
                im = Image.open(B / 'gbif' / i / f"{m['n']}.jpg").convert('RGB')
                im.thumbnail((cell - 4, cell - 4))
                img.paste(im, (c * cell + 2, y + 22))
                dr.rectangle((c * cell + 2, y + 22, c * cell + 26, y + 38), fill=(0, 0, 0))
                dr.text((c * cell + 6, y + 24), str(m['n']), fill=(255, 255, 255))
            except Exception:
                pass
    img.save(out, quality=82)


def approve(pairs):
    dst = B / 'approved_src'
    dst.mkdir(parents=True, exist_ok=True)
    for p in pairs:
        i, k = p.split('=')
        src = i.split(':')[-1]  # 同じ種の別の個体（ブリ・ワラサ・イナダ）は「warasa:buri=3」のように候補の魚種を指定できる
        i = i.split(':')[0]
        meta = json.loads((B / 'gbif' / src / 'meta.json').read_text())
        m = next(x for x in meta if x['n'] == int(k))
        b = http(large(m['url']), timeout=120, raw=True) or http(m['url'], timeout=120, raw=True)
        if not b or len(b) < 5000:
            print('取得できない', i)
            continue
        (dst / f'{i}.jpg').write_bytes(b)
        isg = 'gbif.org' in m['page']
        (dst / f'{i}.json').write_text(json.dumps({'title': (f"GBIF occurrence {m['page'].rsplit('/', 1)[-1]}（{m['dataset']}）" if isg else f"iNaturalist observation {m['page'].rsplit('/', 1)[-1]}"), 'page': m['page'], 'artist': m['artist'] or m['dataset'],
                                                    'license': m['license'], 'license_url': m['license_url'], 'source': 'GBIF（観察・標本記録の画像）' if isg else 'iNaturalist（観察の写真。魚種は写真で確認）'}, ensure_ascii=False))
        print('採用', i, m['page'], m['license'], m['artist'])


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd')
    ap.add_argument('rest', nargs='*')
    ap.add_argument('--ids')
    ap.add_argument('--n', type=int, default=12)
    a = ap.parse_args()
    if a.cmd == 'candidates':
        candidates(set(a.ids.split(',')) if a.ids else None, a.n)
    elif a.cmd == 'inat':
        inat(set(a.ids.split(',')), a.n)
    elif a.cmd == 'sheet':
        sheet(a.rest[0].split(','), a.rest[1])
    elif a.cmd == 'approve':
        approve(a.rest)
