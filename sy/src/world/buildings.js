// 건물 — 실제 외곽선(footprints.js)을 게임 건물로 세운다.
//
// 데이터는 tools/bake_overture.py 가 구운 회전 사각형이다.
//   [중심x, 중심y, 가로, 세로, 각도, 종류, 이름, 지상층, 지하층]
// 이름이 없는 건물은 도로명주소로 부른다 (지어낸 상호를 쓰지 않는다).
// 실내 생성은 world/interior.js 가 맡는다.

import { SEED, BUILDING, KIND, TILE, GEO, ROAD_CLASS } from '../config.js';
import { GridIndex } from './spatial.js';
import { makeRng } from '../util/rng.js';
import { ROADS } from './data/roads.js';
import { FOOTPRINTS, B_KINDS, B_NAMES } from './data/footprints.js';
import { LANDMARK_NOTES } from './data/landmarks.js';

// 도로 선분 인덱스 — 건물이 길 위에 올라앉지 않게 막는 데 쓴다.
// 청크 래스터라이즈에서도 같은 인덱스를 재사용한다.
export function buildRoadIndex() {
  const index = new GridIndex(TILE.chunk);
  const all = [];
  const paths = [];          // 도로 한 줄 전체 (그릴 때 이어서 그리려고)
  for (const road of ROADS) {
    const spec = ROAD_CLASS[road.cls];
    const tiles = road.tiles;
    const roadIndex = paths.length;
    paths.push({ name: road.name, cls: road.cls, spec, tiles });
    const half = spec.width / 2 + spec.sidewalk;
    let travelled = 0;       // 도로 시작점부터의 누적 길이 — 횡단보도 간격에 쓴다
    for (let i = 0; i < tiles.length - 1; i++) {
      const [ax, ay] = tiles[i], [bx, by] = tiles[i + 1];
      const seg = { name: road.name, cls: road.cls, spec, half, ax, ay, bx, by,
        dist0: travelled, roadIndex };
      travelled += Math.hypot(bx - ax, by - ay);
      all.push(seg);
      index.insert(seg,
        Math.min(ax, bx) - half - 2, Math.min(ay, by) - half - 2,
        Math.max(ax, bx) + half + 2, Math.max(ay, by) + half + 2);
    }
  }
  return { index, all, paths };
}

// 문 바로 바깥 칸 (건물에서 나올 때 서는 자리)
export function doorOutside(b) {
  return b.doorOut;
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

// ── 회전 사각형 ────────────────────────────────────────────────────────
// 실제 건물은 길을 따라 비스듬히 앉아 있다. 데이터의 각도를 그대로 쓰고,
// 칸 판정은 건물 지역 좌표로 되돌려서 한다.
export function rectContains(b, tx, ty) {
  const dx = tx - b.cx, dy = ty - b.cy;
  const u = dx * b.cos + dy * b.sin;
  const v = -dx * b.sin + dy * b.cos;
  return Math.abs(u) <= b.rw / 2 && Math.abs(v) <= b.rh / 2;
}

// 건물 지역 좌표 → 세계 좌표
function toWorld(b, u, v) {
  return { x: b.cx + u * b.cos - v * b.sin, y: b.cy + u * b.sin + v * b.cos };
}

// 같은 주소가 두 번 나오지 않게 (실제 도로명주소도 겹치지 않는다)
const usedAddress = new Set();

function uniqueAddress(base) {
  if (!usedAddress.has(base)) { usedAddress.add(base); return base; }
  for (let n = 1; n < 60; n++) {
    const candidate = `${base}-${n}`;   // 실제로도 쓰는 부번 형식
    if (!usedAddress.has(candidate)) { usedAddress.add(candidate); return candidate; }
  }
  return base;
}

// 출입구 — 네 변 중 길에 가장 가까운 쪽에 낸다. 같으면 남쪽(화면 아래)이 우선이다.
function placeDoor(b, roads) {
  const sides = [
    { u: 0, v: 1, dir: 'S' },   // 지역 좌표에서의 바깥 방향
    { u: 1, v: 0, dir: 'E' },
    { u: -1, v: 0, dir: 'W' },
    { u: 0, v: -1, dir: 'N' },
  ];
  let best = null;
  for (const side of sides) {
    const depth = side.v !== 0 ? b.rh / 2 : b.rw / 2;
    const mid = toWorld(b, side.u * (depth + 0.6), side.v * (depth + 0.6));
    const d = roadDistance(roads, mid.x, mid.y);
    // 화면 아래쪽으로 난 문이 보기 좋다 — 그쪽에 조금 점수를 준다
    const nx = side.u * b.cos - side.v * b.sin;
    const ny = side.u * b.sin + side.v * b.cos;
    const score = d - ny * 6;
    if (!best || score < best.score) best = { side, score, nx, ny, depth };
  }
  const inside = toWorld(b, best.side.u * (best.depth - 0.5), best.side.v * (best.depth - 0.5));
  const outside = toWorld(b, best.side.u * (best.depth + 0.7), best.side.v * (best.depth + 0.7));
  const dir = Math.abs(best.ny) >= Math.abs(best.nx)
    ? (best.ny > 0 ? 'S' : 'N') : (best.nx > 0 ? 'E' : 'W');
  b.door = { x: Math.floor(inside.x), y: Math.floor(inside.y), dir };
  b.doorOut = { x: Math.floor(outside.x), y: Math.floor(outside.y) };
  b.doorSide = best.side;
}

// 이 자리에서 가장 가까운 차도까지의 거리 (타일)
function roadDistance(roads, x, y) {
  const r = BUILDING.doorProbeRadius;
  let best = Infinity;
  for (const seg of roads.index.query(x - r, y - r, x + r, y + r)) {
    const dx = seg.bx - seg.ax, dy = seg.by - seg.ay;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - seg.ax) * dx + (y - seg.ay) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = seg.ax + t * dx, py = seg.ay + t * dy;
    const d = Math.hypot(px - x, py - y) - seg.half;
    if (d < best) best = d;
  }
  return best;
}

