// 지역 데이터 → 타일 그리드. 청크 단위로 필요할 때만 만들고 캐시한다.
// 5백만 칸짜리 지도를 한 번에 만들지 않는 이유가 이것이다 (로딩 최소화).

import {
  SEED, TILE, GROUND, GROUND_SOLID, PROP, PROP_SOLID, PROP_RULES, GEO,
} from '../config.js';
import { WORLD_W, WORLD_H, projectPath, pathBounds, pointInPath, distToSegment, metersToTiles }
  from './geo.js';
import { GridIndex } from './spatial.js';
import { noiseAt, fbm, seedOf } from '../util/rng.js';
import { REGIONS, WATERWAYS } from './data/regions.js';

const CH = TILE.chunk;
const CROSSWALK_SPACING = 46;  // 횡단보도 간격 (타일)
const CROSSWALK_HALF = 1.6;    // 횡단보도 폭의 절반 (타일)

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
    this.regionIndex = new GridIndex(CH * 2);
    this.waterIndex = new GridIndex(CH);

    // 구역 폴리곤을 타일 좌표로 미리 변환해 둔다
    this.regions = REGIONS.map((r) => {
      const path = projectPath(r.path);
      const b = pathBounds(path);
      const region = { ...r, path, bounds: b, order: 0 };
      this.regionIndex.insert(region, b.minX, b.minY, b.maxX, b.maxY);
      return region;
    });
    this.regions.forEach((r, i) => { r.order = i; });

    // 블록 바닥 (아파트 단지 마당, 상가 뒷마당)
    this.areaIndex = new GridIndex(CH);
    const areaGround = { parking: GROUND.PARKING, plaza: GROUND.PLAZA,
      yard: GROUND.YARD, lawn: GROUND.GRASS };
    for (const a of buildings.areas || []) {
      const area = { ...a, kind: areaGround[a.ground] };
      this.areaIndex.insert(area, a.x, a.y, a.x + a.w, a.y + a.h);
    }

    // 하천 선분
    this.waterways = [];
    for (const w of WATERWAYS) {
      const path = projectPath(w.path);
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
    while (this.order.length > TILE.chunkCacheMax) {
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
    const ox = cx * CH, oy = cy * CH;

    // 1) 바탕 — 논밭에 얼룩진 풀밭
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CH; x++) {
        const tx = ox + x, ty = oy + y;
        const v = fbm(S_BASE, tx, ty, 26, 3);
        ground[y * CH + x] = v > 0.62 ? GROUND.GRASS : v < 0.36 ? GROUND.DIRT : GROUND.FIELD;
      }
    }

    // 2) 구역 — 뒤쪽 구역이 앞쪽을 덮는다
    const regions = this.regionIndex
      .query(ox, oy, ox + CH, oy + CH)
      .sort((a, b) => a.order - b.order);
    const regionRate = new Float32Array(n); // 소품 밀도 (숲은 높다)
    for (const r of regions) {
      for (let y = 0; y < CH; y++) {
        const ty = oy + y + 0.5;
        if (ty < r.bounds.minY || ty > r.bounds.maxY) continue;
        for (let x = 0; x < CH; x++) {
          const tx = ox + x + 0.5;
          if (tx < r.bounds.minX || tx > r.bounds.maxX) continue;
          if (!pointInPath(tx, ty, r.path)) continue;
          const i = y * CH + x;
          ground[i] = r.ground;
          regionRate[i] = r.propRate || 0;
          // 도시 바닥은 잔디와 포장이 얼룩덜룩 섞인다 (주차장·광장 자리)
          if (r.kind === 'city' && fbm(S_CITY, ox + x, oy + y, 9, 2) > 0.74) {
            ground[i] = GROUND.PLAZA;
          }
        }
      }
    }

    // 2-1) 블록 바닥
    for (const a of this.areaIndex.query(ox, oy, ox + CH, oy + CH)) {
      const x0 = Math.max(0, a.x - ox), x1 = Math.min(CH, a.x + a.w - ox);
      const y0 = Math.max(0, a.y - oy), y1 = Math.min(CH, a.y + a.h - oy);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * CH + x;
          // 포장 바닥에도 화단이 조금씩 섞인다
          const green = a.kind !== GROUND.GRASS && fbm(S_CITY, ox + x, oy + y, 7, 2) > 0.78;
          ground[i] = green ? GROUND.GRASS : a.kind;
          regionRate[i] = a.kind === GROUND.GRASS ? 0.05 : green ? 0.02 : 0;
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
        return { s, dx, dy, len2, len: Math.sqrt(len2), halfRoad2: halfRoad * halfRoad,
          outer2: outer * outer,
          minX: Math.min(s.ax, s.bx) - outer - 1, maxX: Math.max(s.ax, s.bx) + outer + 1,
          minY: Math.min(s.ay, s.by) - outer - 1, maxY: Math.max(s.ay, s.by) + outer + 1,
          ground: s.spec.ground !== undefined ? s.spec.ground : GROUND.ROAD,
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
              paint = q.ground;
              // 폭이 넉넉한 차도에는 점선 중앙선을 넣는다
              if (q.centerLine && d2 < 0.62) {
                const dash = ((q.dist0 + t * q.len) % 5);
                if (dash < 2.6) paint = GROUND.ROAD_LINE;
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
            }
          }
          if (paint >= 0) {
            ground[i] = cross ? GROUND.CROSSWALK : paint;
            regionRate[i] = 0;
          }
        }
      }
    }

    // 5) 소품 — 지면 종류에 따라 결정적으로 흩뿌린다
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CH; x++) {
        const i = y * CH + x;
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

    // 6) 건물 — 벽은 막히고 출입구만 뚫린다
    const here = this.buildings.index.query(ox, oy, ox + CH, oy + CH);
    for (const b of here) {
      const x0 = Math.max(0, b.x - ox), x1 = Math.min(CH, b.x + b.w - ox);
      const y0 = Math.max(0, b.y - oy), y1 = Math.min(CH, b.y + b.h - oy);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = y * CH + x;
          ground[i] = GROUND.FLOOR;
          prop[i] = PROP.NONE;
          solid[i] = 1;
        }
      }
      const dx = b.door.x - ox, dy = b.door.y - oy;
      if (dx >= 0 && dx < CH && dy >= 0 && dy < CH) solid[dy * CH + dx] = 0;
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

  isSolid(tx, ty) {
    if (!this.inBounds(tx, ty)) return true;   // 지도 밖은 벽
    const c = this.chunk(Math.floor(tx / CH), Math.floor(ty / CH));
    return c.solid[(ty - c.cy * CH) * CH + (tx - c.cx * CH)] === 1;
  }

  groundAt(tx, ty) {
    const t = this.tileAt(tx, ty);
    return t ? t.ground : GROUND.FIELD;
  }

  // 지금 서 있는 곳이 어느 구역인가 (이름 표시용)
  regionNameAt(tx, ty) {
    let found = '';
    for (const r of this.regionIndex.queryPoint(tx, ty)) {
      if (r.label && pointInPath(tx, ty, r.path)) found = r.name;
    }
    return found;
  }
}

// 미니맵·전체지도용 저해상도 그림. 시작할 때 한 번만 만든다.
export function buildOverview(map, scale) {
  const w = Math.ceil(WORLD_W / scale), h = Math.ceil(WORLD_H / scale);
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tx = x * scale + scale / 2, ty = y * scale + scale / 2;
      let g = GROUND.FIELD;
      for (const r of map.regionIndex.queryPoint(tx, ty)) {
        if (pointInPath(tx, ty, r.path)) g = r.ground;
      }
      for (const s of map.waterIndex.queryPoint(tx, ty)) {
        if (distToSegment(tx, ty, s.ax, s.ay, s.bx, s.by) < s.half) g = GROUND.WATER;
      }
      // 미니맵에서는 큰길만, 대신 실제보다 굵게 그린다 (안 그러면 안 보인다)
      for (const s of map.buildings.roads.index.query(tx - scale, ty - scale, tx + scale, ty + scale)) {
        if (s.spec.width < 4) continue;
        if (distToSegment(tx, ty, s.ax, s.ay, s.bx, s.by) < s.spec.width / 2 + scale * 0.45) {
          g = GROUND.ROAD;
        }
      }
      data[y * w + x] = g;
    }
  }
  return { w, h, scale, data };
}
