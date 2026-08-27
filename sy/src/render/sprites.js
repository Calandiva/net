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
    case GROUND.ROAD: { // 아스팔트 알갱이
      for (let i = 0; i < 22; i++) px(ctx, rng.int(0, S - 1), rng.int(0, S - 1), 1, 1,
        shade(base, rng.chance(0.5) ? 0.1 : -0.1));
      break;
    }
    case GROUND.ROAD_LINE: {
      px(ctx, 0, 0, S, S, GROUND_COLOR[GROUND.ROAD]);
      px(ctx, 0, S / 2 - 1, S, 2, '#e8e2c8');
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
    case GROUND.YARD: case GROUND.PARKING: { // 주차 구획선
      px(ctx, 0, 0, 1, S, shade(base, 0.22));
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

// 건물 한 채를 통째로 그린 캔버스. 아래 끝이 건물 남쪽 벽에 맞는다.
export function buildingSprite(b) {
  const wh = wallHeight(b);
  const key = `${b.kind}|${b.w}|${b.h}|${b.floors}|${b.seed}|${b.door.dir}`;
  let hit = buildingCache.get(key);
  if (hit) return hit;

  const pw = b.w * S, ph = b.h * S + wh;
  const { canvas, ctx } = makeCanvas(pw, ph);
  const col = BUILDING_COLOR[b.kind] || BUILDING_COLOR[KIND.SHOP];
  const rng = makeRng(SEED, 'sprite', b.seed, b.kind);
  // 같은 종류라도 채마다 색을 조금씩 흔든다
  const wall = shade(col.wall, rng.range(-0.06, 0.06));
  const roof = shade(col.roof, rng.range(-0.07, 0.07));
  const trim = col.trim;
  const roofH = b.h * S;

  // 옥상
  px(ctx, 0, 0, pw, roofH, roof);
  px(ctx, 0, 0, pw, 1, shade(roof, 0.18));
  px(ctx, 0, roofH - 1, pw, 1, shade(roof, -0.2));
  drawRoofDetail(ctx, b, pw, roofH, roof, trim, col, rng);

  // 앞벽
  px(ctx, 0, roofH, pw, wh, wall);
  px(ctx, 0, roofH, pw, 1, shade(wall, 0.2));
  px(ctx, 0, ph - 2, pw, 2, shade(wall, -0.28));
  px(ctx, 0, roofH, 1, wh, shade(wall, -0.12));
  px(ctx, pw - 1, roofH, 1, wh, shade(wall, -0.12));

  drawWindows(ctx, b, pw, roofH, wh, wall, col, rng);
  drawFrontDoor(ctx, b, pw, roofH, wh, col, rng);

  hit = canvas;
  buildingCache.set(key, hit);
  buildingOrder.push(key);
  if (buildingOrder.length > BUILDING_CACHE_MAX) {
    buildingCache.delete(buildingOrder.shift());
  }
  return hit;
}

function drawRoofDetail(ctx, b, pw, roofH, roof, trim, col, rng) {
  const dark = shade(roof, -0.16), light = shade(roof, 0.12);
  switch (b.kind) {
    case KIND.APARTMENT: case KIND.TOWER: {
      // 옥상 난간 + 물탱크 + 계단탑
      px(ctx, 1, 1, pw - 2, 1, light);
      px(ctx, 1, roofH - 3, pw - 2, 1, dark);
      const tx = Math.floor(pw * 0.62), ty = Math.floor(roofH * 0.3);
      px(ctx, tx, ty, 12, 8, shade(roof, -0.25));
      px(ctx, tx + 1, ty + 1, 10, 2, light);
      px(ctx, 6, Math.floor(roofH * 0.45), 10, 9, dark);
      break;
    }
    case KIND.HOUSE: case KIND.FARMHOUSE: {
      // 경사 지붕 — 가운데 용마루
      const mid = Math.floor(roofH / 2);
      px(ctx, 0, 0, pw, mid, shade(roof, 0.1));
      px(ctx, 0, mid, pw, roofH - mid, dark);
      px(ctx, 0, mid - 1, pw, 2, shade(roof, -0.35));
      break;
    }
    case KIND.FACTORY: case KIND.WAREHOUSE: {
      // 톱날 지붕 + 환기구
      for (let x = 2; x < pw - 4; x += 10) {
        px(ctx, x, 2, 6, roofH - 5, dark);
        px(ctx, x, 2, 6, 2, col.accent);
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
      // 상가 옥상 — 난간, 실외기 줄, 물탱크, 옥상 출입문
      px(ctx, 1, 1, pw - 2, roofH - 3, shade(roof, -0.05));
      px(ctx, 1, 1, pw - 2, 1, light);
      px(ctx, 1, roofH - 3, pw - 2, 1, dark);
      for (let x = 5; x < pw - 8; x += 11) {
        if (!rng.chance(0.55)) continue;
        px(ctx, x, 5, 7, 5, shade(roof, -0.2));
        px(ctx, x + 1, 6, 5, 3, shade(roof, 0.1));
      }
      if (roofH > 26) {
        px(ctx, pw - 14, roofH - 14, 9, 8, dark);       // 옥상 출입문
        px(ctx, pw - 12, roofH - 12, 5, 5, shade(roof, 0.2));
      }
      if (roofH > 20 && rng.chance(0.6)) {
        px(ctx, 4, roofH - 13, 8, 7, shade(roof, -0.28)); // 물탱크
        px(ctx, 5, roofH - 12, 6, 2, light);
      }
    }
  }
}

function drawWindows(ctx, b, pw, roofH, wh, wall, col, rng) {
  if (b.kind === KIND.FARMHOUSE && b.w < 6) return;
  const glass = shade(col.accent, rng.range(-0.05, 0.1));
  const rows = Math.max(1, Math.min(4, Math.floor((wh - 8) / 9)));
  const step = b.kind === KIND.FACTORY || b.kind === KIND.WAREHOUSE ? 14 : 9;
  for (let r = 0; r < rows; r++) {
    const y = roofH + 4 + r * 9;
    if (y + 5 > roofH + wh - 3) break;
    for (let x = 4; x < pw - 6; x += step) {
      if (rng.chance(0.12)) continue; // 불 꺼진 창
      px(ctx, x, y, 5, 5, glass);
      px(ctx, x, y, 5, 1, shade(glass, 0.25));
      px(ctx, x, y + 4, 5, 1, shade(glass, -0.25));
    }
  }
  // 상가는 1층에 간판띠
  if ((b.kind === KIND.SHOP || b.kind === KIND.MART) && wh > 14) {
    const y = roofH + wh - 14;
    px(ctx, 1, y, pw - 2, 5, col.accent);
    px(ctx, 1, y, pw - 2, 1, shade(col.accent, 0.25));
    for (let x = 3; x < pw - 5; x += 4) px(ctx, x, y + 2, 2, 1, '#fffdf2');
  }
}

function drawFrontDoor(ctx, b, pw, roofH, wh, col, rng) {
  const doorW = Math.min(10, Math.max(5, Math.floor(pw / 5)));
  const y = roofH + wh - 9;
  const dark = shade(col.trim, -0.2);
  if (b.door.dir === 'S') {
    // 앞면 정중앙 근처 — 실제 출입구 타일 위치에 맞춘다
    const dx = Math.max(1, Math.min(pw - doorW - 1, (b.door.x - b.x) * S + (S - doorW) / 2));
    px(ctx, dx, y, doorW, 9, dark);
    px(ctx, dx + 1, y + 1, doorW - 2, 6, shade(col.accent, 0.2));
    px(ctx, dx, y + 8, doorW, 1, shade(dark, -0.3));
  } else {
    // 옆·뒷면 출입구는 앞벽에 셔터나 창고문으로 표시만 한다
    const dx = Math.floor(pw / 2) - doorW / 2;
    px(ctx, dx, y + 2, doorW, 7, shade(col.trim, -0.05));
  }
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
    case IN.EXIT: {
      px(ctx, 0, 0, S, S, INTERIOR_COLOR[IN.FLOOR]);
      px(ctx, 2, 2, 12, 12, base);
      px(ctx, 5, 5, 6, 6, shade(base, 0.3));
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
  groundCache.clear(); propCache.clear(); buildingCache.clear();
  buildingOrder.length = 0; interiorCache.clear(); gizmoCache.clear();
  npcSheets.clear(); playerSheet = null; catSprites = null; doorMat = null;
}
