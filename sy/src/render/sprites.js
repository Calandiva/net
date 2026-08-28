// 절차적 스프라이트 생성 — 이 파일이 게임의 모든 그림을 만든다.
//
// 외부 이미지를 일절 쓰지 않는다. 전부 캔버스에 코드로 찍는다.
// 나중에 진짜 도트 에셋으로 바꾸고 싶으면 이 파일만 갈아끼우면 된다.
// 규칙: 모든 생성물은 시드에서 나오고, 한 번 만들면 캐시한다.

import { TILE, GROUND, PROP, KIND, IN, BUILDING, PLAYER, SEED } from '../config.js';
import {
  GROUND_COLOR, GROUND_JITTER, PROP_COLOR, BUILDING_COLOR, INTERIOR_COLOR,
  PLAYER_COLOR, NPC_COLORS, shade, mix,
} from './palette.js';
import { makeRng, noiseAt, seedOf } from '../util/rng.js';

const S = TILE.size;
// 간판 색 — 우리나라 상가 간판에 흔한 색들
const SIGN_COLORS = ['#d4574a', '#e2b93b', '#3f7fbf', '#4f9a5a', '#e2782f',
  '#8f5aa8', '#2f2f38', '#d8607f'];
const GROUND_VARIANTS = 6;   // 지면 종류마다 만들어 둘 변주 개수
const S_TEX = seedOf(SEED, 'tex');

// ── 캔버스 도구 ─────────────────────────────────────────────────────────
export function makeCanvas(w, h) {
  const c = typeof OffscreenCanvas !== 'undefined'
    ? new OffscreenCanvas(w, h)
    : Object.assign(document.createElement('canvas'), { width: w, height: h });
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

// 도트 하나(또는 사각형) 찍기
function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

// ── 지면 타일 ───────────────────────────────────────────────────────────
const groundCache = new Map();

// kind 와 variant 로 16x16 지면 타일 하나
export function groundTile(kind, variant) {
  const key = kind * 16 + variant;
  let hit = groundCache.get(key);
  if (hit) return hit;

  const { canvas, ctx } = makeCanvas(S, S);
  const base = GROUND_COLOR[kind] || '#ff00ff';
  const jitter = GROUND_JITTER[kind] || 0;
  const rng = makeRng(SEED, 'ground', kind, variant);

  px(ctx, 0, 0, S, S, base);
  // 얼룩 — 픽셀마다 밝기를 조금씩 흔든다
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = rng();
      if (n > 0.72) px(ctx, x, y, 1, 1, shade(base, jitter * (n - 0.72) * 3));
      else if (n < 0.2) px(ctx, x, y, 1, 1, shade(base, -jitter * (0.2 - n) * 3));
    }
  }

  switch (kind) {
    case GROUND.FIELD: { // 논 — 이랑 줄무늬
      const dark = shade(base, -0.12);
      for (let y = (variant % 2) ? 1 : 2; y < S; y += 4) px(ctx, 0, y, S, 1, dark);
      break;
    }
    case GROUND.GRASS: { // 풀 — 짧은 잎
      for (let i = 0; i < 10; i++) {
        const x = rng.int(0, S - 1), y = rng.int(0, S - 2);
        px(ctx, x, y, 1, 2, shade(base, 0.16));
      }
      break;
    }
    case GROUND.ASPHALT: { // 상가 마당 — 아스팔트에 기름 자국과 주차선 조각
      for (let i = 0; i < 20; i++) px(ctx, rng.int(0, S - 1), rng.int(0, S - 1), 1, 1,
        shade(base, rng.chance(0.5) ? 0.08 : -0.08));
      if (variant === 0) px(ctx, 2, 0, 1, S, shade(base, 0.24));
      if (variant === 3) px(ctx, 0, 6, S, 1, shade(base, -0.14));
      break;
    }
    case GROUND.ROAD: { // 아스팔트 알갱이
      for (let i = 0; i < 22; i++) px(ctx, rng.int(0, S - 1), rng.int(0, S - 1), 1, 1,
        shade(base, rng.chance(0.5) ? 0.1 : -0.1));
      break;
    }
    case GROUND.ROAD_LINE: {
      // 우리나라 도로 중앙선은 노란색이다
      px(ctx, 0, 0, S, S, GROUND_COLOR[GROUND.ROAD]);
      px(ctx, 0, S / 2 - 1, S, 2, '#e0b63c');
      break;
    }
    case GROUND.SIDEWALK: { // 보도블럭 격자
      const line = shade(base, -0.14);
      for (let y = 0; y < S; y += 8) px(ctx, 0, y, S, 1, line);
      for (let x = (variant % 2) ? 0 : 4; x < S; x += 8) px(ctx, x, 0, 1, S, line);
      break;
    }
    case GROUND.CROSSWALK: {
      px(ctx, 0, 0, S, S, GROUND_COLOR[GROUND.ROAD]);
      px(ctx, 2, 0, 5, S, '#eeead8');
      px(ctx, 10, 0, 5, S, '#eeead8');
      break;
    }
    case GROUND.PLAZA: { // 포장 블럭
      const line = shade(base, -0.12);
      for (let y = 0; y < S; y += 4) px(ctx, 0, y, S, 1, line);
      for (let x = 0; x < S; x += 4) px(ctx, x, 0, 1, S, line);
      break;
    }
    case GROUND.WATER: { // 잔물결
      for (let i = 0; i < 4; i++) {
        const y = rng.int(1, S - 2), x = rng.int(0, S - 6);
        px(ctx, x, y, rng.int(3, 6), 1, shade(base, 0.22));
      }
      break;
    }
    case GROUND.SAND: {
      for (let i = 0; i < 14; i++) px(ctx, rng.int(0, S - 1), rng.int(0, S - 1), 1, 1,
        shade(base, -0.1));
      break;
    }
    case GROUND.PARKING: { // 주차 구획선 — 일부 타일에만 그린다
      if (variant % 3 === 0) px(ctx, 0, 1, 1, S - 2, shade(base, 0.3));
      for (let i = 0; i < 10; i++) px(ctx, rng.int(0, S - 1), rng.int(0, S - 1), 1, 1,
        shade(base, rng.chance(0.5) ? 0.06 : -0.06));
      break;
    }
    case GROUND.YARD: { // 공단 포장 마당
      for (let i = 0; i < 14; i++) px(ctx, rng.int(0, S - 1), rng.int(0, S - 1), 1, 1,
        shade(base, rng.chance(0.5) ? 0.07 : -0.07));
      if (variant % 4 === 0) px(ctx, 0, 0, S, 1, shade(base, -0.12));
      break;
    }
    case GROUND.TRACK: { // 산책로 — 자잘한 자갈
      for (let i = 0; i < 18; i++) px(ctx, rng.int(0, S - 1), rng.int(0, S - 1), 1, 1,
        shade(base, rng.chance(0.5) ? 0.12 : -0.12));
      break;
    }
    case GROUND.FLOOR: { // 건물 바닥 — 실제로는 거의 가려진다
      px(ctx, 0, 0, S, S, shade(base, -0.05));
      break;
    }
  }

  hit = canvas;
  groundCache.set(key, hit);
  return hit;
}

