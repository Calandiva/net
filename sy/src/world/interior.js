// 실내 생성 · 층 전환. 건물에 들어갈 때마다 그 층을 즉석에서 만든다.
// 모든 건물이 시드로 만들어지므로 같은 건물의 같은 층은 언제나 같은 모습이다.

import { SEED, INTERIOR, IN, IN_SOLID, KIND, ELEVATOR_KINDS } from '../config.js';
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
  // 단독주택·농막은 실내도 작다. 큰 건물만 넓게.
  const small = b.kind === KIND.HOUSE || b.kind === KIND.FARMHOUSE;
  const minW = small ? 13 : INTERIOR.minW;
  const minH = small ? 11 : INTERIOR.minH;
  const w = clampInt(Math.round(b.w * INTERIOR.scale), minW, INTERIOR.maxW);
  const h = clampInt(Math.round(b.h * INTERIOR.scale), minH, INTERIOR.maxH);
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
  if (layout === 'open' || layout === 'parking' || layout === 'mart' || layout === 'cinema') {
    fillOpen(tiles, w, h, set, get, rng, b, floor, layout, rooms);
  } else {
    // 위·아래 두 줄로 방을 나눈다
    makeRoomRow(1, corridorY - Math.floor(cw / 2), rooms, w, h, set, rng, true);
    makeRoomRow(corridorY + Math.ceil(cw / 2), h - 1, rooms, w, h, set, rng, false);
    // 출입구에서 복도까지 길을 뚫는다
    if (exit) for (let y = corridorY; y < h - 1; y++) set(exit.x, y, IN.FLOOR);
  }

  // 복도에 그 건물다운 것들을 놓는다
  decorateCorridor(b, floor, w, h, corridorY, set, get, rng);

  // 방 이름과 가구. 특수 층(마트·주차장·상영관)은 이미 이름과 배치가 정해져 있다.
  const namer = roomNamer(b, floor, rng, layout);
  rooms.forEach((room, i) => {
    if (room.custom) return;
    room.name = namer(i, room);
    furnish(room, layout, set, get, rng, b);
  });

  // 층 이동 장치 — 실제 건물처럼 계단은 늘 있고, 큰 건물에는 엘리베이터가 더 있다
  const floors = floorList(b);
  const stairs = {};
  const useElevator = b.floors >= INTERIOR.elevatorFrom ||
    (ELEVATOR_KINDS.includes(b.kind) && floors.length >= 3);
  if (floors.length > 1) {
    const idx = floors.indexOf(floor);
    const upSpot = { x: 2, y: corridorY };
    const downSpot = { x: 3, y: corridorY };
    if (idx < floors.length - 1) { set(upSpot.x, upSpot.y, IN.STAIR_UP); stairs.up = { ...upSpot }; }
    if (idx > 0) { set(downSpot.x, downSpot.y, IN.STAIR_DOWN); stairs.down = { ...downSpot }; }
    set(upSpot.x, upSpot.y + 1, IN.FLOOR);
    set(downSpot.x, downSpot.y + 1, IN.FLOOR);

    if (useElevator) {
      const elevator = { x: 5, y: corridorY };
      set(elevator.x, elevator.y, IN.ELEVATOR);
      set(elevator.x, elevator.y + 1, IN.FLOOR);
      stairs.elevator = elevator;
    }
  }

  // 어느 칸이 어느 방인지 (문을 열기 전에는 그 방이 안 보인다)
  const roomAt = new Int16Array(w * h).fill(-1);
  rooms.forEach((room, i) => {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        roomAt[y * w + x] = i;
      }
    }
    // 문이 없는 방(마트 매장·주차장 같은 통짜 공간)은 처음부터 보인다
    if (!room.door) room.seen = true;
  });

  // 상호작용 물건을 놓을 자리 — 벽에 붙은 빈 바닥
  const slots = [];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (tiles[at(x, y)] !== IN.FLOOR) continue;
      if (get(x, y - 1) === IN.WALL || get(x, y - 1) === IN.WINDOW) slots.push({ x, y });
    }
  }

  return {
    building: b, floor, w, h, tiles, rooms, spawn, exit, stairs, slots, layout, roomAt,
    // 이 칸이 지금 보이는가 (문을 안 연 방은 어둡다)
    visibleAt(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return false;
      const idx = roomAt[y * w + x];
      return idx < 0 || rooms[idx].seen;
    },
    // 방을 밝힌다
    reveal(idx) {
      if (idx >= 0 && idx < rooms.length) rooms[idx].seen = true;
    },
    roomIndexAt(x, y) {
      if (x < 0 || y < 0 || x >= w || y >= h) return -1;
      return roomAt[y * w + x];
    },
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
  // 지하는 대개 주차장이다
  if (floor < 0 && (kind === KIND.MART || kind === KIND.TOWER ||
      kind === KIND.APARTMENT || kind === KIND.PUBLIC)) return 'parking';
  if (kind === KIND.MART) return 'mart';
  // 두원타워 8·9층은 메가박스다
  if (b.floorNames && b.floorNames[floor] &&
      String(b.floorNames[floor]).includes('메가박스')) return 'cinema';
  if (kind === KIND.FACTORY || kind === KIND.WAREHOUSE) return 'open';
  if (kind === KIND.STATION && floor < 0) return 'open';
  if (kind === KIND.CHURCH && floor === 1) return 'open';
  if (kind === KIND.APARTMENT) return 'units';
  return 'rooms';
}

