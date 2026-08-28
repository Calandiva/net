// 건물 안의 사람과 사건.
//
// 층마다 시드로 정해진다. 같은 판에서 같은 건물에 다시 들어가면 같은 사람, 같은 사건이다.
// 사건은 눈에 보이는 것(연기·상자·물웅덩이)과 사람들의 말로 알 수 있다.

import { SEED, LIFE, IN, KIND } from '../config.js';
import { makeRng } from '../util/rng.js';
import { INDOOR_ROLES } from './data/npcs.js';
import { INDOOR_EVENTS } from './data/events.js';
import { itemsFor } from '../game/data/items.js';

// 이 건물, 이 층에 오늘 무슨 일이 있는가
export function pickIndoorEvent(b, floor) {
  const rng = makeRng(SEED, 'event', b.seed, b.name, floor);
  if (!rng.chance(LIFE.eventChance)) return null;
  const pool = INDOOR_EVENTS.filter((e) => !e.kinds || e.kinds.includes(b.kind));
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) return e.id === 'any-quiet' ? null : e;
  }
  return null;
}

// 사건이 남긴 흔적을 실내에 흩뿌린다
export function applyEventProps(interior, event) {
  if (!event || !event.prop) return;
  const rng = makeRng(SEED, 'eventprop', interior.building.seed, interior.floor, event.id);
  const { w, h } = interior;
  const put = (x, y, tile) => {
    if (interior.tileAt(x, y) !== IN.FLOOR) return;
    interior.setTile(x, y, tile);
  };
  const scatter = (tile, count) => {
    for (let i = 0; i < count; i++) put(rng.int(1, w - 2), rng.int(1, h - 2), tile);
  };
  switch (event.prop) {
    case 'smoke': scatter(IN.SMOKE, Math.floor(w * h * 0.05)); break;
    case 'boxes': scatter(IN.BOX, Math.floor(w * h * 0.03)); break;
    case 'puddle': scatter(IN.PUDDLE, Math.floor(w * h * 0.02)); break;
    case 'cone': scatter(IN.CONE, Math.max(3, Math.floor(w * h * 0.008))); break;
    default: break;   // dark, crowd 는 사람 수와 밝기로 표현한다
  }
}

// 이 층에 있는 사람들
export function makeIndoorPeople(b, floor, interior, event) {
  const roles = INDOOR_ROLES[b.kind];
  if (!roles || !roles.length) return [];
  const rng = makeRng(SEED, 'people', b.seed, b.name, floor);
  const crowded = event && event.prop === 'crowd';
  const people = [];

  // 카운터·기계 옆에 설 사람부터
  const spots = collectSpots(interior);
  // 방이 많으면 방 수대로, 통짜 공간(마트·주차장)이면 넓이대로
  const byRooms = Math.round(interior.rooms.length * LIFE.indoorPerRoom);
  const byArea = Math.round((interior.w * interior.h) / 260);
  const max = Math.min(LIFE.indoorMax,
    Math.max(2, Math.max(byRooms, byArea) + (crowded ? 4 : 0)));

  // 역할은 되도록 겹치지 않게 (손님·학생처럼 여럿이어도 되는 역할만 반복한다)
  let deck = rng.shuffle(roles);
  for (let i = 0; i < max; i++) {
    if (!deck.length) deck = rng.shuffle(roles.filter((r) => r.many)).concat(rng.shuffle(roles));
    const role = deck.shift();
    const spot = pickSpot(spots, role.where, rng);
    if (!spot) break;
    const lines = role.lines.slice();
    // 사건을 아는 사람은 그 이야기를 한다
    if (event && event.lines.length && rng.chance(0.62)) {
      lines.unshift(rng.pick(event.lines));
    }
    // 어떤 사람은 줄 것을 하나 들고 있다 (아이템은 사람에게서만 나온다)
    let gift = null;
    if (rng.chance(LIFE.giftChance)) {
      const pool = itemsFor(b.kind, null);
      if (pool.length) gift = rng.pick(pool).id;
    }
    people.push({
      x: (spot.x + 0.5) * 16, y: (spot.y + 0.9) * 16,
      tx: spot.x, ty: spot.y, gift,
      role: role.name, lines, seed: rng.int(0, 9999),
      dir: rng.pick(['down', 'left', 'right', 'up']),
      anim: rng.range(0, 3), moving: false,
    });
  }
  return people;
}

// 사람을 세울 만한 자리들을 모아 둔다
function collectSpots(interior) {
  const { w, h, tiles } = interior;
  const near = (x, y, kind) => {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (interior.tileAt(x + dx, y + dy) === kind) return true;
    }
    return false;
  };
  const spots = { counter: [], machine: [], room: [], corridor: [], any: [] };
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (tiles[y * w + x] !== IN.FLOOR) continue;
      if (!interior.canReach(x, y)) continue;   // 못 가는 자리에는 세우지 않는다
      const idx = interior.roomIndexAt(x, y);
      const spot = { x, y, room: idx };
      if (near(x, y, IN.COUNTER)) spots.counter.push(spot);
      else if (near(x, y, IN.MACHINE) || near(x, y, IN.SHELF)) spots.machine.push(spot);
      else if (idx >= 0) spots.room.push(spot);
      else spots.corridor.push(spot);
      spots.any.push(spot);
    }
  }
  return spots;
}

function pickSpot(spots, where, rng) {
  const order = where === 'counter' ? ['counter', 'corridor', 'any']
    : where === 'machine' ? ['machine', 'room', 'any']
    : where === 'room' ? ['room', 'any']
    : where === 'corridor' ? ['corridor', 'any']
    : ['any'];
  for (const key of order) {
    const list = spots[key];
    if (list && list.length) {
      const i = rng.int(0, list.length - 1);
      const spot = list[i];
      list.splice(i, 1);                       // 같은 자리에 둘이 서지 않게
      return spot;
    }
  }
  return null;
}