// 타일 좌표로 변주 고르기 — 같은 자리는 언제나 같은 모습
export function groundVariantAt(tx, ty) {
  return Math.floor(noiseAt(S_TEX, tx, ty) * GROUND_VARIANTS) % GROUND_VARIANTS;
}

// ── 소품 ────────────────────────────────────────────────────────────────
const propCache = new Map();
export const PROP_H = 24; // 소품 캔버스 높이 (타일보다 커서 위로 삐져나온다)

export function propSprite(kind, variant) {
  const key = kind * 16 + variant;
  let hit = propCache.get(key);
  if (hit) return hit;

  const { canvas, ctx } = makeCanvas(S, PROP_H);
  const rng = makeRng(SEED, 'prop', kind, variant);
  const c = PROP_COLOR[kind] || {};
  const base = PROP_H; // 바닥선

  switch (kind) {
    case PROP.TREE: {
      const leaf = shade(c.leaf, rng.range(-0.08, 0.08));
      px(ctx, 7, base - 7, 2, 6, c.trunk);
      // 잎은 세 덩어리를 겹쳐 둥글게
      for (const [ox, oy, r] of [[8, base - 13, 6], [5, base - 11, 5], [11, base - 11, 5]]) {
        blob(ctx, ox, oy, r, leaf, rng);
      }
      blob(ctx, 6, base - 15, 3, c.leafHi, rng);
      break;
    }
    case PROP.BUSH: {
      blob(ctx, 8, base - 4, 5, c.leaf, rng);
      blob(ctx, 6, base - 6, 3, c.leafHi, rng);
      break;
    }
    case PROP.LAMP: {
      px(ctx, 7, base - 16, 2, 16, c.pole);
      px(ctx, 5, base - 20, 6, 4, c.head);
      px(ctx, 4, base - 18, 8, 1, shade(c.head, -0.3));
      break;
    }
    case PROP.BENCH: {
      px(ctx, 2, base - 6, 12, 3, c.wood);
      px(ctx, 2, base - 9, 12, 2, shade(c.wood, 0.1));
      px(ctx, 3, base - 3, 2, 3, c.leg);
      px(ctx, 11, base - 3, 2, 3, c.leg);
      break;
    }
    case PROP.SIGN: {
      px(ctx, 7, base - 12, 2, 12, c.pole);
      px(ctx, 2, base - 20, 12, 8, c.board);
      px(ctx, 4, base - 17, 8, 1, c.text);
      px(ctx, 4, base - 15, 6, 1, c.text);
      break;
    }
    case PROP.HYDRANT: {
      px(ctx, 6, base - 8, 4, 8, c.body);
      px(ctx, 5, base - 10, 6, 2, c.cap);
      px(ctx, 4, base - 6, 8, 2, shade(c.body, -0.2));
      break;
    }
    case PROP.PLANTER: {
      px(ctx, 4, base - 6, 8, 6, c.pot);
      blob(ctx, 8, base - 9, 4, c.leaf, rng);
      break;
    }
    case PROP.FENCE: {
      px(ctx, 0, base - 8, S, 2, c.wood);
      px(ctx, 0, base - 4, S, 2, c.wood);
      px(ctx, 2, base - 10, 2, 10, shade(c.wood, -0.15));
      px(ctx, 12, base - 10, 2, 10, shade(c.wood, -0.15));
      break;
    }
    case PROP.ROCK: {
      blob(ctx, 8, base - 4, 5, c.body, rng);
      px(ctx, 6, base - 7, 3, 2, c.hi);
      break;
    }
    case PROP.FLOWER: {
      const petal = c.petal[variant % c.petal.length];
      for (let i = 0; i < 3; i++) {
        const x = 3 + i * 5 + rng.int(0, 1), y = base - 4 - rng.int(0, 3);
        px(ctx, x, y + 2, 1, 3, c.stem);
        px(ctx, x - 1, y, 3, 2, petal);
      }
      break;
    }
    case PROP.VENDING: {
      px(ctx, 3, base - 14, 10, 14, c.body);
      px(ctx, 5, base - 12, 6, 7, c.glass);
      px(ctx, 5, base - 4, 6, 2, shade(c.body, -0.3));
      break;
    }
  }

  hit = canvas;
  propCache.set(key, hit);
  return hit;
}

// 둥근 덩어리 (도트라서 원 대신 계단식)
function blob(ctx, cx, cy, r, color, rng) {
  ctx.fillStyle = color;
  for (let y = -r; y <= r; y++) {
    const w = Math.round(Math.sqrt(Math.max(0, r * r - y * y)));
    if (w <= 0) continue;
    const wobble = rng ? (rng.chance(0.25) ? -1 : 0) : 0;
    ctx.fillRect(cx - w, cy + y, w * 2 + wobble, 1);
  }
}

// ── 건물 ────────────────────────────────────────────────────────────────
const buildingCache = new Map();
const buildingOrder = [];
const BUILDING_CACHE_MAX = 320;

// 건물 높이(픽셀) — 층수에 비례하되 상한이 있다
export function wallHeight(b) {
  return Math.min(BUILDING.wallHeightMax, 8 + b.floors * BUILDING.wallHeightPerFloor);
}

// 건물 한 채의 생김새를 시드에서 뽑는다.
// 같은 종류라도 채마다 파사드·차양·옥상 구조물이 달라진다.
function pickStyle(b, rng) {
  const tall = b.floors >= 8;
  const wide = b.w >= 10;
  return {
    facade: rng.pick(tall ? ['glass', 'glass', 'grid'] : ['grid', 'tile', 'glass']),
    awning: (b.kind === KIND.SHOP || b.kind === KIND.MART) && rng.chance(0.55),
    awningColor: rng.pick(SIGN_COLORS),
    signs: b.kind === KIND.SHOP ? rng.int(1, 3) : 1,
    pillar: b.kind === KIND.SHOP && b.floors >= 4 && rng.chance(0.4),   // 옥상 광고탑
    tank: rng.chance(tall ? 0.7 : 0.35),                                // 물탱크
    solar: rng.chance(b.kind === KIND.HOUSE ? 0.35 : 0.2),              // 태양광
    penthouse: tall && rng.chance(0.5),                                 // 옥탑방
    units: rng.chance(0.5),                                             // 실외기 줄
    roofShape: rng.pick(['gable', 'flat', 'hip']),                      // 주택 지붕
    chimney: b.kind === KIND.FACTORY && rng.chance(0.5),
    docks: (b.kind === KIND.WAREHOUSE || b.kind === KIND.FACTORY) && wide,
    piloti: b.kind === KIND.APARTMENT && rng.chance(0.45),              // 1층 필로티
    ridge: rng.chance(0.5),                                             // 공장 지붕 골 방향
  };
}