// 세상의 모든 건물을 만든다. 시작할 때 한 번.
export function buildBuildings() {
  usedAddress.clear();
  const roads = buildRoadIndex();
  const index = new GridIndex(TILE.chunk);
  const placed = [];
  let nextId = 1;

  for (const f of FOOTPRINTS) {
    const [cx, cy, rw, rh, rawDeg, kindIdx, nameIdx, floors, basement] = f;
    const name = nameIdx >= 0 ? B_NAMES[nameIdx] : null;
    const note = name ? LANDMARK_NOTES[name] : null;
    const kind = note ? note.kind : B_KINDS[kindIdx];
    const useFloors = Math.max(1, note ? note.floors : floors);
    // 높은 건물은 조금만 기울었으면 반듯하게 세운다 (벽이 기울어 보이지 않게)
    let deg = rawDeg;
    if (Math.abs(deg) < 6 || useFloors > 6) deg = Math.round(deg / 90) * 90;
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    const hw = rw / 2, hh = rh / 2;
    const ex = Math.abs(cos) * hw + Math.abs(sin) * hh;
    const ey = Math.abs(sin) * hw + Math.abs(cos) * hh;
    const x = Math.floor(cx - ex), y = Math.floor(cy - ey);
    const rng = makeRng(SEED, 'building', name || 'x', Math.round(cx), Math.round(cy));
    const b = {
      id: nextId++, kind, name,
      cx, cy, rw, rh, deg, rad, cos, sin,
      x, y,                                    // 축 정렬 경계상자 (인덱스·컬링용)
      w: Math.max(1, Math.ceil(cx + ex) - x),
      h: Math.max(1, Math.ceil(cy + ey) - y),
      sw: Math.max(3, Math.round(rw)),        // 스프라이트·실내에 쓰는 정수 크기
      sh: Math.max(3, Math.round(rh)),
      floors: useFloors,
      basement: note ? note.basement : basement,
      note: note ? (note.note || '') : '',
      floorNames: note ? (note.floorNames || null) : null,
      metro: note ? (note.metro || null) : null,
      seed: rng.int(0, 0xffff),
      // 지도에 이름을 띄울 만한 건물 — 아는 시설이거나, 큰 공공시설이다
      landmark: !!note || (!!name && LANDMARK_KINDS.has(kind) && rw * rh >= 220),
    };
    if (!b.name) {
      const addr = buildingAddress({ x: b.x, y: b.y, w: b.w, h: b.h }, roads);
      b.name = uniqueAddress(addr || `구래동 ${1 + (b.seed % 3000)}`);
    } else {
      usedAddress.add(b.name);
    }
    placeDoor(b, roads);
    placed.push(b);
    index.insert(b, b.x, b.y, b.x + b.w, b.y + b.h);
  }

  // 문 앞이 다른 건물에 막힌 건물은 문을 옮긴다
  fixBlockedDoors(placed, index);

  const doorIndex = new Map();
  for (const b of placed) doorIndex.set(b.door.y * 1000000 + b.door.x, b);

  return { list: placed, index, doorIndex, roads };
}

