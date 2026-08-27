// districts.js 규칙 → 이면도로 + 건물 목록.
// "핵심 지점은 손으로, 사이는 절차적으로" 의 절차적 부분이 여기다.
// 같은 시드면 언제나 같은 블록이 나온다.

import { SEED, KIND, ROAD_CLASS } from '../config.js';
import { projectPath, pathBounds, pointInPath, metersToTiles } from './geo.js';
import { makeRng } from '../util/rng.js';
import { DISTRICTS } from './data/districts.js';
import {
  SHOP_PREFIX, SHOP_SUFFIX, SHOP_MIX, BUILDING_SUFFIX,
  FACTORY_PREFIX, FACTORY_SUFFIX, FACTORY_TAIL, RURAL_NAME,
} from './data/names.js';

const T = metersToTiles; // 미터 → 타일

// 상호 하나 짓기
export function makeShopName(rng, category) {
  const cat = category || rng.pick(SHOP_MIX);
  return rng.pick(SHOP_PREFIX) + rng.pick(SHOP_SUFFIX[cat]);
}

// 폴리곤 안쪽을 따라 도로 선을 잘라 낸다.
// 밖으로 삐져나온 부분은 버리고 안쪽 구간만 폴리라인으로 남긴다.
function clipLineToPath(fixed, from, to, path, horizontal, step = 3) {
  const runs = [];
  let current = null;
  for (let t = from; t <= to; t += step) {
    const x = horizontal ? t : fixed;
    const y = horizontal ? fixed : t;
    if (pointInPath(x, y, path)) {
      if (!current) current = [[x, y]];
      else current.push([x, y]);
    } else if (current) {
      if (current.length > 1) runs.push(current);
      current = null;
    }
  }
  if (current && current.length > 1) runs.push(current);
  return runs;
}

// 블록 한 칸을 건물로 채운다. 종류별로 규칙이 다르다.
function fillBlock(district, rect, rng, out) {
  const f = district.fill;
  // 블록 바닥 — 아파트 단지 마당과 상가 뒷마당은 포장되어 있다
  if (district.kind === 'apartment') {
    out.areas.push({ ...rect, ground: 'parking' });
  } else if (district.kind === 'commercial') {
    out.areas.push({ ...rect, ground: 'plaza' });
  }
  switch (district.kind) {
    case 'apartment': return fillApartment(district, rect, rng, out, f);
    case 'commercial': return fillCommercial(district, rect, rng, out, f);
    case 'house': return fillHouse(district, rect, rng, out, f);
    case 'industrial': return fillIndustrial(district, rect, rng, out, f);
    case 'rural': return fillRural(district, rect, rng, out, f);
  }
}

// 아파트 — 긴 판상형 동을 줄지어 놓고 번호를 매긴다.
function fillApartment(d, rect, rng, out, f) {
  const bw = Math.round(T(f.bw)), bh = Math.round(T(f.bh));
  const gap = Math.round(T(f.gap));
  const rowPitch = bh + gap;
  for (let y = rect.y + 2; y + bh <= rect.y + rect.h - 2; y += rowPitch) {
    for (let x = rect.x + 2; x + bw <= rect.x + rect.w - 2; x += bw + Math.round(gap * 0.6)) {
      const n = f.start + out.aptCount[d.id]++;
      out.buildings.push({
        name: `${d.name} ${n}동`, kind: KIND.APARTMENT,
        x, y, w: bw, h: bh,
        floors: rng.int(f.floors[0], f.floors[1]), basement: 1,
        districtId: d.id,
      });
    }
  }
}