// 건물 한 채를 통째로 그린 캔버스. 아래 끝이 건물 남쪽 벽에 맞는다.
export function buildingSprite(b) {
  const wh = wallHeight(b);
  const key = `${b.kind}|${b.w}|${b.h}|${b.floors}|${b.seed}|${b.door.dir}`;
  let hit = buildingCache.get(key);
  if (hit) return hit;

  const pw = b.w * S, ph = b.h * S + wh;
  const { canvas, ctx } = makeCanvas(pw, ph);
  let col = BUILDING_COLOR[b.kind] || BUILDING_COLOR[KIND.SHOP];
  // 비닐하우스는 흰 비닐이 씌워져 있다
  if (b.name && b.name.includes('비닐하우스')) {
    col = { wall: '#e8eeea', roof: '#dfe6e2', trim: '#b8c4bc', accent: '#cfe0d8' };
  }
  const rng = makeRng(SEED, 'sprite', b.seed, b.kind);
  const style = pickStyle(b, rng);
  // 같은 종류라도 채마다 색을 꽤 다르게 흔든다
  const wall = shade(col.wall, rng.range(-0.10, 0.10));
  const roof = shade(col.roof, rng.range(-0.12, 0.12));
  const trim = col.trim;
  const roofH = b.h * S;

  // 옥상
  px(ctx, 0, 0, pw, roofH, roof);
  px(ctx, 0, 0, pw, 1, shade(roof, 0.18));
  px(ctx, 0, roofH - 1, pw, 1, shade(roof, -0.2));
  drawRoofDetail(ctx, b, pw, roofH, roof, trim, col, rng, style);

  // 앞벽
  px(ctx, 0, roofH, pw, wh, wall);
  px(ctx, 0, roofH, pw, 1, shade(wall, 0.2));
  px(ctx, 0, ph - 2, pw, 2, shade(wall, -0.28));
  px(ctx, 0, roofH, 1, wh, shade(wall, -0.12));
  px(ctx, pw - 1, roofH, 1, wh, shade(wall, -0.12));

  drawWindows(ctx, b, pw, roofH, wh, wall, col, rng, style);
  drawFrontDoor(ctx, b, pw, roofH, wh, col, rng, style);

  hit = canvas;
  buildingCache.set(key, hit);
  buildingOrder.push(key);
  if (buildingOrder.length > BUILDING_CACHE_MAX) {
    buildingCache.delete(buildingOrder.shift());
  }
  return hit;
}

function drawRoofDetail(ctx, b, pw, roofH, roof, trim, col, rng, style) {
  const dark = shade(roof, -0.16), light = shade(roof, 0.12);
  switch (b.kind) {
    case KIND.APARTMENT: case KIND.TOWER: {
      // 옥상 난간
      px(ctx, 1, 1, pw - 2, 2, light);
      px(ctx, 1, roofH - 3, pw - 2, 2, dark);
      px(ctx, 1, 1, 2, roofH - 3, shade(roof, 0.06));
      px(ctx, pw - 3, 1, 2, roofH - 3, shade(roof, -0.06));
      // 계단탑과 엘리베이터 기계실 — 세대 라인마다 하나씩 올라온다
      const towerStep = 42;
      for (let x = 8; x < pw - 16; x += towerStep) {
        const ty = Math.floor(roofH * 0.34);
        px(ctx, x, ty, 13, 10, shade(roof, -0.26));
        px(ctx, x + 1, ty + 1, 11, 3, light);
        px(ctx, x + 3, ty + 10, 7, 2, shade(roof, -0.34));
      }
      // 물탱크
      if (pw > 60) {
        const wx = pw - 22;
        px(ctx, wx, 6, 14, 9, shade(roof, -0.2));
        px(ctx, wx + 1, 7, 12, 3, light);
      }
      break;
    }
    case KIND.HOUSE: case KIND.FARMHOUSE: {
      if (style.roofShape === 'flat') {
        // 평지붕 — 옥상에 물탱크와 장독대, 가끔 태양광
        px(ctx, 1, 1, pw - 2, roofH - 3, shade(roof, -0.06));
        px(ctx, 1, 1, pw - 2, 1, light);
        if (style.tank) { px(ctx, 4, 4, 7, 6, dark); px(ctx, 5, 5, 5, 2, light); }
        if (style.solar) {
          for (let x = pw - 16; x < pw - 4 && x > 2; x += 6) px(ctx, x, 5, 5, 8, '#3f5f8a');
        }
        for (let i = 0; i < 3; i++) px(ctx, pw - 10 + i * 3, roofH - 9, 2, 3, '#7a5a3a');
      } else if (style.roofShape === 'hip') {
        // 모임지붕 — 네 방향으로 흐른다
        px(ctx, 0, 0, pw, roofH, shade(roof, 0.06));
        for (let i = 0; i < Math.min(pw, roofH) / 2; i++) {
          px(ctx, i, i, pw - i * 2, 1, shade(roof, 0.02 - i * 0.02));
        }
        px(ctx, 0, roofH - 2, pw, 2, dark);
      } else {
        // 박공지붕 — 가운데 용마루
        const mid = Math.floor(roofH / 2);
        px(ctx, 0, 0, pw, mid, shade(roof, 0.1));
        px(ctx, 0, mid, pw, roofH - mid, dark);
        px(ctx, 0, mid - 1, pw, 2, shade(roof, -0.35));
        for (let x = 2; x < pw - 2; x += 5) px(ctx, x, 1, 1, roofH - 2, shade(roof, -0.06));
      }
      break;
    }
    case KIND.FACTORY: case KIND.WAREHOUSE: {
      // 샌드위치 패널 골. 방향은 건물마다 다르다.
      if (style.ridge) {
        for (let x = 2; x < pw - 3; x += 9) {
          px(ctx, x, 2, 5, roofH - 5, dark);
          px(ctx, x, 2, 5, 2, shade(roof, 0.18));
        }
      } else {
        for (let y = 2; y < roofH - 3; y += 9) {
          px(ctx, 2, y, pw - 4, 5, dark);
          px(ctx, 2, y, pw - 4, 2, shade(roof, 0.18));
        }
      }
      // 지붕 환기구 줄
      for (let x = 6; x < pw - 8; x += 16) px(ctx, x, Math.floor(roofH / 2) - 2, 6, 4, '#c8ccd0');
      // 굴뚝
      if (style.chimney) {
        const cx2 = pw - 14;
        px(ctx, cx2, 3, 6, 16, '#b8bec4');
        px(ctx, cx2, 3, 6, 3, '#e2554a');
        px(ctx, cx2 + 1, 6, 4, 2, '#8f979e');
      }
      break;
    }
    case KIND.SCHOOL: case KIND.PUBLIC: case KIND.HOSPITAL: {
      px(ctx, 2, 2, pw - 4, roofH - 5, shade(roof, -0.08));
      px(ctx, 4, 4, pw - 8, 1, light);
      if (b.kind === KIND.HOSPITAL) { // 옥상 적십자
        const cx = Math.floor(pw / 2), cy = Math.floor(roofH / 2);
        px(ctx, cx - 2, cy - 6, 5, 13, col.accent);
        px(ctx, cx - 6, cy - 2, 13, 5, col.accent);
      }
      break;
    }
    case KIND.CHURCH: {
      const cx = Math.floor(pw / 2), cy = Math.floor(roofH / 2);
      px(ctx, cx - 1, cy - 8, 3, 16, col.accent);
      px(ctx, cx - 5, cy - 4, 11, 3, col.accent);
      break;
    }
    case KIND.STATION: {
      // 유리 캐노피
      for (let x = 2; x < pw - 2; x += 6) px(ctx, x, 2, 4, roofH - 5, shade(roof, 0.16));
      px(ctx, 0, roofH - 4, pw, 2, col.accent);
      break;
    }
    case KIND.MART: {
      px(ctx, 3, 3, pw - 6, roofH - 7, shade(roof, -0.1));
      for (let x = 6; x < pw - 6; x += 12) px(ctx, x, 6, 8, 6, dark); // 실외기
      break;
    }
    default: {
      // 상가 옥상 — 난간, 실외기 줄, 물탱크, 옥탑방, 광고탑
      px(ctx, 1, 1, pw - 2, roofH - 3, shade(roof, -0.05));
      px(ctx, 1, 1, pw - 2, 1, light);
      px(ctx, 1, roofH - 3, pw - 2, 1, dark);
      // 실외기 — 상가 옥상은 이것들로 빼곡하다
      const acRows = Math.max(1, Math.floor(roofH / 26));
      for (let r = 0; r < acRows; r++) {
        const ay = 5 + r * 14;
        if (ay + 6 > roofH - 6) break;
        for (let x = 4; x < pw - 8; x += 10) {
          if (!rng.chance(style.units ? 0.85 : 0.45)) continue;
          px(ctx, x, ay, 7, 6, shade(roof, -0.24));
          px(ctx, x + 1, ay + 1, 5, 3, shade(roof, 0.12));
          px(ctx, x + 1, ay + 5, 5, 1, shade(roof, -0.34));
        }
      }
      // 배관과 난간 그림자
      const pipeY = Math.floor(roofH * 0.72);
      px(ctx, 3, pipeY, pw - 6, 1, shade(roof, -0.2));
      if (rng.chance(0.5)) px(ctx, Math.floor(pw / 3), 3, 1, roofH - 8, shade(roof, -0.16));
      if (roofH > 24) {
        px(ctx, pw - 14, roofH - 14, 9, 8, dark);        // 옥상 출입문
        px(ctx, pw - 12, roofH - 12, 5, 5, shade(roof, 0.2));
      }
      if (style.tank && roofH > 18) {
        px(ctx, 4, roofH - 13, 8, 7, shade(roof, -0.28)); // 물탱크
        px(ctx, 5, roofH - 12, 6, 2, light);
      }
      if (style.penthouse && roofH > 26) {
        px(ctx, Math.floor(pw / 2) - 7, 5, 15, 11, shade(roof, -0.18));
        px(ctx, Math.floor(pw / 2) - 5, 7, 11, 4, shade(col.accent, 0.2));
      }
      if (style.pillar) {
        // 옥상 광고탑 — 간판 기둥이 하늘로 솟아 있다
        const sx = Math.floor(pw * 0.25);
        px(ctx, sx, 2, 3, roofH - 6, '#8f959c');
        px(ctx, sx - 5, 1, 13, 7, rng.pick(SIGN_COLORS));
        px(ctx, sx - 3, 3, 9, 1, '#fffdf2');
      }
    }
  }
}

