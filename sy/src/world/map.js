// 지역 데이터 → 타일 그리드. 청크 단위로 필요할 때만 만들고 캐시한다.
// 5백만 칸짜리 지도를 한 번에 만들지 않는 이유가 이것이다 (로딩 최소화).

import {
  SEED, TILE, GROUND, GROUND_SOLID, PROP, PROP_SOLID, PROP_RULES, GEO, BUILDING,
} from '../config.js';
import { WORLD_W, WORLD_H, pathBounds, pointInPath, distToSegment, metersToTiles }
  from './geo.js';
import { GridIndex } from './spatial.js';
import { doorOutside, rectContains } from './buildings.js';
import { noiseAt, fbm, seedOf } from '../util/rng.js';
import { MAP_KIND } from '../render/palette.js';
import { GROUND_AREAS, WATERWAYS, AREA_LABELS } from './data/ground.js';

const CH = TILE.chunk;
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const CROSSWALK_SPACING = 78;  // 횡단보도 간격 (타일)
const CROSSWALK_HALF = 1.0;    // 횡단보도 폭의 절반 (타일)

// 그 칸이 (자기 자신 말고) 다른 건물에 덮여 있는가
function buildingCovers(list, x, y, self) {
  for (const b of list) {
    if (b === self) continue;
    if (rectContains(b, x + 0.5, y + 0.5)) return true;
  }
  return false;
}

// 구역 성격 → 바닥과 소품 밀도
const AREA_GROUND = {
  city: GROUND.SIDEWALK, industrial: GROUND.YARD, field: GROUND.FIELD,
  park: GROUND.GRASS, forest: GROUND.GRASS, water: GROUND.WATER,
};
const AREA_PROPS = { forest: 0.42, park: 0.14, field: 0.01, city: 0.02, industrial: 0 };

const groundSolid = new Set(GROUND_SOLID);
const propSolid = new Set(PROP_SOLID);

// 노이즈 시드는 미리 정수로 굳혀 둔다 (타일마다 문자열을 만들지 않기 위해)
const S_BASE = seedOf(SEED, 'base');
const S_CITY = seedOf(SEED, 'city');
const S_PROP = seedOf(SEED, 'prop');
const S_PROPKIND = seedOf(SEED, 'propkind');

export class WorldMap {
  constructor(buildings) {
    this.buildings = buildings;
    this.chunks = new Map();      // key → {ground, prop, solid, buildings}
    this.order = [];              // LRU
    this.cacheMax = TILE.chunkCacheMax;   // 점검 도구는 이 값을 크게 올려 쓴다
    this.regionIndex = new GridIndex(CH * 2);
    this.waterIndex = new GridIndex(CH);

    // 실제 토지이용 구역 (이미 타일 좌표로 구워져 있다)
    this.regions = GROUND_AREAS.map((r, i) => {
      const b = pathBounds(r.path);
      const region = {
        ...r, bounds: b, order: i,
        ground: AREA_GROUND[r.kind] !== undefined ? AREA_GROUND[r.kind] : GROUND.GRASS,
        propRate: AREA_PROPS[r.kind] || 0,
      };
      this.regionIndex.insert(region, b.minX, b.minY, b.maxX, b.maxY);
      return region;
    });
    this.areaLabels = AREA_LABELS;

    // 하천 선분
    this.waterways = [];
    for (const w of WATERWAYS) {
      const path = w.path;
      const half = metersToTiles(w.width) / 2;
      for (let i = 0; i < path.length - 1; i++) {
        const seg = { name: w.name, half, ax: path[i][0], ay: path[i][1],
          bx: path[i + 1][0], by: path[i + 1][1] };
        this.waterways.push(seg);
        this.waterIndex.insert(seg,
          Math.min(seg.ax, seg.bx) - half - 4, Math.min(seg.ay, seg.by) - half - 4,
          Math.max(seg.ax, seg.bx) + half + 4, Math.max(seg.ay, seg.by) + half + 4);
      }
    }
  }