// 지도에 이름을 띄울 만한 종류
const LANDMARK_KINDS = new Set([KIND.STATION, KIND.MART, KIND.TOWER, KIND.PUBLIC,
  KIND.SCHOOL, KIND.HOSPITAL]);

// 그 칸을 다른 건물이 차지하는가
function occupied(index, x, y, self) {
  for (const other of index.query(x, y, x, y)) {
    if (other === self) continue;
    if (rectContains(other, x + 0.5, y + 0.5)) return true;
  }
  return false;
}

// 문 앞이 막힌 건물은 다른 변으로 문을 옮긴다 (막히면 안에 갇힌다)
export function fixBlockedDoors(placed, index) {
  let moved = 0;
  for (const b of placed) {
    if (!occupied(index, b.doorOut.x, b.doorOut.y, b)) continue;
    const sides = [
      { u: 0, v: 1, dir: 'S' }, { u: 1, v: 0, dir: 'E' },
      { u: -1, v: 0, dir: 'W' }, { u: 0, v: -1, dir: 'N' },
    ];
    let fixed = false;
    for (const side of sides) {
      const depth = side.v !== 0 ? b.rh / 2 : b.rw / 2;
      const along = side.v !== 0 ? b.rw / 2 : b.rh / 2;
      // 그 변을 따라 가운데부터 양옆으로 훑는다
      for (let off = 0; off <= along && !fixed; off += 1) {
        for (const sign of (off === 0 ? [0] : [1, -1])) {
          const su = side.u * (depth + 0.7) + (side.v !== 0 ? off * sign : 0);
          const sv = side.v * (depth + 0.7) + (side.u !== 0 ? off * sign : 0);
          const out = toWorld(b, su, sv);
          const ox = Math.floor(out.x), oy = Math.floor(out.y);
          if (occupied(index, ox, oy, b)) continue;
          const iu = side.u * (depth - 0.5) + (side.v !== 0 ? off * sign : 0);
          const iv = side.v * (depth - 0.5) + (side.u !== 0 ? off * sign : 0);
          const inside = toWorld(b, iu, iv);
          b.door = { x: Math.floor(inside.x), y: Math.floor(inside.y), dir: side.dir };
          b.doorOut = { x: ox, y: oy };
          fixed = true;
          break;
        }
      }
      if (fixed) break;
    }
    if (fixed) moved++;
  }
  return moved;
}

// 타일 한 칸을 차지한 건물 (없으면 null)
export function buildingAtTile(buildings, tx, ty) {
  for (const b of buildings.index.queryPoint(tx, ty)) {
    if (rectContains(b, tx + 0.5, ty + 0.5)) return b;
  }
  return null;
}

// 층 이름 (지하 표기)
export function floorLabel(floor) {
  return floor < 0 ? `지하 ${-floor}층` : `${floor}층`;
}

// 층에 무엇이 있는지. 데이터에 적힌 게 있으면 그걸 쓰고, 없으면 종류로 짐작한다.
const DEFAULT_FLOOR_USE = {
  [KIND.APARTMENT]: (f) => (f < 0 ? '주차장' : f === 1 ? '현관·경비' : '세대'),
  [KIND.SHOP]: (f) => (f < 0 ? '창고' : f === 1 ? '상가' : f === 2 ? '학원·식당' : '사무실'),
  [KIND.TOWER]: (f) => (f < 0 ? '주차장' : f <= 3 ? '상가' : '오피스텔'),
  [KIND.MART]: (f) => (f < 0 ? '주차장' : '매장'),
  [KIND.SCHOOL]: (f) => (f === 1 ? '교무실·급식실' : '교실'),
  [KIND.PUBLIC]: (f) => (f < 0 ? '주차장' : f === 1 ? '민원실' : '사무실'),
  [KIND.STATION]: (f) => (f === -2 ? '승강장' : f === -1 ? '대합실' : '출입구'),
  [KIND.FACTORY]: (f) => (f === 1 ? '생산라인' : '사무실'),
  [KIND.WAREHOUSE]: () => '창고',
  [KIND.HOUSE]: (f) => (f === 1 ? '거실' : '방'),
  [KIND.FARMHOUSE]: () => '창고',
};

export function floorUse(b, floor) {
  if (b.floorNames && b.floorNames[floor] !== undefined) return b.floorNames[floor];
  const fn = DEFAULT_FLOOR_USE[b.kind];
  return fn ? fn(floor) : '';
}

// 건물이 몇 층부터 몇 층까지 있는가
export function floorRange(b) {
  return { min: b.basement ? -b.basement : 1, max: b.floors };
}

export const BUILDING_KINDS = KIND;