function drawWindows(ctx, b, pw, roofH, wh, wall, col, rng, style) {
  if (b.kind === KIND.APARTMENT) {
    return drawApartmentFace(ctx, b, pw, roofH, wh, wall, col, rng, style);
  }
  if (b.kind === KIND.FARMHOUSE && b.w < 6) return;
  const glass = shade(col.accent, rng.range(-0.05, 0.1));

  // 창고·공장 앞면은 하역 도크 셔터가 늘어선다
  if (b.kind === KIND.WAREHOUSE || b.kind === KIND.FACTORY) {
    const y = roofH + Math.max(2, wh - 14);
    if (style.docks) {
      for (let x = 4; x < pw - 12; x += 18) {
        px(ctx, x, y, 13, Math.min(12, wh - 3), shade(wall, -0.22));
        for (let i = 1; i < 5; i++) px(ctx, x, y + i * 3, 13, 1, shade(wall, -0.32));
      }
    } else {
      for (let x = 4; x < pw - 8; x += 14) px(ctx, x, y + 2, 9, 5, glass);
    }
    return;
  }

  if (style.facade === 'glass') {
    // 커튼월 — 층마다 통유리 띠
    for (let r = 0; ; r++) {
      const y = roofH + 3 + r * 8;
      if (y + 6 > roofH + wh - 4) break;
      px(ctx, 2, y, pw - 4, 5, glass);
      px(ctx, 2, y, pw - 4, 1, shade(glass, 0.28));
      for (let x = 4; x < pw - 4; x += 7) px(ctx, x, y, 1, 5, shade(wall, -0.1));
    }
  } else if (style.facade === 'tile') {
    // 타일 벽 — 작은 창이 드문드문
    for (let y = roofH + 2; y < roofH + wh - 4; y += 4) {
      px(ctx, 1, y, pw - 2, 1, shade(wall, -0.06));
    }
    for (let r = 0; ; r++) {
      const y = roofH + 4 + r * 9;
      if (y + 5 > roofH + wh - 4) break;
      for (let x = 5; x < pw - 7; x += 12) {
        if (rng.chance(0.2)) continue;
        px(ctx, x, y, 6, 5, glass);
        px(ctx, x, y + 4, 6, 1, shade(glass, -0.3));
      }
    }
  } else {
    // 격자 창 — 가장 흔한 모습
    const step = 9;
    for (let r = 0; ; r++) {
      const y = roofH + 4 + r * 9;
      if (y + 5 > roofH + wh - 4) break;
      for (let x = 4; x < pw - 6; x += step) {
        if (rng.chance(0.12)) continue;
        px(ctx, x, y, 5, 5, glass);
        px(ctx, x, y, 5, 1, shade(glass, 0.25));
        px(ctx, x, y + 4, 5, 1, shade(glass, -0.25));
      }
    }
  }

  // 상가는 1층 유리 파사드와 간판띠. 간판 수와 색은 건물마다 다르다.
  if ((b.kind === KIND.SHOP || b.kind === KIND.MART || b.kind === KIND.TOWER) && wh > 14) {
    // 1층 통유리
    px(ctx, 1, roofH + wh - 9, pw - 2, 7, shade(col.accent, 0.3));
    for (let x = 4; x < pw - 3; x += 6) px(ctx, x, roofH + wh - 9, 1, 7, shade(wall, -0.15));

    const signCount = b.kind === KIND.MART ? 1 : style.signs;
    for (let i = 0; i < signCount; i++) {
      const y = roofH + wh - 14 - i * 11;
      if (y < roofH + 2) break;
      const sign = b.kind === KIND.MART ? col.accent : rng.pick(SIGN_COLORS);
      const inset = i === 0 ? 1 : 3;
      px(ctx, inset, y, pw - inset * 2, i === 0 ? 5 : 4, sign);
      px(ctx, inset, y, pw - inset * 2, 1, shade(sign, 0.25));
      for (let x = inset + 2; x < pw - inset - 3; x += 4) {
        px(ctx, x, y + 2, 2, 1, '#fffdf2');
      }
    }
    // 차양(어닝)
    if (style.awning) {
      const y = roofH + wh - 10;
      for (let x = 1; x < pw - 3; x += 6) {
        px(ctx, x, y, 5, 3, style.awningColor);
        px(ctx, x, y + 3, 5, 1, shade(style.awningColor, -0.3));
      }
    }
  }
}

