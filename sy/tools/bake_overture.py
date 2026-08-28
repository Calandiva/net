# -*- coding: utf-8 -*-
"""받아 둔 실제 지형 데이터를 게임이 읽는 JS 모듈로 굽는다.

  python3 tools/overture_fetch.py   # 먼저 데이터를 받고 (망이 열린 곳에서 한 번)
  python3 tools/bake_overture.py    # src/world/data/*.js 를 다시 굽는다
  python3 build.py

굽는 것
  src/world/data/roads.js       실제 도로 중심선 + 도로명
  src/world/data/footprints.js  실제 건물 외곽선 (중심·크기·각도)
  src/world/data/ground.js      토지이용·수계·지형 구역
  src/world/data/landmarks.js   실제 좌표를 가진 주요 시설 (POI)

원본은 Overture Maps (OpenStreetMap 기여자, ODbL). 출처 표기는 README 참고.
"""
import io, json, math, os, sys, collections

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'overture-cache')
DATA = os.path.join(HERE, '..', 'src', 'world', 'data')

# 게임 세계 범위 — config.js 의 GEO 와 같아야 한다
WEST, SOUTH, EAST, NORTH = 126.5980, 37.6020, 126.6620, 37.6620
METERS_PER_TILE = 2.5
LAT0 = (SOUTH + NORTH) / 2
M_PER_DEG_LAT = 111132.0        # config.js GEO 와 같은 값을 쓴다
M_PER_DEG_LON = 88162.0

# Overture 도로 등급 → 게임 도로 등급 (config.js ROAD_CLASS)
ROAD_CLASS = {
    'motorway': 'expressway', 'motorway_link': 'local',
    'trunk': 'arterial', 'trunk_link': 'local',
    'primary': 'arterial', 'primary_link': 'local',
    'secondary': 'main', 'secondary_link': 'local',
    'tertiary': 'local', 'tertiary_link': 'local',
    'residential': 'local', 'living_street': 'alley',
    'unclassified': 'alley', 'service': 'alley',
    'pedestrian': 'path', 'footway': 'path', 'path': 'path',
    'steps': 'path', 'track': 'path', 'cycleway': 'path',
}

# Overture 건물 class → 게임 건물 종류 (config.js KIND)
BUILDING_KIND = {
    'apartments': 'apartment', 'residential': 'apartment', 'dormitory': 'apartment',
    'house': 'house', 'detached': 'house', 'terrace': 'house', 'semidetached_house': 'house',
    'bungalow': 'house', 'cabin': 'house', 'hut': 'house',
    'commercial': 'shop', 'retail': 'shop', 'supermarket': 'mart', 'kiosk': 'shop',
    'office': 'tower', 'hotel': 'tower',
    'industrial': 'factory', 'manufacture': 'factory', 'factory': 'factory',
    'warehouse': 'warehouse', 'storage_tank': 'warehouse', 'hangar': 'warehouse',
    'school': 'school', 'kindergarten': 'school', 'university': 'school', 'college': 'school',
    'hospital': 'hospital', 'clinic': 'hospital',
    'church': 'church', 'chapel': 'church', 'temple': 'church', 'cathedral': 'church',
    'civic': 'public', 'government': 'public', 'public': 'public', 'library': 'public',
    'train_station': 'station', 'transportation': 'station',
    'farm': 'farmhouse', 'farm_auxiliary': 'farmhouse', 'barn': 'farmhouse',
    'greenhouse': 'farmhouse', 'shed': 'farmhouse', 'stable': 'farmhouse',
    'roof': 'warehouse', 'garage': 'warehouse', 'garages': 'warehouse',
    'sports_hall': 'public', 'pavilion': 'park', 'toilets': 'park', 'service': 'warehouse',
}

# POI 분류 → 건물 종류 (이름과 함께 건물에 얹는다)
POI_KIND = {
    'transportation': 'station', 'train_station': 'station', 'railroad_freight': 'station',
    'grocery_store': 'mart', 'superstore': 'mart', 'shopping_center': 'mart',
    'cinema': 'tower', 'movie_theater': 'tower',   # 메가박스는 두원타워 안에 있다
    'elementary_school': 'school', 'middle_school': 'school', 'high_school': 'school',
    'school': 'school', 'university': 'school', 'kindergarten': 'school',
    'library': 'public', 'central_government_office': 'public', 'city_hall': 'public',
    'post_office': 'public', 'police_station': 'public', 'fire_station': 'public',
    'hospital': 'hospital', 'doctor': 'hospital', 'medical_center': 'hospital',
    'church_cathedral': 'church', 'buddhist_temple': 'church',
    'business_manufacturing_and_supply': 'factory',
}