// 상가 — 블록 가장자리를 따라 좁고 깊은 건물을 붙여 세운다.
function fillCommercial(d, rect, rng, out, f) {
  const depth = Math.max(3, Math.round(T(f.depth)));
  const minW = Math.max(3, Math.round(T(f.minW)));
  const maxW = Math.max(minW + 1, Math.round(T(f.maxW)));
  const edges = [
    { horizontal: true, y: rect.y, dir: 1 },
    { horizontal: true, y: rect.y + rect.h - depth, dir: -1 },
    { horizontal: false, x: rect.x, dir: 1 },
    { horizontal: false, x: rect.x + rect.w - depth, dir: -1 },
  ];
  for (const e of edges) {
    if (e.horizontal) {
      for (let x = rect.x; x + minW <= rect.x + rect.w; ) {
        const w = rng.int(minW, Math.min(maxW, rect.x + rect.w - x));
        if (w < minW) break;
        if (rng.chance(0.86)) pushShop(d, rng, out, x, e.y, w, depth, f);
        x += w + (rng.chance(0.25) ? 1 : 0);
      }
    } else {
      for (let y = rect.y + depth; y + minW <= rect.y + rect.h - depth; ) {
        const h = rng.int(minW, Math.min(maxW, rect.y + rect.h - depth - y));
        if (h < minW) break;
        if (rng.chance(0.8)) pushShop(d, rng, out, e.x, y, depth, h, f);
        y += h + (rng.chance(0.25) ? 1 : 0);
      }
    }
  }

  // 블록 안쪽에도 한 줄 더 — 로데오거리처럼 골목 안까지 가게가 들어찬다
  const innerX = rect.x + depth + 2, innerY = rect.y + depth + 2;
  const innerW = rect.w - (depth + 2) * 2, innerH = rect.h - (depth + 2) * 2;
  if (innerW >= minW && innerH >= 4) {
    for (let x = innerX; x + minW <= innerX + innerW; ) {
      const w = rng.int(minW, Math.min(maxW, innerX + innerW - x));
      if (w < minW) break;
      if (rng.chance(0.7)) {
        pushShop(d, rng, out, x, innerY, w, Math.min(innerH, depth), f);
      }
      x += w + 1;
    }
  }
}

function pushShop(d, rng, out, x, y, w, h, f) {
  const floors = rng.int(f.floors[0], f.floors[1]);
  // 층이 있으면 건물 이름, 단층이면 가게 이름이 곧 건물 이름
  const name = floors >= 3
    ? rng.pick(SHOP_PREFIX) + rng.pick(BUILDING_SUFFIX)
    : makeShopName(rng);
  out.buildings.push({
    name, kind: KIND.SHOP, x, y, w, h,
    floors, basement: floors >= 5 ? 1 : 0, districtId: d.id,
  });
}

// 단독·빌라 — 작은 네모를 격자로 흩는다.
function fillHouse(d, rect, rng, out, f) {
  const size = Math.max(3, Math.round(T(f.size)));
  const jitter = Math.round(T(f.jitter));
  const pitch = size + Math.max(2, Math.round(jitter * 0.8));
  for (let y = rect.y + 1; y + size <= rect.y + rect.h - 1; y += pitch) {
    for (let x = rect.x + 1; x + size <= rect.x + rect.w - 1; x += pitch) {
      if (!rng.chance(0.82)) continue;
      const w = size + rng.int(-1, 2), h = size + rng.int(-1, 1);
      const floors = rng.int(f.floors[0], f.floors[1]);
      out.buildings.push({
        name: rng.pick(SHOP_PREFIX) + (floors >= 3 ? '빌라' : '주택'),
        kind: KIND.HOUSE, x, y, w: Math.max(3, w), h: Math.max(3, h),
        floors, basement: 0, districtId: d.id,
      });
    }
  }
}

