// 자동 이동을 위한 길찾기. 지도를 눌러 목적지를 찍으면 여기서 길을 만든다.
//
// 세상 전체를 한 번에 탐색하면 청크를 통째로 만들게 되니(느리다),
// 플레이어 둘레의 창(window) 안에서만 A* 를 돌리고, 걸어가면서 다시 찾는다.
// 목적지가 창 밖이면 창 안에서 목적지에 가장 가까운 칸까지만 간다.

import { PATHING } from '../config.js';

const NEIGHBORS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414],
];

// from → to 로 가는 타일 목록. 못 가면 가장 가까이 간 데까지 돌려준다.
// 반환: [{x, y}, …] (출발 칸은 빼고). 한 발짝도 못 가면 빈 배열.
export function findPath(map, from, to) {
  const half = PATHING.window;
  const minX = Math.min(from.x, to.x) - half, maxX = Math.max(from.x, to.x) + half;
  const minY = Math.min(from.y, to.y) - half, maxY = Math.max(from.y, to.y) + half;
  const clampX = (x) => Math.max(from.x - half, Math.min(from.x + half, x));
  const clampY = (y) => Math.max(from.y - half, Math.min(from.y + half, y));
  // 창은 플레이어 둘레로 제한한다 (먼 목적지는 나눠서 간다)
  const lo = { x: Math.max(minX, from.x - half), y: Math.max(minY, from.y - half) };
  const hi = { x: Math.min(maxX, from.x + half), y: Math.min(maxY, from.y + half) };
  const goal = { x: clampX(to.x), y: clampY(to.y) };

  const key = (x, y) => (y - lo.y) * (hi.x - lo.x + 1) + (x - lo.x);
  const cost = new Map();      // key → 지금까지의 거리
  const cameFrom = new Map();  // key → 이전 key
  const px = new Map();        // key → 좌표
  const open = new BinaryHeap();

  const h = (x, y) => Math.hypot(x - goal.x, y - goal.y);
  const startKey = key(from.x, from.y);
  cost.set(startKey, 0);
  px.set(startKey, from);
  open.push(startKey, h(from.x, from.y));

  let best = startKey, bestH = h(from.x, from.y);
  let expanded = 0;

  while (open.size && expanded < PATHING.maxNodes) {
    const cur = open.pop();
    const p = px.get(cur);
    expanded++;
    const dh = h(p.x, p.y);
    if (dh < bestH) { bestH = dh; best = cur; }
    if (p.x === goal.x && p.y === goal.y) { best = cur; break; }

    const g = cost.get(cur);
    for (const [dx, dy, w] of NEIGHBORS) {
      const nx = p.x + dx, ny = p.y + dy;
      if (nx < lo.x || nx > hi.x || ny < lo.y || ny > hi.y) continue;
      if (map.isSolid(nx, ny)) continue;
      // 대각선은 양옆이 다 뚫려 있을 때만 (모서리를 파고들지 않게)
      if (dx && dy && (map.isSolid(p.x + dx, p.y) || map.isSolid(p.x, p.y + dy))) continue;
      const nk = key(nx, ny);
      const ng = g + w + tileCost(map, nx, ny);
      if (cost.has(nk) && cost.get(nk) <= ng) continue;
      cost.set(nk, ng);
      cameFrom.set(nk, cur);
      px.set(nk, { x: nx, y: ny });
      open.push(nk, ng + h(nx, ny) * PATHING.heuristicWeight);
    }
  }

  // 되짚어 올라가며 길을 만든다
  const path = [];
  let node = best;
  while (node !== undefined && node !== startKey) {
    path.push(px.get(node));
    node = cameFrom.get(node);
  }
  path.reverse();
  return path;
}

// 인도나 길 위로 다니는 편이 자연스럽다 — 논밭·풀밭은 조금 비싸게 친다
function tileCost(map, x, y) {
  const t = map.tileAt(x, y);
  if (!t) return 0;
  return PATHING.groundCost[t.ground] || 0;
}

// 작은 이진 힙 (외부 라이브러리를 쓰지 않는다)
class BinaryHeap {
  constructor() { this.items = []; this.scores = []; }
  get size() { return this.items.length; }
  push(item, score) {
    this.items.push(item); this.scores.push(score);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.scores[parent] <= this.scores[i]) break;
      this.swap(parent, i); i = parent;
    }
  }
  pop() {
    const top = this.items[0];
    const item = this.items.pop(), score = this.scores.pop();
    if (this.items.length) {
      this.items[0] = item; this.scores[0] = score;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < this.items.length && this.scores[l] < this.scores[s]) s = l;
        if (r < this.items.length && this.scores[r] < this.scores[s]) s = r;
        if (s === i) break;
        this.swap(s, i); i = s;
      }
    }
    return top;
  }
  swap(a, b) {
    const it = this.items[a]; this.items[a] = this.items[b]; this.items[b] = it;
    const sc = this.scores[a]; this.scores[a] = this.scores[b]; this.scores[b] = sc;
  }
}