# 토지이용/지형 → 지면 구역 성격 (world/map.js 의 kind)
LANDUSE_KIND = {
    'industrial': 'industrial', 'quarry': 'industrial', 'landfill': 'industrial',
    'farmland': 'field', 'allotments': 'field', 'orchard': 'field', 'vineyard': 'field',
    'greenhouse_horticulture': 'field', 'farmyard': 'field', 'meadow': 'field',
    'residential': 'city', 'commercial': 'city', 'retail': 'city', 'education': 'city',
    'school': 'city', 'institutional': 'city', 'religious': 'city',
    'park': 'park', 'grass': 'park', 'garden': 'park', 'village_green': 'park',
    'recreation_ground': 'park', 'pitch': 'park', 'playground': 'park',
    'cemetery': 'park', 'golf_course': 'park', 'winter_sports': 'park',
    'forest': 'forest', 'wood': 'forest', 'scrub': 'forest', 'grassland': 'field',
    'pedestrian': 'city', 'plaza': 'city',
}


WORLD_W = (EAST - WEST) * M_PER_DEG_LON / METERS_PER_TILE
WORLD_H = (NORTH - SOUTH) * M_PER_DEG_LAT / METERS_PER_TILE
PAD = 40.0          # 세계 밖으로 이만큼(타일)까지만 남긴다


def clip_polygon(points):
    """세계 상자로 폴리곤 자르기 (서덜랜드-호지먼)."""
    box = [(-PAD, -PAD), (WORLD_W + PAD, WORLD_H + PAD)]
    out = list(points)
    for side in range(4):
        if not out:
            return []
        src, out = out, []
        for i in range(len(src)):
            cur, prev = src[i], src[i - 1]
            cin, pin = inside(cur, side, box), inside(prev, side, box)
            if cin:
                if not pin:
                    out.append(intersect(prev, cur, side, box))
                out.append(cur)
            elif pin:
                out.append(intersect(prev, cur, side, box))
    return out


def inside(p, side, box):
    if side == 0: return p[0] >= box[0][0]
    if side == 1: return p[0] <= box[1][0]
    if side == 2: return p[1] >= box[0][1]
    return p[1] <= box[1][1]


def intersect(a, b, side, box):
    if side in (0, 1):
        x = box[0][0] if side == 0 else box[1][0]
        t = (x - a[0]) / ((b[0] - a[0]) or 1e-9)
        return [x, a[1] + t * (b[1] - a[1])]
    y = box[0][1] if side == 2 else box[1][1]
    t = (y - a[1]) / ((b[1] - a[1]) or 1e-9)
    return [a[0] + t * (b[0] - a[0]), y]


def clip_line(points):
    """세계 상자 밖 구간을 잘라 낸 폴리라인 조각들."""
    def ok(p):
        return -PAD <= p[0] <= WORLD_W + PAD and -PAD <= p[1] <= WORLD_H + PAD
    parts, cur = [], []
    for p in points:
        if ok(p):
            cur.append(p)
        else:
            if len(cur) > 1:
                parts.append(cur)
            cur = []
    if len(cur) > 1:
        parts.append(cur)
    return parts


def project(lon, lat):
    """경위도 → 타일 좌표 (world/geo.js 와 같은 식)."""
    x = (lon - WEST) * M_PER_DEG_LON / METERS_PER_TILE
    y = (NORTH - lat) * M_PER_DEG_LAT / METERS_PER_TILE
    return x, y


def load(tag):
    with io.open(os.path.join(CACHE, tag + '.json'), encoding='utf-8') as f:
        return json.load(f)


def name_of(row):
    n = row.get('names') or {}
    return (n.get('primary') or '').strip()