// 아파트 앞면 — 세대 구획선과 발코니 띠, 그 사이 창문
function drawApartmentFace(ctx, b, pw, roofH, wh, wall, col, rng, style) {
  const unit = 22;                    // 세대 하나의 폭(픽셀)
  const glass = shade(col.accent, rng.range(-0.04, 0.08));
  const line = shade(wall, -0.16);
  const rows = Math.max(2, Math.floor((wh - 6) / 8));

  for (let r = 0; r < rows; r++) {
    const y = roofH + 3 + r * 8;
    if (y + 6 > roofH + wh - 3) break;
    // 발코니 난간 띠
    px(ctx, 1, y + 5, pw - 2, 1, line);
    for (let x = 3; x < pw - 6; x += unit) {
      px(ctx, x, y, 8, 5, glass);
      px(ctx, x, y, 8, 1, shade(glass, 0.22));
      px(ctx, x + 10, y + 1, 6, 4, shade(glass, -0.12)); // 작은방 창
    }
  }
  // 세대 사이 벽선
  for (let x = 0; x < pw; x += unit) px(ctx, x, roofH + 1, 1, wh - 3, line);
  // 1층 — 필로티(기둥만 있는 층)인 단지가 있고, 아닌 단지가 있다
  if (style.piloti) {
    const y = roofH + wh - 9;
    px(ctx, 1, y, pw - 2, 9, shade(wall, -0.42));
    for (let x = 3; x < pw - 4; x += unit / 2) px(ctx, x, y, 3, 9, shade(wall, -0.05));
  }
  // 출입구 캐노피
  const dx = Math.max(2, Math.min(pw - 16, (b.door.x - b.x) * S));
  px(ctx, dx, roofH + wh - 8, 14, 8, shade(col.trim, -0.1));
  px(ctx, dx + 2, roofH + wh - 7, 10, 4, shade(col.accent, 0.15));
}

function drawFrontDoor(ctx, b, pw, roofH, wh, col, rng, style) {
  // 문은 언제나 앞면에 있다 (world/buildings.js 의 placeDoor 참고).
  // 실제 출입구 타일 x 에 맞춰 그려서, 땅에 깔린 매트와 자리가 어긋나지 않게 한다.
  const doorW = Math.min(12, Math.max(6, Math.floor(pw / 6)));
  const y = roofH + wh - 10;
  const dark = shade(col.trim, -0.2);
  const dx = Math.max(1, Math.min(pw - doorW - 1,
    (b.door.x - b.x) * S + (S - doorW) / 2));

  // 차양
  px(ctx, dx - 2, y - 3, doorW + 4, 3, shade(col.trim, 0.05));
  // 문틀과 유리문
  px(ctx, dx, y, doorW, 10, dark);
  px(ctx, dx + 1, y + 1, doorW - 2, 7, shade(col.accent, 0.25));
  px(ctx, dx + doorW / 2 - 0.5, y + 1, 1, 7, dark);   // 가운데 문설주
  px(ctx, dx, y + 9, doorW, 1, shade(dark, -0.3));
}

// 출입구 발판 (땅에 깔리는 매트) — 문 찾기 쉬우라고
let doorMat = null;
export function doorMatSprite() {
  if (doorMat) return doorMat;
  const { canvas, ctx } = makeCanvas(S, S);
  px(ctx, 2, 4, 12, 9, '#c9a24a');
  px(ctx, 3, 5, 10, 7, '#e0b95f');
  px(ctx, 5, 8, 6, 1, '#8f6f2c');
  doorMat = canvas;
  return doorMat;
}

// ── 사람 ────────────────────────────────────────────────────────────────
// 4방향 × 4프레임 (서기, 걷기1, 서기, 걷기2)
const DIRS = ['down', 'left', 'right', 'up'];
const FRAMES = 4;

export function makeCharacterSheet(colors) {
  const w = PLAYER.drawWidth, h = PLAYER.drawHeight;
  const { canvas, ctx } = makeCanvas(w * FRAMES, h * DIRS.length);
  for (let d = 0; d < DIRS.length; d++) {
    for (let f = 0; f < FRAMES; f++) {
      drawCharacter(ctx, f * w, d * h, w, h, DIRS[d], f, colors);
    }
  }
  return { canvas, w, h, dirs: DIRS, frames: FRAMES };
}

function drawCharacter(ctx, ox, oy, w, h, dir, frame, c) {
  const step = frame === 1 ? 1 : frame === 3 ? -1 : 0; // 걸음에 따라 다리를 엇갈린다
  const cx = ox + w / 2;
  const out = c.outline;

  // 그림자
  ctx.globalAlpha = 0.2;
  px(ctx, ox + 3, oy + h - 2, w - 6, 2, '#000000');
  ctx.globalAlpha = 1;

  // 다리
  px(ctx, cx - 3, oy + h - 6 + (step > 0 ? 0 : 1), 2, 5, c.bottom);
  px(ctx, cx + 1, oy + h - 6 + (step < 0 ? 0 : 1), 2, 5, c.bottom);
  px(ctx, cx - 3, oy + h - 2, 2, 2, c.shoe);
  px(ctx, cx + 1, oy + h - 2, 2, 2, c.shoe);

  // 몸통
  px(ctx, cx - 4, oy + 8, 8, 7, c.top);
  px(ctx, cx - 4, oy + 8, 8, 1, shade(c.top, 0.2));
  // 팔
  px(ctx, cx - 5, oy + 9 + (step > 0 ? 1 : 0), 1, 5, shade(c.top, -0.12));
  px(ctx, cx + 4, oy + 9 + (step < 0 ? 1 : 0), 1, 5, shade(c.top, -0.12));

  // 머리
  px(ctx, cx - 4, oy + 1, 8, 8, c.skin);
  px(ctx, cx - 4, oy + 1, 8, 3, c.hair);
  px(ctx, cx - 5, oy + 2, 1, 5, c.hair);
  px(ctx, cx + 4, oy + 2, 1, 5, c.hair);

  // 눈·표정 — 방향에 따라
  if (dir === 'down') {
    px(ctx, cx - 3, oy + 5, 2, 2, out);
    px(ctx, cx + 1, oy + 5, 2, 2, out);
    px(ctx, cx - 1, oy + 7, 2, 1, shade(c.skin, -0.25));
  } else if (dir === 'left') {
    px(ctx, cx - 3, oy + 5, 2, 2, out);
    px(ctx, cx - 5, oy + 4, 1, 3, c.hair);
  } else if (dir === 'right') {
    px(ctx, cx + 1, oy + 5, 2, 2, out);
    px(ctx, cx + 4, oy + 4, 1, 3, c.hair);
  } else {
    px(ctx, cx - 4, oy + 1, 8, 6, c.hair); // 뒤통수
  }
}