// 공장 — 블록 하나에 큰 건물 한둘.
function fillIndustrial(d, rect, rng, out, f) {
  const count = rng.int(1, 2);
  let cursorY = rect.y + 3;
  for (let i = 0; i < count; i++) {
    const w = Math.round(T(rng.range(f.minW, f.maxW)));
    const h = Math.round(T(rng.range(f.minH, f.maxH)));
    if (cursorY + h > rect.y + rect.h - 3) break;
    const x = rect.x + rng.int(2, Math.max(2, rect.w - w - 2));
    const warehouse = rng.chance(0.3);
    out.buildings.push({
      name: rng.pick(FACTORY_PREFIX) + rng.pick(FACTORY_SUFFIX) + ' ' + rng.pick(FACTORY_TAIL),
      kind: warehouse ? KIND.WAREHOUSE : KIND.FACTORY,
      x, y: cursorY, w, h,
      floors: rng.int(f.floors[0], f.floors[1]), basement: 0, districtId: d.id,
    });
    cursorY += h + Math.round(T(30));
  }
}

// 농가 — 드문드문.
function fillRural(d, rect, rng, out, f) {
  const size = Math.max(3, Math.round(T(f.size)));
  const pitch = size + Math.round(T(f.jitter)) + 6;
  for (let y = rect.y + 2; y + size <= rect.y + rect.h - 2; y += pitch) {
    for (let x = rect.x + 2; x + size <= rect.x + rect.w - 2; x += pitch) {
      if (!rng.chance(f.rate)) continue;
      out.buildings.push({
        name: rng.pick(RURAL_NAME), kind: KIND.FARMHOUSE,
        x: x + rng.int(0, 3), y: y + rng.int(0, 3),
        w: size + rng.int(-1, 3), h: size + rng.int(-1, 1),
        floors: rng.int(f.floors[0], f.floors[1]), basement: 0, districtId: d.id,
      });
    }
  }
}

// 모든 구역을 펼친다. 게임 시작 때 한 번만 돈다.
export function expandDistricts() {
  const out = { roads: [], buildings: [], areas: [], aptCount: {} };

  for (const d of DISTRICTS) {
    const path = projectPath(d.path);
    const b = pathBounds(path);
    const rng = makeRng(SEED, 'district', d.id);
    out.aptCount[d.id] = 0;

    const streetW = ROAD_CLASS[d.street].width + ROAD_CLASS[d.street].sidewalk * 2;
    const pitchX = Math.round(T(d.block.w)) + streetW;
    const pitchY = Math.round(T(d.block.h)) + streetW;
    const x0 = Math.floor(b.minX), y0 = Math.floor(b.minY);

    // 블록 사이 길 — 구역 안쪽 구간만 남긴다
    for (let x = x0; x <= b.maxX; x += pitchX) {
      for (const run of clipLineToPath(x, y0, b.maxY, path, false)) {
        out.roads.push({ name: '', cls: d.street, tiles: run, districtId: d.id });
      }
    }
    for (let y = y0; y <= b.maxY; y += pitchY) {
      for (const run of clipLineToPath(y, x0, b.maxX, path, true)) {
        out.roads.push({ name: '', cls: d.street, tiles: run, districtId: d.id });
      }
    }

    // 블록 안쪽 채우기
    for (let y = y0; y <= b.maxY; y += pitchY) {
      for (let x = x0; x <= b.maxX; x += pitchX) {
        // 길 폭 + 여유 한 칸만큼 안으로 들여 놓는다. 건물이 길에 닿으면 버려진다.
        const inset = Math.ceil(streetW / 2) + 2;
        const rect = {
          x: x + inset, y: y + inset,
          w: pitchX - inset * 2, h: pitchY - inset * 2,
        };
        const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
        // 블록 중심과 네 귀퉁이 중 셋 이상이 구역 안에 있어야 채운다
        let inside = pointInPath(cx, cy, path) ? 1 : 0;
        for (const [px, py] of [[rect.x, rect.y], [rect.x + rect.w, rect.y],
          [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h]]) {
          if (pointInPath(px, py, path)) inside++;
        }
        if (inside < 3) continue;
        fillBlock(d, rect, rng, out);
      }
    }
  }
  delete out.aptCount;
  return out;
}