def rings(geom):
    """폴리곤/멀티폴리곤의 바깥 링들."""
    t = geom['type']
    if t == 'Polygon':
        return [geom['coordinates'][0]]
    if t == 'MultiPolygon':
        return [p[0] for p in geom['coordinates']]
    return []


def lines(geom):
    t = geom['type']
    if t == 'LineString':
        return [geom['coordinates']]
    if t == 'MultiLineString':
        return geom['coordinates']
    return []


def simplify(points, tol):
    """더글라스-포이커. points 는 [x, y] 목록 (타일 좌표)."""
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    span = math.hypot(dx, dy)
    worst, at = 0.0, 0
    for i in range(1, len(points) - 1):
        p = points[i]
        if span < 1e-9:
            d = math.hypot(p[0] - a[0], p[1] - a[1])
        else:
            d = abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / span
        if d > worst:
            worst, at = d, i
    if worst <= tol:
        return [a, b]
    return simplify(points[:at + 1], tol)[:-1] + simplify(points[at:], tol)


def min_rect(points):
    """회전 최소 넓이 사각형 → (cx, cy, w, h, 각도°). points 는 타일 좌표."""
    hull = convex_hull(points)
    if len(hull) < 3:
        xs = [p[0] for p in points]; ys = [p[1] for p in points]
        return ((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2,
                max(0.6, max(xs) - min(xs)), max(0.6, max(ys) - min(ys)), 0.0)
    best = None
    for i in range(len(hull)):
        ax, ay = hull[i]
        bx, by = hull[(i + 1) % len(hull)]
        ang = math.atan2(by - ay, bx - ax)
        cos, sin = math.cos(-ang), math.sin(-ang)
        us = [p[0] * cos - p[1] * sin for p in hull]
        vs = [p[0] * sin + p[1] * cos for p in hull]
        w, h = max(us) - min(us), max(vs) - min(vs)
        area = w * h
        if best is None or area < best[0]:
            cu, cv = (min(us) + max(us)) / 2, (min(vs) + max(vs)) / 2
            cx = cu * math.cos(ang) - cv * math.sin(ang)
            cy = cu * math.sin(ang) + cv * math.cos(ang)
            best = (area, cx, cy, w, h, math.degrees(ang))
    _, cx, cy, w, h, deg = best
    if w < h:                      # 긴 쪽이 가로가 되게 맞춘다
        w, h, deg = h, w, deg + 90
    deg = ((deg + 90) % 180) - 90  # -90 ~ 90
    return cx, cy, w, h, deg


def convex_hull(points):
    pts = sorted(set((round(p[0], 3), round(p[1], 3)) for p in points))
    if len(pts) < 3:
        return pts
    def half(seq):
        out = []
        for p in seq:
            while len(out) >= 2:
                (x1, y1), (x2, y2) = out[-2], out[-1]
                if (x2 - x1) * (p[1] - y1) - (y2 - y1) * (p[0] - x1) > 0:
                    break
                out.pop()
            out.append(p)
        return out
    return half(pts)[:-1] + half(reversed(pts))[:-1]


def num(v, digits=1):
    s = '%.*f' % (digits, v)
    if '.' in s:
        s = s.rstrip('0').rstrip('.')
    if s in ('', '-', '-0', '-0.0'):
        s = '0'
    return s


def header(title, extra=''):
    return ('// %s\n//\n'
            '// 이 파일은 tools/bake_overture.py 가 만든다. 손으로 고치지 말 것.\n'
            '// 원본: Overture Maps (OpenStreetMap 기여자, ODbL) · %s\n%s\n'
            % (title, RELEASE_NOTE, extra))


RELEASE_NOTE = '2026-08-19 릴리스'


# 이름난 시설의 층수·안내문. 데이터에는 없는 것이라 여기 적어 둔다.
# (실제로 있는 시설만 적는다 — 없는 이름을 지어내지 않는다)
# POI 이름이 지저분할 때 쓰는 표준 이름 (실제로 쓰이는 이름으로만 정리한다)
ALIASES = {
    '이마트 (emart)': '이마트 김포한강점',
    '홀리카홀리카 이마트 김포한강점': '이마트 김포한강점',
    '김포 한강신도시 메가박스': '메가박스 김포한강신도시',
    '양촌읍행정복지센터': '양촌읍 행정복지센터',
}

# 건물이 없는 시설(지하역 등)은 이 크기로 하나 세운다 — [가로, 세로] 타일
SYNTHETIC = {
    'station': (9, 7),
    'mart': (26, 18),
    'public': (14, 9),
}

NOTES = {
    '구래역': dict(floors=1, basement=2, note='김포 골드라인 · 양촌 ↔ 마산',
                 floor_names={'-2': '승강장', '-1': '대합실', '1': '역사 출입구'},
                 metro={'line': '김포 골드라인', 'order': 2}, kind='station'),
    '마산역': dict(floors=1, basement=2, note='김포 골드라인 · 구래 ↔ 장기',
                 floor_names={'-2': '승강장', '-1': '대합실', '1': '역사 출입구'},
                 metro={'line': '김포 골드라인', 'order': 3}, kind='station'),
    '양촌역': dict(floors=1, basement=2, note='김포 골드라인 기점 · 산업단지 방면',
                 floor_names={'-2': '승강장', '-1': '대합실', '1': '역사 출입구'},
                 metro={'line': '김포 골드라인', 'order': 1}, kind='station'),
    '이마트 김포한강점': dict(floors=4, basement=2, note='구래역 4번 출구 · 10:00 ~ 23:00',
                      floor_names={'-2': '주차장', '-1': '주차장', '1': '식품매장',
                                   '2': '생활용품', '3': '가전·푸드코트', '4': '문화센터'},
                      kind='mart'),
    '두원타워': dict(floors=12, basement=2, note='8층 메가박스 김포한강신도시',
                  floor_names={'-2': '주차장', '-1': '주차장', '1': '로비·은행', '2': '학원',
                               '3': '병원', '4': '학원', '5': '사무실', '6': '사무실',
                               '7': '사무실', '8': '메가박스', '9': '메가박스 상영관',
                               '10': '사무실', '11': '사무실', '12': '옥상'},
                  kind='tower'),
    '구래동 행정복지센터': dict(floors=4, basement=1, note='민원실은 1층입니다', kind='public'),
    '양촌읍행정복지센터': dict(floors=3, basement=0, kind='public'),
    '양곡도서관': dict(floors=3, basement=1, note='열람실은 3층',
                  floor_names={'-1': '주차장', '1': '종합자료실', '2': '어린이자료실', '3': '열람실'},
                  kind='public'),
}


def bake_roads():
    rows = [r for r in load('roads') if r.get('subtype') == 'road']
    out, kept = [], 0
    for r in rows:
        cls = ROAD_CLASS.get(r.get('class') or '', 'alley')
        name = name_of(r)
        for line in lines(r['geom']):
            for part in clip_line([list(project(p[0], p[1])) for p in line]):
                pts = simplify(part, 0.9)
                if len(pts) < 2:
                    continue
                length = sum(math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1])
                             for i in range(len(pts) - 1))
                if length < 6 and not name:   # 아주 짧은 이름 없는 토막은 버린다
                    continue
                kept += 1
                out.append((name, cls, pts))
    body = ['export const ROADS = [']
    for name, cls, pts in out:
        coords = ','.join('[%s,%s]' % (num(x), num(y)) for x, y in pts)
        body.append("  { name: %s, cls: '%s', tiles: [%s] },"
                    % (json.dumps(name, ensure_ascii=False) if name else 'null', cls, coords))
    body.append('];')
    text = header('실제 도로 중심선. 좌표는 타일 단위 (world/geo.js 의 투영과 같다).',
                  '// 등급: expressway 자동차전용 · arterial 간선 · main 4~6차선 ·\n'
                  '//       local 2차선 · alley 골목·구내도로 · path 보행로\n')
    write('roads.js', text + '\n'.join(body) + '\n')
    print('roads.js  도로 %d개' % kept)