let playerSheet = null;
export function playerSheet_() {
  if (!playerSheet) playerSheet = makeCharacterSheet(PLAYER_COLOR);
  return playerSheet;
}

const npcSheets = new Map();
export function npcSheet(seed) {
  let hit = npcSheets.get(seed);
  if (hit) return hit;
  const rng = makeRng(SEED, 'npc', seed);
  hit = makeCharacterSheet({
    skin: rng.pick(['#f2cfa8', '#e6bd94', '#d8a97e']),
    hair: rng.pick(NPC_COLORS.hair),
    top: rng.pick(NPC_COLORS.top),
    bottom: rng.pick(NPC_COLORS.bottom),
    shoe: '#3a3a42',
    outline: '#2a2028',
  });
  npcSheets.set(seed, hit);
  return hit;
}

// 고양이 — 이 동네에 꼭 있어야 한다
let catSprites = null;
export function catSprite(variant) {
  if (!catSprites) {
    catSprites = [];
    for (let v = 0; v < 3; v++) {
      const { canvas, ctx } = makeCanvas(14, 12);
      const rng = makeRng(SEED, 'cat', v);
      const fur = rng.pick(['#d8b98a', '#8a8a92', '#3a3a42', '#e8e2d8']);
      px(ctx, 2, 5, 9, 5, fur);
      px(ctx, 9, 3, 4, 4, fur);          // 머리
      px(ctx, 9, 2, 1, 2, fur);          // 귀
      px(ctx, 12, 2, 1, 2, fur);
      px(ctx, 1, 3, 2, 5, fur);          // 꼬리
      px(ctx, 3, 9, 2, 2, shade(fur, -0.2));
      px(ctx, 8, 9, 2, 2, shade(fur, -0.2));
      px(ctx, 10, 4, 1, 1, '#2a2028');   // 눈
      px(ctx, 12, 4, 1, 1, '#2a2028');
      catSprites.push(canvas);
    }
  }
  return catSprites[variant % catSprites.length];
}

// ── 길 위 사건 소품 ─────────────────────────────────────────────────────
const eventPropCache = new Map();

export function eventPropSprite(icon) {
  let hit = eventPropCache.get(icon);
  if (hit) return hit;
  const { canvas, ctx } = makeCanvas(S, 24);
  const base = 24;
  switch (icon) {
    case 'cone':
      px(ctx, 3, base - 4, 10, 3, '#c85a2a');
      px(ctx, 5, base - 12, 6, 8, '#e2703a');
      px(ctx, 6, base - 16, 4, 4, '#e2703a');
      px(ctx, 5, base - 9, 6, 2, '#f2f2ee');
      break;
    case 'stall':   // 좌판
      px(ctx, 1, base - 9, 14, 6, '#b98f5c');
      px(ctx, 1, base - 10, 14, 2, '#d8a86a');
      px(ctx, 2, base - 3, 2, 3, '#7a5a3a');
      px(ctx, 12, base - 3, 2, 3, '#7a5a3a');
      px(ctx, 0, base - 17, S, 5, '#d8564a');   // 차양
      px(ctx, 0, base - 13, S, 1, '#a8382c');
      break;
    case 'bowl':
      px(ctx, 4, base - 6, 8, 4, '#c98f6a');
      px(ctx, 5, base - 7, 6, 2, '#e8d8a8');
      break;
    case 'boxes':
      px(ctx, 2, base - 10, 7, 7, '#b98f5c');
      px(ctx, 8, base - 7, 6, 5, '#a87f4c');
      px(ctx, 2, base - 10, 7, 1, '#d8a86a');
      break;
    case 'puddle':
      ctx.globalAlpha = 0.75;
      blob(ctx, 8, base - 4, 5, '#7fa8bd', null);
      ctx.globalAlpha = 1;
      break;
    case 'crowd':   // 사람 많음 — 발자국 표시만
      px(ctx, 4, base - 5, 3, 2, '#8a8477');
      px(ctx, 9, base - 8, 3, 2, '#8a8477');
      break;
    default:
      px(ctx, 5, base - 10, 6, 10, '#8a919c');
  }
  hit = canvas;
  eventPropCache.set(icon, hit);
  return hit;
}

// ── 자동차 ──────────────────────────────────────────────────────────────
// 방향마다 미리 돌려서 구워 둔다. 매 프레임 회전시키면 도트가 지저분해진다.
const CAR_DIRS = 16;
const CAR_COLORS = ['#d8d8dc', '#3a3f46', '#8f97a0', '#5f7fa8', '#b8452f',
  '#2f5a3f', '#e2e2d8', '#7a5a8f'];
const carCache = new Map();

export function carSprite(kind, color, dirIndex) {
  const key = `${kind}|${color}|${dirIndex}`;
  let hit = carCache.get(key);
  if (hit) return hit;

  const size = kind === 'bus' ? 46 : kind === 'truck' ? 38 : 26;
  const body = kind === 'car' ? 11 : 13;
  const box = Math.ceil(Math.hypot(size, body)) + 2;
  const { canvas, ctx } = makeCanvas(box, box);
  const c = CAR_COLORS[color % CAR_COLORS.length];

  ctx.save();
  ctx.translate(box / 2, box / 2);
  ctx.rotate((dirIndex / CAR_DIRS) * Math.PI * 2);
  ctx.translate(-size / 2, -body / 2);

  // 차체
  px(ctx, 0, 0, size, body, c);
  px(ctx, 0, 0, size, 1, shade(c, 0.22));
  px(ctx, 0, body - 1, size, 1, shade(c, -0.28));
  if (kind === 'bus') {
    // 버스 — 창문 줄과 노선 색띠
    for (let x = 4; x < size - 6; x += 6) px(ctx, x, 2, 4, body - 4, '#9fc0dd');
    px(ctx, 0, Math.floor(body / 2), size, 2, '#3f7fbf');
    px(ctx, size - 4, 2, 3, body - 4, shade(c, -0.2));
  } else if (kind === 'truck') {
    // 트럭 — 앞칸과 적재함
    px(ctx, 0, 0, 11, body, shade(c, -0.12));
    px(ctx, 2, 2, 6, body - 4, '#9fc0dd');
    px(ctx, 12, 1, size - 13, body - 2, shade(c, 0.1));
    for (let x = 14; x < size - 2; x += 5) px(ctx, x, 1, 1, body - 2, shade(c, -0.15));
  } else {
    // 승용차 — 앞유리, 뒷유리, 지붕
    px(ctx, 5, 1, size - 11, body - 2, shade(c, -0.08));
    px(ctx, 6, 2, 4, body - 4, '#9fc0dd');
    px(ctx, size - 10, 2, 4, body - 4, '#8fb0cc');
  }
  // 바퀴와 등
  px(ctx, 3, -1, 4, 1, '#2a2a30');
  px(ctx, size - 8, -1, 4, 1, '#2a2a30');
  px(ctx, 3, body, 4, 1, '#2a2a30');
  px(ctx, size - 8, body, 4, 1, '#2a2a30');
  px(ctx, size - 2, 1, 2, 2, '#f2e2a8');
  px(ctx, size - 2, body - 3, 2, 2, '#f2e2a8');
  px(ctx, 0, 1, 1, 2, '#d8564a');
  px(ctx, 0, body - 3, 1, 2, '#d8564a');
  ctx.restore();

  hit = canvas;
  carCache.set(key, hit);
  return hit;
}