// 한 줄에 방을 여러 개 만든다. 복도 쪽에는 문이 달린다.
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
    set(doorX, wallY, IN.DOOR);        // 닫힌 문 — 열어야 방이 보인다
    rooms.push({ x, y: top ? y0 : y0 + 1, w: right - x, h: height - 1,
      door: { x: doorX, y: wallY }, seen: false });
    x = right + 1;
  }
}

// 넓은 한 칸짜리 층 (마트·공장·승강장·주차장·상영관)
function fillOpen(tiles, w, h, set, get, rng, b, floor, layout, rooms) {
  if (layout === 'parking') return fillParking(w, h, set, rng, rooms);
  if (layout === 'mart') return fillMart(w, h, set, rng, b, floor, rooms);
  if (layout === 'cinema') return fillCinema(w, h, set, rng, rooms);
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

// 복도 꾸미기 — 건물마다 다르게
function decorateCorridor(b, floor, w, h, corridorY, set, get, rng) {
  const put = (x, y, v) => { if (get(x, y) === IN.FLOOR) set(x, y, v); };
  switch (b.kind) {
    case KIND.SCHOOL:
      // 복도 벽을 따라 사물함
      for (let x = 7; x < w - 3; x += 2) {
        if (rng.chance(0.75)) put(x, corridorY - 1, IN.LOCKER);
      }
      break;
    case KIND.PUBLIC: case KIND.STATION:
      // 1층에는 안내 카운터
      if (floor === 1) {
        for (let x = Math.floor(w / 2) - 2; x <= Math.floor(w / 2) + 2; x++) {
          put(x, corridorY - 1, IN.COUNTER);
        }
      }
      break;
    case KIND.HOSPITAL:
      for (let x = 8; x < w - 4; x += 6) put(x, corridorY - 1, IN.COUNTER);
      break;
    case KIND.TOWER: case KIND.SHOP:
      for (let x = 8; x < w - 4; x += 7) if (rng.chance(0.5)) put(x, corridorY - 1, IN.PLANT);
      break;
    default:
      break;
  }
}

// 지하주차장 — 기둥과 주차면, 차 몇 대
function fillParking(w, h, set, rng, rooms) {
  for (let y = 3; y < h - 3; y += 6) {
    for (let x = 2; x < w - 2; x++) {
      if ((x - 2) % 7 === 0) continue;            // 차로
      if (rng.chance(0.45)) set(x, y, IN.CAR);    // 주차된 차
    }
  }
  for (let y = 4; y < h - 2; y += 7) {
    for (let x = 4; x < w - 2; x += 8) set(x, y, IN.PILLAR);
  }
  rooms.push({ x: 1, y: 1, w: w - 2, h: h - 2, name: '지하주차장', custom: true });
}

// 마트 매장 — 진열대 통로와 계산대, 카트
function fillMart(w, h, set, rng, b, floor, rooms) {
  // 계산대는 출입구 쪽(아래)에 한 줄
  for (let x = 3; x < w - 6; x += 4) {
    set(x, h - 4, IN.COUNTER);
    set(x + 1, h - 4, IN.COUNTER);
  }
  set(w - 4, h - 4, IN.CART);
  set(w - 3, h - 4, IN.CART);
  // 진열대 — 통로를 두고 줄지어
  for (let y = 3; y < h - 7; y += 3) {
    for (let x = 2; x < w - 2; x++) {
      if (x % 8 === 0 || x % 8 === 1) continue;   // 통로
      set(x, y, IN.SHELF);
    }
  }
  // 벽면 냉장고
  for (let x = 2; x < w - 2; x++) if (x % 3 !== 0) set(x, 1, IN.MACHINE);
  const use = b.floorNames && b.floorNames[floor];
  rooms.push({ x: 1, y: 1, w: w - 2, h: h - 2, name: use || '매장', custom: true });
}

// 상영관 — 매표소와 스크린, 좌석
function fillCinema(w, h, set, rng, rooms) {
  const hallW = Math.floor((w - 3) / 2);
  const midY = Math.floor(h * 0.55);
  // 로비: 매표소와 매점
  for (let x = 3; x < w - 3; x += 5) set(x, h - 3, IN.COUNTER);
  set(2, h - 3, IN.CART);

  // 상영관 둘 (왼쪽·오른쪽)
  for (let i = 0; i < 2; i++) {
    const x0 = 1 + i * (hallW + 1);
    const x1 = x0 + hallW;
    for (let y = 1; y < midY; y++) { set(x0, y, IN.WALL); set(x1, y, IN.WALL); }
    for (let x = x0; x <= x1; x++) set(x, midY, IN.WALL);
    set(x0 + Math.floor(hallW / 2), midY, IN.FLOOR);      // 상영관 문
    for (let x = x0 + 1; x < x1; x++) set(x, 1, IN.SCREEN); // 스크린
    for (let y = 3; y < midY - 1; y += 2) {
      for (let x = x0 + 1; x < x1; x++) {
        if (x === x0 + Math.floor(hallW / 2)) continue;     // 가운데 통로
        set(x, y, IN.SEAT);
      }
    }
    rooms.push({ x: x0 + 1, y: 2, w: hallW - 1, h: midY - 3,
      name: `${i + 1}관`, custom: true });
  }
  rooms.push({ x: 1, y: midY + 1, w: w - 2, h: h - midY - 2, name: '매표소', custom: true });
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

// 방에 가구 놓기 — 건물 종류마다 배치가 다르다
function furnish(room, layout, set, get, rng, b) {
  const inside = (x, y) => x > room.x && x < room.x + room.w - 1 &&
    y > room.y && y < room.y + room.h - 1;
  const put = (x, y, v) => { if (inside(x, y) && get(x, y) === IN.FLOOR) set(x, y, v); };

  // 교실 — 책상을 줄 맞춰 놓고 앞에 교탁
  if (b.kind === KIND.SCHOOL && /반$/.test(room.name || '')) {
    for (let y = room.y + 2; y < room.y + room.h - 1; y += 2) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x += 2) put(x, y, IN.DESK);
    }
    put(room.x + Math.floor(room.w / 2), room.y + 1, IN.COUNTER);
    return;
  }
  // 세대 — 현관 쪽에 신발장, 안쪽에 침대와 식탁
  if (b.kind === KIND.APARTMENT || b.kind === KIND.HOUSE) {
    put(room.x + 1, room.y + 1, IN.SHELF);
    put(room.x + room.w - 2, room.y + 1, IN.BED);
    put(room.x + Math.floor(room.w / 2), room.y + Math.floor(room.h / 2), IN.TABLE);
    if (rng.chance(0.5)) put(room.x + 1, room.y + room.h - 2, IN.PLANT);
    return;
  }
  // 사무실·민원실 — 책상을 두 줄로
  if (b.kind === KIND.PUBLIC || b.kind === KIND.TOWER || b.kind === KIND.STATION) {
    for (let y = room.y + 1; y < room.y + room.h - 1; y += 3) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x += 2) put(x, y, IN.DESK);
    }
    return;
  }

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
