#!/usr/bin/env python3
"""関東の OSM（Geofabrik の PBF）をマスターデータとして取得し、公式 MD5 で検証する。
  python3 tools/kanto/fetch_master.py                 # 既定の URL（kanto-261008）
  python3 tools/kanto/fetch_master.py --url URL       # 別の版
  python3 tools/kanto/fetch_master.py --from-file F   # 別の場所で取得した PBF を取り込む（MD5 ファイルも同じ場所に置く）
マスター（data-master/）は書き換えない。元の PBF にはノード・ウェイ・リレーション・全タグがそのまま入っている。
取得は途中から再開できる（curl -C -）。MD5 が合わなければ失敗として終了し、マスターにしない。
"""
import argparse, hashlib, json, os, shutil, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MASTER = ROOT / 'data-master'
DEFAULT_URL = 'https://download.geofabrik.de/asia/japan/kanto-261008.osm.pbf'
EXPECTED_SIZE = 517645146  # ユーザー指定の元データの大きさ（バイト）


def digest(path, algo):
    h = hashlib.new(algo)
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1 << 22), b''):
            h.update(b)
    return h.hexdigest()


def curl(url, out, resume=True):
    cmd = ['curl', '-fL', '--retry', '5', '--retry-delay', '5', '-o', str(out), url]
    if resume:
        cmd[1:1] = ['-C', '-']
    print('取得:', url, flush=True)
    r = subprocess.run(cmd)
    if r.returncode != 0:
        raise RuntimeError(f'取得に失敗しました（curl 終了コード {r.returncode}）。ネットワークの許可（download.geofabrik.de）を確認してください。')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=DEFAULT_URL)
    ap.add_argument('--from-file')
    a = ap.parse_args()
    MASTER.mkdir(exist_ok=True)
    name = os.path.basename(a.url) if not a.from_file else os.path.basename(a.from_file)
    pbf, md5f = MASTER / name, MASTER / (name + '.md5')
    if a.from_file:
        shutil.copyfile(a.from_file, pbf)
        if os.path.exists(a.from_file + '.md5'):
            shutil.copyfile(a.from_file + '.md5', md5f)
    else:
        part = MASTER / (name + '.part')
        if not pbf.exists():
            curl(a.url, part)
            part.rename(pbf)
        curl(a.url + '.md5', md5f, resume=False)
    if not md5f.exists():
        sys.exit('公式の MD5 ファイルがないため検証できません。マスターにしません。')
    official = md5f.read_text().split()[0].strip().lower()
    size = pbf.stat().st_size
    print(f'大きさ {size:,} バイト（指定 {EXPECTED_SIZE:,}）', flush=True)
    got = digest(pbf, 'md5')
    if got != official:
        bad = pbf.with_suffix('.pbf.bad')
        pbf.rename(bad)
        sys.exit(f'MD5 が一致しません（公式 {official} / 取得 {got}）。{bad} に退避しました。')
    sha = digest(pbf, 'sha256')
    manifest = {
        'file': name, 'url': a.url, 'bytes': size, 'expected_bytes': EXPECTED_SIZE, 'size_matches_expected': size == EXPECTED_SIZE,
        'md5': got, 'md5_official': official, 'md5_verified': True, 'sha256': sha,
        'fetched_at': time.strftime('%Y-%m-%dT%H:%M:%S%z'),
        'source': 'Geofabrik GmbH extract of OpenStreetMap', 'license': 'ODbL 1.0', 'attribution': '© OpenStreetMap contributors',
        'note': 'マスターデータ。書き換えない。ノード・ウェイ・リレーション・全タグを含む元の PBF。',
    }
    (MASTER / 'MANIFEST.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
    print('検証OK：MD5 一致。data-master/MANIFEST.json を書きました。')


if __name__ == '__main__':
    main()