export function carDirIndex(angle) {
  const step = (Math.PI * 2) / CAR_DIRS;
  return ((Math.round(angle / step) % CAR_DIRS) + CAR_DIRS) % CAR_DIRS;
}

// ── 실내 타일 ───────────────────────────────────────────────────────────
const interiorCache = new Map();

export function interiorTile(kind, variant) {
  const key = kind * 16 + variant;
  let hit = interiorCache.get(key);
  if (hit) return hit;

  const { canvas, ctx } = makeCanvas(S, S);
  const base = INTERIOR_COLOR[kind] || '#ff00ff';
  const rng = makeRng(SEED, 'in', kind, variant);
  px(ctx, 0, 0, S, S, base);

  switch (kind) {
    case IN.FLOOR: { // 장판 — 이음선
      px(ctx, 0, 0, S, 1, shade(base, -0.08));
      px(ctx, 0, 0, 1, S, shade(base, -0.08));
      for (let i = 0; i < 6; i++) px(ctx, rng.int(0, S - 1), rng.int(0, S - 1), 1, 1,
        shade(base, -0.05));
      break;
    }
    case IN.WALL: {
      px(ctx, 0, 0, S, 3, shade(base, 0.16));
      px(ctx, 0, S - 3, S, 3, shade(base, -0.22));
      for (let y = 3; y < S - 3; y += 6) px(ctx, 0, y, S, 1, shade(base, -0.1));
      break;
    }
    case IN.EXIT: { // 건물 현관 — 유리문과 비상구 표시
      px(ctx, 0, 0, S, S, INTERIOR_COLOR[IN.WALL]);
      px(ctx, 1, 3, 14, 13, '#8fb8cc');          // 유리
      px(ctx, 1, 3, 14, 1, '#d8e6ee');
      px(ctx, 7, 3, 2, 13, INTERIOR_COLOR[IN.WALL]); // 문설주
      px(ctx, 3, 9, 2, 2, '#e8d8a8');            // 손잡이
      px(ctx, 10, 9, 2, 2, '#e8d8a8');
      px(ctx, 4, 0, 8, 3, base);                 // 비상구 표시등
      px(ctx, 6, 1, 4, 1, '#ffffff');
      break;
    }
    case IN.STAIR_UP: case IN.STAIR_DOWN: {
      const up = kind === IN.STAIR_UP;
      for (let i = 0; i < 4; i++) {
        const y = up ? 12 - i * 4 : i * 4;
        px(ctx, 1, y, 14, 3, shade(base, up ? 0.06 * i : -0.06 * i));
      }
      break;
    }
    case IN.ELEVATOR: {
      px(ctx, 1, 1, 14, 14, shade(base, -0.15));
      px(ctx, 3, 3, 4, 10, shade(base, 0.25));
      px(ctx, 9, 3, 4, 10, shade(base, 0.25));
      break;
    }
    case IN.COUNTER: {
      px(ctx, 0, 3, S, 10, base);
      px(ctx, 0, 3, S, 2, shade(base, 0.2));
      px(ctx, 0, 12, S, 2, shade(base, -0.25));
      break;
    }
    case IN.SHELF: {
      px(ctx, 1, 1, 14, 14, base);
      for (let y = 3; y < 14; y += 5) px(ctx, 2, y, 12, 3, shade(base, rng.range(-0.2, 0.25)));
      break;
    }
    case IN.DESK: {
      px(ctx, 1, 4, 14, 9, base);
      px(ctx, 1, 4, 14, 2, shade(base, 0.18));
      px(ctx, 4, 6, 7, 4, '#6d7a86'); // 모니터
      break;
    }
    case IN.PLANT: {
      px(ctx, 0, 0, S, S, INTERIOR_COLOR[IN.FLOOR]);
      px(ctx, 6, 10, 4, 5, '#b1705a');
      blob(ctx, 8, 7, 4, base, rng);
      break;
    }
    case IN.RUG: {
      px(ctx, 1, 1, 14, 14, base);
      px(ctx, 3, 3, 10, 10, shade(base, 0.14));
      break;
    }
    case IN.WINDOW: {
      px(ctx, 0, 0, S, S, INTERIOR_COLOR[IN.WALL]);
      px(ctx, 2, 3, 12, 9, base);
      px(ctx, 7, 3, 2, 9, shade(base, -0.25));
      break;
    }
    case IN.BED: {
      px(ctx, 2, 2, 12, 12, base);
      px(ctx, 2, 2, 12, 4, shade(base, 0.2));
      px(ctx, 3, 7, 10, 6, '#b8c8dc');
      break;
    }
    case IN.TABLE: {
      px(ctx, 2, 3, 12, 10, base);
      px(ctx, 2, 3, 12, 2, shade(base, 0.2));
      px(ctx, 6, 6, 4, 4, '#f2f2ee');
      break;
    }
    case IN.DOOR: { // 닫힌 문
      px(ctx, 0, 0, S, S, INTERIOR_COLOR[IN.WALL]);
      px(ctx, 2, 1, 12, 14, base);
      px(ctx, 2, 1, 12, 1, shade(base, 0.24));
      px(ctx, 3, 3, 10, 10, shade(base, -0.12));
      px(ctx, 11, 8, 2, 2, '#e8d8a8');   // 손잡이
      break;
    }
    case IN.DOOR_OPEN: { // 열린 문 — 옆으로 젖혀져 있다
      px(ctx, 0, 0, S, S, INTERIOR_COLOR[IN.FLOOR]);
      px(ctx, 0, 0, 3, S, INTERIOR_COLOR[IN.WALL]);
      px(ctx, 13, 0, 3, S, INTERIOR_COLOR[IN.WALL]);
      px(ctx, 3, 0, 4, 14, base);
      px(ctx, 3, 0, 4, 1, shade(base, 0.24));
      break;
    }
    case IN.LOCKER: { // 복도 사물함
      px(ctx, 0, 0, S, S, base);
      for (let x = 1; x < S; x += 5) px(ctx, x, 1, 4, 14, shade(base, 0.1));
      for (let x = 1; x < S; x += 5) px(ctx, x + 1, 7, 2, 1, shade(base, -0.35));
      break;
    }
    case IN.SMOKE: { // 연기 — 반쯤 비친다
      px(ctx, 0, 0, S, S, INTERIOR_COLOR[IN.FLOOR]);
      ctx.globalAlpha = 0.55;
      for (let i = 0; i < 7; i++) {
        blob(ctx, rng.int(3, 13), rng.int(3, 13), rng.int(2, 4), base, rng);
      }
      ctx.globalAlpha = 1;
      break;
    }
    case IN.BOX: { // 쏟아진 상자
      px(ctx, 0, 0, S, S, INTERIOR_COLOR[IN.FLOOR]);
      px(ctx, 1, 4, 9, 8, base);
      px(ctx, 1, 4, 9, 1, shade(base, 0.2));
      px(ctx, 5, 4, 1, 8, shade(base, -0.25));
      px(ctx, 9, 1, 6, 6, shade(base, -0.1));
      break;
    }
    case IN.PUDDLE: { // 물웅덩이
      px(ctx, 0, 0, S, S, INTERIOR_COLOR[IN.FLOOR]);
      ctx.globalAlpha = 0.7;
      blob(ctx, 8, 9, 5, base, rng);
      ctx.globalAlpha = 1;
      px(ctx, 5, 6, 4, 1, shade(base, 0.35));
      break;
    }
    case IN.CONE: { // 안전콘
      px(ctx, 0, 0, S, S, INTERIOR_COLOR[IN.FLOOR]);
      px(ctx, 4, 12, 9, 3, shade(base, -0.2));
      px(ctx, 6, 5, 5, 7, base);
      px(ctx, 7, 2, 3, 3, base);
      px(ctx, 6, 8, 5, 2, '#f2f2ee');
      break;
    }
    case IN.CAR: { // 주차된 차 (위에서 본 모습)
      px(ctx, 0, 0, S, S, INTERIOR_COLOR[IN.FLOOR]);
      px(ctx, 2, 1, 12, 14, base);
      px(ctx, 3, 3, 10, 4, '#9fc0dd');
      px(ctx, 3, 9, 10, 4, shade(base, -0.15));
      px(ctx, 2, 0, 12, 1, shade(base, 0.2));
      break;
    }
    case IN.PILLAR: { // 기둥
      px(ctx, 0, 0, S, S, INTERIOR_COLOR[IN.FLOOR]);
      px(ctx, 2, 2, 12, 12, base);
      px(ctx, 2, 2, 12, 2, shade(base, 0.18));
      px(ctx, 2, 12, 12, 2, shade(base, -0.25));
      break;
    }
    case IN.SEAT: { // 상영관 좌석
      px(ctx, 0, 0, S, S, '#2a2530');
      px(ctx, 1, 4, 6, 10, base);
      px(ctx, 9, 4, 6, 10, base);
      px(ctx, 1, 4, 6, 2, shade(base, 0.2));
      px(ctx, 9, 4, 6, 2, shade(base, 0.2));
      break;
    }
    case IN.SCREEN: { // 스크린
      px(ctx, 0, 0, S, S, '#2a2530');
      px(ctx, 0, 2, S, 11, base);
      px(ctx, 0, 2, S, 1, '#ffffff');
      break;
    }
    case IN.CART: { // 카트 보관대
      px(ctx, 0, 0, S, S, INTERIOR_COLOR[IN.FLOOR]);
      for (let i = 0; i < 3; i++) px(ctx, 2 + i * 4, 4, 3, 9, base);
      px(ctx, 1, 3, 14, 1, shade(base, -0.2));
      break;
    }
    case IN.MACHINE: {
      px(ctx, 1, 1, 14, 14, base);
      px(ctx, 3, 3, 10, 5, shade(base, -0.3));
      px(ctx, 4, 10, 3, 3, '#e2705f');
      px(ctx, 9, 10, 3, 3, '#8fc48a');
      break;
    }
  }

  hit = canvas;
  interiorCache.set(key, hit);
  return hit;
}

