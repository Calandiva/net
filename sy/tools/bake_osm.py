# -*- coding: utf-8 -*-
"""OSM Overpass → world/data/*.osm.js 로 굽는 개발용 스크립트.

게임은 이 스크립트 없이도 돈다. 지금 들어 있는 지역 데이터는 손으로 넣은 근사치이고,
이 스크립트는 그걸 실제 OSM 데이터로 갈아끼우고 싶을 때 개발 머신에서 한 번만 돌린다.
결과물(.osm.js)만 레포에 커밋하면 실행 시점에는 네트워크가 필요 없다.

  python3 tools/bake_osm.py                 # 기본 영역(config.js 의 GEO)
  python3 tools/bake_osm.py --out src/world/data

굽고 나서 src/world/data/index.js 의 import 를 .osm.js 로 바꾸면 끝이다.
스키마는 손으로 쓴 파일과 같다.

주의: Overpass 는 공용 서버다. 영역을 넓게 잡으면 거절당한다. 한 번 받아서 커밋하고,
반복 실행하지 않는다.
"""
import argparse
import io
import json
import os
import re
import sys
import urllib.request

OVERPASS = 'https://overpass-api.de/api/interpreter'

# config.js 에서 영역을 그대로 읽어 온다 (두 곳에 좌표를 적지 않기 위해)
def read_geo(config_path):
    text = io.open(config_path, encoding='utf-8').read()
    block = re.search(r'export const GEO = \{(.*?)\};', text, re.S).group(1)
    def num(key):
        return float(re.search(key + r':\s*([-\d.]+)', block).group(1))
    return num('south'), num('west'), num('north'), num('east')


QUERY = '''[out:json][timeout:180];
(
  way["building"]({bbox});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|footway|path)$"]({bbox});
  way["waterway"]({bbox});
  way["natural"="water"]({bbox});
  way["landuse"~"^(industrial|residential|commercial|farmland|forest|grass|retail)$"]({bbox});
  relation["landuse"]({bbox});
  node["railway"="station"]({bbox});
);
out body geom;
'''

# OSM 태그 → 우리 스키마
HIGHWAY_CLASS = {
    'motorway': 'expressway', 'trunk': 'expressway',
    'primary': 'arterial', 'secondary': 'arterial',
    'tertiary': 'main', 'residential': 'local', 'unclassified': 'local',
    'living_street': 'alley', 'service': 'alley',
    'footway': 'path', 'path': 'path',
}
LANDUSE_KIND = {
    'industrial': 'industrial', 'residential': 'city', 'commercial': 'city',
    'retail': 'city', 'farmland': 'field', 'forest': 'forest', 'grass': 'park',
}
BUILDING_KIND = {
    'apartments': 'APARTMENT', 'residential': 'APARTMENT', 'house': 'HOUSE',
    'detached': 'HOUSE', 'retail': 'SHOP', 'commercial': 'SHOP',
    'industrial': 'FACTORY', 'warehouse': 'WAREHOUSE', 'school': 'SCHOOL',
    'hospital': 'HOSPITAL', 'church': 'CHURCH', 'train_station': 'STATION',
    'public': 'PUBLIC', 'civic': 'PUBLIC',
}


def fetch(bbox):
    query = QUERY.format(bbox=bbox)
    req = urllib.request.Request(OVERPASS, data=query.encode('utf-8'),
                                 headers={'User-Agent': 'gurae-map-bake/1.0'})
    with urllib.request.urlopen(req, timeout=300) as res:
        return json.loads(res.read().decode('utf-8'))


def geom(el):
    return [[round(p['lon'], 6), round(p['lat'], 6)] for p in el.get('geometry', [])]


def js_path(points, indent='      '):
    chunks, line = [], []
    for lon, lat in points:
        line.append('[%s, %s]' % (lon, lat))
        if len(line) == 4:
            chunks.append(', '.join(line))
            line = []
    if line:
        chunks.append(', '.join(line))
    return (',\n' + indent).join(chunks)


