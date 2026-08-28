// 실내 생성 · 층 전환. 건물에 들어갈 때마다 그 층을 즉석에서 만든다.
// 모든 건물이 시드로 만들어지므로 같은 건물의 같은 층은 언제나 같은 모습이다.

import { SEED, INTERIOR, IN, IN_SOLID, KIND } from '../config.js';
import { makeRng } from '../util/rng.js';
import { ROOM_NAMES } from './data/names.js';

const solidSet = new Set(IN_SOLID);

// 층 배열 (지하부터 꼭대기까지)
export function floorList(b) {
  const out = [];
  for (let f = -(b.basement || 0); f <= b.floors; f++) {
    if (f === 0) continue; // 0층은 없다
    out.push(f);
  }
  return out;
}

// 실내 한 층. 결과는 그때그때 만들고 나가면 버린다 (작아서 부담 없다).
export function makeInterior(b, floor) {
  const rng = makeRng(SEED, 'interior', b.seed, b.name, floor);
  const w = clampInt(Math.round(b.w * INTERIOR.scale), INTERIOR.minW, INTERIOR.maxW);
  const h = clampInt(Math.round(b.h * INTERIOR.scale), INTERIOR.minH, INTERIOR.maxH);
  const tiles = new Uint8Array(w * h).fill(IN.FLOOR);
  const at = (x, y) => y * w + x;
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < w && y < h) tiles[at(x, y)] = v; };
  const get = (x, y) => (x >= 0 && y >= 0 && x < w && y < h ? tiles[at(x, y)] : IN.WALL);

  // 바깥벽
  for (let x = 0; x < w; x++) { set(x, 0, IN.WALL); set(x, h - 1, IN.WALL); }
  for (let y = 0; y < h; y++) { set(0, y, IN.WALL); set(w - 1, y, IN.WALL); }
  // 창문 — 벽에 드문드문
  for (let x = 2; x < w - 2; x += 3) {
    if (rng.chance(0.55)) set(x, 0, IN.WINDOW);
    if (rng.chance(0.35)) set(x, h - 1, IN.WINDOW);
  }

  const ground = groundFloorOf(b);
  const isGround = floor === ground;
  const rooms = [];
  const layout = layoutOf(b.kind, floor, b);

  // 출입구 — 지상 1층에만
  let spawn = { x: Math.floor(w / 2), y: h - 2 };
  let exit = null;
  if (isGround) {
    const ex = Math.floor(w / 2);
    set(ex, h - 1, IN.EXIT);
    exit = { x: ex, y: h - 1 };
    spawn = { x: ex, y: h - 2 };
  }

  // 복도와 방
  const corridorY = Math.floor(h / 2);
  const cw = Math.min(INTERIOR.corridorWidth, h - 4);
  if (layout === 'open') {
    fillOpen(tiles, w, h, set, get, rng, b, floor);
  } else {
    // 위·아래 두 줄로 방을 나눈다
    makeRoomRow(1, corridorY - Math.floor(cw / 2), rooms, w, h, set, rng, true);
    makeRoomRow(corridorY + Math.ceil(cw / 2), h - 1, rooms, w, h, set, rng, false);
    // 출입구에서 복도까지 길을 뚫는다
    if (exit) for (let y = corridorY; y < h - 1; y++) set(exit.x, y, IN.FLOOR);
  }

  // 방 이름과 가구
  const namer = roomNamer(b, floor, rng, layout);
  rooms.forEach((room, i) => {
    room.name = namer(i, room);
    furnish(room, layout, set, get, rng, b);
  });

  // 층 이동 장치
  const floors = floorList(b);
  const stairs = {};
  const useElevator = b.floors >= INTERIOR.elevatorFrom;
  const spot = { x: 2, y: corridorY };
  const spot2 = { x: 3, y: corridorY };
  if (floors.length > 1) {
    const kindUp = useElevator ? IN.ELEVATOR : IN.STAIR_UP;
    const idx = floors.indexOf(floor);
    if (useElevator) {
      set(spot.x, spot.y, IN.ELEVATOR);
      stairs.elevator = { ...spot };
    } else {
      if (idx < floors.length - 1) { set(spot.x, spot.y, kindUp); stairs.up = { ...spot }; }
      if (idx > 0) { set(spot2.x, spot2.y, IN.STAIR_DOWN); stairs.down = { ...spot2 }; }
    }
    // 계단 앞은 비워 둔다
    set(spot.x, spot.y + 1, IN.FLOOR);
    set(spot2.x, spot2.y + 1, IN.FLOOR);
  }

  // 상호작용 물건을 놓을 자리 — 벽에 붙은 빈 바닥
  const slots = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (tiles[at(x, y)] !== IN.FLOOR) continue;
      if (get(x, y - 1) === IN.WALL || get(x, y - 1) === IN.WINDOW) slots.push({ x, y });
    }
  }

  return {
    building: b, floor, w, h, tiles, rooms, spawn, exit, stairs, slots, layout,
    isSolid(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return true;
      return solidSet.has(tiles[y * w + x]);
    },
    tileAt(x, y) { return get(x, y); },
    setTile(x, y, v) { set(x, y, v); },
  };
}