def bake_footprints():
    from shapely.geometry import shape, Point
    buildings = load('buildings')
    places = load('places')

    # POI 를 건물에 얹는다 (건물 안에 있는 점 → 그 건물의 이름·용도)
    shapes = []
    for b in buildings:
        try:
            shapes.append(shape(b['geom']))
        except Exception:
            shapes.append(None)
    poi_for, orphans = {}, []
    for p in places:
        nm = ALIASES.get(name_of(p), name_of(p))
        if not nm:
            continue
        cat = ((p.get('categories') or {}).get('primary') or '')
        pt = shape(p['geom'])
        best, bestd = None, 1e9
        for i, g in enumerate(shapes):
            if g is None:
                continue
            if g.bounds[0] - 0.0004 > pt.x or g.bounds[2] + 0.0004 < pt.x:
                continue
            if g.bounds[1] - 0.0004 > pt.y or g.bounds[3] + 0.0004 < pt.y:
                continue
            d = g.distance(pt)
            if d < bestd:
                best, bestd = i, d
        # 이름난 시설(역·마트·학교…)이 이름 없는 가게보다, 아는 시설이 그보다 우선한다
        rank = (3 if nm in NOTES else 2 if cat in POI_KIND else 1)
        if best is None or bestd > 0.00025:      # 25m 넘게 떨어지면 남의 건물이다
            if rank >= 2 and POI_KIND.get(cat) in SYNTHETIC:
                orphans.append((nm, POI_KIND.get(cat), pt.x, pt.y))
            continue
        prev = poi_for.get(best)
        if not prev or rank > prev[2]:
            poi_for[best] = (nm, POI_KIND.get(cat), rank)

    kinds, names = [], []
    kind_ix, name_ix = {}, {}
    rows = []
    for i, b in enumerate(buildings):
        g = shapes[i]
        if g is None or g.is_empty:
            continue
        ring = list(g.exterior.coords) if g.geom_type == 'Polygon' else \
            max((list(p.exterior.coords) for p in g.geoms), key=len)
        pts = [project(x, y) for x, y in ring]
        cx, cy, w, h, deg = min_rect(pts)
        if not (-PAD <= cx <= WORLD_W + PAD and -PAD <= cy <= WORLD_H + PAD):
            continue
        w, h = max(3.0, w), max(3.0, h)
        if w > 120 or h > 120:                   # 터무니없이 큰 것은 데이터 오류로 본다
            continue
        poi = poi_for.get(i)
        kind = (poi[1] if poi and poi[1] else None) \
            or BUILDING_KIND.get(b.get('class') or '') \
            or ('shop' if poi else None)
        own = ALIASES.get(name_of(b), name_of(b))
        # 건물 자체 이름이 아는 시설이면 그게 우선이다 (안에 든 가게 이름에 밀리지 않게)
        name = own if own in NOTES else (poi[0] if poi else own)
        note = NOTES.get(name)
        if note and note.get('kind'):
            kind = note['kind']
        if not kind:
            kind = 'house' if w * h < 60 else 'shop'
        floors = b.get('num_floors')
        if not floors and b.get('height'):
            floors = max(1, int(round(b['height'] / 3.2)))
        if note:
            floors = note['floors']
        if not floors:
            floors = {'apartment': 15, 'tower': 10, 'factory': 2, 'warehouse': 1,
                      'house': 2, 'shop': 4, 'school': 4, 'public': 3, 'mart': 3,
                      'hospital': 5, 'church': 2, 'station': 1, 'farmhouse': 1,
                      'park': 1}.get(kind, 2)
        basement = note['basement'] if note else (1 if kind in ('mart', 'tower') else 0)
        if kind not in kind_ix:
            kind_ix[kind] = len(kinds); kinds.append(kind)
        ni = -1
        if name:
            if name not in name_ix:
                name_ix[name] = len(names); names.append(name)
            ni = name_ix[name]
        rows.append((cx, cy, w, h, deg, kind_ix[kind], ni, floors, basement))

    # 건물 외곽선이 없는 시설(지하역 등)은 자리에 하나 세워 준다
    taken = set(names)
    for nm, kind, lon, lat in orphans:
        if nm in taken:
            continue
        taken.add(nm)
        cx, cy = project(lon, lat)
        if not (-PAD <= cx <= WORLD_W + PAD and -PAD <= cy <= WORLD_H + PAD):
            continue
        note = NOTES.get(nm)
        w, h = SYNTHETIC[kind]
        if kind not in kind_ix:
            kind_ix[kind] = len(kinds); kinds.append(kind)
        name_ix[nm] = len(names); names.append(nm)
        rows.append((cx, cy, float(w), float(h), 0.0, kind_ix[kind], name_ix[nm],
                     note['floors'] if note else 2, note['basement'] if note else 0))

    body = ['export const B_KINDS = %s;' % json.dumps(kinds, ensure_ascii=False),
            '',
            'export const B_NAMES = [']
    for n in names:
        body.append('  %s,' % json.dumps(n, ensure_ascii=False))
    body.append('];')
    body.append('')
    body.append('// [중심x, 중심y, 가로, 세로, 각도(도), 종류, 이름번호(-1=없음), 지상층, 지하층]')
    body.append('export const FOOTPRINTS = [')
    for r in rows:
        body.append('  [%s,%s,%s,%s,%s,%d,%d,%d,%d],'
                    % (num(r[0]), num(r[1]), num(r[2]), num(r[3]), num(r[4], 0),
                       r[5], r[6], r[7], r[8]))
    body.append('];')
    write('footprints.js',
          header('실제 건물 외곽선. 회전 최소 사각형으로 줄여 담았다.') + '\n'.join(body) + '\n')
    print('footprints.js  건물 %d개 · 이름 %d개' % (len(rows), len(names)))
    return {names[r[6]]: (r[0], r[1]) for r in rows if r[6] >= 0}