  static key(cx, cy) { return cx * 100000 + cy; }

  // 청크 하나를 만든다 (있으면 캐시에서 꺼낸다)
  chunk(cx, cy) {
    const key = WorldMap.key(cx, cy);
    let c = this.chunks.get(key);
    if (c) return c;
    c = this._generate(cx, cy);
    this.chunks.set(key, c);
    this.order.push(key);
    while (this.order.length > this.cacheMax) {
      const old = this.order.shift();
      if (old !== key) this.chunks.delete(old);
    }
    return c;
  }

  _generate(cx, cy) {
    const n = CH * CH;
    const ground = new Uint8Array(n);
    const prop = new Uint8Array(n);
    const solid = new Uint8Array(n);
    const noProp = new Uint8Array(n);   // 도로 가장자리처럼 소품이 있으면 안 되는 칸
    const ox = cx * CH, oy = cy * CH;

    // 1) 바탕 — 논밭에 얼룩진 풀밭
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CH; x++) {
        const tx = ox + x, ty = oy + y;
        const v = fbm(S_BASE, tx, ty, 26, 3);
        // 논이 기본이고, 밭(흙)과 묵힌 땅(풀)이 드문드문 섞인다
        ground[y * CH + x] = v > 0.78 ? GROUND.GRASS : v < 0.34 ? GROUND.DIRT : GROUND.FIELD;
      }
    }

    // 2) 구역 — 뒤쪽 구역이 앞쪽을 덮는다
    const regions = this.regionIndex
      .query(ox, oy, ox + CH, oy + CH)
      .sort((a, b) => a.order - b.order);
    const regionRate = new Float32Array(n); // 소품 밀도 (숲은 높다)
    for (const r of regions) {
      // 구역 경계상자와 청크가 겹치는 칸만 본다 (구역이 천 개라 이게 성능을 가른다)
      const yA = Math.max(0, Math.floor(r.bounds.minY - oy));
      const yB = Math.min(CH - 1, Math.ceil(r.bounds.maxY - oy));
      const xA = Math.max(0, Math.floor(r.bounds.minX - ox));
      const xB = Math.min(CH - 1, Math.ceil(r.bounds.maxX - ox));
      for (let y = yA; y <= yB; y++) {
        const ty = oy + y + 0.5;
        for (let x = xA; x <= xB; x++) {
          const tx = ox + x + 0.5;
          if (!pointInPath(tx, ty, r.path)) continue;
          const i = y * CH + x;
          ground[i] = r.ground;
          regionRate[i] = r.propRate || 0;
          if (r.kind === 'city') {
            // 신도시 바닥은 대부분 보도블럭과 포장이다. 녹지는 가로수 띠 정도.
            const v = fbm(S_CITY, ox + x, oy + y, 9, 2);
            ground[i] = v > 0.66 ? GROUND.GRASS : v < 0.32 ? GROUND.PLAZA : GROUND.SIDEWALK;
            regionRate[i] = v > 0.66 ? 0.05 : 0.015;
          }
        }
      }
    }

    // 3) 하천 — 물과 모래톱
    const waters = this.waterIndex.query(ox - 4, oy - 4, ox + CH + 4, oy + CH + 4);
    if (waters.length) {
      for (let y = 0; y < CH; y++) {
        for (let x = 0; x < CH; x++) {
          const tx = ox + x + 0.5, ty = oy + y + 0.5;
          let best = Infinity;
          for (const s of waters) {
            const d = distToSegment(tx, ty, s.ax, s.ay, s.bx, s.by) - s.half;
            if (d < best) best = d;
          }
          const i = y * CH + x;
          if (best < 0) ground[i] = GROUND.WATER;
          else if (best < 1.6) ground[i] = GROUND.SAND;
        }
      }
    }

    // 4) 도로 — 차도 · 보도 · 횡단보도
    const rawSegs = this.buildings.roads.index.query(ox - 8, oy - 8, ox + CH + 8, oy + CH + 8);
    if (rawSegs.length) {
      // 선분마다 변하지 않는 값은 미리 뽑아 둔다 (타일마다 다시 계산하지 않게)
      const segs = rawSegs.map((s) => {
        const dx = s.bx - s.ax, dy = s.by - s.ay;
        const len2 = dx * dx + dy * dy || 1;
        const halfRoad = s.spec.width / 2;
        const outer = halfRoad + s.spec.sidewalk;
        // 안쪽 반경 — 타일이 도로 안에 확실히 들어올 때만 칠한다
        const inner = Math.max(0.4, halfRoad - 0.8);
        return { s, dx, dy, len2, len: Math.sqrt(len2), halfRoad2: halfRoad * halfRoad,
          inner2: inner * inner, outer2: outer * outer,
          minX: Math.min(s.ax, s.bx) - outer - 1, maxX: Math.max(s.ax, s.bx) + outer + 1,
          minY: Math.min(s.ay, s.by) - outer - 1, maxY: Math.max(s.ay, s.by) + outer + 1,
          ground: s.spec.ground !== undefined ? s.spec.ground : GROUND.ROAD,
          sidewalk: s.spec.sidewalk > 0,
          centerLine: s.spec.ground === undefined && s.spec.width >= 4,
          crossing: s.spec.crossing, dist0: s.dist0 };
      });
      for (let y = 0; y < CH; y++) {
        const ty = oy + y + 0.5;
        const row = segs.filter((q) => ty >= q.minY && ty <= q.maxY);
        if (!row.length) continue;
        for (let x = 0; x < CH; x++) {
          const tx = ox + x + 0.5;
          const i = y * CH + x;
          let paint = -1, cross = false;
          for (const q of row) {
            if (tx < q.minX || tx > q.maxX) continue;
            let t = ((tx - q.s.ax) * q.dx + (ty - q.s.ay) * q.dy) / q.len2;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const ex = tx - (q.s.ax + t * q.dx), ey = ty - (q.s.ay + t * q.dy);
            const d2 = ex * ex + ey * ey;
            if (d2 <= q.halfRoad2) {
              // 차도 안쪽만 도로로 칠한다. 가장자리 한 겹은 원래 지면으로 두고
              // 그리는 쪽에서 선으로 덮는다 — 그래야 도로 경계가 계단처럼 각지지 않는다.
              noProp[i] = 1;
              if (d2 <= q.inner2) {
                paint = q.ground;
              } else if (q.sidewalk) {
                paint = GROUND.SIDEWALK;
              }
              if (q.crossing) {
                // 도로를 따라 일정 간격으로 횡단보도를 놓는다
                const along = q.dist0 + t * q.len;
                const phase = ((along % CROSSWALK_SPACING) + CROSSWALK_SPACING) % CROSSWALK_SPACING;
                if (phase < CROSSWALK_HALF || phase > CROSSWALK_SPACING - CROSSWALK_HALF) {
                  cross = true;
                }
              }
              break;
            } else if (d2 <= q.outer2 && paint < 0) {
              paint = GROUND.SIDEWALK;
              noProp[i] = 1;
            }
          }
          if (cross) {
            ground[i] = GROUND.CROSSWALK;
            regionRate[i] = 0;
          } else if (paint >= 0) {
            ground[i] = paint;
            regionRate[i] = 0;
          }
        }
      }
    }

    // 5) 소품 — 지면 종류에 따라 결정적으로 흩뿌린다
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CH; x++) {
        const i = y * CH + x;
        if (noProp[i]) continue;
        const g = ground[i];
        const rule = PROP_RULES[g];
        const extra = regionRate[i];
        if (!rule && !extra) continue;
        const r = noiseAt(S_PROP, ox + x, oy + y);
        const rate = (rule ? rule.rate : 0) + extra;
        if (r > rate) continue;
        const pickList = rule ? rule.pick : [PROP.TREE, PROP.TREE, PROP.BUSH, PROP.ROCK];
        const idx = Math.floor(noiseAt(S_PROPKIND, ox + x, oy + y) * pickList.length);
        prop[i] = pickList[Math.min(idx, pickList.length - 1)];
      }
    }

    // 6) 건물 — 벽은 막히고 출입구만 뚫린다.
    //    건물은 길을 따라 기울어 있으므로 칸마다 회전 사각형 안인지 본다.
    const here = this.buildings.index.query(ox, oy, ox + CH, oy + CH);
    for (const b of here) {
      const x0 = Math.max(0, b.x - ox), x1 = Math.min(CH, b.x + b.w - ox);
      const y0 = Math.max(0, b.y - oy), y1 = Math.min(CH, b.y + b.h - oy);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (!rectContains(b, ox + x + 0.5, oy + y + 0.5)) continue;
          const i = y * CH + x;
          ground[i] = GROUND.FLOOR;
          prop[i] = PROP.NONE;
          solid[i] = 1;
        }
      }
      const dx = b.door.x - ox, dy = b.door.y - oy;
      if (dx >= 0 && dx < CH && dy >= 0 && dy < CH) {
        solid[dy * CH + dx] = 0;
        ground[dy * CH + dx] = GROUND.FLOOR;
        prop[dy * CH + dx] = PROP.NONE;
      }
    }

    // 6-1) 문 앞은 비워 둔다 — 나무나 화단이 문을 막으면 안에 갇힌다.
    //      건물 루프가 끝난 뒤에 해야 나중에 놓인 건물에 다시 덮이지 않는다.
    const nearby = this.buildings.index.query(ox - 4, oy - 4, ox + CH + 4, oy + CH + 4);
    for (const b of nearby) {
      const out = doorOutside(b);
      for (let step = 0; step < BUILDING.doorApron; step++) {
        const ax = out.x + (b.door.dir === 'E' ? step : b.door.dir === 'W' ? -step : 0);
        const ay = out.y + (b.door.dir === 'S' ? step : b.door.dir === 'N' ? -step : 0);
        const px = ax - ox, py = ay - oy;
        if (px < 0 || px >= CH || py < 0 || py >= CH) continue;
        const i = py * CH + px;
        // 다른 건물 안이면 손대지 않는다 (그런 문은 buildings.js 가 옮긴다)
        if (buildingCovers(nearby, ax, ay, b)) break;
        prop[i] = PROP.NONE;
        if (groundSolid.has(ground[i])) ground[i] = GROUND.SIDEWALK;
      }
    }

    // 7) 충돌 정리
    for (let i = 0; i < n; i++) {
      if (groundSolid.has(ground[i]) || propSolid.has(prop[i])) solid[i] = 1;
    }

    return { ground, prop, solid, buildings: here, cx, cy };
  }

  // ── 타일 조회 ────────────────────────────────────────────────────
  inBounds(tx, ty) {
    return tx >= 0 && ty >= 0 && tx < WORLD_W && ty < WORLD_H;
  }

  tileAt(tx, ty) {
    if (!this.inBounds(tx, ty)) return null;
    const c = this.chunk(Math.floor(tx / CH), Math.floor(ty / CH));
    const i = (ty - c.cy * CH) * CH + (tx - c.cx * CH);
    return { ground: c.ground[i], prop: c.prop[i], solid: c.solid[i] };
  }

  // 이미 만들어 둔 청크인가 (없는 곳을 조회하다 청크를 새로 만들지 않으려고)
  hasChunk(tx, ty) {
    return this.chunks.has(WorldMap.key(Math.floor(tx / CH), Math.floor(ty / CH)));
  }

  isSolid(tx, ty) {
    if (!this.inBounds(tx, ty)) return true;   // 지도 밖은 벽
    const c = this.chunk(Math.floor(tx / CH), Math.floor(ty / CH));
    return c.solid[(ty - c.cy * CH) * CH + (tx - c.cx * CH)] === 1;
  }

  // 여기서 걸어서 갈 수 있는 칸이 몇 개인가 (limit 까지만 센다).
  // 갇혔는지 알아보는 용도라 넓으면 바로 끊는다.
  openArea(tx, ty, limit) {
    if (this.isSolid(tx, ty)) return 0;
    const seen = new Set([ty * 100000 + tx]);
    const queue = [tx, ty];
    let count = 0;
    for (let i = 0; i < queue.length && count < limit; i += 2) {
      const x = queue[i], y = queue[i + 1];
      count++;
      for (const [dx, dy] of NEIGHBORS) {
        const nx = x + dx, ny = y + dy;
        const key = ny * 100000 + nx;
        if (seen.has(key) || this.isSolid(nx, ny)) continue;
        seen.add(key);
        queue.push(nx, ny);
      }
    }
    return count;
  }

  // 갇히지 않을 만큼 넓은 자리를 가까운 데서 찾는다.
  // (문 앞이 막혔거나 소품에 끼었을 때 여기로 옮긴다)
  openSpot(tx, ty, need = 60, radius = 24) {
    if (this.openArea(tx, ty, need) >= need) return { x: tx, y: ty };
    for (let r = 1; r <= radius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = tx + dx, y = ty + dy;
          if (this.isSolid(x, y)) continue;
          if (this.openArea(x, y, need) >= need) return { x, y };
        }
      }
    }
    return { x: tx, y: ty };
  }

  groundAt(tx, ty) {
    const t = this.tileAt(tx, ty);
    return t ? t.ground : GROUND.FIELD;
  }

  // 지금 서 있는 곳이 어떤 성격의 땅인가 (사람·사건을 고를 때 쓴다)
  regionKindAt(tx, ty) {
    let kind = 'field';
    for (const r of this.regionIndex.queryPoint(tx, ty)) {
      if (pointInPath(tx, ty, r.path)) kind = r.kind;
    }
    return kind;
  }

  // 지금 서 있는 곳이 어느 동네인가 (행정동 이름표 중 가장 가까운 것)
  regionNameAt(tx, ty) {
    let best = '', bestD = Infinity;
    for (const a of this.areaLabels) {
      const d = Math.hypot(a.x - tx, a.y - ty);
      if (d < bestD) { bestD = d; best = a.name; }
    }
    return best;
  }
}