// 상호작용 물건 (버튼·레버·자판기 따위) — 실내외 공용
const gizmoCache = new Map();
export function gizmoSprite(icon, active) {
  const key = icon + (active ? '!' : '');
  let hit = gizmoCache.get(key);
  if (hit) return hit;
  const { canvas, ctx } = makeCanvas(S, S);
  const body = '#3d4450';
  switch (icon) {
    case 'button':
      px(ctx, 3, 5, 10, 8, body);
      px(ctx, 5, 7, 6, 4, active ? '#8fc48a' : '#e2554a');
      px(ctx, 5, 7, 6, 1, '#ffffff44');
      break;
    case 'lever':
      px(ctx, 4, 9, 8, 5, body);
      px(ctx, active ? 9 : 5, 3, 2, 7, '#d8d8dc');
      px(ctx, active ? 8 : 4, 2, 4, 3, active ? '#8fc48a' : '#e2554a');
      break;
    case 'panel':
      px(ctx, 2, 3, 12, 11, '#8a919c');
      px(ctx, 3, 4, 10, 9, active ? '#2a2f38' : '#b8bfc8');
      if (active) { px(ctx, 5, 6, 2, 2, '#f2c14e'); px(ctx, 9, 9, 2, 2, '#8fc48a'); }
      break;
    case 'valve':
      px(ctx, 7, 4, 2, 9, body);
      px(ctx, 3, 6, 10, 2, active ? '#8fc48a' : '#e2554a');
      px(ctx, 6, 3, 4, 2, '#d8d8dc');
      break;
    case 'note':
      px(ctx, 3, 3, 10, 11, '#f2eddc');
      px(ctx, 5, 6, 6, 1, '#8a8477');
      px(ctx, 5, 8, 6, 1, '#8a8477');
      px(ctx, 5, 10, 4, 1, '#8a8477');
      break;
    case 'bowl':
      px(ctx, 4, 8, 8, 4, '#c98f6a');
      px(ctx, 5, 7, 6, 2, active ? '#e8d8a8' : '#a8724e');
      break;
    case 'bell':
      px(ctx, 5, 4, 6, 7, '#d8b45a');
      px(ctx, 4, 10, 8, 2, '#b8923a');
      px(ctx, 7, 12, 2, 2, '#8a6a24');
      break;
    default:
      px(ctx, 4, 4, 8, 8, body);
      px(ctx, 6, 6, 4, 4, active ? '#8fc48a' : '#e2554a');
  }
  hit = canvas;
  gizmoCache.set(key, hit);
  return hit;
}

// 캐시를 비운다 (시드를 바꿔 다시 만들 때)
export function clearSpriteCaches() {
  groundCache.clear(); propCache.clear(); buildingCache.clear(); carCache.clear();
  eventPropCache.clear();
  buildingOrder.length = 0; interiorCache.clear(); gizmoCache.clear();
  npcSheets.clear(); playerSheet = null; catSprites = null; doorMat = null;
}