def write(name, text):
    path = os.path.join(DATA, name)
    with io.open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)


# 수계 등급 → 폭(미터)
WATER_WIDTH = {'river': 40, 'canal': 25, 'stream': 8, 'drain': 5, 'ditch': 4, 'water': 12}


def bake_ground():
    """토지이용·지형·수계·행정동 이름표를 하나의 지면 데이터로 굽는다."""
    areas = []

    def add_area(kind, name, geom, min_tiles, label=False):
        for ring in rings(geom):
            pts = clip_polygon([list(project(x, y)) for x, y in ring])
            if len(pts) < 4:
                continue
            pts = simplify(pts + [pts[0]], 1.4)
            if len(pts) < 4:
                continue
            area = abs(sum(pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]
                           for i in range(len(pts) - 1))) / 2
            if area < min_tiles:
                continue
            areas.append((kind, name if label else None, pts, area))

    for row in load('landuse'):
        kind = LANDUSE_KIND.get(row.get('class') or '')
        if not kind:
            continue
        add_area(kind, name_of(row), row['geom'], 60, label=True)
    for row in load('land'):
        cls = row.get('class') or ''
        kind = LANDUSE_KIND.get(cls)
        if cls in ('wood', 'forest', 'scrub'):
            kind = 'forest'
        if not kind:
            continue
        add_area(kind, name_of(row), row['geom'], 120, label=True)
    for row in load('water'):
        if row['geom']['type'] in ('Polygon', 'MultiPolygon'):
            add_area('water', name_of(row), row['geom'], 20, label=True)

    waterways = []
    for row in load('water'):
        width = WATER_WIDTH.get(row.get('class') or '', 6)
        for line in lines(row['geom']):
            for part in clip_line([list(project(x, y)) for x, y in line]):
                pts = simplify(part, 0.9)
                if len(pts) < 2:
                    continue
                waterways.append((name_of(row), width, pts))

    # 도시 지역의 바탕 — 행정동 경계 안은 보도블럭이 기본이다 (논밭이 아니라).
    # 위의 토지이용 구역이 그 위를 덮는다.
    CITY_DONG = ('구래동', '마산동', '장기동', '장기본동', '운양동')

    # 산봉우리 이름 (가현산 · 학운산 …)
    labels = []
    for row in load('land'):
        if row.get('class') != 'peak' or row['geom']['type'] != 'Point':
            continue
        nm = name_of(row)
        if not nm:
            continue
        x, y = project(row['geom']['coordinates'][0], row['geom']['coordinates'][1])
        if -PAD <= x <= WORLD_W + PAD and -PAD <= y <= WORLD_H + PAD:
            labels.append((nm, x, y, None))

    # 행정동 이름표 (오픈 데이터)
    if os.path.exists(os.path.join(CACHE, 'admdong.json')):
        with io.open(os.path.join(CACHE, 'admdong.json'), encoding='utf-8') as f:
            adm = json.load(f)
        for f2 in adm['features']:
            nm = f2['properties'].get('adm_nm', '')
            if '김포시' not in nm:
                continue
            short = nm.split()[-1]
            polys = f2['geometry']['coordinates'] if f2['geometry']['type'] == 'MultiPolygon' \
                else [f2['geometry']['coordinates']]
            best = None
            for poly in polys:
                ring = poly[0]
                inside = [p for p in ring if WEST <= p[0] <= EAST and SOUTH <= p[1] <= NORTH]
                if len(inside) < 3:
                    continue
                cx = sum(p[0] for p in inside) / len(inside)
                cy = sum(p[1] for p in inside) / len(inside)
                if best is None or len(inside) > best[2]:
                    best = (cx, cy, len(inside), ring)
            if best:
                x, y = project(best[0], best[1])
                ring = clip_polygon([list(project(p[0], p[1])) for p in best[3]])
                labels.append((short, x, y, simplify(ring + [ring[0]], 2.0) if len(ring) > 3 else None))
            if short in CITY_DONG:
                for poly in polys:
                    pts = clip_polygon([list(project(p[0], p[1])) for p in poly[0]])
                    if len(pts) < 4:
                        continue
                    pts = simplify(pts + [pts[0]], 1.2)
                    area = abs(sum(pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1]
                                   for i in range(len(pts) - 1))) / 2
                    if area > 400:
                        areas.append(('city', None, pts, area))

    # 큰 것부터 그려야 작은 것이 위에 남는다
    areas.sort(key=lambda a: -a[3])

    body = ['// [성격, 이름(없으면 null), 꼭짓점...]']
    body.append('export const GROUND_AREAS = [')
    for kind, name, pts, _ in areas:
        coords = ','.join('[%s,%s]' % (num(x), num(y)) for x, y in pts)
        body.append("  { kind: '%s', name: %s, path: [%s] }," %
                    (kind, json.dumps(name, ensure_ascii=False) if name else 'null', coords))
    body.append('];')
    body.append('')
    body.append('export const WATERWAYS = [')
    for name, width, pts in waterways:
        coords = ','.join('[%s,%s]' % (num(x), num(y)) for x, y in pts)
        body.append('  { name: %s, width: %d, path: [%s] },' %
                    (json.dumps(name, ensure_ascii=False) if name else 'null', width, coords))
    body.append('];')
    body.append('')
    body.append('// 동네·산 이름표. path 가 있으면 그 안에 있을 때 이 이름을 쓴다.')
    body.append('export const AREA_LABELS = [')
    for name, x, y, path in labels:
        coords = ('[' + ','.join('[%s,%s]' % (num(px2), num(py2)) for px2, py2 in path) + ']') \
            if path else 'null'
        body.append("  { name: '%s', x: %s, y: %s, path: %s }," % (name, num(x), num(y), coords))
    body.append('];')
    write('ground.js', header('실제 토지이용 · 수계 · 지형') + '\n'.join(body) + '\n')
    print('ground.js  구역 %d · 물길 %d · 이름표 %d' % (len(areas), len(waterways), len(labels)))


def bake_landmarks():
    """이름과 자리가 확인된 시설 — 건물 데이터에 얹을 안내문·층 구성."""
    body = ['// 이름 → { 층수, 지하층, 안내문, 층별 용도, 지하철 }']
    body.append('export const LANDMARK_NOTES = {')
    for name, note in NOTES.items():
        parts = ['floors: %d' % note['floors'], 'basement: %d' % note['basement'],
                 "kind: '%s'" % note['kind']]
        if note.get('note'):
            parts.append('note: %s' % json.dumps(note['note'], ensure_ascii=False))
        if note.get('floor_names'):
            parts.append('floorNames: %s' % json.dumps(note['floor_names'], ensure_ascii=False))
        if note.get('metro'):
            parts.append('metro: %s' % json.dumps(note['metro'], ensure_ascii=False))
        body.append('  %s: { %s },' % (json.dumps(name, ensure_ascii=False), ', '.join(parts)))
    body.append('};')
    write('landmarks.js', header('주요 시설 안내 (층 구성 · 안내문)') + '\n'.join(body) + '\n')
    print('landmarks.js  시설 %d개' % len(NOTES))


if __name__ == '__main__':
    bake_roads()
    bake_footprints()
    bake_ground()
    bake_landmarks()