// 지형색이 아니라 지도 기호색 코드(MAP_KIND)를 담는다.
export function buildOverview(map, scale) {
  const w = Math.ceil(WORLD_W / scale), h = Math.ceil(WORLD_H / scale);
  const data = new Uint8Array(w * h);
  const kindOf = {
    city: MAP_KIND.CITY, industrial: MAP_KIND.INDUSTRIAL, park: MAP_KIND.PARK,
    forest: MAP_KIND.FOREST, water: MAP_KIND.WATER, field: MAP_KIND.FIELD,
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tx = x * scale + scale / 2, ty = y * scale + scale / 2;
      let v = MAP_KIND.FIELD;
      for (const r of map.regionIndex.queryPoint(tx, ty)) {
        if (pointInPath(tx, ty, r.path)) v = kindOf[r.kind] !== undefined ? kindOf[r.kind] : v;
      }
      for (const s of map.waterIndex.queryPoint(tx, ty)) {
        if (distToSegment(tx, ty, s.ax, s.ay, s.bx, s.by) < s.half + scale * 0.3) {
          v = MAP_KIND.WATER;
        }
      }
      // 도로는 실제보다 굵게 그려야 이 축척에서 보인다
      for (const s of map.buildings.roads.index.query(tx - scale, ty - scale,
          tx + scale, ty + scale)) {
        if (s.spec.width < 4) continue;
        const d = distToSegment(tx, ty, s.ax, s.ay, s.bx, s.by);
        if (d < s.spec.width / 2 + scale * 0.45) {
          v = s.spec.width >= 8 ? MAP_KIND.MAIN_ROAD : MAP_KIND.ROAD;
        }
      }
      data[y * w + x] = v;
    }
  }
  return { w, h, scale, data };
}
