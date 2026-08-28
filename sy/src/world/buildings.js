// 건물 정의 · 배치 · 출입구. 실내 생성은 world/interior.js 가 맡는다.
//
// 랜드마크(places.js)를 먼저 놓고, 절차 생성 건물은 이미 놓인 건물이나
// 도로와 겹치면 버린다. 그래서 데이터에 손을 대도 지도가 깨지지 않는다.

import { SEED, BUILDING, KIND, TILE, GEO } from '../config.js';
import { project, projectPath, metersToTiles } from './geo.js';
import { GridIndex, rectsOverlap } from './spatial.js';
import { makeRng } from '../util/rng.js';
import { expandDistricts } from './blocks.js';
import { PLACES } from './data/places.js';
import { ROADS } from './data/roads.js';
import { ROAD_CLASS } from '../config.js';

// 도로 선분 인덱스 — 건물이 길 위에 올라앉지 않게 막는 데 쓴다.
// 청크 래스터라이즈에서도 같은 인덱스를 재사용한다.
export function buildRoadIndex(generatedRoads) {
  const index = new GridIndex(TILE.chunk);
  const all = [];
  const add = (name, cls, tiles) => {
    const spec = ROAD_CLASS[cls];
    const half = spec.width / 2 + spec.sidewalk;
    let travelled = 0; // 도로 시작점부터의 누적 길이 — 횡단보도 간격에 쓴다
    for (let i = 0; i < tiles.length - 1; i++) {
      const [ax, ay] = tiles[i], [bx, by] = tiles[i + 1];
      const seg = { name, cls, spec, half, ax, ay, bx, by, dist0: travelled };
      travelled += Math.hypot(bx - ax, by - ay);
      all.push(seg);
      index.insert(seg,
        Math.min(ax, bx) - half - 2, Math.min(ay, by) - half - 2,
        Math.max(ax, bx) + half + 2, Math.max(ay, by) + half + 2);
    }
  };
  for (const road of ROADS) add(road.name, road.cls, projectPath(road.path));
  for (const road of generatedRoads) add(road.name, road.cls, road.tiles);
  return { index, all };
}