function clampInt(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 이 건물의 "1층" (지상 최저층)
export function groundFloorOf(b) { return 1; }

// 종류·층에 따른 실내 형태
function layoutOf(kind, floor, b) {
  if (kind === KIND.MART || kind === KIND.FACTORY || kind === KIND.WAREHOUSE) return 'open';
  if (kind === KIND.STATION && floor < 0) return 'open';
  if (kind === KIND.CHURCH && floor === 1) return 'open';
  if (kind === KIND.APARTMENT) return 'units';
  return 'rooms';
}

// 한 줄에 방을 여러 개 만든다
function makeRoomRow(y0, y1, rooms, w, h, set, rng, top) {
  const height = y1 - y0;
  if (height < INTERIOR.minRoom) return;
  let x = 1;
  while (x < w - 1) {
    const width = rng.int(INTERIOR.minRoom, INTERIOR.minRoom + 4);
    const right = Math.min(w - 1, x + width);
    if (right - x < INTERIOR.minRoom) break;
    // 방 사이 칸막이
    if (right < w - 1) for (let y = y0; y < y1; y++) set(right, y, IN.WALL);
    // 복도 쪽 벽과 문
    const doorX = x + Math.floor((right - x) / 2);
    const wallY = top ? y1 - 1 : y0;
    for (let xx = x; xx < right; xx++) set(xx, wallY, IN.WALL);
    set(doorX, wallY, IN.FLOOR);
    rooms.push({ x, y: top ? y0 : y0 + 1, w: right - x, h: height - 1, door: { x: doorX, y: wallY } });
    x = right + 1;
  }
}

// 넓은 한 칸짜리 층 (마트·공장·승강장)
function fillOpen(tiles, w, h, set, get, rng, b, floor) {
  if (b.kind === KIND.STATION && floor < 0) {
    // 승강장 — 가운데가 선로
    const railY = Math.floor(h / 2);
    for (let x = 1; x < w - 1; x++) {
      set(x, railY - 1, IN.WALL);
      set(x, railY, IN.MACHINE);
      set(x, railY + 1, IN.WALL);
    }
    for (let x = 2; x < w - 2; x += 5) set(x, railY - 2, IN.COUNTER); // 스크린도어 앞 벤치
    return;
  }
  if (b.kind === KIND.MART) {
    for (let y = 3; y < h - 3; y += 3) {
      for (let x = 2; x < w - 2; x++) {
        if (x % 9 === 0) continue; // 통로
        set(x, y, IN.SHELF);
      }
    }
    for (let x = 2; x < Math.min(w - 2, 8); x++) set(x, h - 3, IN.COUNTER);
    return;
  }
  if (b.kind === KIND.CHURCH) {
    for (let y = 3; y < h - 3; y += 2) {
      for (let x = 3; x < w - 3; x++) {
        if (x === Math.floor(w / 2)) continue;
        set(x, y, IN.TABLE);
      }
    }
    return;
  }
  // 공장·창고 — 기계와 자재
  for (let y = 3; y < h - 3; y += 4) {
    for (let x = 3; x < w - 3; x += 5) {
      if (rng.chance(0.7)) set(x, y, IN.MACHINE);
      if (rng.chance(0.3)) set(x + 1, y, IN.SHELF);
    }
  }
}

// 방 이름 짓기
function roomNamer(b, floor, rng, layout) {
  if (b.kind === KIND.APARTMENT || (b.kind === KIND.TOWER && floor >= 4)) {
    return (i) => `${Math.max(1, floor)}${String(i + 1).padStart(2, '0')}호`;
  }
  if (b.kind === KIND.SCHOOL) {
    const pool = rng.shuffle(ROOM_NAMES.school);
    return (i) => (i < 3 && floor > 1 ? `${floor - 1}학년 ${i + 1}반` : pool[i % pool.length]);
  }
  if (b.kind === KIND.STATION) {
    const pool = rng.shuffle(ROOM_NAMES.station);
    return (i) => pool[i % pool.length];
  }
  if (b.name && b.name.includes('도서관')) {
    const pool = rng.shuffle(ROOM_NAMES.library);
    return (i) => pool[i % pool.length];
  }
  if (b.kind === KIND.PUBLIC) {
    const pool = rng.shuffle(ROOM_NAMES.public);
    return (i) => pool[i % pool.length];
  }
  if (b.kind === KIND.HOSPITAL) {
    const pool = rng.shuffle(ROOM_NAMES.hospital);
    return (i) => pool[i % pool.length];
  }
  if (b.kind === KIND.FACTORY || b.kind === KIND.WAREHOUSE) {
    const pool = rng.shuffle(ROOM_NAMES.factory);
    return (i) => pool[i % pool.length];
  }
  if (b.kind === KIND.MART) {
    const pool = rng.shuffle(ROOM_NAMES.mart);
    return (i) => pool[i % pool.length];
  }
  if (b.kind === KIND.SHOP || b.kind === KIND.TOWER) {
    // 상가는 호실 번호로 부른다 (301호, 302호 …)
    return (i) => `${Math.max(1, floor)}${String(i + 1).padStart(2, '0')}호`;
  }
  if (b.kind === KIND.HOUSE || b.kind === KIND.FARMHOUSE) {
    return (i) => ['거실', '안방', '작은방', '주방', '창고'][i % 5];
  }
  const pool = rng.shuffle(ROOM_NAMES.office);
  return (i) => pool[i % pool.length];
}

// 방에 가구 놓기
function furnish(room, layout, set, get, rng, b) {
  const inside = (x, y) => x > room.x && x < room.x + room.w - 1 &&
    y > room.y && y < room.y + room.h - 1;
  const put = (x, y, v) => { if (inside(x, y) && get(x, y) === IN.FLOOR) set(x, y, v); };

  const kit = furnitureKit(b.kind, room.name);
  const count = Math.max(1, Math.floor(room.w * room.h * 0.16));
  for (let i = 0; i < count; i++) {
    const x = rng.int(room.x + 1, room.x + room.w - 2);
    const y = rng.int(room.y + 1, room.y + room.h - 2);
    put(x, y, rng.pick(kit));
  }
  if (rng.chance(0.4)) put(room.x + 1, room.y + 1, IN.PLANT);
  if (rng.chance(0.3)) put(room.x + room.w - 2, room.y + room.h - 2, IN.RUG);
}

function furnitureKit(kind, roomName) {
  switch (kind) {
    case KIND.APARTMENT: case KIND.HOUSE: case KIND.FARMHOUSE:
      return [IN.BED, IN.TABLE, IN.SHELF, IN.RUG];
    case KIND.SCHOOL: return [IN.DESK, IN.DESK, IN.SHELF];
    case KIND.HOSPITAL: return [IN.BED, IN.DESK, IN.MACHINE];
    case KIND.PUBLIC: case KIND.STATION: return [IN.DESK, IN.COUNTER, IN.SHELF];
    case KIND.SHOP: case KIND.TOWER: case KIND.MART: return [IN.SHELF, IN.TABLE, IN.COUNTER];
    case KIND.FACTORY: case KIND.WAREHOUSE: return [IN.MACHINE, IN.SHELF];
    case KIND.CHURCH: return [IN.TABLE, IN.PLANT];
    default: return [IN.DESK, IN.SHELF, IN.TABLE];
  }
}
