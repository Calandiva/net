# -*- coding: utf-8 -*-
"""Overture Maps 공개 S3 버킷에서 우리 지역의 실제 지형 데이터를 받아 온다.

  python3 tools/overture_fetch.py            # tools/overture-cache/*.json 채우기

Overture 데이터는 OpenStreetMap 에서 온 것이다 (ODbL). 게임에 구워 넣을 때
출처를 반드시 밝힌다 — README.md 와 도움말 화면을 보라.

받아 오는 것: 도로 · 건물 외곽선 · 장소(POI) · 수계 · 토지이용 · 지형
한 번 받아 두면 tools/overture-cache/ 에 남고, bake_overture.py 가 그걸 읽는다.
망이 막힌 곳에서는 이 스크립트만 실패하고 게임은 구워 둔 데이터로 그대로 돈다.
"""
import io, json, os, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

BASE = "https://overturemaps-us-west-2.s3.amazonaws.com/"
RELEASE = "release/2026-08-19.0"
BBOX = (126.593, 37.598, 126.667, 37.662)     # 서, 남, 동, 북 — 게임 세계보다 조금 넓게
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'overture-cache')

THEMES = {
    'roads':     ('theme=transportation/type=segment', ['id', 'names', 'subtype', 'class', 'subclass']),
    'buildings': ('theme=buildings/type=building',     ['id', 'names', 'class', 'subtype', 'height', 'num_floors']),
    'places':    ('theme=places/type=place',           ['id', 'names', 'categories', 'confidence']),
    'water':     ('theme=base/type=water',             ['id', 'names', 'class', 'subtype']),
    'landuse':   ('theme=base/type=land_use',          ['id', 'names', 'class', 'subtype']),
    'land':      ('theme=base/type=land',              ['id', 'names', 'class', 'subtype']),
}


class HttpFile(io.RawIOBase):
    """S3 객체를 Range 요청으로 읽는 파일 객체 (parquet 푸터·행그룹만 받아 온다)."""

    def __init__(self, key):
        self.url = BASE + key
        self.pos = 0
        req = urllib.request.Request(self.url, method='HEAD')
        with urllib.request.urlopen(req, timeout=60) as r:
            self._size = int(r.headers['Content-Length'])

    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos

    def seek(self, off, whence=0):
        self.pos = off if whence == 0 else self.pos + off if whence == 1 else self._size + off
        return self.pos

    def read(self, n=-1):
        if n is None or n < 0:
            n = self._size - self.pos
        end = min(self.pos + n, self._size) - 1
        if end < self.pos:
            return b''
        req = urllib.request.Request(self.url, headers={'Range': 'bytes=%d-%d' % (self.pos, end)})
        for attempt in range(4):
            try:
                with urllib.request.urlopen(req, timeout=180) as r:
                    data = r.read()
                break
            except Exception:
                if attempt == 3:
                    raise
                time.sleep(1 + attempt)
        self.pos += len(data)
        return data

    def readinto(self, b):
        data = self.read(len(b))
        b[:len(data)] = data
        return len(data)


def list_files(prefix):
    keys, token = [], None
    while True:
        url = '%s?list-type=2&prefix=%s&max-keys=1000' % (BASE, urllib.parse.quote(prefix))
        if token:
            url += '&continuation-token=' + urllib.parse.quote(token, safe='')
        with urllib.request.urlopen(url, timeout=120) as r:
            body = r.read().decode()
        keys += re.findall(r'<Key>([^<]+)</Key>', body)
        more = re.search(r'<NextContinuationToken>([^<]+)</NextContinuationToken>', body)
        if not more:
            break
        token = more.group(1)
    return sorted(k for k in keys if k.endswith('.parquet'))


def row_groups(pq, key):
    """파일 하나의 행그룹별 bbox — 푸터만 읽는다 (몇 MB)."""
    pf = pq.ParquetFile(HttpFile(key))
    md = pf.metadata
    cols = [md.schema.column(i).name for i in range(md.num_columns)]
    ix = {n: cols.index(n) for n in ('xmin', 'xmax', 'ymin', 'ymax')}
    out = []
    for g in range(md.num_row_groups):
        rg = md.row_group(g)
        st = {n: rg.column(i).statistics for n, i in ix.items()}
        out.append((st['xmin'].min, st['ymin'].min, st['xmax'].max, st['ymax'].max))
    return out


def overlaps(box):
    return not (box[2] < BBOX[0] or box[0] > BBOX[2] or box[3] < BBOX[1] or box[1] > BBOX[3])


def fetch(tag):
    import pyarrow.parquet as pq
    from shapely import wkb
    prefix, columns = THEMES[tag][0], THEMES[tag][1]
    files = list_files('%s/%s/' % (RELEASE, prefix))
    print('%s: 파일 %d개에서 행그룹 찾는 중' % (tag, len(files)), flush=True)
    hits = []
    with ThreadPoolExecutor(12) as ex:
        for key, groups in zip(files, ex.map(lambda k: row_groups(pq, k), files)):
            good = [i for i, g in enumerate(groups) if overlaps(g)]
            if good:
                hits.append((key, good))
    feats = []
    for key, groups in hits:
        pf = pq.ParquetFile(HttpFile(key))
        for g in groups:
            tb = pf.read_row_group(g, columns=columns + ['bbox', 'geometry'])
            bb = tb.column('bbox').combine_chunks()
            xmin, xmax = bb.field('xmin').to_pylist(), bb.field('xmax').to_pylist()
            ymin, ymax = bb.field('ymin').to_pylist(), bb.field('ymax').to_pylist()
            idx = [i for i in range(tb.num_rows) if overlaps((xmin[i], ymin[i], xmax[i], ymax[i]))]
            if not idx:
                continue
            sub = tb.take(idx)
            data = {c: sub.column(c).to_pylist() for c in columns}
            geoms = sub.column('geometry').to_pylist()
            for i in range(len(idx)):
                row = {c: data[c][i] for c in columns}
                row['geom'] = wkb.loads(bytes(geoms[i])).__geo_interface__
                feats.append(json.loads(json.dumps(row, default=list)))
    os.makedirs(CACHE, exist_ok=True)
    with io.open(os.path.join(CACHE, tag + '.json'), 'w', encoding='utf-8') as f:
        json.dump(feats, f, ensure_ascii=False)
    print('%s: %d건 저장' % (tag, len(feats)), flush=True)


def fetch_admin():
    """행정동 경계 (오픈 데이터, GitHub). 구역 이름표에 쓴다."""
    url = ('https://raw.githubusercontent.com/raqoon886/Local_HangJeongDong/master/'
           'hangjeongdong_%EA%B2%BD%EA%B8%B0%EB%8F%84.geojson')
    with urllib.request.urlopen(url, timeout=180) as r:
        data = json.loads(r.read().decode())
    os.makedirs(CACHE, exist_ok=True)
    with io.open(os.path.join(CACHE, 'admdong.json'), 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    print('admdong: %d건 저장' % len(data['features']))


if __name__ == '__main__':
    todo = sys.argv[1:] or list(THEMES) + ['admin']
    for tag in todo:
        if tag == 'admin':
            fetch_admin()
        else:
            fetch(tag)