// 선분이 사각형(여유 pad 포함)을 지나가는가 — 굵은 선 vs 상자 간이 판정
function segmentHitsRect(seg, rect, pad) {
  const minX = rect.x - pad, minY = rect.y - pad;
  const maxX = rect.x + rect.w + pad, maxY = rect.y + rect.h + pad;
  let { ax, ay, bx, by } = seg;
  // 양 끝이 한쪽으로 완전히 벗어나 있으면 안 만난다
  if ((ax < minX && bx < minX) || (ax > maxX && bx > maxX)) return false;
  if ((ay < minY && by < minY) || (ay > maxY && by > maxY)) return false;
  // 끝점이 안에 있으면 만난다
  if (ax >= minX && ax <= maxX && ay >= minY && ay <= maxY) return true;
  if (bx >= minX && bx <= maxX && by >= minY && by <= maxY) return true;
  // 나머지는 선분-슬랩 교차
  const dx = bx - ax, dy = by - ay;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, ax - minX], [dx, maxX - ax], [-dy, ay - minY], [dy, maxY - ay]]) {
    if (p === 0) { if (q < 0) return false; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
    else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}

// 출입구 자리 정하기: 가장 가까운 길 쪽 벽 한가운데
function placeDoor(rect, roads, rng) {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const r = BUILDING.doorProbeRadius;
  const near = roads.index.query(cx - r, cy - r, cx + r, cy + r);
  let best = null, bestD = Infinity;
  for (const seg of near) {
    // 선분 위에서 건물 중심에 가장 가까운 점
    const dx = seg.bx - seg.ax, dy = seg.by - seg.ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((cx - seg.ax) * dx + (cy - seg.ay) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = seg.ax + t * dx, py = seg.ay + t * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d < bestD) { bestD = d; best = { px, py }; }
  }

  let dir = 'S';
  if (best) {
    const vx = best.px - cx, vy = best.py - cy;
    if (Math.abs(vx) > Math.abs(vy)) dir = vx > 0 ? 'E' : 'W';
    else dir = vy > 0 ? 'S' : 'N';
  }

  // 벽 가운데에서 살짝 흔들어 배치 (전부 정가운데면 심심하다)
  const jx = rect.w > 6 ? rng.int(-1, 1) : 0;
  const jy = rect.h > 6 ? rng.int(-1, 1) : 0;
  switch (dir) {
    case 'N': return { x: rect.x + Math.floor(rect.w / 2) + jx, y: rect.y, dir };
    case 'S': return { x: rect.x + Math.floor(rect.w / 2) + jx, y: rect.y + rect.h - 1, dir };
    case 'W': return { x: rect.x, y: rect.y + Math.floor(rect.h / 2) + jy, dir };
    default: return { x: rect.x + rect.w - 1, y: rect.y + Math.floor(rect.h / 2) + jy, dir };
  }
}

// 문 앞(건물 바깥) 한 칸 — 나올 때 여기에 선다
export function doorOutside(b) {
  switch (b.door.dir) {
    case 'N': return { x: b.door.x, y: b.door.y - 1 };
    case 'S': return { x: b.door.x, y: b.door.y + 1 };
    case 'W': return { x: b.door.x - 1, y: b.door.y };
    default: return { x: b.door.x + 1, y: b.door.y };
  }
}

// 도로명주소를 만든다.
// 실제 규칙: 도로 시작점부터 20m 마다 번호가 1씩 오르고, 왼쪽이 홀수 오른쪽이 짝수.
// 이름을 알 수 없는 건물에는 지어낸 상호 대신 이 주소를 붙인다.
export function buildingAddress(rect, roads) {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const r = BUILDING.doorProbeRadius;
  let best = null, bestD = Infinity;
  for (const seg of roads.index.query(cx - r, cy - r, cx + r, cy + r)) {
    if (!seg.name) continue;                 // 이름 있는 도로만 주소가 된다
    const dx = seg.bx - seg.ax, dy = seg.by - seg.ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((cx - seg.ax) * dx + (cy - seg.ay) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = seg.ax + t * dx, py = seg.ay + t * dy;
    const d = Math.hypot(px - cx, py - cy);
    if (d < bestD) {
      bestD = d;
      // 진행 방향 기준 왼쪽인지 오른쪽인지 (외적 부호)
      const side = dx * (cy - seg.ay) - dy * (cx - seg.ax);
      best = { seg, along: seg.dist0 + t * Math.sqrt(len2), left: side < 0 };
    }
  }
  if (!best) return null;
  const meters = best.along * GEO.metersPerTile;
  const number = Math.max(1, Math.floor(meters / 20) * 2 + (best.left ? 1 : 2));
  return `${best.seg.name} ${number}`;
}

let nextId = 1;

function makeBuilding(spec, roads, index, placed) {
  const rect = { x: spec.x, y: spec.y, w: spec.w, h: spec.h };
  if (rect.w < BUILDING.minTiles || rect.h < BUILDING.minTiles) return null;

  // 이미 놓인 건물과 겹치면 버린다
  for (const other of index.query(rect.x - 2, rect.y - 2,
      rect.x + rect.w + 2, rect.y + rect.h + 2)) {
    if (rectsOverlap(rect, other, 1)) return null;
  }
  // 길 위에 올라앉아도 버린다
  if (!spec.landmark) {
    const near = roads.index.query(rect.x - 8, rect.y - 8, rect.x + rect.w + 8, rect.y + rect.h + 8);
    for (const seg of near) {
      if (segmentHitsRect(seg, rect, seg.half + 0.5)) return null;
    }
  }

  // 이름이 없는 건물은 도로명주소로 부른다
  let name = spec.name;
  if (!name && spec.address) {
    const addr = buildingAddress(rect, roads);
    name = addr ? (spec.suffix ? `${addr} ${spec.suffix}` : addr)
      : (spec.suffix || '이름 없는 건물');
  }

  const rng = makeRng(SEED, 'building', name, rect.x, rect.y);
  const b = {
    id: nextId++,
    name, kind: spec.kind,
    x: rect.x, y: rect.y, w: rect.w, h: rect.h,
    floors: Math.max(1, spec.floors | 0),
    basement: spec.basement | 0,
    note: spec.note || '',
    metro: spec.metro || null,
    districtId: spec.districtId || null,
    seed: rng.int(0, 0xffff),
    landmark: !!spec.landmark,
  };
  b.door = placeDoor(rect, roads, rng);
  placed.push(b);
  index.insert(b, b.x, b.y, b.x + b.w, b.y + b.h);
  return b;
}

// 세상의 모든 건물을 만든다. 시작할 때 한 번.
export function buildBuildings() {
  const districts = expandDistricts();
  const roads = buildRoadIndex(districts.roads);
  const index = new GridIndex(TILE.chunk);
  const placed = [];

  // 1) 랜드마크 먼저 — 이쪽이 우선권을 갖는다
  for (const p of PLACES) {
    const [tx, ty] = project([p.lon, p.lat]);
    const w = Math.max(BUILDING.minTiles, Math.round(metersToTiles(p.w)));
    const h = Math.max(BUILDING.minTiles, Math.round(metersToTiles(p.h)));
    makeBuilding({
      ...p, landmark: true,
      x: Math.round(tx - w / 2), y: Math.round(ty - h / 2), w, h,
    }, roads, index, placed);
  }

  // 2) 절차 생성 건물
  for (const spec of districts.buildings) {
    makeBuilding(spec, roads, index, placed);
  }

  // 출입구 → 건물 찾기
  const doorIndex = new Map();
  for (const b of placed) doorIndex.set(b.door.y * 1000000 + b.door.x, b);

  return { list: placed, index, doorIndex, roads,
    generatedRoads: districts.roads, areas: districts.areas };
}

// 타일 한 칸을 차지한 건물 (없으면 null)
export function buildingAtTile(buildings, tx, ty) {
  for (const b of buildings.index.queryPoint(tx, ty)) {
    if (tx >= b.x && tx < b.x + b.w && ty >= b.y && ty < b.y + b.h) return b;
  }
  return null;
}

// 층 이름 (지하 표기)
export function floorLabel(floor) {
  return floor < 0 ? `지하 ${-floor}층` : `${floor}층`;
}

// 건물이 몇 층부터 몇 층까지 있는가
export function floorRange(b) {
  return { min: b.basement ? -b.basement : 1, max: b.floors };
}

export const BUILDING_KINDS = KIND;