def bake(data, out_dir):
    regions, roads, places = [], [], []
    for el in data.get('elements', []):
        tags = el.get('tags', {})
        pts = geom(el)
        if len(pts) < 2:
            continue
        if 'highway' in tags:
            cls = HIGHWAY_CLASS.get(tags['highway'])
            if cls:
                roads.append((tags.get('name', ''), cls, pts))
        elif 'landuse' in tags:
            kind = LANDUSE_KIND.get(tags['landuse'])
            if kind:
                regions.append((tags.get('name', ''), kind, pts))
        elif tags.get('natural') == 'water' or 'waterway' in tags:
            regions.append((tags.get('name', ''), 'water', pts))
        elif 'building' in tags:
            lons = [p[0] for p in pts]
            lats = [p[1] for p in pts]
            kind = BUILDING_KIND.get(tags['building'], 'SHOP')
            places.append((
                tags.get('name', ''), kind,
                round(sum(lons) / len(lons), 6), round(sum(lats) / len(lats), 6),
                # 폭·높이를 미터로 (경도 1도 ≈ 88150m, 위도 1도 ≈ 110990m)
                round((max(lons) - min(lons)) * 88150),
                round((max(lats) - min(lats)) * 110990),
                int(tags.get('building:levels', 0) or 0),
            ))

    head = ('// tools/bake_osm.py 가 만든 파일. 직접 고치지 말 것.\n'
            '// 출처: OpenStreetMap contributors (ODbL). 손으로 쓴 파일과 스키마가 같다.\n\n')

    with io.open(os.path.join(out_dir, 'roads.osm.js'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(head + 'export const ROADS = [\n')
        for name, cls, pts in roads:
            f.write("  { name: %s, cls: '%s',\n    path: [%s] },\n"
                    % (json.dumps(name, ensure_ascii=False), cls, js_path(pts)))
        f.write('];\n')

    with io.open(os.path.join(out_dir, 'regions.osm.js'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(head + "import { GROUND } from '../../config.js';\n\n"
                'const KIND_GROUND = {\n'
                '  city: GROUND.GRASS, field: GROUND.FIELD, industrial: GROUND.YARD,\n'
                '  park: GROUND.GRASS, forest: GROUND.GRASS, water: GROUND.WATER,\n'
                '};\n\nexport const REGIONS = [\n')
        for i, (name, kind, pts) in enumerate(regions):
            f.write("  { id: 'osm%d', name: %s, kind: '%s', ground: KIND_GROUND['%s'],\n"
                    "    label: %s,\n    path: [%s] },\n"
                    % (i, json.dumps(name, ensure_ascii=False), kind, kind,
                       'true' if name else 'false', js_path(pts)))
        f.write('];\n\nexport const WATERWAYS = [];\n')

    with io.open(os.path.join(out_dir, 'places.osm.js'), 'w', encoding='utf-8', newline='\n') as f:
        f.write(head + "import { KIND } from '../../config.js';\n\nexport const PLACES = [\n")
        for name, kind, lon, lat, w, h, levels in places:
            if not name or w < 6 or h < 6:
                continue  # 이름 없는 작은 건물은 절차 생성에 맡긴다
            f.write("  { name: %s, kind: KIND.%s, lon: %s, lat: %s, w: %d, h: %d,\n"
                    "    floors: %d, basement: 0 },\n"
                    % (json.dumps(name, ensure_ascii=False), kind, lon, lat, w, h,
                       levels or 3))
        f.write('];\n')

    print('구웠다: 도로 %d · 구역 %d · 건물 %d' % (len(roads), len(regions), len(places)))
    print('src/world/data/index.js 의 import 를 *.osm.js 로 바꾸면 적용된다.')


def main():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(here, 'src', 'world', 'data'))
    ap.add_argument('--cache', default=os.path.join(here, 'tools', 'osm-cache.json'))
    args = ap.parse_args()

    south, west, north, east = read_geo(os.path.join(here, 'src', 'config.js'))
    bbox = '%s,%s,%s,%s' % (south, west, north, east)

    if os.path.exists(args.cache):
        print('받아 둔 응답을 쓴다: %s' % args.cache)
        data = json.load(io.open(args.cache, encoding='utf-8'))
    else:
        print('Overpass 에 요청한다: %s' % bbox)
        try:
            data = fetch(bbox)
        except Exception as err:              # 네트워크가 막힌 환경에서도 친절하게
            print('실패: %s' % err, file=sys.stderr)
            print('망이 막혀 있으면 다른 곳에서 받은 Overpass JSON 을 %s 에 두고 다시 돌리면 된다.'
                  % args.cache, file=sys.stderr)
            raise SystemExit(1)
        json.dump(data, io.open(args.cache, 'w', encoding='utf-8'), ensure_ascii=False)

    bake(data, args.out)


if __name__ == '__main__':
    main()
